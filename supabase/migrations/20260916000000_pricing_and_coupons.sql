alter table public.products
  add column if not exists compare_at_price numeric(10, 2);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  recipient_name text not null,
  discount_percent numeric(5, 2) not null check (discount_percent > 0 and discount_percent <= 100),
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

create policy "Public can read active coupons"
  on public.coupons for select
  using (active = true and (expires_at is null or expires_at > now()));

create policy "Authenticated admins can manage coupons"
  on public.coupons for all
  to authenticated
  using (true)
  with check (true);
