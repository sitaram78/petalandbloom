import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { requireAuth } from '../../lib/authMiddleware';

/**
 * Securely associates prior guest orders placed with the user's phone or email
 * to their verified registered user account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enforce customer authentication - user can ONLY link orders to their own verified account
  const authUser = await requireAuth(req, res);
  if (!authUser) return;

  try {
    const { email, phone } = req.body || {};
    const userId = authUser.id; // Strictly bound to authenticated session

    let linkedCount = 0;
    const lookupEmail = email?.trim().toLowerCase() || authUser.email;
    const lookupPhone = phone?.trim().replace(/\D/g, '').slice(-10) || (authUser.phone ? authUser.phone.replace(/\D/g, '').slice(-10) : null);

    // Link by email
    if (lookupEmail) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ customer_id: userId })
        .eq('customer_id', null)
        .ilike('guest_email', lookupEmail)
        .select('id');

      if (!error && data) {
        linkedCount += data.length;
      }
    }

    // Link by phone
    if (lookupPhone) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ customer_id: userId })
        .eq('customer_id', null)
        .ilike('guest_phone', `%${lookupPhone}%`)
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
