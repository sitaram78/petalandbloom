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
