import type { StaffRole, CustomerProfile } from '@/context/AuthContext';

export type PermissionKey =
  // Commerce & Orders
  | 'orders.read'
  | 'orders.update_status'
  | 'orders.assign_carrier'
  | 'orders.cancel'
  | 'orders.refund'
  // Patrons & CRM
  | 'customers.read'
  | 'customers.export'
  | 'customers.adjust_points'
  | 'messages.manage'
  | 'reviews.moderate'
  // Catalog & Logistics
  | 'products.read'
  | 'products.write'
  | 'products.delete'
  | 'inventory.adjust'
  // Growth & Marketing
  | 'coupons.manage'
  | 'influencers.manage'
  | 'analytics.read'
  // Studio Editorial & Navigation
  | 'assets.manage'
  | 'navigation.manage'
  // Governance & System
  | 'settings.manage'
  | 'audit.read'
  | 'staff.manage';

export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  description: string;
  category: 'Commerce & Orders' | 'Patrons & CRM' | 'Catalog' | 'Growth & Marketing' | 'Studio Content' | 'Governance & System';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Commerce & Orders
  { key: 'orders.read', name: 'View Orders & Shipments', description: 'View orders, items, shipping details, and tracking timelines.', category: 'Commerce & Orders', riskLevel: 'low' },
  { key: 'orders.update_status', name: 'Advance Fulfillment States', description: 'Advance order fulfillment states (Processing, Packed, Shipped, Delivered).', category: 'Commerce & Orders', riskLevel: 'medium' },
  { key: 'orders.assign_carrier', name: 'Assign Couriers & AWB', description: 'Assign delivery carriers and input AWB tracking numbers.', category: 'Commerce & Orders', riskLevel: 'medium' },
  { key: 'orders.cancel', name: 'Cancel Orders & Restock', description: 'Terminate an order and trigger automated inventory restoration.', category: 'Commerce & Orders', riskLevel: 'high' },
  { key: 'orders.refund', name: 'Issue Financial Refunds', description: 'Execute financial refunds via payment gateway to customer bank/card.', category: 'Commerce & Orders', riskLevel: 'critical' },

  // Patrons & CRM
  { key: 'customers.read', name: 'View Patron Directory', description: 'View patron list, customer order history, and saved delivery addresses.', category: 'Patrons & CRM', riskLevel: 'low' },
  { key: 'customers.export', name: 'Export Customer Database (CSV)', description: 'Download full patron PII database in CSV format.', category: 'Patrons & CRM', riskLevel: 'critical' },
  { key: 'customers.adjust_points', name: 'Adjust Loyalty Points', description: 'Manually credit or debit Petal Points in customer loyalty accounts.', category: 'Patrons & CRM', riskLevel: 'high' },
  { key: 'messages.manage', name: 'Live Assistance & Concierge', description: 'View assistance tickets and reply directly to customer queries.', category: 'Patrons & CRM', riskLevel: 'medium' },
  { key: 'reviews.moderate', name: 'Moderate Customer Reviews', description: 'Approve, reject, or feature verified customer reviews.', category: 'Patrons & CRM', riskLevel: 'medium' },

  // Catalog & Logistics
  { key: 'products.read', name: 'View Catalog Pieces', description: 'View pieces, prices, variants, categories, and inventory counts.', category: 'Catalog', riskLevel: 'low' },
  { key: 'products.write', name: 'Create & Edit Pieces', description: 'Create new handcrafted pieces, modify prices, and edit descriptions.', category: 'Catalog', riskLevel: 'high' },
  { key: 'products.delete', name: 'Delete Catalog Pieces', description: 'Permanently delete pieces and archive catalog listings.', category: 'Catalog', riskLevel: 'high' },
  { key: 'inventory.adjust', name: 'Override Physical Inventory', description: 'Manually adjust stock quantities and inventory levels.', category: 'Catalog', riskLevel: 'medium' },

  // Growth & Marketing
  { key: 'coupons.manage', name: 'Manage Promotional Vouchers', description: 'Create, configure conditions, activate, or terminate discount codes.', category: 'Growth & Marketing', riskLevel: 'high' },
  { key: 'influencers.manage', name: 'Manage Creator Affiliates', description: 'Assign ambassador promo codes and inspect commission ledgers.', category: 'Growth & Marketing', riskLevel: 'medium' },
  { key: 'analytics.read', name: 'View Intelligence Reports', description: 'View aggregate revenue, sales analytics, and business intelligence.', category: 'Growth & Marketing', riskLevel: 'high' },

  // Studio Content
  { key: 'assets.manage', name: 'Manage Studio Media & Banners', description: 'Upload and replace hero banners, occasion artwork, and imagery.', category: 'Studio Content', riskLevel: 'medium' },
  { key: 'navigation.manage', name: 'Manage Storefront Navigation', description: 'Alter storefront header navigation menus, links, and hierarchy.', category: 'Studio Content', riskLevel: 'medium' },

  // Governance & System
  { key: 'settings.manage', name: 'Manage Store Settings', description: 'Modify business policies, shipping fees, tax rules, and credentials.', category: 'Governance & System', riskLevel: 'critical' },
  { key: 'audit.read', name: 'View Audit Trails', description: 'Inspect immutable administrative logs and operational activity.', category: 'Governance & System', riskLevel: 'high' },
  { key: 'staff.manage', name: 'Manage Staff & Roles', description: 'Invite staff members, assign roles, and grant capability permissions.', category: 'Governance & System', riskLevel: 'critical' },
];

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRole, PermissionKey[]> = {
  super_admin: [
    'orders.read',
    'orders.update_status',
    'orders.assign_carrier',
    'orders.cancel',
    'orders.refund',
    'customers.read',
    'customers.export',
    'customers.adjust_points',
    'messages.manage',
    'reviews.moderate',
    'products.read',
    'products.write',
    'products.delete',
    'inventory.adjust',
    'coupons.manage',
    'influencers.manage',
    'analytics.read',
    'assets.manage',
    'navigation.manage',
    'settings.manage',
    'audit.read',
    'staff.manage',
  ],
  admin: [
    'orders.read',
    'orders.update_status',
    'orders.assign_carrier',
    'orders.cancel',
    'customers.read',
    'customers.adjust_points',
    'messages.manage',
    'reviews.moderate',
    'products.read',
    'products.write',
    'products.delete',
    'inventory.adjust',
    'coupons.manage',
    'influencers.manage',
    'analytics.read',
    'assets.manage',
    'navigation.manage',
    'settings.manage',
    'audit.read',
    'staff.manage',
  ],
  operations: [
    'orders.read',
    'orders.update_status',
    'orders.assign_carrier',
    'orders.cancel',
    'products.read',
    'products.write',
    'inventory.adjust',
    'assets.manage',
    'navigation.manage',
  ],
  support: [
    'orders.read',
    'customers.read',
    'customers.adjust_points',
    'products.read',
    'messages.manage',
    'reviews.moderate',
  ],
  marketing: [
    'analytics.read',
    'coupons.manage',
    'influencers.manage',
    'assets.manage',
    'products.read',
  ],
  customer: [],
};

