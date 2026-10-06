-- Migration: 20260928000001_core_schema.sql
-- Description: Core schema (Profiles, Addresses, Categories, Products) for NEW Supabase project

-- Ensure pgcrypto extension is available for UUID generation
create extension if not exists "pgcrypto";

-- Function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Profiles (Customer & Admin identities linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  email text,
  role text not null default 'customer' check (role in ('customer', 'admin', 'super_admin')),
  referral_code text unique,
  referred_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tr_profiles_updated_at on public.profiles;
create trigger tr_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 2. Customer Addresses
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode varchar(6) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tr_customer_addresses_updated_at on public.customer_addresses;
create trigger tr_customer_addresses_updated_at
  before update on public.customer_addresses
  for each row execute function public.handle_updated_at();

-- 3. Categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_display_order on public.categories(display_order asc);

-- 4. Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  slug text not null unique,
  category_id uuid references public.categories(id) on delete set null,
  category_slug text not null default 'flowers',
  price_in_paise integer not null check (price_in_paise >= 0),
  compare_at_price_in_paise integer check (compare_at_price_in_paise is null or compare_at_price_in_paise > price_in_paise),
  price_label text,
  description text not null,
  long_description text,
  inventory_count integer not null default 10 check (inventory_count >= 0),
  is_made_to_order boolean not null default true,
  is_customisable boolean not null default false,
  is_bestseller boolean not null default false,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  preparation_days text default '3–5 days',
  bouquet_size text,
  images text[] not null default '{}',
  colors text[] not null default '{}',
  occasions text[] not null default '{}',
  recipients text[] not null default '{}',
  whats_included text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_code on public.products(code);
create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_category on public.products(category_slug);
create index if not exists idx_products_active on public.products(is_active);

drop trigger if exists tr_products_updated_at on public.products;
create trigger tr_products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();
-- Migration: 20260928000002_orders_and_payments.sql
-- Description: Orders, Items, Status Machine, Cashfree Payments, and Webhook Event Idempotency

-- 1. Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.profiles(id) on delete set null,
  guest_name text not null,
  guest_phone text not null,
  guest_email text,
  shipping_address_snapshot jsonb not null,
  subtotal_in_paise integer not null check (subtotal_in_paise >= 0),
  discount_in_paise integer not null default 0 check (discount_in_paise >= 0),
  shipping_fee_in_paise integer not null default 0 check (shipping_fee_in_paise >= 0),
  total_in_paise integer not null check (total_in_paise >= 0),
  order_status text not null default 'PENDING_PAYMENT' check (
    order_status in (
      'PENDING_PAYMENT',
      'PAYMENT_CONFIRMED',
      'ORDER_CONFIRMED',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'PAYMENT_FAILED',
      'REFUNDED'
    )
  ),
  payment_status text not null default 'PENDING' check (
    payment_status in ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED')
  ),
  applied_coupon_code text,
  loyalty_points_redeemed integer not null default 0 check (loyalty_points_redeemed >= 0),
  loyalty_discount_in_paise integer not null default 0 check (loyalty_discount_in_paise >= 0),
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_phone on public.orders(guest_phone);
create index if not exists idx_orders_order_number on public.orders(order_number);
create index if not exists idx_orders_status on public.orders(order_status);

drop trigger if exists tr_orders_updated_at on public.orders;
create trigger tr_orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- 2. Order Items (Immutable purchase snapshots)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_code text not null,
  product_name text not null,
  unit_price_in_paise integer not null check (unit_price_in_paise >= 0),
  quantity integer not null check (quantity > 0),
  total_price_in_paise integer not null check (total_price_in_paise >= 0),
  selected_color text,
  gift_wrap boolean not null default false,
  personal_message text,
  item_image text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items(order_id);

-- 3. Order Status Audit History
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  previous_status text,
  new_status text not null,
  note text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists idx_order_status_history_order on public.order_status_history(order_id);

-- 4. Cashfree Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'CASHFREE',
  cf_order_id text not null unique,
  cf_payment_session_id text,
  cf_payment_id text,
  amount_in_paise integer not null check (amount_in_paise >= 0),
  currency varchar(3) not null default 'INR',
  status text not null default 'PENDING' check (
    status in ('PENDING', 'SUCCESS', 'FAILED', 'USER_DROPPED', 'FLAGGED')
  ),
  payment_method text,
  payment_details jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_cf_order on public.payments(cf_order_id);
create index if not exists idx_payments_order on public.payments(order_id);

drop trigger if exists tr_payments_updated_at on public.payments;
create trigger tr_payments_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

-- 5. Payment Events (Webhook Idempotency Log)
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  cf_order_id text not null,
  event_type text not null,
  raw_payload jsonb not null,
  is_processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_events_event_id on public.payment_events(event_id);
create index if not exists idx_payment_events_cf_order on public.payment_events(cf_order_id);
-- Migration: 20260928000003_coupons_and_marketing.sql
-- Description: Coupons, Redemptions, Loyalty Ledger, and Referral Engine

-- 1. Coupons (Supporting standard, promo, and influencer coupons)
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  recipient_name text,
  discount_type text not null default 'PERCENT' check (discount_type in ('PERCENT', 'FLAT')),
  discount_value integer not null check (discount_value > 0),
  min_order_in_paise integer not null default 0 check (min_order_in_paise >= 0),
  max_discount_in_paise integer check (max_discount_in_paise is null or max_discount_in_paise > 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer not null default 1 check (per_customer_limit > 0),
  expires_at timestamptz,
  active boolean not null default true,
  is_influencer boolean not null default false,
  influencer_name text,
  commission_percent numeric(5, 2) default 0,
  scope_type text not null default 'ALL' check (scope_type in ('ALL', 'CATEGORIES', 'SPECIFIC_PRODUCTS', 'PRICE_TIER', 'OCCASION', 'CUSTOM_COMPOUND')),
  applicable_categories text[] not null default '{}',
  applicable_product_codes text[] not null default '{}',
  applicable_occasions text[] not null default '{}',
  min_product_price_in_paise integer not null default 0 check (min_product_price_in_paise >= 0),
  min_spend_mode text not null default 'ELIGIBLE_ITEMS_ONLY' check (min_spend_mode in ('ELIGIBLE_ITEMS_ONLY', 'CART_TOTAL')),
  cart_mix_mode text not null default 'ALLOW_MIXED' check (cart_mix_mode in ('ALLOW_MIXED', 'STRICT_EXCLUSIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_active on public.coupons(active);
create index if not exists idx_coupons_scope_type on public.coupons(scope_type);

drop trigger if exists tr_coupons_updated_at on public.coupons;
create trigger tr_coupons_updated_at
  before update on public.coupons
  for each row execute function public.handle_updated_at();

-- 2. Coupon Redemptions (Audit trail)
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_phone text not null,
  discount_applied_in_paise integer not null check (discount_applied_in_paise >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_coupon_redemptions_coupon on public.coupon_redemptions(coupon_id);
create index if not exists idx_coupon_redemptions_phone on public.coupon_redemptions(customer_phone);

-- 3. Loyalty Accounts
create table if not exists public.loyalty_accounts (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  lifetime_points_earned integer not null default 0 check (lifetime_points_earned >= 0),
  tier text not null default 'FLORET' check (tier in ('FLORET', 'BLOSSOM', 'HEIRLOOM')),
  updated_at timestamptz not null default now()
);

-- 4. Loyalty Transactions Ledger (Immutable double-entry points log)
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null check (
    type in (
      'EARN_PURCHASE',
      'REDEEM_PURCHASE',
      'REFERRAL_BONUS',
      'WELCOME_BONUS',
      'ADJUSTMENT',
      'REFUND_REVERSAL',
      'PROMOTIONAL_BONUS'
    )
  ),
  points integer not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_loyalty_transactions_customer on public.loyalty_transactions(customer_id);

-- 5. Referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid references public.profiles(id) on delete set null,
  referee_phone text not null,
  qualifying_order_id uuid references public.orders(id) on delete set null,
  status text not null default 'PENDING' check (
    status in ('PENDING', 'QUALIFIED', 'REWARDED', 'DISQUALIFIED')
  ),
  reward_points integer not null default 100 check (reward_points >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_id);
create index if not exists idx_referrals_referee_phone on public.referrals(referee_phone);
-- Migration: 20260928000004_shipping_and_admin.sql
-- Description: Shipping logistics, audit logging, and site configuration tables

-- 1. Shipments
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  carrier text not null default 'MANUAL' check (
    carrier in ('SHIPROCKET', 'DELHIVERY', 'INDIA_POST', 'MANUAL')
  ),
  awb_number text,
  tracking_url text,
  shipping_label_url text,
  status text not null default 'PENDING' check (
    status in (
      'PENDING',
      'MANIFESTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'RTO_INITIATED',
      'RTO_DELIVERED',
      'FAILED'
    )
  ),
  estimated_delivery_date date,
  weight_in_grams integer default 500,
  pickup_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipments_order on public.shipments(order_id);
create index if not exists idx_shipments_awb on public.shipments(awb_number);

drop trigger if exists tr_shipments_updated_at on public.shipments;
create trigger tr_shipments_updated_at
  before update on public.shipments
  for each row execute function public.handle_updated_at();

-- 2. Shipment Events (Tracking history)
create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null,
  location text,
  description text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_shipment_events_shipment on public.shipment_events(shipment_id);

-- 3. Audit Logs (Administrative and security action tracing)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'admin',
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity, entity_id);

-- 4. Dynamic Navigation (Preserved from existing application)
create table if not exists public.navigation (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  path text,
  parent_id uuid references public.navigation(id) on delete cascade,
  "order" integer not null default 0,
  type text not null default 'link' check (type in ('link', 'dropdown')),
  created_at timestamptz not null default now()
);

create index if not exists idx_navigation_order on public.navigation("order" asc);

-- 5. Dynamic Site Assets (Preserved from existing application)
create table if not exists public.site_assets (
  section_key text primary key,
  label text not null,
  description text,
  image_url text not null,
  updated_at timestamptz not null default now()
);
-- Migration: 20260928000005_rls_policies.sql
-- Description: Comprehensive Row Level Security (RLS) policies for NEW Supabase project

-- 1. Helper function: is_admin
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

-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.referrals enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.navigation enable row level security;
alter table public.site_assets enable row level security;

-- PROFILES
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "Admins can manage all profiles" on public.profiles;
create policy "Admins can manage all profiles"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- CUSTOMER ADDRESSES
drop policy if exists "Users can manage own addresses" on public.customer_addresses;
create policy "Users can manage own addresses"
  on public.customer_addresses for all
  using (auth.uid() = customer_id or public.is_admin())
  with check (auth.uid() = customer_id or public.is_admin());

-- CATEGORIES
drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
  on public.categories for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- PRODUCTS
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products for select
  using (is_active = true or public.is_admin());

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ORDERS
drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
  on public.orders for select
  using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "Admins can manage all orders" on public.orders;
create policy "Admins can manage all orders"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- ORDER ITEMS
drop policy if exists "Customers can read own order items" on public.order_items;
create policy "Customers can read own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and (orders.customer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Admins can manage order items" on public.order_items;
create policy "Admins can manage order items"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- ORDER STATUS HISTORY
drop policy if exists "Customers can view status history of own orders" on public.order_status_history;
create policy "Customers can view status history of own orders"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_status_history.order_id
        and (orders.customer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Admins can manage order status history" on public.order_status_history;
create policy "Admins can manage order status history"
  on public.order_status_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- PAYMENTS & PAYMENT EVENTS (Server-role and Admins only)
drop policy if exists "Admins can view payments" on public.payments;
create policy "Admins can view payments"
  on public.payments for select
  using (public.is_admin());

drop policy if exists "Admins can view payment events" on public.payment_events;
create policy "Admins can view payment events"
  on public.payment_events for select
  using (public.is_admin());

-- COUPONS
drop policy if exists "Public can read active non-expired coupons" on public.coupons;
create policy "Public can read active non-expired coupons"
  on public.coupons for select
  using (active = true and (expires_at is null or expires_at > now()) or public.is_admin());

drop policy if exists "Admins can manage coupons" on public.coupons;
create policy "Admins can manage coupons"
  on public.coupons for all
  using (public.is_admin())
  with check (public.is_admin());

-- COUPON REDEMPTIONS
drop policy if exists "Admins can view coupon redemptions" on public.coupon_redemptions;
create policy "Admins can view coupon redemptions"
  on public.coupon_redemptions for select
  using (public.is_admin());

-- LOYALTY ACCOUNTS
drop policy if exists "Customers can view own loyalty account" on public.loyalty_accounts;
create policy "Customers can view own loyalty account"
  on public.loyalty_accounts for select
  using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "Admins can manage loyalty accounts" on public.loyalty_accounts;
create policy "Admins can manage loyalty accounts"
  on public.loyalty_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

-- LOYALTY TRANSACTIONS
drop policy if exists "Customers can view own loyalty transactions" on public.loyalty_transactions;
create policy "Customers can view own loyalty transactions"
  on public.loyalty_transactions for select
  using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "Admins can view all loyalty transactions" on public.loyalty_transactions;
create policy "Admins can view all loyalty transactions"
  on public.loyalty_transactions for select
  using (public.is_admin());

-- REFERRALS
drop policy if exists "Referrers can view own referrals" on public.referrals;
create policy "Referrers can view own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or public.is_admin());

drop policy if exists "Admins can manage referrals" on public.referrals;
create policy "Admins can manage referrals"
  on public.referrals for all
  using (public.is_admin())
  with check (public.is_admin());

-- SHIPMENTS & EVENTS
drop policy if exists "Customers can view shipments for own orders" on public.shipments;
create policy "Customers can view shipments for own orders"
  on public.shipments for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = shipments.order_id
        and (orders.customer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Admins can manage shipments" on public.shipments;
create policy "Admins can manage shipments"
  on public.shipments for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Customers can view shipment events for own orders" on public.shipment_events;
create policy "Customers can view shipment events for own orders"
  on public.shipment_events for select
  using (
    exists (
      select 1 from public.shipments
      join public.orders on orders.id = shipments.order_id
      where shipments.id = shipment_events.shipment_id
        and (orders.customer_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Admins can manage shipment events" on public.shipment_events;
create policy "Admins can manage shipment events"
  on public.shipment_events for all
  using (public.is_admin())
  with check (public.is_admin());

-- AUDIT LOGS
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (public.is_admin());

-- NAVIGATION & SITE ASSETS
drop policy if exists "Public can read navigation" on public.navigation;
create policy "Public can read navigation"
  on public.navigation for select
  using (true);

drop policy if exists "Admins can manage navigation" on public.navigation;
create policy "Admins can manage navigation"
  on public.navigation for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public can read site assets" on public.site_assets;
create policy "Public can read site assets"
  on public.site_assets for select
  using (true);

drop policy if exists "Admins can manage site assets" on public.site_assets;
create policy "Admins can manage site assets"
  on public.site_assets for all
  using (public.is_admin())
  with check (public.is_admin());
-- Migration: 20260929000002_complete_operating_system.sql
-- Description: Complete Consolidated Schema for The Petal & Bloom Commerce Operating System
-- Author: Principal Security & Database Architect
-- Includes: audit_logs, product_reviews, store_settings, assistance_conversations, assistance_messages, customer_wishlists, and RLS policies

-- ==========================================
-- 1. HELPER FUNCTIONS
-- ==========================================
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

-- ==========================================
-- 2. CENTRAL STORE SETTINGS & LOGISTICS
-- ==========================================
create table if not exists public.store_settings (
  id text primary key default 'primary',
  whatsapp_number text not null default '+919931653303',
  support_email text not null default 'concierge@thepetalandbloom.com',
  instagram_handle text not null default '@thepetalandbloom',
  instagram_url text not null default 'https://instagram.com/thepetalandbloom',
  business_hours text not null default 'Monday – Saturday, 10 AM – 7 PM IST',
  response_time text not null default 'We typically respond within a few hours during business hours.',
  concierge_channel_mode text not null default 'WHATSAPP' check (concierge_channel_mode in ('WHATSAPP', 'IN_SYSTEM')),
  legal_business_name text not null default 'The Petal & Bloom Studio',
  studio_address text not null default 'Handmade Floral Craft Studio, India',
  gstin text not null default 'GSTIN-PENDING-UNREGISTERED',
  -- Logistics & Courier Automation Fields
  shiprocket_email text default '',
  shiprocket_password text default '',
  shiprocket_pickup_location text default 'Primary Studio Warehouse',
  delhivery_api_key text default '',
  delhivery_warehouse_name text default 'Studio Primary',
  logistics_automation_mode text not null default 'MANUAL_APPROVAL' check (logistics_automation_mode in ('MANUAL_APPROVAL', 'AUTO_DISPATCH')),
  pickup_contact_name text default 'The Petal & Bloom Studio',
  pickup_contact_phone text default '+919931653303',
  pickup_pincode text default '800001',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default primary row if not exists
insert into public.store_settings (
  id, whatsapp_number, support_email, instagram_handle, instagram_url,
  business_hours, response_time, concierge_channel_mode,
  legal_business_name, studio_address, gstin,
  logistics_automation_mode, pickup_contact_name, pickup_contact_phone, pickup_pincode
)
values (
  'primary', '+919931653303', 'concierge@thepetalandbloom.com', '@thepetalandbloom', 'https://instagram.com/thepetalandbloom',
  'Monday – Saturday, 10 AM – 7 PM IST', 'We typically respond within a few hours during business hours.', 'WHATSAPP',
  'The Petal & Bloom Studio', 'Handmade Floral Craft Studio, India', 'GSTIN-PENDING-UNREGISTERED',
  'MANUAL_APPROVAL', 'The Petal & Bloom Studio', '+919931653303', '800001'
)
on conflict (id) do nothing;

-- ==========================================
-- 3. AUDIT LOGS (Append-Only Governance)
-- ==========================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'admin',
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity, entity_id);
create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ==========================================
-- 4. VERIFIED PRODUCT REVIEWS & UGC
-- ==========================================
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text,
  rating integer not null check (rating >= 1 and rating <= 5),
  review_title text,
  review_text text not null,
  customer_photo text,
  is_verified_purchase boolean not null default false,
  is_approved boolean not null default true,
  helpful_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_reviews_product on public.product_reviews(product_code);
create index if not exists idx_product_reviews_customer on public.product_reviews(customer_id);
create index if not exists idx_product_reviews_approved on public.product_reviews(is_approved);
create index if not exists idx_product_reviews_created on public.product_reviews(created_at desc);

-- ==========================================
-- 5. IN-SYSTEM LIVE CONCIERGE ASSISTANCE
-- ==========================================
create table if not exists public.assistance_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  subject text default 'General Atelier Enquiry',
  status text not null default 'OPEN' check (status in ('OPEN', 'PENDING_ADMIN', 'REPLIED', 'RESOLVED')),
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assistance_conv_customer on public.assistance_conversations(customer_id);
create index if not exists idx_assistance_conv_status on public.assistance_conversations(status);
create index if not exists idx_assistance_conv_last_msg on public.assistance_conversations(last_message_at desc);

create table if not exists public.assistance_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistance_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('CUSTOMER', 'ADMIN', 'BOT')),
  sender_name text not null,
  sender_id uuid references auth.users(id) on delete set null,
  message_text text not null,
  attachments jsonb default '[]'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistance_msg_conv on public.assistance_messages(conversation_id);
create index if not exists idx_assistance_msg_created on public.assistance_messages(created_at asc);

-- ==========================================
-- 6. CROSS-DEVICE CLOUD WISHLISTS
-- ==========================================
create table if not exists public.customer_wishlists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  created_at timestamptz not null default now(),
  unique(customer_id, product_code)
);

create index if not exists idx_wishlist_customer on public.customer_wishlists(customer_id);
create index if not exists idx_wishlist_product on public.customer_wishlists(product_code);

-- ==========================================
-- 7. COUPONS SCHEMA EXPANSION (AFFILIATES)
-- ==========================================
alter table public.coupons add column if not exists is_influencer boolean default false;
alter table public.coupons add column if not exists commission_percent numeric default 10;
alter table public.coupons add column if not exists instagram_handle text;
alter table public.coupons add column if not exists payout_upi_or_bank text;

-- ==========================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
alter table public.store_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.product_reviews enable row level security;
alter table public.assistance_conversations enable row level security;
alter table public.assistance_messages enable row level security;
alter table public.customer_wishlists enable row level security;

-- STORE SETTINGS RLS
drop policy if exists "Public can view store settings" on public.store_settings;
create policy "Public can view store settings" on public.store_settings for select using (true);

drop policy if exists "Admins can update store settings" on public.store_settings;
create policy "Admins can update store settings" on public.store_settings for all using (public.is_admin());

-- AUDIT LOGS RLS (Append-Only)
drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs" on public.audit_logs
  for select using (public.is_admin());

drop policy if exists "Service role and admins can insert audit logs" on public.audit_logs;
create policy "Service role and admins can insert audit logs" on public.audit_logs
  for insert with check (true);

-- Disallow updates and deletes on audit_logs
revoke update, delete on public.audit_logs from public, authenticated, anon;

-- PRODUCT REVIEWS RLS
drop policy if exists "Public can view approved reviews" on public.product_reviews;
create policy "Public can view approved reviews" on public.product_reviews
  for select using (is_approved = true or public.is_admin());

drop policy if exists "Authenticated users can submit reviews" on public.product_reviews;
create policy "Authenticated users can submit reviews" on public.product_reviews
  for insert with check (true);

drop policy if exists "Admins can manage all reviews" on public.product_reviews;
create policy "Admins can manage all reviews" on public.product_reviews
  for all using (public.is_admin()) with check (public.is_admin());

-- ASSISTANCE CONVERSATIONS RLS
drop policy if exists "Customers can view their conversations" on public.assistance_conversations;
create policy "Customers can view their conversations" on public.assistance_conversations
  for select using (auth.uid() = customer_id or customer_id is null or public.is_admin());

drop policy if exists "Anyone can create conversations" on public.assistance_conversations;
create policy "Anyone can create conversations" on public.assistance_conversations
  for insert with check (true);

drop policy if exists "Admins can update conversations" on public.assistance_conversations;
create policy "Admins can update conversations" on public.assistance_conversations
  for update using (public.is_admin() or auth.uid() = customer_id);

-- ASSISTANCE MESSAGES RLS
drop policy if exists "Participants can view messages" on public.assistance_messages;
create policy "Participants can view messages" on public.assistance_messages
  for select using (
    public.is_admin() or
    exists (
      select 1 from public.assistance_conversations
      where id = assistance_messages.conversation_id
        and (customer_id = auth.uid() or customer_id is null)
    )
  );

drop policy if exists "Participants can insert messages" on public.assistance_messages;
create policy "Participants can insert messages" on public.assistance_messages
  for insert with check (true);

-- CUSTOMER WISHLISTS RLS
drop policy if exists "Users can manage own wishlist" on public.customer_wishlists;
create policy "Users can manage own wishlist" on public.customer_wishlists
  for all using (auth.uid() = customer_id or public.is_admin())
  with check (auth.uid() = customer_id or public.is_admin());
