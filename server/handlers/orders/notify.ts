import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { sendDispatchEmail } from '../../lib/emailService';
import { requireAuth } from '../../lib/authMiddleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // Enforce staff/admin authentication
  const authUser = await requireAuth(req, res, { allowedRoles: ['super_admin', 'admin', 'operations'] });
  if (!authUser) return;

  try {
    const { orderId, awbNumber, carrier, trackingUrl, estimatedDelivery } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required.' });
    }

    // Fetch order details
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_number,
        guest_name,
        guest_phone,
        guest_email,
        shipping_address_snapshot,
        order_status
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const cleanPhone = (order.guest_phone || '').replace(/\D/g, '').slice(-10);
    const trackingLink = trackingUrl || `https://thepetalandbloom.vercel.app/track?order_id=${order.order_number}`;

    // 1. Send Dispatch Email if customer email is on record
    let emailSent = false;
    if (order.guest_email) {
      emailSent = await sendDispatchEmail({
        to: order.guest_email,
        name: order.guest_name,
        orderNumber: order.order_number,
        carrier: carrier || 'Studio Express Courier',
        awbNumber: awbNumber || 'TPB-DIRECT',
        trackingUrl: trackingLink,
        estimatedDelivery: estimatedDelivery || '3–5 business days',
        shippingAddress: order.shipping_address_snapshot || {
          addressLine1: 'Address on file',
          city: '',
          state: '',
          pincode: '',
        },
      });
    }

    // 2. Generate WhatsApp concierge dispatch text for 1-click admin send
    const waText = [
      `🌸 *The Petal & Bloom Studio Dispatch*`,
      ``,
      `Dear ${order.guest_name},`,
      `Your bespoke blooms for Order *${order.order_number}* have been crafted and safely packed!`,
      ``,
      carrier && `📦 *Courier:* ${carrier}`,
      awbNumber && `🔢 *AWB Number:* ${awbNumber}`,
      `📍 *Track Live:* ${trackingLink}`,
      ``,
      `Thank you for letting us create something meaningful for you! If you have any delivery requests, feel free to reply directly here. ✨`,
    ].filter(Boolean).join('\n');

    const whatsappLink = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waText)}`;

    return res.status(200).json({
      success: true,
      message: 'Notification processed successfully.',
      emailSent,
      whatsappLink,
      recipientPhone: cleanPhone,
    });
  } catch (err: any) {
    console.error('[Notify API Error]', err);
    return res.status(500).json({ success: false, message: err.message || 'Notification failed.' });
  }
}
