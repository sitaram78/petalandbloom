import { useAuth } from '@/context/AuthContext';
import {
  PermissionKey,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  ROLE_METADATA,
  RoleMeta,
} from '@/utils/rbac';

export function useRBAC() {
  const { profile, isSuperAdmin, isAdmin, isStaff } = useAuth();

  const can = (permission: PermissionKey): boolean => {
    return hasPermission(profile, permission);
  };

  const canAny = (...permissions: PermissionKey[]): boolean => {
    return hasAnyPermission(profile, permissions);
  };

  const canAll = (...permissions: PermissionKey[]): boolean => {
    return hasAllPermissions(profile, permissions);
  };

  const permissions = getUserPermissions(profile);
  const roleMeta: RoleMeta = profile?.role ? (ROLE_METADATA[profile.role] || ROLE_METADATA.customer) : ROLE_METADATA.customer;

  return {
    role: profile?.role || 'customer',
    roleMeta,
    isSuperAdmin,
    isAdmin,
    isStaff,
    permissions,
    can,
    canAny,
    canAll,
  };
}
