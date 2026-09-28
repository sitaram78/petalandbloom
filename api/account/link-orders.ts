import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseServer } from '../lib/supabaseServer';

/**
 * Associates prior guest orders placed with the user's phone or email to their registered user account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email, phone } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    let linkedCount = 0;

    // Link by email
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabaseServer
        .from('orders')
        .update({ customer_id: userId })
        .eq('customer_id', null)
        .ilike('guest_email', cleanEmail)
        .select('id');

      if (!error && data) {
        linkedCount += data.length;
      }
    }

    // Link by phone
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
      const { data, error } = await supabaseServer
        .from('orders')
        .update({ customer_id: userId })
        .eq('customer_id', null)
        .ilike('guest_phone', `%${cleanPhone}%`)
        .select('id');

      if (!error && data) {
        linkedCount += data.length;
      }
    }

    return res.status(200).json({
      success: true,
      linkedOrdersCount: linkedCount,
    });
  } catch (error: any) {
    console.error('[Link Orders Error]:', error);
    return res.status(500).json({
      error: 'Failed to link guest orders',
      message: error.message,
    });
  }
}
