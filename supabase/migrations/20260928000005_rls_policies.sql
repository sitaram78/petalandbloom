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
