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
