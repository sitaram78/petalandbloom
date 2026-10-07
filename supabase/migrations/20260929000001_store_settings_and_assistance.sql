-- Migration: 20260929000001_store_settings_and_assistance.sql
-- Description: Central store settings (WhatsApp, Email, Instagram, Concierge Mode) and In-System Customer Assistance Chat

-- 1. Central Store & Brand Settings
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default settings if empty
insert into public.store_settings (
  id, whatsapp_number, support_email, instagram_handle, instagram_url,
  business_hours, response_time, concierge_channel_mode,
  legal_business_name, studio_address, gstin
)
values (
  'primary', '+919861615937', 'concierge@thepetalandbloom.com', '@thepetalandbloom', 'https://instagram.com/thepetalandbloom',
  'Monday – Saturday, 10 AM – 7 PM IST', 'We typically respond within a few hours during business hours.', 'WHATSAPP',
  'The Petal & Bloom Studio', 'Handmade Floral Craft Studio, India', 'GSTIN-PENDING-UNREGISTERED'
)
on conflict (id) do update set
  whatsapp_number = excluded.whatsapp_number,
  updated_at = now();

-- 2. In-System Customer Assistance Conversations
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

-- 3. In-System Customer Assistance Messages
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

-- Row Level Security (RLS)
alter table public.store_settings enable row level security;
alter table public.assistance_conversations enable row level security;
alter table public.assistance_messages enable row level security;

-- Policies for store_settings
drop policy if exists "Public can view store settings" on public.store_settings;
create policy "Public can view store settings" on public.store_settings for select using (true);

drop policy if exists "Admins can update store settings" on public.store_settings;
create policy "Admins can update store settings" on public.store_settings for all using (public.is_admin());

-- Policies for assistance_conversations
drop policy if exists "Customers can view their conversations" on public.assistance_conversations;
create policy "Customers can view their conversations" on public.assistance_conversations
  for select using (auth.uid() = customer_id or public.is_admin());

drop policy if exists "Anyone can create conversations" on public.assistance_conversations;
create policy "Anyone can create conversations" on public.assistance_conversations
  for insert with check (true);

drop policy if exists "Admins can update conversations" on public.assistance_conversations;
create policy "Admins can update conversations" on public.assistance_conversations
  for update using (public.is_admin() or auth.uid() = customer_id);

-- Policies for assistance_messages
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
