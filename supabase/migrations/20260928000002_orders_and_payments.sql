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
