import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../_lib/supabaseServer';
import { requireAuth } from '../../../_lib/authMiddleware';
import { logAuditEvent, AUDIT_ACTIONS } from '../../../_lib/auditService';
import { generateTrackingUrl, CarrierType } from '../../../../src/services/shippingService';

export interface AdminCreateOrderItem {
  productCode?: string;
  productName: string;
  unitPriceInRupees: number;
  quantity: number;
  selectedColor?: string;
  giftWrap?: boolean;
  personalMessage?: string;
  itemImage?: string;
}

export interface AdminCreateOrderRequest {
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  shippingAddress: {
    recipientName?: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: AdminCreateOrderItem[];
  discountInRupees?: number;
  shippingFeeInRupees?: number;
  orderStatus?: string;
  paymentStatus?: 'SUCCESS' | 'PENDING' | 'FAILED';
  paymentMethod?: string;
  orderDate?: string;
  adminNote?: string;
  shipment?: {
    carrier?: CarrierType;
    awbNumber?: string;
    customTrackingUrl?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // 1. Authenticate Staff Member (Super Admin, Admin, Operations)
  const authUser = await requireAuth(req, res, {
    allowedRoles: ['super_admin', 'admin', 'operations'],
  });
  if (!authUser) return;

  try {
    const body = (req.body || {}) as AdminCreateOrderRequest;
    const {
      customer,
      shippingAddress,
      items,
      discountInRupees = 0,
      shippingFeeInRupees = 0,
      orderStatus,
      paymentStatus = 'SUCCESS',
      paymentMethod = 'MANUAL_UPI',
      orderDate,
      adminNote,
      shipment,
    } = body;

    // 2. Validate Customer Details
    if (!customer?.name?.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }

    const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'A valid 10-digit Indian mobile number is required.',
      });
    }

