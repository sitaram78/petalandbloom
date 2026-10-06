import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useRBAC } from '@/hooks/useRBAC';
import { useNotification } from '@/context/NotificationContext';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import {
  PERMISSIONS_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_METADATA,
  type PermissionKey,
  type StaffRole,
} from '@/utils/rbac';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  X,
  Check,
  Lock,
  Loader2,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface StaffProfile {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: StaffRole;
  permissions?: string[];
  created_at: string;
}

const PROTECTED_FOUNDER_EMAILS = ['sitaramnayak8763@gmail.com', 'admin@thepetalandbloom.in'];
const STAFF_ROLE_OPTIONS: StaffRole[] = ['super_admin', 'admin', 'operations', 'support', 'marketing'];

export default function AdminTeamManager() {
  const { user: currentUser } = useAuth();
  const { can, isSuperAdmin } = useRBAC();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');

  // Edit Staff Drawer State
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [drawerRole, setDrawerRole] = useState<StaffRole>('operations');
  const [drawerPermissions, setDrawerPermissions] = useState<PermissionKey[]>([]);
  const [savingDrawer, setSavingDrawer] = useState(false);

  // Add / Promote Staff Modal State
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'create' | 'promote'>('create');

  // Direct Create Form State
  const [createForm, setCreateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'operations' as StaffRole,
  });
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Promote Customer State
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<StaffProfile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [promoteRole, setPromoteRole] = useState<StaffRole>('operations');
  const [selectedUserToPromote, setSelectedUserToPromote] = useState<StaffProfile | null>(null);
  const [promoting, setPromoting] = useState(false);

  // Fetch all staff members with persistent permissions enrichment
  const fetchStaff = useCallback(async () => {
    try {
      // 1. Attempt API endpoint first
      const res = await authFetch('/api/admin/staff');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.staff)) {
          const merged = json.staff.map((s: StaffProfile) => {
            const hasCustomPerms = Array.isArray(s.permissions) && s.permissions.length > 0;
            const effectiveRole = s.role || 'operations';
            return {
              ...s,
              role: effectiveRole,
              permissions: hasCustomPerms ? s.permissions : (ROLE_DEFAULT_PERMISSIONS[effectiveRole] || []),
            };
          });
          setStaffList(merged);
          return;
        }
      }

      // 2. Client-side fallback if /api/admin/staff is not running (e.g. dev server)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', STAFF_ROLE_OPTIONS)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const mergedFallback = ((data as StaffProfile[]) || []).map((s) => {
        const hasCustomPerms = Array.isArray(s.permissions) && s.permissions.length > 0;
        const effectiveRole = s.role || 'operations';
        return {
          ...s,
          role: effectiveRole,
          permissions: hasCustomPerms ? s.permissions : (ROLE_DEFAULT_PERMISSIONS[effectiveRole] || []),
        };
      });
      setStaffList(mergedFallback);
    } catch (err: any) {
      console.error('[AdminTeamManager] Fetch error:', err);
      showNotification('Could not load staff list: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Open Edit Drawer
  const handleOpenEdit = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setDrawerRole(staff.role);

    const hasCustomPerms = Array.isArray(staff.permissions) && staff.permissions.length > 0;
    const currentCustom = hasCustomPerms
      ? staff.permissions as PermissionKey[]
      : [...(ROLE_DEFAULT_PERMISSIONS[staff.role] || [])];

    setDrawerPermissions(currentCustom);
    setIsEditDrawerOpen(true);
  };

  // Close Edit Drawer
  const handleCloseEdit = () => {
    setIsEditDrawerOpen(false);
    setSelectedStaff(null);
  };

  // Switch role inside drawer -> auto-populate permissions to new role defaults
  const handleDrawerRoleChange = (newRole: StaffRole) => {
    setDrawerRole(newRole);
    setDrawerPermissions([...(ROLE_DEFAULT_PERMISSIONS[newRole] || [])]);
  };

  // Toggle individual permission in drawer
  const handleTogglePermission = (key: PermissionKey) => {
    setDrawerPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  // Select all or deselect all in category
  const handleToggleCategory = (categoryKeys: PermissionKey[]) => {
    const allSelected = categoryKeys.every((k) => drawerPermissions.includes(k));
    if (allSelected) {
      setDrawerPermissions((prev) => prev.filter((k) => !categoryKeys.includes(k)));
    } else {
      setDrawerPermissions((prev) => Array.from(new Set([...prev, ...categoryKeys])));
    }
  };

  // Save Role and Permissions
  const handleSaveStaffChanges = async () => {
    if (!selectedStaff) return;

    const isTargetFounder = PROTECTED_FOUNDER_EMAILS.includes((selectedStaff.email || '').toLowerCase().trim());
    if (isTargetFounder && drawerRole !== 'super_admin') {
      showNotification('Founder account role is permanently fixed to Super Admin.', 'error');
      return;
    }

    if (drawerRole === 'super_admin' && !isSuperAdmin) {
      showNotification('Only an existing Super Admin can grant Super Admin privileges.', 'error');
      return;
    }

    if (currentUser?.id === selectedStaff.id && drawerRole !== 'super_admin' && isSuperAdmin) {
      showNotification('You cannot revoke your own Super Admin access to prevent lockout.', 'error');
      return;
    }

    setSavingDrawer(true);
    try {
      let saved = false;

      // 1. Attempt API call
      try {
        const res = await authFetch('/api/admin/staff/update-role', {
          method: 'POST',
          body: JSON.stringify({
            userId: selectedStaff.id,
            newRole: drawerRole,
            permissions: drawerPermissions,
            reason: `Role and capability updated via Studio Team Manager`,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            saved = true;
          }
        }
      } catch (apiErr) {
        console.warn('[AdminTeamManager] API update failed, falling back to direct db:', apiErr);
      }

      // 2. Direct client fallback if API failed or returned non-ok
      if (!saved) {
        let { error: dbErr } = await supabase
          .from('profiles')
          .update({
            role: drawerRole,
            permissions: drawerPermissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedStaff.id);

        if (dbErr && (dbErr.code === '42703' || dbErr.message?.includes('permissions'))) {
          // Fall back to role-only if permissions column not migrated yet
          const { error: roleOnlyErr } = await supabase
            .from('profiles')
            .update({
              role: drawerRole,
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedStaff.id);
          dbErr = roleOnlyErr;
        }

        if (dbErr && (dbErr.code === '23514' || dbErr.message?.includes('profiles_role_check'))) {
          const { error: adminFallbackErr } = await supabase
            .from('profiles')
            .update({
              role: 'admin',
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedStaff.id);
          dbErr = adminFallbackErr;
        }

        if (dbErr) throw dbErr;

        logAudit({
          action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
          entity: 'staff_member',
          entity_id: selectedStaff.id,
          old_values: { role: selectedStaff.role, permissions: selectedStaff.permissions },
          new_values: { role: drawerRole, permissions: drawerPermissions },
          reason: `Updated member to "${drawerRole}" via AdminTeamManager`,
        });
      }

      // 3. Persist to local cache so custom selections are never lost even if column unmigrated
      try {
        const raw = localStorage.getItem('tpb_staff_custom_permissions');
        const customMap = raw ? JSON.parse(raw) : {};
        customMap[selectedStaff.id] = drawerPermissions;
        localStorage.setItem('tpb_staff_custom_permissions', JSON.stringify(customMap));

        const rawRoles = localStorage.getItem('tpb_staff_custom_roles');
        const roleMap = rawRoles ? JSON.parse(rawRoles) : {};
        roleMap[selectedStaff.id] = drawerRole;
        localStorage.setItem('tpb_staff_custom_roles', JSON.stringify(roleMap));
      } catch {}

      // 4. Immediately update local state so UI updates instantaneously
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === selectedStaff.id
            ? { ...s, role: drawerRole, permissions: drawerPermissions }
            : s
        )
      );

      showNotification(`Successfully updated access for ${selectedStaff.full_name || selectedStaff.email}.`, 'success');
      handleCloseEdit();
      fetchStaff();
    } catch (err: any) {
      console.error('[AdminTeamManager] Save error:', err);
      showNotification('Failed to update member access: ' + err.message, 'error');
    } finally {
      setSavingDrawer(false);
    }
  };

  // Demote / Revoke Staff Access entirely (convert back to standard Customer)
  const handleRevokeStaffAccess = async (staff: StaffProfile) => {
    const isTargetFounder = PROTECTED_FOUNDER_EMAILS.includes((staff.email || '').toLowerCase().trim());
    if (isTargetFounder) {
      showNotification('Founder account cannot be demoted or revoked.', 'error');
      return;
    }

    if (staff.id === currentUser?.id) {
      showNotification('You cannot revoke your own staff privileges.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to revoke all studio staff access for ${staff.full_name || staff.email}? They will become a standard customer.`
    );
    if (!confirmed) return;

    try {
      // 1. Try API
      let revoked = false;
      try {
        const res = await authFetch('/api/admin/staff/update-role', {
          method: 'POST',
          body: JSON.stringify({
            userId: staff.id,
            newRole: 'customer',
            permissions: [],
            reason: 'Revoked staff role and returned to customer status',
          }),
        });
        if (res.ok) revoked = true;
      } catch (apiErr) {
        console.warn('[AdminTeamManager] Revoke API failed, falling back:', apiErr);
      }

      if (!revoked) {
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'customer', updated_at: new Date().toISOString() })
          .eq('id', staff.id);

        if (error) throw error;

        logAudit({
          action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
          entity: 'staff_member',
          entity_id: staff.id,
          old_values: { role: staff.role },
          new_values: { role: 'customer' },
          reason: 'Revoked staff role; demoted to customer',
        });
      }

      showNotification(`Staff privileges revoked for ${staff.full_name || staff.email}.`, 'success');
      fetchStaff();
    } catch (err: any) {
      showNotification('Failed to revoke access: ' + err.message, 'error');
    }
  };

  // Direct Staff Onboarding (creates new auth user and profile, or promotes existing)
  const handleCreateNewStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName.trim()) {
      showNotification('Full name is required.', 'error');
      return;
    }
    if (!createForm.email.trim() || !createForm.email.includes('@')) {
      showNotification('A valid work email address is required.', 'error');
      return;
    }
    if (!createForm.password || createForm.password.length < 6) {
      showNotification('Password must be at least 6 characters.', 'error');
      return;
    }
    if (createForm.role === 'super_admin' && !isSuperAdmin) {
      showNotification('Only a Super Admin can create another Super Admin account.', 'error');
      return;
    }

    setCreatingStaff(true);
    try {
      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[createForm.role] || [];
      const cleanEmail = createForm.email.trim().toLowerCase();
      let created = false;
      let respUser: any = null;
      let successMsg = '';

      try {
        const res = await authFetch('/api/admin/staff/create', {
          method: 'POST',
          body: JSON.stringify({
            fullName: createForm.fullName.trim(),
            email: cleanEmail,
            phone: createForm.phone.trim(),
            password: createForm.password,
            role: createForm.role,
            permissions: defaultPerms,
          }),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          created = true;
          respUser = json.user;
          successMsg = json.message || `Successfully created staff account for ${cleanEmail}!`;
        } else if (json.message && !json.message.includes('fetch failed')) {
          throw new Error(json.message);
        }
      } catch (apiErr: any) {
        if (!apiErr.message?.includes('fetch failed')) {
          throw apiErr;
        }
        console.warn('[AdminTeamManager] API create returned fetch error, attempting client fallback:', apiErr);
      }

      // Client fallback if server fetch failed (e.g. dev server network sandbox)
      if (!created) {
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (existingProf) {
          let { error: updErr } = await supabase
            .from('profiles')
            .update({
              role: createForm.role,
              full_name: createForm.fullName.trim() || existingProf.full_name,
              phone: createForm.phone.trim() || existingProf.phone,
              permissions: defaultPerms,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProf.id);

          if (updErr && (updErr.code === '42703' || updErr.message?.includes('permissions'))) {
            const { error: retryErr } = await supabase
              .from('profiles')
              .update({
                role: createForm.role,
                full_name: createForm.fullName.trim() || existingProf.full_name,
                phone: createForm.phone.trim() || existingProf.phone,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingProf.id);
            updErr = retryErr;
          }

          if (updErr) throw updErr;

          created = true;
          respUser = { ...existingProf, role: createForm.role, permissions: defaultPerms };
          successMsg = `User "${cleanEmail}" was already registered and has been promoted to Studio Staff (${createForm.role})!`;
        } else {
          throw new Error('Failed to reach staff creation service. Please check your network connection and try again.');
        }
      }

      showNotification(successMsg, 'success');

      // Cache custom permissions
      if (respUser?.id) {
        try {
          const raw = localStorage.getItem('tpb_staff_custom_permissions');
          const customMap = raw ? JSON.parse(raw) : {};
          customMap[respUser.id] = defaultPerms;
          localStorage.setItem('tpb_staff_custom_permissions', JSON.stringify(customMap));

          const rawRoles = localStorage.getItem('tpb_staff_custom_roles');
          const roleMap = rawRoles ? JSON.parse(rawRoles) : {};
          roleMap[respUser.id] = createForm.role;
          localStorage.setItem('tpb_staff_custom_roles', JSON.stringify(roleMap));
        } catch {}
      }

      // Reset form and reload staff list
      setIsPromoteModalOpen(false);
      setCreateForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        role: 'operations',
      });
      fetchStaff();
    } catch (err: any) {
      console.error('[AdminTeamManager] Create staff error:', err);
      showNotification(err.message || 'Failed to onboard staff member.', 'error');
    } finally {
      setCreatingStaff(false);
    }
  };

  // Search users to promote
  const handleSearchUsers = async (query: string) => {
    setUserSearchInput(query);
    if (query.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const q = query.trim().toLowerCase();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);

      if (error) throw error;
      // Filter out users who are already staff
      const existingStaffIds = new Set(staffList.map((s) => s.id));
      const candidates = (data as StaffProfile[]).filter((u) => !existingStaffIds.has(u.id));
      setUserSearchResults(candidates);
    } catch (err) {
      console.warn('User search error:', err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Promote Selected Candidate to Staff
  const handlePromoteCandidate = async () => {
    if (!selectedUserToPromote) return;

    if (promoteRole === 'super_admin' && !isSuperAdmin) {
      showNotification('Only a Super Admin can promote a user to Super Admin.', 'error');
      return;
    }

    setPromoting(true);
    try {
      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[promoteRole] || [];

      // Try API
      let promoted = false;
      try {
        const res = await authFetch('/api/admin/staff/update-role', {
          method: 'POST',
          body: JSON.stringify({
            userId: selectedUserToPromote.id,
            newRole: promoteRole,
            permissions: defaultPerms,
            reason: `Promoted customer to ${promoteRole}`,
          }),
        });
        if (res.ok) promoted = true;
      } catch (apiErr) {
        console.warn('API promote fallback:', apiErr);
      }

      if (!promoted) {
        let { error } = await supabase
          .from('profiles')
          .update({
            role: promoteRole,
            permissions: defaultPerms,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedUserToPromote.id);

        if (error && (error.code === '42703' || error.message?.includes('permissions'))) {
          const { error: roleOnlyErr } = await supabase
            .from('profiles')
            .update({ role: promoteRole, updated_at: new Date().toISOString() })
            .eq('id', selectedUserToPromote.id);
          error = roleOnlyErr;
        }

        if (error && (error.code === '23514' || error.message?.includes('profiles_role_check'))) {
          const { error: adminFallbackErr } = await supabase
            .from('profiles')
            .update({ role: 'admin', updated_at: new Date().toISOString() })
            .eq('id', selectedUserToPromote.id);
          error = adminFallbackErr;
        }

        if (error) throw error;

        logAudit({
          action: AUDIT_ACTIONS.STAFF_ROLE_MODIFIED,
          entity: 'staff_member',
          entity_id: selectedUserToPromote.id,
          old_values: { role: 'customer' },
          new_values: { role: promoteRole, permissions: defaultPerms },
          reason: `Promoted customer to staff role: ${promoteRole}`,
        });
      }

      showNotification(
        `Added ${selectedUserToPromote.full_name || selectedUserToPromote.email} to Studio Team as ${promoteRole}!`,
        'success'
      );
      setIsPromoteModalOpen(false);
      setSelectedUserToPromote(null);
      setUserSearchInput('');
      setUserSearchResults([]);
      fetchStaff();
    } catch (err: any) {
      showNotification('Failed to promote user: ' + err.message, 'error');
    } finally {
      setPromoting(false);
    }
  };

  // Group catalog permissions by category for clean UI rendering
  const permissionsByCategory = PERMISSIONS_CATALOG.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS_CATALOG>);

  // Filter staff list by search query and role filter
  const filteredStaff = staffList.filter((s) => {
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  // Calculate metrics
  const superAdminCount = staffList.filter((s) => s.role === 'super_admin').length;
  const adminCount = staffList.filter((s) => s.role === 'admin').length;
  const operationsCount = staffList.filter((s) => s.role === 'operations').length;
  const supportCount = staffList.filter((s) => s.role === 'support').length;
  const marketingCount = staffList.filter((s) => s.role === 'marketing').length;

  return (
    <div className="space-y-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-rose" />
            <h2 className="heading-serif text-xl text-bark">Studio Team & Access Governance</h2>
          </div>
          <p className="text-xs text-ink-light mt-1 max-w-xl">
            Configure staff operational authorizations, assign functional roles, and manage capability overrides across the atelier.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchStaff();
            }}
            disabled={refreshing}
            className="p-2.5 bg-paper hover:bg-parchment-100 border border-canvas-line rounded-sm text-ink-light hover:text-bark transition-colors"
            title="Refresh staff roster"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-rose' : ''} />
          </button>

          {can('staff.manage') && (
            <button
              type="button"
              onClick={() => {
                setSelectedUserToPromote(null);
                setUserSearchInput('');
                setUserSearchResults([]);
                setPromoteRole('operations');
                setIsPromoteModalOpen(true);
              }}
              className="px-4 py-2.5 bg-bark hover:bg-bark/90 text-linen rounded-sm text-xs font-medium flex items-center gap-2 shadow-sm transition-colors"
            >
              <UserPlus size={15} />
              Promote / Add Staff
            </button>
          )}
        </div>
      </div>

      {/* 2. Team Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-linen p-4 rounded-sm border border-canvas-line">
          <p className="text-[10px] uppercase font-bold tracking-wider text-ink-light">Total Staff</p>
          <p className="font-serif text-2xl text-bark mt-1">{staffList.length}</p>
          <p className="text-[11px] text-ink-light mt-0.5">Active team members</p>
        </div>

        <div className="bg-linen p-4 rounded-sm border border-purple-200/60">
          <p className="text-[10px] uppercase font-bold tracking-wider text-purple-800">Super Admins</p>
          <p className="font-serif text-2xl text-purple-950 mt-1">{superAdminCount}</p>
          <p className="text-[11px] text-purple-700/80 mt-0.5">Executive control</p>
        </div>

        <div className="bg-linen p-4 rounded-sm border border-blue-200/60">
          <p className="text-[10px] uppercase font-bold tracking-wider text-blue-800">Operations</p>
          <p className="font-serif text-2xl text-blue-950 mt-1">{operationsCount}</p>
          <p className="text-[11px] text-blue-700/80 mt-0.5">Crafting & Dispatch</p>
        </div>

        <div className="bg-linen p-4 rounded-sm border border-amber-200/60">
          <p className="text-[10px] uppercase font-bold tracking-wider text-amber-800">Support</p>
          <p className="font-serif text-2xl text-amber-950 mt-1">{supportCount}</p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">Concierge & Patrons</p>
        </div>

        <div className="bg-linen p-4 rounded-sm border border-rose/30">
          <p className="text-[10px] uppercase font-bold tracking-wider text-rose">Marketing</p>
          <p className="font-serif text-2xl text-bark mt-1">{marketingCount}</p>
          <p className="text-[11px] text-ink-light mt-0.5">Promos & Creator CRM</p>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linen p-4 rounded-sm border border-canvas-line">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 bg-paper border border-canvas-line rounded-sm text-xs text-bark placeholder:text-ink-light/60 focus:outline-none focus:border-bark"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-light hover:text-bark"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] text-ink-light uppercase tracking-wider font-semibold mr-1 flex items-center gap-1">
            <Filter size={12} /> Filter:
          </span>
          {(['all', ...STAFF_ROLE_OPTIONS] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-sm text-xs capitalize whitespace-nowrap transition-colors ${
                roleFilter === r
                  ? 'bg-bark text-linen font-medium'
                  : 'bg-paper text-ink-light hover:text-bark border border-canvas-line'
              }`}
            >
              {r === 'all' ? 'All Roles' : (ROLE_METADATA[r]?.label || r)}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Staff Members Table */}
      <div className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-ink-light">
            <Loader2 size={30} className="animate-spin text-rose mb-3" />
            <p className="text-xs">Loading studio staff roster...</p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="py-16 text-center text-ink-light space-y-2">
            <ShieldAlert size={32} className="mx-auto text-ink-light/40" />
            <p className="text-sm font-medium text-bark">No staff members match the selected filter</p>
            <p className="text-xs text-ink-light">Try adjusting your search criteria or promoting a customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-canvas-line bg-paper/60 text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role & Status</th>
                  <th className="py-3 px-4">Granted Capabilities</th>
                  <th className="py-3 px-4">Joined Atelier</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-line text-xs">
                {filteredStaff.map((staff) => {
                  const isFounder = PROTECTED_FOUNDER_EMAILS.includes((staff.email || '').toLowerCase().trim());
                  const roleMeta = ROLE_METADATA[staff.role] || ROLE_METADATA.customer;
                  const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[staff.role] || [];
                  const customPermsCount = Array.isArray(staff.permissions) ? staff.permissions.length : 0;
                  const effectivePermsCount = staff.role === 'super_admin' ? PERMISSIONS_CATALOG.length : (customPermsCount > 0 ? customPermsCount : defaultRolePerms.length);

                  return (
                    <tr key={staff.id} className="hover:bg-paper/40 transition-colors">
                      {/* Member Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-bark/10 text-bark font-serif flex items-center justify-center font-bold text-sm shrink-0 border border-bark/15">
                            {(staff.full_name || staff.email || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-bark truncate">
                                {staff.full_name || 'Unnamed Staff Member'}
                              </p>
                              {isFounder && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                  <Sparkles size={9} /> Founder
                                </span>
                              )}
                              {staff.id === currentUser?.id && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-bark/10 text-bark">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-light truncate mt-0.5">{staff.email || 'No email registered'}</p>
                            {staff.phone && (
                              <p className="text-[10px] text-ink-light/80 mt-0.5">Ph: +91 {staff.phone}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleMeta.badgeClass}`}>
                          {staff.role === 'super_admin' ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                          {roleMeta.label}
                        </span>
                      </td>

                      {/* Permissions Summary */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-bark font-medium">
                            <Lock size={12} className="text-ink-light" />
                            {staff.role === 'super_admin' ? (
                              <span>Full Access (22 / 22 Capabilities)</span>
                            ) : (
                              <span>{effectivePermsCount} Capabilities Authorized</span>
                            )}
                          </div>
                          <p className="text-[10px] text-ink-light">
                            {staff.role === 'super_admin'
                              ? 'Unrestricted root authority'
                              : customPermsCount > 0
                              ? 'Custom tailored permissions active'
                              : 'Standard role defaults applied'}
                          </p>
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-ink-light text-[11px]">
                        {staff.created_at
                          ? new Date(staff.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {can('staff.manage') && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(staff)}
                              className="px-3 py-1.5 bg-paper hover:bg-parchment-100 border border-canvas-line rounded-sm text-xs font-medium text-bark transition-colors"
                            >
                              Configure Access
                            </button>
                          )}

                          {can('staff.manage') && !isFounder && staff.id !== currentUser?.id && (
                            <button
                              type="button"
                              onClick={() => handleRevokeStaffAccess(staff)}
                              title="Revoke staff privileges"
                              className="p-1.5 text-ink-light hover:text-rose hover:bg-rose/10 rounded-sm transition-colors"
                            >
                              <AlertTriangle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DRAWER: EDIT ROLE & GRANULAR CAPABILITY PERMISSIONS                       */}
      {/* ========================================================================= */}
      {isEditDrawerOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-bark/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-linen h-full shadow-2xl flex flex-col border-l border-canvas-line animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-canvas-line bg-paper/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose">
                  Access Authorization
                </span>
                <h3 className="heading-serif text-lg text-bark mt-0.5">
                  Configure Permissions: {selectedStaff.full_name || selectedStaff.email}
                </h3>
                <p className="text-xs text-ink-light mt-0.5">{selectedStaff.email}</p>
              </div>

              <button
                type="button"
                onClick={handleCloseEdit}
                className="p-2 text-ink-light hover:text-bark rounded-sm hover:bg-linen transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Founder Warning */}
              {PROTECTED_FOUNDER_EMAILS.includes((selectedStaff.email || '').toLowerCase().trim()) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-2.5 text-amber-900 text-xs">
                  <Sparkles size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Founder Account Protection</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      This user is designated as the primary studio founder. Their Super Admin status is immutable.
                    </p>
                  </div>
                </div>
              )}

              {/* Role Selection Radio Cards */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-bark block">
                  Select Staff Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {STAFF_ROLE_OPTIONS.map((roleOpt) => {
                    const isSelected = drawerRole === roleOpt;
                    const meta = ROLE_METADATA[roleOpt];
                    const isSuperAdminOption = roleOpt === 'super_admin';
                    const disabled = (isSuperAdminOption && !isSuperAdmin) || (
                      PROTECTED_FOUNDER_EMAILS.includes((selectedStaff.email || '').toLowerCase().trim()) && roleOpt !== 'super_admin'
                    );

                    return (
                      <button
                        key={roleOpt}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleDrawerRoleChange(roleOpt)}
                        className={`text-left p-3 rounded-sm border transition-all relative ${
                          isSelected
                            ? 'bg-paper border-bark shadow-xs ring-1 ring-bark'
                            : 'bg-linen border-canvas-line hover:border-bark/40'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta?.badgeClass}`}>
                            {meta?.label || roleOpt}
                          </span>
                          {isSelected && <Check size={14} className="text-bark" />}
                        </div>
                        <p className="text-[11px] text-ink-light mt-2 line-clamp-2">
                          {meta?.description || 'Standard operational role'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Capability Matrix */}
              <div className="space-y-4 pt-4 border-t border-canvas-line">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-bark">
                      Capability Permissions ({drawerPermissions.length} of {PERMISSIONS_CATALOG.length} active)
                    </h4>
                    <p className="text-[11px] text-ink-light mt-0.5">
                      Toggle specific functional actions granted to this member.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDrawerPermissions([...(ROLE_DEFAULT_PERMISSIONS[drawerRole] || [])])}
                    className="text-[11px] text-rose hover:underline font-medium"
                  >
                    Reset to Role Defaults
                  </button>
                </div>

                {drawerRole === 'super_admin' ? (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-sm text-xs text-purple-950 flex items-start gap-3">
                    <ShieldAlert size={18} className="text-purple-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Super Admin Root Access Active</p>
                      <p className="text-[11px] text-purple-800 mt-0.5">
                        Super Admins automatically inherit all 22 operational capabilities across Commerce, Patrons, Logistics, Governance, and Gateways.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(permissionsByCategory).map(([category, perms]) => {
                      const categoryKeys = perms.map((p) => p.key);
                      const allSelected = categoryKeys.every((k) => drawerPermissions.includes(k));
                      const someSelected = categoryKeys.some((k) => drawerPermissions.includes(k));

                      return (
                        <div key={category} className="bg-paper/70 rounded-sm border border-canvas-line overflow-hidden">
                          {/* Category Header */}
                          <div className="p-3 bg-paper border-b border-canvas-line flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-bark">
                              {category}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleCategory(categoryKeys)}
                              className="text-[10px] text-ink-light hover:text-bark uppercase tracking-wider font-semibold"
                            >
                              {allSelected ? 'Deselect Category' : 'Select All'}
                            </button>
                          </div>

                          {/* Permissions List */}
                          <div className="p-3 divide-y divide-canvas-line/50 space-y-2">
                            {perms.map((perm) => {
                              const isChecked = drawerPermissions.includes(perm.key);
                              const isRoleDefault = (ROLE_DEFAULT_PERMISSIONS[drawerRole] || []).includes(perm.key);

                              const riskColor = {
                                low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                                medium: 'bg-amber-100 text-amber-800 border-amber-200',
                                high: 'bg-orange-100 text-orange-800 border-orange-200',
                                critical: 'bg-rose/15 text-rose border-rose/30',
                              }[perm.riskLevel];

                              return (
                                <label
                                  key={perm.key}
                                  className="pt-2 flex items-start gap-3 cursor-pointer group select-none"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTogglePermission(perm.key)}
                                    className="mt-1 w-4 h-4 rounded-xs border-canvas-line text-bark focus:ring-bark"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-medium text-bark group-hover:text-rose transition-colors">
                                        {perm.name}
                                      </span>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider border ${riskColor}`}>
                                        {perm.riskLevel}
                                      </span>
                                      {isRoleDefault && (
                                        <span className="text-[9px] text-ink-light/70 uppercase tracking-wider">
                                          (Role Default)
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-ink-light mt-0.5">{perm.description}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-canvas-line bg-paper/60 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCloseEdit}
                className="px-4 py-2 text-xs font-medium text-ink-light hover:text-bark rounded-sm transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveStaffChanges}
                disabled={savingDrawer}
                className="px-6 py-2.5 bg-bark hover:bg-bark/90 text-linen rounded-sm text-xs font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60"
              >
                {savingDrawer ? <Loader2 size={14} className="animate-spin text-rose" /> : <CheckCircle2 size={14} />}
                {savingDrawer ? 'Persisting Access...' : 'Save Member Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ONBOARD STAFF MEMBER (CREATE NEW ACCOUNT OR PROMOTE PATRON)        */}
      {/* ========================================================================= */}
      {isPromoteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bark/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-linen w-full max-w-lg rounded-sm border border-canvas-line shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-canvas-line pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose">
                  Atelier Expansion
                </span>
                <h3 className="heading-serif text-lg text-bark mt-0.5">Onboard Studio Staff</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPromoteModalOpen(false)}
                className="p-1.5 text-ink-light hover:text-bark rounded-sm"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-canvas-line gap-4">
              <button
                type="button"
                onClick={() => setModalTab('create')}
                className={`pb-2.5 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all ${
                  modalTab === 'create'
                    ? 'border-bark text-bark'
                    : 'border-transparent text-ink-light hover:text-bark'
                }`}
              >
                <UserPlus size={14} className="text-rose" />
                Create New Staff
              </button>
              <button
                type="button"
                onClick={() => setModalTab('promote')}
                className={`pb-2.5 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all ${
                  modalTab === 'promote'
                    ? 'border-bark text-bark'
                    : 'border-transparent text-ink-light hover:text-bark'
                }`}
              >
                <Search size={14} className="text-rose" />
                Promote Existing Patron
              </button>
            </div>

            {/* TAB 1: DIRECT STAFF CREATION */}
            {modalTab === 'create' && (
              <form onSubmit={handleCreateNewStaff} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-bark block">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-bark block">Work Email *</label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="colleague@thepetalandbloom.in"
                      className="w-full px-3 py-2 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-bark block">Mobile Number</label>
                    <input
                      type="tel"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="10-digit mobile"
                      className="w-full px-3 py-2 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-bark block">Initial Password *</label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={createForm.password}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Temporary login password (min 6 chars)"
                    className="w-full px-3 py-2 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <p className="text-[10px] text-ink-light">The staff member will use this password to enter the studio.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-bark block">Assign Operational Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value as StaffRole }))}
                    className="w-full p-2.5 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  >
                    {STAFF_ROLE_OPTIONS.map((r) => {
                      const meta = ROLE_METADATA[r];
                      const disabled = r === 'super_admin' && !isSuperAdmin;
                      return (
                        <option key={r} value={r} disabled={disabled}>
                          {meta?.label || r} — {meta?.description || ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-canvas-line">
                  <button
                    type="button"
                    onClick={() => setIsPromoteModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-ink-light hover:text-bark rounded-sm"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={creatingStaff}
                    className="px-5 py-2.5 bg-bark hover:bg-bark/90 text-linen rounded-sm text-xs font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {creatingStaff ? <Loader2 size={14} className="animate-spin text-rose" /> : <UserPlus size={14} />}
                    {creatingStaff ? 'Creating Staff Account...' : 'Create & Onboard Staff'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: PROMOTE EXISTING PATRON */}
            {modalTab === 'promote' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-bark block">
                    Search Patron by Email, Name, or Phone
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      value={userSearchInput}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      placeholder="Type email, phone, or patron name..."
                      className="w-full pl-9 pr-3 py-2 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                    {isSearchingUsers && (
                      <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-rose" />
                    )}
                  </div>

                  {/* Candidate Results */}
                  {userSearchResults.length > 0 && !selectedUserToPromote && (
                    <div className="max-h-48 overflow-y-auto border border-canvas-line rounded-sm divide-y divide-canvas-line bg-paper text-xs">
                      {userSearchResults.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserToPromote(candidate);
                            setUserSearchResults([]);
                          }}
                          className="w-full text-left p-3 hover:bg-parchment-100 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="font-medium text-bark">{candidate.full_name || candidate.email}</p>
                            <p className="text-[11px] text-ink-light">{candidate.email} • Ph: {candidate.phone || '—'}</p>
                          </div>
                          <ChevronRight size={14} className="text-ink-light" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected User Badge */}
                  {selectedUserToPromote && (
                    <div className="p-3 bg-paper border border-bark rounded-sm flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                          Selected Candidate
                        </span>
                        <p className="font-medium text-bark text-xs mt-1">
                          {selectedUserToPromote.full_name || selectedUserToPromote.email}
                        </p>
                        <p className="text-[11px] text-ink-light">{selectedUserToPromote.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUserToPromote(null)}
                        className="text-xs text-rose hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-bark block">
                    Assign Operational Role
                  </label>
                  <select
                    value={promoteRole}
                    onChange={(e) => setPromoteRole(e.target.value as StaffRole)}
                    className="w-full p-2.5 bg-paper border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  >
                    {STAFF_ROLE_OPTIONS.map((r) => {
                      const meta = ROLE_METADATA[r];
                      const disabled = r === 'super_admin' && !isSuperAdmin;
                      return (
                        <option key={r} value={r} disabled={disabled}>
                          {meta?.label || r} — {meta?.description || ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-canvas-line">
                  <button
                    type="button"
                    onClick={() => setIsPromoteModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-ink-light hover:text-bark rounded-sm"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={!selectedUserToPromote || promoting}
                    onClick={handlePromoteCandidate}
                    className="px-5 py-2.5 bg-bark hover:bg-bark/90 text-linen rounded-sm text-xs font-medium flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                  >
                    {promoting ? <Loader2 size={14} className="animate-spin text-rose" /> : <UserPlus size={14} />}
                    {promoting ? 'Promoting Member...' : 'Promote to Staff'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
