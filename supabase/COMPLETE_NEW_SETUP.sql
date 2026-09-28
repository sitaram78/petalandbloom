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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_active on public.coupons(active);

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
-- Migration: 20260928000006_seed_catalog.sql
-- Description: Seed initial categories and catalog products for NEW Supabase project

-- 1. Insert Categories
insert into public.categories (name, slug, display_order, is_active)
values
  ('Flowers', 'flowers', 1, true),
  ('Bouquets', 'bouquets', 2, true),
  ('Gifts', 'gifts', 3, true),
  ('Bags', 'bags', 4, true),
  ('Home Décor', 'decor', 5, true),
  ('Gift Boxes', 'giftboxes', 6, true),
  ('Custom', 'custom', 7, true)
on conflict (slug) do update set
  name = excluded.name,
  display_order = excluded.display_order;

-- 2. Insert Products

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-FL-001',
  'Evermore Rose',
  'tpb-fl-001',
  'flowers',
  34900,
  null,
  'A handmade crochet rose designed to last far beyond the day it is gifted.',
  'The Evermore Rose is our signature single bloom — a handmade crochet rose shaped stitch by stitch to capture the softness of a real petal. Designed to sit on a desk, a shelf, or a bedside table, it is a quiet reminder of a moment worth keeping.',
  15,
  true,
  true,
  true,
  true,
  true,
  '3–5 days',
  '',
  ARRAY['https://images.pexels.com/photos/18809860/pexels-photo-18809860.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/7185718/pexels-photo-7185718.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/31583953/pexels-photo-31583953.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Red', 'Pink', 'White', 'Lavender', 'Yellow', 'Custom']::text[],
  ARRAY['Birthday', 'Anniversary', 'Friendship', 'Gifting']::text[],
  ARRAY['Partner', 'Friend', 'Mother']::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-FL-002',
  'Golden Sun',
  'tpb-fl-002',
  'flowers',
  34900,
  null,
  'A warm sunflower bloom that brings a little light to any corner.',
  'The Golden Sun is a cheerful crochet sunflower with warm golden petals and a textured centre. It is the kind of bloom that makes a room feel a little brighter — and a gift feel a little more thoughtful.',
  15,
  true,
  true,
  false,
  false,
  true,
  '3–5 days',
  '',
  ARRAY['https://images.pexels.com/photos/36007970/pexels-photo-36007970.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32501693/pexels-photo-32501693.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Golden Yellow', 'Mustard', 'Cream', 'Custom']::text[],
  ARRAY['Birthday', 'Friendship', 'Just Because']::text[],
  ARRAY['Friend', 'Sibling']::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-FL-003',
  'Daisy Daydream',
  'tpb-fl-003',
  'flowers',
  29900,
  null,
  'Simple, sweet, and made to sit quietly among your favourite things.',
  'The Daisy Daydream is a delicate crochet daisy with soft white petals and a warm centre. Understated and gentle, it is the bloom for someone who appreciates the little things.',
  15,
  true,
  false,
  false,
  false,
  true,
  '3–5 days',
  '',
  ARRAY['https://images.pexels.com/photos/5775875/pexels-photo-5775875.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32914223/pexels-photo-32914223.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['White', 'Pink', 'Yellow', 'Custom']::text[],
  ARRAY['Friendship', 'Just Because', 'Birthday']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-FL-004',
  'Petal Whisper Tulip',
  'tpb-fl-004',
  'flowers',
  34900,
  null,
  'A graceful crochet tulip with a slender stem and soft cupped petals.',
  'The Petal Whisper Tulip captures the quiet elegance of a single tulip in yarn. Its slender stem and cupped petals make it a beautiful standalone piece or a thoughtful addition to a larger bouquet.',
  15,
  true,
  true,
  false,
  false,
  true,
  '3–5 days',
  '',
  ARRAY['https://images.pexels.com/photos/24361048/pexels-photo-24361048.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/31104018/pexels-photo-31104018.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Pink', 'White', 'Lavender', 'Yellow', 'Custom']::text[],
  ARRAY['Birthday', 'Anniversary', 'Mother''s Day']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-FL-005',
  'Premium Rose',
  'tpb-fl-005',
  'flowers',
  39900,
  null,
  'A larger, fuller crochet rose with layered petals and a premium finish.',
  'The Premium Rose is our most refined single bloom — larger, with more layered petals and a richer texture. It is the rose for moments that deserve something a little more.',
  15,
  true,
  true,
  false,
  true,
  true,
  '4–6 days',
  '',
  ARRAY['https://images.pexels.com/photos/17143519/pexels-photo-17143519.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/7185718/pexels-photo-7185718.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Red', 'Pink', 'White', 'Lavender', 'Peach', 'Custom']::text[],
  ARRAY['Anniversary', 'Valentine''s Day', 'Mother''s Day']::text[],
  ARRAY['Partner', 'Mother']::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-001',
  'Little Bloom',
  'tpb-bq-001',
  'bouquets',
  49900,
  null,
  'One handmade bloom, wrapped and ready to make someone smile.',
  'The Little Bloom is our simplest bouquet — a single crochet flower, wrapped with care. It is the perfect little gesture for someone who deserves a moment of thought.',
  15,
  true,
  false,
  false,
  false,
  true,
  '3–5 days',
  '1 flower',
  ARRAY['https://images.pexels.com/photos/17864125/pexels-photo-17864125.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/17864123/pexels-photo-17864123.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Red', 'Pink', 'White', 'Lavender', 'Yellow', 'Custom']::text[],
  ARRAY['Just Because', 'Friendship', 'Birthday']::text[],
  ARRAY[]::text[],
  ARRAY['Handmade crochet flower', 'Premium wrapping', 'Ribbon', 'Gift-ready presentation']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-002',
  'Bloom Duo',
  'tpb-bq-002',
  'bouquets',
  69900,
  null,
  'Two complementary blooms brought together in a small, thoughtful pairing.',
  'The Bloom Duo pairs two complementary crochet flowers — a rose and a tulip, a daisy and a sunflower — wrapped together as a small story. It is the bouquet for a friendship, a thank-you, or a quiet celebration.',
  15,
  true,
  true,
  false,
  false,
  true,
  '4–6 days',
  '2 flowers',
  ARRAY['https://images.pexels.com/photos/20269074/pexels-photo-20269074.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32280850/pexels-photo-32280850.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Friendship', 'Birthday', 'Anniversary']::text[],
  ARRAY[]::text[],
  ARRAY['2 handmade crochet flowers', 'Premium wrapping', 'Ribbon', 'Gift-ready presentation']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-003',
  'Trio of Petals',
  'tpb-bq-003',
  'bouquets',
  89900,
  null,
  'Three handmade blooms, brought together into one little story.',
  'The Trio of Petals is our most-loved bouquet. Three crochet flowers — each chosen to complement the others — wrapped together in premium packaging. It is the bouquet that turns a gift into a moment.',
  15,
  true,
  true,
  true,
  true,
  true,
  '4–6 days',
  '3 flowers',
  ARRAY['https://images.pexels.com/photos/20269075/pexels-photo-20269075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/29753251/pexels-photo-29753251.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/28450065/pexels-photo-28450065.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Birthday', 'Anniversary', 'Valentine''s Day', 'Mother''s Day']::text[],
  ARRAY[]::text[],
  ARRAY['3 handmade crochet flowers', 'Premium wrapping', 'Ribbon', 'Gift-ready presentation']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-004',
  'Petal Story',
  'tpb-bq-004',
  'bouquets',
  129900,
  null,
  'Five blooms arranged into a fuller, more expressive bouquet.',
  'The Petal Story is a bouquet with more to say. Five crochet flowers in a considered arrangement, wrapped in premium packaging with a ribbon finish. It is the bouquet for anniversaries, milestones, and moments that deserve more than a single bloom.',
  15,
  true,
  true,
  false,
  false,
  true,
  '5–7 days',
  '5 flowers',
  ARRAY['https://images.pexels.com/photos/29753249/pexels-photo-29753249.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/20269075/pexels-photo-20269075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Anniversary', 'Mother''s Day', 'Birthday']::text[],
  ARRAY[]::text[],
  ARRAY['5 handmade crochet flowers', 'Premium wrapping', 'Ribbon', 'Gift-ready presentation']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-005',
  'Garden in Bloom',
  'tpb-bq-005',
  'bouquets',
  159900,
  null,
  'Seven flowers gathered into a rich, layered crochet bouquet.',
  'The Garden in Bloom is a generous arrangement — seven crochet flowers in a mix of roses, tulips, and daisies, wrapped and finished with a premium ribbon. It is the bouquet that feels like a whole garden in your hands.',
  15,
  true,
  true,
  false,
  false,
  true,
  '5–7 days',
  '7 flowers',
  ARRAY['https://images.pexels.com/photos/29753249/pexels-photo-29753249.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/39412616/pexels-photo-39412616.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Anniversary', 'Mother''s Day', 'Wedding', 'Festivals']::text[],
  ARRAY[]::text[],
  ARRAY['7 handmade crochet flowers', 'Premium wrapping', 'Ribbon', 'Gift-ready presentation']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-006',
  'Forever Garden',
  'tpb-bq-006',
  'bouquets',
  199900,
  null,
  'Nine blooms — our largest standard bouquet, made to be unforgettable.',
  'The Forever Garden is our most generous standard bouquet. Nine crochet flowers arranged into a rich, full composition, wrapped in premium packaging and finished with a ribbon. It is the bouquet for once-in-a-lifetime moments.',
  15,
  true,
  true,
  false,
  true,
  true,
  '6–8 days',
  '9 flowers',
  ARRAY['https://images.pexels.com/photos/39412616/pexels-photo-39412616.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/29753249/pexels-photo-29753249.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Anniversary', 'Wedding', 'Mother''s Day']::text[],
  ARRAY[]::text[],
  ARRAY['9 handmade crochet flowers', 'Premium wrapping', 'Ribbon', 'Gift-ready presentation']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-007',
  'Premium Mixed Bouquet',
  'tpb-bq-007',
  'bouquets',
  149900,
  null,
  'A curated mix of flower types and colours for a one-of-a-kind arrangement.',
  'The Premium Mixed Bouquet is a curated blend of different flower types — roses, tulips, daisies, and sunflowers — chosen to create a rich, textured arrangement. No two are exactly alike.',
  15,
  true,
  true,
  false,
  false,
  true,
  '5–7 days',
  '5–7 flowers',
  ARRAY['https://images.pexels.com/photos/29753249/pexels-photo-29753249.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/20269074/pexels-photo-20269074.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Curated mix']::text[],
  ARRAY['Birthday', 'Anniversary', 'Festivals']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BQ-008',
  'Large Premium Bouquet',
  'tpb-bq-008',
  'bouquets',
  249900,
  null,
  'Our grandest bouquet — a lush, abundant arrangement for the most special occasions.',
  'The Large Premium Bouquet is our most abundant creation — a generous arrangement of 10+ crochet flowers in a rich, layered composition. Made for weddings, milestone anniversaries, and moments that deserve the fullest expression.',
  15,
  true,
  true,
  false,
  false,
  true,
  '7–10 days',
  '10+ flowers',
  ARRAY['https://images.pexels.com/photos/39412616/pexels-photo-39412616.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/29753249/pexels-photo-29753249.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Wedding', 'Anniversary', 'Corporate Gifting']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-KR-001',
  'Pocket Bloom Keyring',
  'tpb-kr-001',
  'gifts',
  19900,
  null,
  'A tiny crochet bloom you can carry everywhere.',
  'The Pocket Bloom Keyring is a miniature crochet flower attached to a sturdy keyring. It is the smallest way to carry a little beauty with you — and a lovely little gift for someone who deserves a small surprise.',
  15,
  true,
  false,
  true,
  false,
  true,
  '2–4 days',
  '',
  ARRAY['https://images.pexels.com/photos/37129474/pexels-photo-37129474.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/38634277/pexels-photo-38634277.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Red', 'Pink', 'White', 'Lavender', 'Yellow']::text[],
  ARRAY['Just Because', 'Friendship', 'Return Gift']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-KR-002',
  'Premium Custom Keyring',
  'tpb-kr-002',
  'gifts',
  24900,
  null,
  'A custom-colour crochet keyring with a premium finish.',
  'The Premium Custom Keyring lets you choose the colour, the flower type, and the accent. It is a small, personal gift made to order — and a favourite for return gifts and party favours.',
  15,
  true,
  true,
  false,
  false,
  true,
  '3–5 days',
  '',
  ARRAY['https://images.pexels.com/photos/38634277/pexels-photo-38634277.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/37129474/pexels-photo-37129474.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom']::text[],
  ARRAY['Return Gift', 'Friendship', 'Just Because']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-KR-003',
  'Flower Bookmark',
  'tpb-kr-003',
  'gifts',
  19900,
  null,
  'A delicate crochet flower bookmark for the readers you love.',
  'The Flower Bookmark is a slim crochet flower attached to a bookmark stem — a gentle, literary gift for the readers in your life. It sits beautifully between pages and lasts far longer than a real petal.',
  15,
  true,
  true,
  false,
  false,
  true,
  '2–4 days',
  '',
  ARRAY['https://images.pexels.com/photos/36595917/pexels-photo-36595917.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/34352098/pexels-photo-34352098.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Pink', 'White', 'Lavender', 'Yellow', 'Custom']::text[],
  ARRAY['Friendship', 'Just Because', 'Birthday']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-HD-001',
  'Mini Flower Pot',
  'tpb-hd-001',
  'decor',
  49900,
  null,
  'A tiny crochet bloom planted in a mini pot — a little piece of permanent garden.',
  'The Mini Flower Pot is a crochet flower set in a small decorative pot. It is a complete little piece of decor — a permanent garden for a desk, a shelf, or a windowsill.',
  15,
  true,
  true,
  false,
  false,
  true,
  '3–5 days',
  '',
  ARRAY['https://images.pexels.com/photos/17864123/pexels-photo-17864123.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/32280850/pexels-photo-32280850.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Pink', 'White', 'Yellow', 'Custom']::text[],
  ARRAY['Housewarming', 'Just Because', 'Mother''s Day']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BG-001',
  'Mini Crochet Purse',
  'tpb-bg-001',
  'bags',
  54900,
  null,
  'A small, charming crochet purse for everyday essentials.',
  'The Mini Crochet Purse is a compact, handmade bag with a soft textured finish. It is the kind of piece that adds a handmade touch to an everyday outfit.',
  15,
  true,
  true,
  false,
  false,
  true,
  '4–6 days',
  '',
  ARRAY['https://images.pexels.com/photos/33207480/pexels-photo-33207480.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30224898/pexels-photo-30224898.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Cream', 'Pink', 'Sage', 'Brown', 'Custom']::text[],
  ARRAY['Birthday', 'Just Because']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BG-002',
  'Petal Tote',
  'tpb-bg-002',
  'bags',
  89900,
  null,
  'A medium crochet tote with floral accents — functional and beautiful.',
  'The Petal Tote is a medium-sized crochet bag with delicate floral accents woven into the design. It is roomy enough for daily use and pretty enough to carry with intention.',
  15,
  true,
  true,
  false,
  false,
  true,
  '5–7 days',
  '',
  ARRAY['https://images.pexels.com/photos/30224898/pexels-photo-30224898.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30859913/pexels-photo-30859913.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Cream', 'Sage', 'Brown', 'Custom']::text[],
  ARRAY['Birthday', 'Just Because']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-BG-003',
  'Premium Tote',
  'tpb-bg-003',
  'bags',
  129900,
  null,
  'A large, fully-lined crochet tote with a premium finish and sturdy straps.',
  'The Premium Tote is our finest bag — a large, fully-lined crochet tote with sturdy straps and a structured finish. It is made to be used, carried, and loved for years.',
  15,
  true,
  true,
  false,
  true,
  true,
  '5–7 days',
  '',
  ARRAY['https://images.pexels.com/photos/30859913/pexels-photo-30859913.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/30224897/pexels-photo-30224897.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Cream', 'Brown', 'Sage', 'Custom']::text[],
  ARRAY['Birthday', 'Anniversary']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-GF-001',
  'Little Bloom Gift Box',
  'tpb-gf-001',
  'giftboxes',
  79900,
  null,
  'A single crochet bloom, a keyring, and a greeting card in a gift-ready box.',
  'The Little Bloom Gift Box brings together a single crochet flower, a Pocket Bloom keyring, and a greeting card in a beautifully packaged box. It is a complete gift — ready to give, ready to receive.',
  15,
  true,
  true,
  false,
  true,
  true,
  '4–6 days',
  '',
  ARRAY['https://images.pexels.com/photos/10482144/pexels-photo-10482144.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/13143524/pexels-photo-13143524.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Birthday', 'Friendship', 'Just Because', 'Mother''s Day']::text[],
  ARRAY[]::text[],
  ARRAY['1 crochet flower', 'Pocket Bloom keyring', 'Greeting card', 'Gift box packaging']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-GF-002',
  'Premium Bloom Box',
  'tpb-gf-002',
  'giftboxes',
  149900,
  null,
  'A trio of crochet blooms, a keyring, a bookmark, and a greeting card in a premium box.',
  'The Premium Bloom Box is our most complete gift — a Trio of Petals bouquet, a Pocket Bloom keyring, a Flower Bookmark, and a greeting card, all presented in a premium gift box with wrapping and ribbon. It is the gift that needs nothing else.',
  15,
  true,
  true,
  false,
  false,
  true,
  '5–7 days',
  '',
  ARRAY['https://images.pexels.com/photos/27291954/pexels-photo-27291954.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/13143524/pexels-photo-13143524.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Custom mix available']::text[],
  ARRAY['Anniversary', 'Mother''s Day', 'Birthday', 'Valentine''s Day']::text[],
  ARRAY[]::text[],
  ARRAY['Trio of Petals bouquet (3 flowers)', 'Pocket Bloom keyring', 'Flower bookmark', 'Greeting card', 'Premium gift box with wrapping and ribbon']::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;

insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  'TPB-CS-001',
  'Custom Bouquet',
  'tpb-cs-001',
  'custom',
  119900,
  null,
  'Your flowers. Your colours. Your story — a bouquet designed entirely around you.',
  'The Custom Bouquet is our made-to-order experience. You choose the flower types, the number of flowers, the colours, the wrapping, the ribbon, and the message. We handcraft it from scratch. No two custom bouquets are the same.',
  15,
  true,
  true,
  false,
  true,
  true,
  '5–10 days',
  'Your choice',
  ARRAY['https://images.pexels.com/photos/29753249/pexels-photo-29753249.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 'https://images.pexels.com/photos/20269075/pexels-photo-20269075.jpeg?auto=compress&cs=tinysrgb&h=650&w=940']::text[],
  ARRAY['Fully custom']::text[],
  ARRAY['All occasions']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[]
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;