    const cleanEmail = customer.email?.trim() || null;
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid customer email address format.' });
    }

    // 3. Validate Delivery Address
    if (!shippingAddress?.addressLine1?.trim() || !shippingAddress?.city?.trim() || !shippingAddress?.state?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Complete shipping address (Address Line 1, City, State) is required.',
      });
    }

    const cleanPincode = (shippingAddress.pincode || '').replace(/\D/g, '');
    if (cleanPincode.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'A valid 6-digit postal PIN code is required.',
      });
    }

    // 4. Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one purchased item is required.' });
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productName?.trim()) {
        return res.status(400).json({ success: false, message: `Item #${i + 1} is missing product name.` });
      }
      if (typeof it.unitPriceInRupees !== 'number' || it.unitPriceInRupees < 0) {
        return res.status(400).json({
          success: false,
          message: `Item #${i + 1} (${it.productName}) has an invalid unit price.`,
        });
      }
      if (!it.quantity || it.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Item #${i + 1} (${it.productName}) must have a quantity of at least 1.`,
        });
      }
    }

    // 5. Authoritative Financial Calculations (Paise Integer Precision)
    const subtotalInPaise = items.reduce((acc, it) => {
      const unitPaise = Math.round(Number(it.unitPriceInRupees) * 100);
      return acc + unitPaise * Number(it.quantity);
    }, 0);

    const discountInPaise = Math.max(0, Math.round(Number(discountInRupees) * 100));
    const shippingFeeInPaise = Math.max(0, Math.round(Number(shippingFeeInRupees) * 100));
    const totalInPaise = Math.max(0, subtotalInPaise - discountInPaise + shippingFeeInPaise);

    // 6. Patron Account Resolution (Auto-link customer_id if user exists in database)
    let linkedCustomerId: string | null = null;
    try {
      // Check customer_profiles or auth.users
      const { data: profile } = await supabaseAdmin
        .from('customer_profiles')
        .select('id, user_id, phone, email')
        .or(`phone.eq.${cleanPhone}${cleanEmail ? `,email.eq.${cleanEmail}` : ''}`)
        .maybeSingle();

      if (profile?.user_id) {
        linkedCustomerId = profile.user_id;
      } else if (profile?.id) {
        linkedCustomerId = profile.id;
      }
    } catch (profileErr) {
      console.warn('[Admin Create Order Customer Link Notice]:', profileErr);
    }

    // 7. Order Reference and Timestamp Resolution
    const orderNumber = `TPB-ADM-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    let createdAt = new Date().toISOString();
    if (orderDate && !isNaN(new Date(orderDate).getTime())) {
      createdAt = new Date(orderDate).toISOString();
    }

    // 8. Determine Default Order Status
    let finalOrderStatus = orderStatus;
    if (!finalOrderStatus) {
      if (paymentStatus === 'SUCCESS') {
        finalOrderStatus = 'PAYMENT_CONFIRMED';
      } else {
        finalOrderStatus = 'PENDING_PAYMENT';
      }
    }

    const addressSnapshot = {
      recipientName: shippingAddress.recipientName?.trim() || customer.name.trim(),
      phone: (shippingAddress.phone || '').replace(/\D/g, '').slice(-10) || cleanPhone,
      addressLine1: shippingAddress.addressLine1.trim(),
      addressLine2: (shippingAddress.addressLine2 || '').trim(),
      city: shippingAddress.city.trim(),
      state: shippingAddress.state.trim(),
      pincode: cleanPincode,
    };

    // 9. Insert Order into Supabase
    const { data: newOrder, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: linkedCustomerId,
        guest_name: customer.name.trim(),
        guest_phone: cleanPhone,
        guest_email: cleanEmail,
        shipping_address_snapshot: addressSnapshot,
        subtotal_in_paise: subtotalInPaise,
        discount_in_paise: discountInPaise,
        loyalty_points_redeemed: 0,
        loyalty_discount_in_paise: 0,
        shipping_fee_in_paise: shippingFeeInPaise,
        total_in_paise: totalInPaise,
        order_status: finalOrderStatus,
        payment_status: paymentStatus,
        customer_note: adminNote?.trim() || 'Recorded manually from offline studio purchase.',
        created_at: createdAt,
      })
      .select('id, order_number, order_status, payment_status, total_in_paise, created_at')
      .single();

    if (orderErr || !newOrder) {
      console.error('[Admin Create Order Database Error]:', orderErr);
      return res.status(500).json({
        success: false,
        message: orderErr?.message || 'Failed to save order to database.',
        error: orderErr,
      });
    }

    // 10. Insert Order Items
    const itemsPayload = items.map((it, idx) => {
      const unitPaise = Math.round(Number(it.unitPriceInRupees) * 100);
      const totalPaise = unitPaise * Number(it.quantity);
      const code = it.productCode?.trim() || `BESPOKE-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;

      return {
        order_id: newOrder.id,
        product_code: code,
        product_name: it.productName.trim(),
        unit_price_in_paise: unitPaise,
        quantity: Number(it.quantity),
        total_price_in_paise: totalPaise,
        selected_color: it.selectedColor?.trim() || null,
        gift_wrap: Boolean(it.giftWrap),
        personal_message: it.personalMessage?.trim() || null,
        item_image: it.itemImage || null,
      };
    });

    const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(itemsPayload);
    if (itemsErr) {
      console.error('[Admin Create Order Items Error]:', itemsErr);
    }

    // 11. Initial Entry in Order Status History
    try {
      await supabaseAdmin.from('order_status_history').insert({
        order_id: newOrder.id,
        previous_status: null,
        new_status: finalOrderStatus,
        note: `Order recorded manually by ${authUser.email}. ${adminNote ? `Note: ${adminNote.trim()}` : ''}`.trim(),
        created_by: authUser.email,
        created_at: createdAt,
      });
    } catch (histErr) {
      console.warn('[Admin Create Order History Warning]:', histErr);
    }

    // 12. Handle Optional Courier & Shipment Recording (Delhivery / Surface)
    const carrier = shipment?.carrier || 'DELHIVERY';
    const cleanAwb = (shipment?.awbNumber || '').trim();
    if (cleanAwb || finalOrderStatus === 'SHIPPED' || finalOrderStatus === 'DELIVERED') {
      try {
        const trackingUrl =
          shipment?.customTrackingUrl?.trim() ||
          generateTrackingUrl(carrier as CarrierType, cleanAwb) ||
          (cleanAwb ? `https://www.delhivery.com/track/package/${encodeURIComponent(cleanAwb)}` : '');

        await supabaseAdmin.from('shipments').insert({
          order_id: newOrder.id,
          carrier,
          awb_number: cleanAwb || null,
          tracking_url: trackingUrl || null,
          status: finalOrderStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
          created_at: createdAt,
        });
      } catch (shipErr) {
        console.warn('[Admin Create Order Shipment Warning]:', shipErr);
      }
    }

    // 13. Synchronize Payment Record
    try {
      await supabaseAdmin.from('payments').insert({
        order_id: newOrder.id,
        amount_in_paise: totalInPaise,
        status: paymentStatus,
        payment_method: paymentMethod || 'MANUAL_UPI',
        created_at: createdAt,
      });
    } catch (payErr) {
      console.warn('[Admin Create Order Payment Warning]:', payErr);
    }

    // 14. Server-Enforced Tamper-Proof Audit Logging
    try {
      await logAuditEvent({
        actor_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.role,
        action: 'ORDER_MANUALLY_RECORDED',
        entity: 'orders',
        entity_id: newOrder.order_number,
        new_values: {
          order_number: newOrder.order_number,
          total_in_rupees: totalInPaise / 100,
          customer_name: customer.name.trim(),
          customer_phone: cleanPhone,
          items_count: items.length,
          order_status: finalOrderStatus,
          payment_status: paymentStatus,
          carrier: cleanAwb ? carrier : null,
          awb_number: cleanAwb || null,
        },
        reason: adminNote?.trim() || 'Manual offline sale recorded by studio admin',
      });
    } catch (auditErr) {
      console.warn('[Admin Create Order Audit Warning]:', auditErr);
    }

    return res.status(201).json({
      success: true,
      message: `Order #${newOrder.order_number} successfully recorded in atelier archive.`,
      order: {
        id: newOrder.id,
        orderNumber: newOrder.order_number,
        orderStatus: newOrder.order_status,
        paymentStatus: newOrder.payment_status,
        totalInRupees: newOrder.total_in_paise / 100,
        createdAt: newOrder.created_at,
      },
    });
  } catch (err: any) {
    console.error('[Admin Order Creation Exception]:', err);
    const msg = err.message || 'Failed to record manual order.';
    return res.status(500).json({ success: false, message: msg, error: msg });
  }
}
