import React from 'react';
import { PermissionKey } from '@/utils/rbac';
import { useRBAC } from '@/hooks/useRBAC';

interface PermissionGateProps {
  permission?: PermissionKey;
  anyPermissions?: PermissionKey[];
  allPermissions?: PermissionKey[];
  requireSuperAdmin?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children if the authenticated staff user possesses
 * the required capability permissions.
 */
export default function PermissionGate({
  permission,
  anyPermissions,
  allPermissions,
  requireSuperAdmin,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll, isSuperAdmin } = useRBAC();

  if (requireSuperAdmin && !isSuperAdmin) {
    return <>{fallback}</>;
  }

  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  if (anyPermissions && anyPermissions.length > 0 && !canAny(...anyPermissions)) {
    return <>{fallback}</>;
  }

  if (allPermissions && allPermissions.length > 0 && !canAll(...allPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
