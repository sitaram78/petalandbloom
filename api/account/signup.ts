import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';

/**
 * Server-side customer registration endpoint.
 * Bypasses Supabase SMTP email rate limits by creating and auto-confirming
 * the customer account with full profile, welcome points, and order linking.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const { email, password, fullName, phone } = req.body || {};

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'A valid 10-digit mobile number is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Create User via Supabase Admin (bypasses client-side rate limits & auto-confirms email)
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        phone: cleanPhone,
        role: 'customer',
      },
    });

    if (createErr) {
      const msg = createErr.message || '';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists. Please sign in instead.',
        });
      }
      return res.status(400).json({ success: false, message: msg });
    }

    if (!userData?.user) {
      return res.status(500).json({ success: false, message: 'Failed to create user account.' });
    }

    const userId = userData.user.id;

    // 2. Ensure customer profile is recorded with role='customer'
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: cleanEmail,
      full_name: fullName.trim(),
      phone: cleanPhone,
      role: 'customer',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // 3. Ensure Loyalty Account exists with 50 Welcome Points
    const { data: existingLoyalty } = await supabaseAdmin
      .from('loyalty_accounts')
      .select('id, points_balance')
      .eq('customer_id', userId)
      .maybeSingle();

    if (!existingLoyalty) {
      await supabaseAdmin.from('loyalty_accounts').insert({
        customer_id: userId,
        points_balance: 50,
        lifetime_points_earned: 50,
        tier: 'FLORET',
      });

      await supabaseAdmin.from('loyalty_transactions').insert({
        customer_id: userId,
        type: 'WELCOME_BONUS',
        points: 50,
        description: 'Welcome to The Petal & Bloom: 50 points gift',
      });
    }

    // 4. Automatically link any previous guest orders made with this phone or email
    try {
      await supabaseAdmin
        .from('orders')
        .update({ customer_id: userId })
        .eq('customer_id', null)
        .or(`guest_email.ilike.${cleanEmail},guest_phone.ilike.%${cleanPhone}%`);
    } catch {
      // Non-blocking order link
    }

    return res.status(200).json({
      success: true,
      message: 'Account created successfully. 50 Petal Points have been credited!',
      user: {
        id: userId,
        email: cleanEmail,
      },
    });
  } catch (err: any) {
    console.error('[API Signup Error]', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'An error occurred during account registration.',
    });
  }
}
