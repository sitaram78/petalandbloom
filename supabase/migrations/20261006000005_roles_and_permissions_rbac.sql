-- Migration: 20261006000005_roles_and_permissions_rbac.sql
-- Description: Phase 1 — Comprehensive Granular Role-Based Access Control (RBAC) System
-- Author: Principal Security & Access Governance Architect

-- ============================================================================
-- 1. EXTEND PROFILES ROLE CONSTRAINT & PERMISSIONS STORAGE
-- ============================================================================

-- Safely remove any existing role check constraints on public.profiles
do $$
declare
  r record;
begin
  for r in (
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  ) loop
    execute format('alter table public.profiles drop constraint if exists %I', r.conname);
  end loop;
end $$;

-- Apply expanded role check constraint allowing all standard organizational roles
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'super_admin', 'admin', 'operations', 'support', 'marketing'));

-- Add granular permissions array column to profiles for individual capability overrides
alter table public.profiles
  add column if not exists permissions text[] not null default array[]::text[];

-- Create indexes for performance
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_permissions on public.profiles using gin(permissions);


-- ============================================================================
-- 2. PERMISSIONS CATALOG & ROLE DEFAULT PERMISSIONS TABLES
-- ============================================================================

create table if not exists public.permissions (
  key text primary key,
  name text not null,
  description text not null,
  category text not null,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now()
);

