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
    // Strictly bind to the authenticated caller's verified email and phone
    let verifiedEmail = authUser.email ? authUser.email.trim().toLowerCase() : '';
    let verifiedPhone = authUser.phone ? authUser.phone.replace(/\D/g, '').slice(-10) : '';

    if (!verifiedPhone || !verifiedEmail) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, phone')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        if (!verifiedEmail && profile.email) verifiedEmail = profile.email.trim().toLowerCase();
        if (!verifiedPhone && profile.phone) verifiedPhone = profile.phone.replace(/\D/g, '').slice(-10);
      }
    }

    if (!verifiedEmail && !verifiedPhone) {
      return res.status(400).json({
        success: false,
        message: 'No verified phone number or email found on your account to associate past orders.',
      });
    }

    // Link by verified email
    if (verifiedEmail) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ customer_id: userId })
        .is('customer_id', null)
        .ilike('guest_email', verifiedEmail)
        .select('id');

      if (!error && data) {
        linkedCount += data.length;
      }
    }

    // Link by verified phone
    if (verifiedPhone && verifiedPhone.length === 10) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ customer_id: userId })
        .is('customer_id', null)
        .ilike('guest_phone', `%${verifiedPhone}%`)
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