export interface RoleMeta {
  role: StaffRole;
  label: string;
  badgeClass: string;
  description: string;
}

export const ROLE_METADATA: Record<StaffRole, RoleMeta> = {
  super_admin: {
    role: 'super_admin',
    label: 'Super Admin',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
    description: 'Unrestricted operational, financial, and access ownership',
  },
  admin: {
    role: 'admin',
    label: 'Studio Admin',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
    description: 'Managerial control over studio operations and catalog',
  },
  operations: {
    role: 'operations',
    label: 'Operations & Logistics',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
    description: 'Stem crafting, packaging, courier dispatch, and stock',
  },
  support: {
    role: 'support',
    label: 'Customer Concierge',
    badgeClass: 'bg-rose/10 text-rose border-rose/30',
    description: 'Live assistance, reviews moderation, and patron care',
  },
  marketing: {
    role: 'marketing',
    label: 'Marketing & Brand',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    description: 'Campaign vouchers, creator partnerships, and analytics',
  },
  customer: {
    role: 'customer',
    label: 'Customer',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Standard retail patron account',
  },
};

/**
 * Checks if a profile has a specific capability permission
 */
export function hasPermission(
  profile: CustomerProfile | null | undefined,
  requiredPermission: PermissionKey
): boolean {
  if (!profile) return false;
  if (profile.role === 'super_admin') return true;

  // 1. If explicit custom capabilities have been configured, they are authoritative
  if (Array.isArray(profile.permissions) && profile.permissions.length > 0) {
    return profile.permissions.includes(requiredPermission);
  }

  // 2. Role default permissions for uncustomized staff
  const defaults = ROLE_DEFAULT_PERMISSIONS[profile.role] || [];
  return defaults.includes(requiredPermission);
}

export function hasAnyPermission(
  profile: CustomerProfile | null | undefined,
  permissions: PermissionKey[]
): boolean {
  return permissions.some((perm) => hasPermission(profile, perm));
}

export function hasAllPermissions(
  profile: CustomerProfile | null | undefined,
  permissions: PermissionKey[]
): boolean {
  return permissions.every((perm) => hasPermission(profile, perm));
}

export function getUserPermissions(
  profile: CustomerProfile | null | undefined
): PermissionKey[] {
  if (!profile) return [];
  if (profile.role === 'super_admin') {
    return ROLE_DEFAULT_PERMISSIONS.super_admin;
  }
  // If custom permissions have been configured, return only the custom set
  if (Array.isArray(profile.permissions) && profile.permissions.length > 0) {
    return profile.permissions as PermissionKey[];
  }
  return ROLE_DEFAULT_PERMISSIONS[profile.role] || [];
}