create table if not exists public.role_default_permissions (
  role text not null check (role in ('super_admin', 'admin', 'operations', 'support', 'marketing')),
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create index if not exists idx_role_default_permissions_role on public.role_default_permissions(role);


-- ============================================================================
-- 3. SEED PERMISSIONS CATALOG (22 ATOMIC CAPABILITIES)
-- ============================================================================

insert into public.permissions (key, name, description, category, risk_level)
values
  -- Commerce & Orders
  ('orders.read', 'View Orders & Shipments', 'View orders, items, shipping details, and tracking timelines.', 'Commerce & Orders', 'low'),
  ('orders.update_status', 'Advance Fulfillment States', 'Advance order fulfillment states (Processing, Packed, Shipped, Delivered).', 'Commerce & Orders', 'medium'),
  ('orders.assign_carrier', 'Assign Couriers & AWB', 'Assign delivery carriers and input AWB tracking numbers.', 'Commerce & Orders', 'medium'),
  ('orders.cancel', 'Cancel Orders & Restock', 'Terminate an order and trigger automated inventory restoration.', 'Commerce & Orders', 'high'),
  ('orders.refund', 'Issue Financial Refunds', 'Execute financial refunds via payment gateway to customer bank/card.', 'Commerce & Orders', 'critical'),

  -- Patrons & CRM
  ('customers.read', 'View Patron Directory', 'View patron list, customer order history, and saved delivery addresses.', 'Patrons & CRM', 'low'),
  ('customers.export', 'Export Customer Database (CSV)', 'Download full patron PII database in CSV format.', 'Patrons & CRM', 'critical'),
  ('customers.adjust_points', 'Adjust Loyalty Points', 'Manually credit or debit Petal Points in customer loyalty accounts.', 'Patrons & CRM', 'high'),
  ('messages.manage', 'Live Assistance & Concierge', 'View assistance tickets and reply directly to customer queries.', 'Patrons & CRM', 'medium'),
  ('reviews.moderate', 'Moderate Customer Reviews', 'Approve, reject, or feature verified customer reviews.', 'Patrons & CRM', 'medium'),

  -- Catalog & Logistics
  ('products.read', 'View Catalog Pieces', 'View pieces, prices, variants, categories, and inventory counts.', 'Catalog', 'low'),
  ('products.write', 'Create & Edit Pieces', 'Create new handcrafted pieces, modify prices, and edit descriptions.', 'Catalog', 'high'),
  ('products.delete', 'Delete Catalog Pieces', 'Permanently delete pieces and archive catalog listings.', 'Catalog', 'high'),
  ('inventory.adjust', 'Override Physical Inventory', 'Manually adjust stock quantities and inventory levels.', 'Catalog', 'medium'),

  -- Growth & Marketing
  ('coupons.manage', 'Manage Promotional Vouchers', 'Create, configure conditions, activate, or terminate discount codes.', 'Growth & Marketing', 'high'),
  ('influencers.manage', 'Manage Creator Affiliates', 'Assign ambassador promo codes and inspect commission ledgers.', 'Growth & Marketing', 'medium'),
  ('analytics.read', 'View Intelligence Reports', 'View aggregate revenue, sales analytics, and business intelligence.', 'Intelligence', 'high'),

  -- Studio Editorial & Navigation
  ('assets.manage', 'Manage Studio Media & Banners', 'Upload and replace hero banners, occasion artwork, and imagery.', 'Studio Content', 'medium'),
  ('navigation.manage', 'Manage Storefront Navigation', 'Alter storefront header navigation menus, links, and hierarchy.', 'Studio Content', 'medium'),

  -- Governance & System
  ('settings.manage', 'Manage Store Settings', 'Modify business policies, shipping fees, tax rules, and credentials.', 'Administration', 'critical'),
  ('audit.read', 'View Audit Trails', 'Inspect immutable administrative logs and operational activity.', 'Governance', 'high'),
  ('staff.manage', 'Manage Staff & Roles', 'Invite staff members, assign roles, and grant capability permissions.', 'Governance', 'critical')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  risk_level = excluded.risk_level;


-- ============================================================================
-- 4. SEED ROLE DEFAULT PERMISSIONS
-- ============================================================================

-- Clean existing defaults to re-seed cleanly
delete from public.role_default_permissions;

-- 4.1 Super Admin: All capabilities
insert into public.role_default_permissions (role, permission_key)
select 'super_admin', key from public.permissions;

-- 4.2 Studio Admin: General managerial operational control
insert into public.role_default_permissions (role, permission_key)
select 'admin', key from public.permissions
where key not in ('orders.refund', 'customers.export', 'staff.manage');

-- 4.3 Studio Operations & Logistics: Crafting, fulfillment, and media
insert into public.role_default_permissions (role, permission_key)
values
  ('operations', 'orders.read'),
  ('operations', 'orders.update_status'),
  ('operations', 'orders.assign_carrier'),
  ('operations', 'orders.cancel'),
  ('operations', 'products.read'),
  ('operations', 'products.write'),
  ('operations', 'inventory.adjust'),
  ('operations', 'assets.manage'),
  ('operations', 'navigation.manage');

-- 4.4 Customer Support / Concierge: Live chats, reviews, read-only patrons
insert into public.role_default_permissions (role, permission_key)
values
  ('support', 'orders.read'),
  ('support', 'customers.read'),
  ('support', 'customers.adjust_points'),
  ('support', 'products.read'),
  ('support', 'messages.manage'),
  ('support', 'reviews.moderate');

-- 4.5 Marketing & Brand: Promotions, creators, reports, assets
insert into public.role_default_permissions (role, permission_key)
values
  ('marketing', 'analytics.read'),
  ('marketing', 'coupons.manage'),
  ('marketing', 'influencers.manage'),
  ('marketing', 'assets.manage'),
  ('marketing', 'products.read');


-- ============================================================================
-- 5. POSTGRESQL SECURITY HELPER FUNCTIONS
-- ============================================================================

-- Function to check if caller is super admin
create or replace function public.is_super_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Function to check if caller is admin or super admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Function to check if caller is any authenticated staff member
create or replace function public.is_staff()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('super_admin', 'admin', 'operations', 'support', 'marketing')
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Master permission verification function
create or replace function public.has_permission(required_perm text)
returns boolean as $$
declare
  user_role text;
  user_perms text[];
begin
  if auth.uid() is null then
    return false;
  end if;

  select role, permissions into user_role, user_perms
  from public.profiles
  where id = auth.uid();

  -- 1. Super admin always possesses all permissions
  if user_role = 'super_admin' then
    return true;
  end if;

  -- 2. Direct individual user permission override
  if user_perms is not null and required_perm = any(user_perms) then
    return true;
  end if;

  -- 3. Check role default permissions catalog
  if user_role is not null and exists (
    select 1 from public.role_default_permissions
    where role = user_role and permission_key = required_perm
  ) then
    return true;
  end if;

  return false;
end;
$$ language plpgsql security definer set search_path = public;


-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 6.1 Permissions & Role Default Permissions Tables
alter table public.permissions enable row level security;
alter table public.role_default_permissions enable row level security;

drop policy if exists "Allow reading permissions catalog" on public.permissions;
create policy "Allow reading permissions catalog"
  on public.permissions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Allow reading role default permissions" on public.role_default_permissions;
create policy "Allow reading role default permissions"
  on public.role_default_permissions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Only super_admin can modify permissions" on public.permissions;
create policy "Only super_admin can modify permissions"
  on public.permissions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Only super_admin can modify role default permissions" on public.role_default_permissions;
create policy "Only super_admin can modify role default permissions"
  on public.role_default_permissions for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- 6.2 Profiles RLS: Guard Role Elevation
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and coalesce(permissions, array[]::text[]) = (select coalesce(permissions, array[]::text[]) from public.profiles where id = auth.uid())
  );

