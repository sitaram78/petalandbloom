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
