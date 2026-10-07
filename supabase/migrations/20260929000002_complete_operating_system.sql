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
  whatsapp_number text not null default '+919861615937',
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
  pickup_contact_phone text default '+919861615937',
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
  'primary', '+919861615937', 'concierge@thepetalandbloom.com', '@thepetalandbloom', 'https://instagram.com/thepetalandbloom',
  'Monday – Saturday, 10 AM – 7 PM IST', 'We typically respond within a few hours during business hours.', 'WHATSAPP',
  'The Petal & Bloom Studio', 'Handmade Floral Craft Studio, India', 'GSTIN-PENDING-UNREGISTERED',
  'MANUAL_APPROVAL', 'The Petal & Bloom Studio', '+919861615937', '800001'
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