drop policy if exists "Staff can view patron profiles" on public.profiles;
create policy "Staff can view patron profiles"
  on public.profiles for select
  using (
    auth.uid() = id or
    public.is_admin() or
    public.has_permission('customers.read') or
    public.has_permission('staff.manage')
  );

drop policy if exists "Staff managers can update profiles" on public.profiles;
create policy "Staff managers can update profiles"
  on public.profiles for update
  using (public.is_super_admin() or public.has_permission('staff.manage'))
  with check (public.is_super_admin() or public.has_permission('staff.manage'));

-- 6.3 Orders & Fulfillment RLS
drop policy if exists "Staff can view orders" on public.orders;
create policy "Staff can view orders"
  on public.orders for select
  using (auth.uid() = customer_id or public.is_admin() or public.has_permission('orders.read'));

drop policy if exists "Staff can update orders" on public.orders;
create policy "Staff can update orders"
  on public.orders for update
  using (public.is_admin() or public.has_permission('orders.update_status'))
  with check (public.is_admin() or public.has_permission('orders.update_status'));

-- 6.4 Shipments RLS
drop policy if exists "Staff can view shipments" on public.shipments;
create policy "Staff can view shipments"
  on public.shipments for select
  using (public.is_admin() or public.has_permission('orders.read'));

drop policy if exists "Staff can manage shipments" on public.shipments;
create policy "Staff can manage shipments"
  on public.shipments for all
  using (public.is_admin() or public.has_permission('orders.assign_carrier'))
  with check (public.is_admin() or public.has_permission('orders.assign_carrier'));

-- 6.5 Customer Assistance & Live Chat RLS
drop policy if exists "Staff can manage assistance conversations" on public.assistance_conversations;
create policy "Staff can manage assistance conversations"
  on public.assistance_conversations for all
  using (auth.uid() = customer_id or public.is_admin() or public.has_permission('messages.manage'))
  with check (auth.uid() = customer_id or public.is_admin() or public.has_permission('messages.manage'));

drop policy if exists "Staff can manage assistance messages" on public.assistance_messages;
create policy "Staff can manage assistance messages"
  on public.assistance_messages for all
  using (
    public.is_admin() or
    public.has_permission('messages.manage') or
    exists (
      select 1 from public.assistance_conversations
      where id = conversation_id and customer_id = auth.uid()
    )
  )
  with check (
    public.is_admin() or
    public.has_permission('messages.manage') or
    exists (
      select 1 from public.assistance_conversations
      where id = conversation_id and customer_id = auth.uid()
    )
  );

-- 6.6 Customer Reviews Moderation RLS
drop policy if exists "Staff can moderate reviews" on public.reviews;
create policy "Staff can moderate reviews"
  on public.reviews for all
  using (status = 'APPROVED' or public.is_admin() or public.has_permission('reviews.moderate'))
  with check (public.is_admin() or public.has_permission('reviews.moderate'));

-- 6.7 Studio Assets & Navigation RLS
drop policy if exists "Staff can manage site assets" on public.site_assets;
create policy "Staff can manage site assets"
  on public.site_assets for all
  using (public.is_admin() or public.has_permission('assets.manage'))
  with check (public.is_admin() or public.has_permission('assets.manage'));

drop policy if exists "Staff can manage navigation" on public.navigation;
create policy "Staff can manage navigation"
  on public.navigation for all
  using (public.is_admin() or public.has_permission('navigation.manage'))
  with check (public.is_admin() or public.has_permission('navigation.manage'));
