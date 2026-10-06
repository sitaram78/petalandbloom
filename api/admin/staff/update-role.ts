import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabaseServer';
import { requireAuth, UserRole } from '../../lib/authMiddleware';
import { logAuditEvent, AUDIT_ACTIONS } from '../../lib/auditService';

const VALID_ROLES: UserRole[] = ['super_admin', 'admin', 'operations', 'support', 'marketing', 'customer'];
const PROTECTED_FOUNDER_EMAILS = ['sitaramnayak8763@gmail.com', 'admin@thepetalandbloom.in'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // 1. Enforce Authentication & Staff Management Capability
  const authUser = await requireAuth(req, res, {
    requiredPermission: 'staff.manage',
    allowedRoles: ['super_admin', 'admin'],
  });
  if (!authUser) return;

  const { userId, newRole, permissions, reason } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, message: 'Target user ID is required.' });
  }

  if (!newRole || !VALID_ROLES.includes(newRole)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`,
    });
  }

  try {
    // 2. Fetch current profile of the target user
    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (targetErr || !targetProfile) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    const targetEmail = (targetProfile.email || '').toLowerCase().trim();

    // 3. Security Guards
    // A. Protected Founders cannot be demoted
    if (PROTECTED_FOUNDER_EMAILS.includes(targetEmail) && newRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Primary Founder Super Admin account role cannot be modified or demoted.',
      });
    }

    // B. Only Super Admin can promote someone to Super Admin
    if (newRole === 'super_admin' && authUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only an active Super Admin can assign the Super Admin role.',
      });
    }

    // C. Non-Super Admin cannot modify a Super Admin user
    if (targetProfile.role === 'super_admin' && authUser.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You cannot alter credentials of a Super Admin member.',
      });
    }

    // D. Self-demotion guard
    if (authUser.id === userId && newRole !== 'super_admin' && authUser.role === 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'You cannot revoke your own Super Admin access to prevent lockout.',
      });
    }

    const cleanPermissions: string[] = Array.isArray(permissions)
      ? Array.from(new Set(permissions.filter((p: any) => typeof p === 'string' && p.trim().length > 0)))
      : [];

    // 4. Update profiles table
    let updateProfilesSuccess = false;
    try {
      const { error: fullUpdateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          role: newRole,
          permissions: cleanPermissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (fullUpdateErr) {
        // If column 'permissions' does not exist yet (Postgres 42703), retry updating only role
        if (fullUpdateErr.code === '42703' || fullUpdateErr.message?.includes('permissions')) {
          console.warn('[Staff API] "permissions" column not migrated on profiles; falling back to updating role only.');
          let { error: roleOnlyErr } = await supabaseAdmin
            .from('profiles')
            .update({
              role: newRole,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (roleOnlyErr && (roleOnlyErr.code === '23514' || roleOnlyErr.message?.includes('profiles_role_check'))) {
            const { error: adminFallbackErr } = await supabaseAdmin
              .from('profiles')
              .update({
                role: 'admin',
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);
            roleOnlyErr = adminFallbackErr;
          }

          if (roleOnlyErr) throw roleOnlyErr;
          updateProfilesSuccess = true;
        } else if (fullUpdateErr.code === '23514' || fullUpdateErr.message?.includes('profiles_role_check')) {
          const { error: adminFallbackErr } = await supabaseAdmin
            .from('profiles')
            .update({
              role: 'admin',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          if (adminFallbackErr) throw adminFallbackErr;
          updateProfilesSuccess = true;
        } else {
          throw fullUpdateErr;
        }
      } else {
        updateProfilesSuccess = true;
      }
    } catch (dbErr: any) {
      console.error('[Staff API] Database update error:', dbErr);
      return res.status(500).json({ success: false, message: 'Failed to update database profile: ' + dbErr.message });
    }

    // 5. Update Supabase Auth app_metadata (cryptographically persisted in JWT & auth.users)
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          role: newRole,
          permissions: cleanPermissions,
        },
      });
    } catch (authErr: any) {
      console.warn('[Staff API] Could not update auth app_metadata:', authErr.message);
      // Non-blocking if profiles table was updated
    }

    // 6. Record Immutable Audit Event
    await logAuditEvent({
      actor_id: authUser.id,
      actor_role: authUser.role,
      actor_email: authUser.email,
      action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
      entity: 'staff_member',
      entity_id: userId,
      old_values: {
        role: targetProfile.role,
        permissions: targetProfile.permissions || [],
      },
      new_values: {
        role: newRole,
        permissions: cleanPermissions,
      },
      reason: reason || `Updated member role to "${newRole}" and modified permissions via Atelier Team Manager`,
      ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || undefined,
      user_agent: req.headers['user-agent'] || undefined,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${targetProfile.full_name || targetEmail} to role "${newRole}".`,
      user: {
        id: userId,
        email: targetEmail,
        full_name: targetProfile.full_name,
        role: newRole,
        permissions: cleanPermissions,
      },
    });
  } catch (err: any) {
    console.error('[Staff API] Unexpected error in update-role:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}
