import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../_lib/supabaseServer';
import { requireAuth } from '../../../_lib/authMiddleware';

const STAFF_ROLES = ['super_admin', 'admin', 'operations', 'support', 'marketing'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // 1. Enforce Authentication & Staff Management Capability
  const authUser = await requireAuth(req, res, {
    requiredPermission: 'staff.manage',
    allowedRoles: ['super_admin', 'admin'],
  });
  if (!authUser) return;

  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    // 2. Fetch all current staff members
    const { data: staffMembers, error: staffErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('role', STAFF_ROLES)
      .order('created_at', { ascending: true });

    if (staffErr) {
      console.error('[Staff API] Error fetching staff:', staffErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch staff members: ' + staffErr.message });
    }

    // Enhance staff members with role and permissions from auth.users app_metadata
    const enrichedStaff = await Promise.all(
      (staffMembers || []).map(async (member) => {
        let permissions = Array.isArray(member.permissions) ? member.permissions : [];
        let role = member.role;
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(member.id);
          if (authData?.user?.app_metadata?.role) {
            role = authData.user.app_metadata.role;
          }
          if (permissions.length === 0 && authData?.user?.app_metadata?.permissions) {
            permissions = authData.user.app_metadata.permissions;
          }
        } catch {
          // Ignore fallback lookup errors
        }
        return {
          ...member,
          role,
          permissions,
        };
      })
    );

    // 3. Optional: Search non-staff customers to facilitate promoting/inviting them to staff
    let searchResults: any[] = [];
    if (search.length >= 2) {
      const { data: foundUsers, error: searchErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(10);

      if (!searchErr && foundUsers) {
        searchResults = foundUsers;
      }
    }

    return res.status(200).json({
      success: true,
      staff: enrichedStaff,
      searchResults,
    });
  } catch (err: any) {
    console.error('[Staff API] Unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}
