import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../_lib/supabaseServer';
import { requireAuth, UserRole, ROLE_DEFAULT_PERMISSIONS } from '../../../_lib/authMiddleware';
import { logAuditEvent, AUDIT_ACTIONS } from '../../../_lib/auditService';

const ALLOWED_STAFF_ROLES: UserRole[] = ['super_admin', 'admin', 'operations', 'support', 'marketing'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  // 1. Enforce Authentication & Staff Management Capability
  const authUser = await requireAuth(req, res, {
    requiredPermission: 'staff.manage',
    allowedRoles: ['super_admin', 'admin'],
  });
  if (!authUser) return;

  const { fullName, email, phone, password, role, permissions } = req.body || {};

  // 2. Validate Inputs
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }

  if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'A valid email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone ? phone.toString().replace(/\D/g, '').slice(-10) : null;

  if (!role || !ALLOWED_STAFF_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Allowed roles: ${ALLOWED_STAFF_ROLES.join(', ')}`,
    });
  }

  // Security Guard: Only super_admin can create another super_admin
  if (role === 'super_admin' && authUser.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only an active Super Admin can create another Super Admin account.',
    });
  }

  const cleanPermissions: string[] = Array.isArray(permissions) && permissions.length > 0
    ? Array.from(new Set(permissions))
    : [...(ROLE_DEFAULT_PERMISSIONS[role] || [])];

  try {
    // 3. Check if user already exists in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingProfile) {
      // If user is already on staff team
      if (ALLOWED_STAFF_ROLES.includes(existingProfile.role)) {
        return res.status(400).json({
          success: false,
          message: `User "${cleanEmail}" is already a staff member (${existingProfile.role}). You can use "Configure Access" to adjust their role and permissions.`,
          user: existingProfile,
        });
      }

      // If user exists as a customer, seamlessly promote them to staff
      const userId = existingProfile.id;

      // Update auth app_metadata
      try {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: fullName.trim(),
            phone: cleanPhone || existingProfile.phone,
            role,
          },
          app_metadata: {
            role,
            permissions: cleanPermissions,
          },
        });
      } catch (authErr: any) {
        console.warn('[Staff Create] Auth metadata update warning:', authErr.message);
      }

      // Update profile in database
      let { error: dbErr } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: cleanPhone || existingProfile.phone,
          role,
          permissions: cleanPermissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (dbErr && (dbErr.code === '42703' || dbErr.message?.includes('permissions'))) {
        const { error: retryErr } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            phone: cleanPhone || existingProfile.phone,
            role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        dbErr = retryErr;
      }

      if (dbErr && (dbErr.code === '23514' || dbErr.message?.includes('profiles_role_check'))) {
        const { error: roleFallbackErr } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            phone: cleanPhone || existingProfile.phone,
            role: 'admin',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        dbErr = roleFallbackErr;
      }

      if (dbErr) throw dbErr;

      await logAuditEvent({
        actor_id: authUser.id,
        actor_role: authUser.role,
        actor_email: authUser.email,
        action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
        entity: 'staff_member',
        entity_id: userId,
        old_values: { role: existingProfile.role },
        new_values: { role, permissions: cleanPermissions },
        reason: `Promoted existing user "${cleanEmail}" to staff role "${role}"`,
        ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
        user_agent: req.headers['user-agent'] || undefined,
      });

      return res.status(200).json({
        success: true,
        message: `Existing user "${cleanEmail}" has been promoted to Studio Staff as ${role}!`,
        user: {
          id: userId,
          email: cleanEmail,
          full_name: fullName.trim(),
          phone: cleanPhone || existingProfile.phone,
          role,
          permissions: cleanPermissions,
        },
      });
    }

    // 4. User does not exist — Create new user in Supabase Auth
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A secure password of at least 6 characters is required for new staff accounts.',
      });
    }

    const { data: createdAuth, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        phone: cleanPhone,
        role,
      },
      app_metadata: {
        role,
        permissions: cleanPermissions,
      },
    });

    if (authCreateErr) {
      if (authCreateErr.message?.toLowerCase().includes('already') || authCreateErr.message?.toLowerCase().includes('registered')) {
        try {
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = (userList?.users || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);
          if (foundUser) {
            await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
              password: password,
              user_metadata: {
                full_name: fullName.trim(),
                phone: cleanPhone || foundUser.user_metadata?.phone,
                role,
              },
              app_metadata: {
                role,
                permissions: cleanPermissions,
              },
            });

            await supabaseAdmin
              .from('profiles')
              .upsert({
                id: foundUser.id,
                email: cleanEmail,
                full_name: fullName.trim(),
                phone: cleanPhone || foundUser.user_metadata?.phone,
                role,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' });

            await logAuditEvent({
              actor_id: authUser.id,
              actor_role: authUser.role,
              actor_email: authUser.email,
              action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
              entity: 'staff_member',
              entity_id: foundUser.id,
              old_values: null,
              new_values: { role, permissions: cleanPermissions, email: cleanEmail },
              reason: `Updated existing registered user "${cleanEmail}" to staff role "${role}"`,
              ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
              user_agent: req.headers['user-agent'] || undefined,
            });

            return res.status(200).json({
              success: true,
              message: `Successfully onboarded staff account for ${cleanEmail} (${role})!`,
              user: {
                id: foundUser.id,
                email: cleanEmail,
                full_name: fullName.trim(),
                phone: cleanPhone,
                role,
                permissions: cleanPermissions,
              },
            });
          }
        } catch (recoverErr: any) {
          console.warn('[Staff Create] Existing user recovery warning:', recoverErr.message);
        }
      }

      return res.status(400).json({
        success: false,
        message: `Failed to create staff account: ${authCreateErr.message}`,
      });
    }

    if (!createdAuth?.user) {
      return res.status(500).json({ success: false, message: 'Failed to create user in auth service.' });
    }

    const newUserId = createdAuth.user.id;

    // 5. Insert profile record in database
    const profilePayload: Record<string, any> = {
      id: newUserId,
      email: cleanEmail,
      full_name: fullName.trim(),
      phone: cleanPhone,
      role,
      updated_at: new Date().toISOString(),
    };

    let { error: insertErr } = await supabaseAdmin
      .from('profiles')
      .upsert({ ...profilePayload, permissions: cleanPermissions }, { onConflict: 'id' });

    if (insertErr && (insertErr.code === '42703' || insertErr.message?.includes('permissions'))) {
      const { error: retryInsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });
      insertErr = retryInsertErr;
    }

    if (insertErr && (insertErr.code === '23514' || insertErr.message?.includes('profiles_role_check'))) {
      const { error: retryRoleErr } = await supabaseAdmin
        .from('profiles')
        .upsert({ ...profilePayload, role: 'admin' }, { onConflict: 'id' });
      insertErr = retryRoleErr;
    }

    if (insertErr) {
      console.warn('[Staff Create] Profile insertion warning:', insertErr.message);
    }

    // 6. Record Immutable Audit Event
    await logAuditEvent({
      actor_id: authUser.id,
      actor_role: authUser.role,
      actor_email: authUser.email,
      action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
      entity: 'staff_member',
      entity_id: newUserId,
      old_values: null,
      new_values: { role, permissions: cleanPermissions, email: cleanEmail },
      reason: `Created new studio staff member: ${cleanEmail} with role ${role}`,
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
      user_agent: req.headers['user-agent'] || undefined,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully created staff account for ${cleanEmail} (${role})!`,
      user: {
        id: newUserId,
        email: cleanEmail,
        full_name: fullName.trim(),
        phone: cleanPhone,
        role,
        permissions: cleanPermissions,
      },
    });
  } catch (err: any) {
    console.error('[Staff Create API] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}
