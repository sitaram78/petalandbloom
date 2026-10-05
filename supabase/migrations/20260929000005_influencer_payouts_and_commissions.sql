-- Migration: 20260929000005_influencer_payouts_and_commissions.sql
-- Description: Influencer commission payout tracking, payout ledger, and audit history

-- 1. Ensure coupons table has commission_paid_inr and payout_upi_or_bank
alter table public.coupons add column if not exists commission_paid_inr numeric(10, 2) default 0 check (commission_paid_inr >= 0);
alter table public.coupons add column if not exists payout_upi_or_bank text;

-- 2. Create influencer_payouts ledger table
create table if not exists public.influencer_payouts (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  amount_inr numeric(10, 2) not null check (amount_inr > 0),
  payout_reference text,
  payment_method text default 'UPI',
  notes text,
  created_at timestamptz not null default now(),
  created_by text default 'admin'
);

create index if not exists idx_influencer_payouts_coupon on public.influencer_payouts(coupon_id);
create index if not exists idx_influencer_payouts_created on public.influencer_payouts(created_at desc);

-- 3. Enable RLS
alter table public.influencer_payouts enable row level security;

-- Policies for staff
drop policy if exists "Staff can view influencer payouts" on public.influencer_payouts;
create policy "Staff can view influencer payouts"
  on public.influencer_payouts for select
  using (auth.role() = 'authenticated');

drop policy if exists "Staff can record influencer payouts" on public.influencer_payouts;
create policy "Staff can record influencer payouts"
  on public.influencer_payouts for insert
  with check (auth.role() = 'authenticated');
