import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { requireAuth } from '../../lib/authMiddleware';
import { logAuditEvent, AUDIT_ACTIONS } from '../../lib/auditService';
import { sendDispatchEmail } from '../../lib/emailService';
import { generateTrackingUrl, CarrierType } from '../../../src/services/shippingService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // 1. Authenticate Staff Member
  const authUser = await requireAuth(req, res, {
    allowedRoles: ['super_admin', 'admin', 'operations'],
  });
  if (!authUser) return;

  try {
    const {
      orderId,
      newStatus,
      statusNote,
      carrier = 'DELHIVERY',
      awbNumber,
      customTrackingUrl,
    } = req.body || {};

    if (!orderId || !newStatus) {
      return res.status(400).json({ success: false, message: 'orderId and newStatus are required.' });
    }

    // 2. Fetch existing order (safely checking UUID vs order_number)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let orderQuery = supabaseAdmin
      .from('orders')
      .select('id, order_number, order_status, payment_status, applied_coupon_code, customer_id, guest_phone, discount_in_paise, guest_name, guest_email, shipping_address_snapshot');

    if (isUuid) {
      orderQuery = orderQuery.eq('id', orderId);
    } else {
      orderQuery = orderQuery.eq('order_number', orderId);
    }
    const { data: order, error: fetchErr } = await orderQuery.maybeSingle();

    if (fetchErr) {
      console.error('[Admin Update Status Fetch Error]:', fetchErr);
      return res.status(500).json({ success: false, message: fetchErr.message || 'Database connection error.', error: fetchErr.message || 'Database connection error.' });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.', error: 'Order not found.' });
    }

    const previousStatus = order.order_status;

    // 3. Update order status and synchronize payment_status
    const isPaidStatus = [
      'PAYMENT_CONFIRMED',
      'ORDER_CONFIRMED',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED'
    ].includes(newStatus);

    const updatePayload: Record<string, any> = {
      order_status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (isPaidStatus) {
      updatePayload.payment_status = 'SUCCESS';
    }

    const { error: updateErr } = await supabaseAdmin
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateErr) {
      throw updateErr;
    }

    // 3b. Sync payment and coupon tracking if confirmed
    if (isPaidStatus) {
      try {
        const { data: existingPayment } = await supabaseAdmin
          .from('payments')
          .select('id, status')
          .eq('order_id', order.id)
          .maybeSingle();

        if (existingPayment) {
          if (existingPayment.status !== 'SUCCESS') {
            await supabaseAdmin
              .from('payments')
              .update({ status: 'SUCCESS', updated_at: new Date().toISOString() })
              .eq('id', existingPayment.id);
          }
        } else {
          await supabaseAdmin.from('payments').insert({
            order_id: order.id,
            amount_in_paise: 0,
            status: 'SUCCESS',
            payment_method: 'ADMIN_CONFIRMED',
          });
        }
      } catch (payErr) {
        console.warn('[Admin Update Status Payment Sync Warning]:', payErr);
      }

      if (order.applied_coupon_code) {
        try {
          const { data: coupon } = await supabaseAdmin
            .from('coupons')
            .select('id, usage_count')
            .eq('code', order.applied_coupon_code)
            .maybeSingle();

          if (coupon) {
            const { data: existingRedemption } = await supabaseAdmin
              .from('coupon_redemptions')
              .select('id')
              .eq('order_id', order.id)
              .eq('coupon_id', coupon.id)
              .maybeSingle();

            if (!existingRedemption) {
              await supabaseAdmin
                .from('coupons')
                .update({ usage_count: (coupon.usage_count || 0) + 1 })
                .eq('id', coupon.id);

              await supabaseAdmin.from('coupon_redemptions').insert({
                coupon_id: coupon.id,
                order_id: order.id,
                customer_id: order.customer_id,
                customer_phone: order.guest_phone,
                discount_applied_in_paise: order.discount_in_paise || 0,
              });
            }
          }
        } catch (couponErr) {
          console.warn('[Admin Update Status Coupon Sync Warning]:', couponErr);
        }
      }
    }

    // 4. Record in order_status_history
    const noteText = statusNote?.trim() || `Status updated to ${newStatus} by ${authUser.email}`;
    try {
      await supabaseAdmin.from('order_status_history').insert({
        order_id: order.id,
        previous_status: previousStatus,
        new_status: newStatus,
        note: noteText,
        created_by: authUser.email,
      });
    } catch (histErr) {
      console.warn('[Admin Update Status History Warning]:', histErr);
    }

    // 5. Handle shipments if SHIPPED or AWB provided
    let finalTrackingUrl = '';
    if (newStatus === 'SHIPPED' || awbNumber?.trim()) {
      try {
        const cleanAwb = (awbNumber || '').trim();
        finalTrackingUrl =
          (customTrackingUrl || '').trim() ||
          generateTrackingUrl(carrier as CarrierType, cleanAwb) ||
          `https://thepetalandbloom.vercel.app/track?order_id=${order.order_number}`;

        const { data: existingShip } = await supabaseAdmin
          .from('shipments')
          .select('id')
          .eq('order_id', order.id)
          .maybeSingle();

        if (existingShip) {
          await supabaseAdmin
            .from('shipments')
            .update({
              carrier,
              awb_number: cleanAwb || null,
              tracking_url: finalTrackingUrl || null,
              status: newStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingShip.id);
        } else {
          await supabaseAdmin.from('shipments').insert({
            order_id: order.id,
            carrier,
            awb_number: cleanAwb || null,
            tracking_url: finalTrackingUrl || null,
            status: newStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
          });
        }

        // Send dispatch notification email if customer email exists
        if (newStatus === 'SHIPPED' && order.guest_email && cleanAwb) {
          try {
            await sendDispatchEmail({
              to: order.guest_email,
              name: order.guest_name || 'Valued Collector',
              orderNumber: order.order_number,
              carrier,
              awbNumber: cleanAwb,
              trackingUrl: finalTrackingUrl,
              estimatedDelivery: '3–5 business days',
              shippingAddress: order.shipping_address_snapshot || {
                addressLine1: 'Address on file',
                city: '',
                state: '',
                pincode: '',
              },
            });
          } catch (emailErr) {
            console.warn('[Dispatch Email Warning]:', emailErr);
          }
        }
      } catch (shipErr) {
        console.warn('[Admin Update Status Shipment Warning]:', shipErr);
      }
    }

    // 6. Server-Enforced Tamper-Proof Audit Logging
    try {
      await logAuditEvent({
        actor_id: authUser.id,
        actor_email: authUser.email,
        actor_role: authUser.role,
        action: newStatus === 'CANCELLED' ? AUDIT_ACTIONS.ORDER_CANCELLED : AUDIT_ACTIONS.ORDER_STATUS_TRANSITION,
        entity: 'orders',
        entity_id: order.order_number,
        old_values: { order_status: previousStatus },
        new_values: {
          order_status: newStatus,
          carrier,
          awb_number: awbNumber?.trim() || null,
          tracking_url: finalTrackingUrl || null,
        },
        reason: noteText,
      });
    } catch (auditErr) {
      console.warn('[Admin Update Status Audit Warning]:', auditErr);
    }

    return res.status(200).json({
      success: true,
      orderNumber: order.order_number,
      previousStatus,
      newStatus,
      message: `Order ${order.order_number} successfully transitioned to ${newStatus}.`,
    });
  } catch (err: any) {
    console.error('[Admin Order Update Error]:', err);
    const msg = err.message || 'Failed to update order status.';
    return res.status(500).json({ success: false, message: msg, error: msg });
  }
}
