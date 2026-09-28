# TARGET ARCHITECTURE: The Petal & Bloom

**Project:** The Petal & Bloom  
**Target Environment:** Antigravity / Vercel + NEW Isolated Supabase Project  
**Author:** Senior Multidisciplinary Engineering Team  
**Status:** Architectural Specification — Pending Approval

---

## 1. System Overview & Boundaries

The target system maintains the exact visual identity and UX patterns of "The Petal & Bloom" while introducing a robust, secure, and transactional e-commerce infrastructure.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (BROWSER)                              │
│                                                                        │
│   Storefront UI (React 18 + Tailwind)        Admin Portal (Protected)  │
│   ├── Preserved Pages & Catalog              ├── Admin Dashboard       │
│   ├── Guest & Account Checkout               ├── Order Management      │
│   ├── Cashfree SDK Payment Modal             ├── Inventory / Products  │
│   └── Customer Account & Tracking            └── Coupon / Influencers  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTPS
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 SERVERLESS BACKEND LAYER (Vercel Functions)            │
│                 /api/* with Server-Side Validation & Secrets           │
│                                                                        │
│   ├── /api/checkout/create-order     (Calculate totals, inventory lock)│
│   ├── /api/payments/cashfree-session (Generate Cashfree payment order) │
│   ├── /api/payments/cashfree-webhook (Verify HMAC signature & update)  │
│   ├── /api/coupons/validate          (Validate rules server-side)      │
│   ├── /api/loyalty/calculate         (Calculate tier & ledger balance) │
│   ├── /api/shipping/estimate-track   (Shipping abstraction layer)      │
│   └── /api/admin/*                   (Role-checked admin operations)   │
└───────────────────────┬─────────────────────────┬──────────────────────┘
                        │                         │
            Service Role│                         │ Official APIs
            PostgreSQL  │                         │ Webhooks
                        ▼                         ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│       NEW SUPABASE PROJECT      │   │       EXTERNAL PROVIDERS         │
│  (100% Isolated from Live Site) │   │                                  │
│                                 │   │  Cashfree Payments (Prepaid)     │
│  ├── Database (Postgres 15+)    │   │  Shiprocket / Delhivery / Post   │
│  ├── Row Level Security (RLS)   │   │  WhatsApp Cloud API / Notif      │
│  ├── Authentication (Auth)      │   └──────────────────────────────────┘
│  └── Storage (Buckets)          │
└─────────────────────────────────┘
```

---

## 2. Server Architecture: Vercel Serverless Functions (`api/`)

Because the application is deployed on Vercel (`vercel.json`), adding standard Vercel serverless TypeScript functions under `/api/` provides:
1. **Secure Execution:** Server secrets (`CASHFREE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CASHFREE_WEBHOOK_SECRET`) are never leaked to the browser.
2. **Deterministic Calculations:** Prices, discounts, shipping fees, and taxes are calculated exclusively on the server.
3. **Webhook Endpoints:** Standard HTTP endpoints for Cashfree payment webhooks with cryptographic signature verification.
4. **Zero Overhead:** No separate server or complex infrastructure required; deploys alongside the Vite SPA on Vercel.

---

## 3. Database Schema (Target NEW Supabase Project)

All financial, transactional, and customer records will reside in the **NEW isolated Supabase project**.

### 3.1 Customer & Identity
1. `profiles`:
   - `id uuid primary key references auth.users(id) on delete cascade`
   - `phone text unique`
   - `full_name text`
   - `email text`
   - `referral_code text unique`
   - `referred_by text`
   - `role text not null default 'customer' check (role in ('customer', 'admin', 'super_admin'))`
   - `created_at timestamptz default now()`
   - `updated_at timestamptz default now()`
2. `customer_addresses`:
   - `id uuid primary key default gen_random_uuid()`
   - `customer_id uuid references public.profiles(id) on delete cascade`
   - `recipient_name text not null`
   - `phone text not null`
   - `address_line1 text not null`
   - `address_line2 text`
   - `city text not null`
   - `state text not null`
   - `pincode varchar(6) not null`
   - `is_default boolean default false`
   - `created_at timestamptz default now()`

### 3.2 Product Catalogue & Inventory
3. `categories`:
   - `id uuid primary key default gen_random_uuid()`
   - `name text not null`
   - `slug text not null unique`
   - `display_order integer default 0`
   - `image_url text`
   - `is_active boolean default true`
   - `created_at timestamptz default now()`
4. `products`:
   - `id uuid primary key default gen_random_uuid()`
   - `code text not null unique` (SKU, e.g. `TPB-FL-001`)
   - `name text not null`
   - `slug text not null unique`
   - `category_id uuid references public.categories(id)`
   - `category_slug text not null` (backward compatibility)
   - `price_in_paise integer not null` (₹349 -> `34900`)
   - `compare_at_price_in_paise integer`
   - `description text not null`
   - `long_description text`
   - `inventory_count integer not null default 10`
   - `is_made_to_order boolean default true`
   - `is_customisable boolean default false`
   - `is_bestseller boolean default false`
   - `is_featured boolean default false`
   - `is_active boolean default true`
   - `preparation_days text default '3-5 days'`
   - `bouquet_size text`
   - `images text[] default '{}'`
   - `colors text[] default '{}'`
   - `occasions text[] default '{}'`
   - `recipients text[] default '{}'`
   - `whats_included text[] default '{}'`
   - `created_at timestamptz default now()`
   - `updated_at timestamptz default now()`

### 3.3 Orders & Order State Machine
5. `orders`:
   - `id uuid primary key default gen_random_uuid()`
   - `order_number text not null unique` (e.g., `TPB-2026-1001`)
   - `customer_id uuid references public.profiles(id)` (NULL for guest checkout)
   - `guest_email text`
   - `guest_phone text not null`
   - `guest_name text not null`
   - `shipping_address_snapshot jsonb not null` (Immutable snapshot of address at checkout)
   - `subtotal_in_paise integer not null`
   - `discount_in_paise integer not null default 0`
   - `shipping_fee_in_paise integer not null default 0`
   - `total_in_paise integer not null`
   - `order_status text not null default 'PENDING_PAYMENT' check (order_status in ('PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'))`
   - `payment_status text not null default 'PENDING' check (payment_status in ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'REFUNDED'))`
   - `coupon_id uuid references public.coupons(id)`
   - `loyalty_points_redeemed integer default 0`
   - `loyalty_discount_in_paise integer default 0`
   - `created_at timestamptz default now()`
   - `updated_at timestamptz default now()`
6. `order_items`:
   - `id uuid primary key default gen_random_uuid()`
   - `order_id uuid not null references public.orders(id) on delete cascade`
   - `product_id uuid references public.products(id)`
   - `product_code text not null`
   - `product_name text not null`
   - `unit_price_in_paise integer not null`
   - `quantity integer not null check (quantity > 0)`
   - `selected_color text`
   - `gift_wrap boolean default false`
   - `personal_message text`
   - `item_image text`
7. `order_status_history`:
   - `id uuid primary key default gen_random_uuid()`
   - `order_id uuid not null references public.orders(id) on delete cascade`
   - `previous_status text`
   - `new_status text not null`
   - `note text`
   - `created_by text default 'system'`
   - `created_at timestamptz default now()`

### 3.4 Payments & Cashfree Integration
8. `payments`:
   - `id uuid primary key default gen_random_uuid()`
   - `order_id uuid not null references public.orders(id) on delete cascade`
   - `provider text not null default 'CASHFREE'`
   - `cf_order_id text not null unique`
   - `cf_payment_session_id text`
   - `amount_in_paise integer not null`
   - `currency varchar(3) default 'INR'`
   - `status text not null default 'PENDING' check (status in ('PENDING', 'SUCCESS', 'FAILED', 'USER_DROPPED', 'FLAGGED'))`
   - `cf_payment_id text`
   - `payment_method jsonb`
   - `error_message text`
   - `created_at timestamptz default now()`
   - `updated_at timestamptz default now()`
9. `payment_events` (Idempotency & Webhook Log):
   - `id uuid primary key default gen_random_uuid()`
   - `event_id text unique` (cf_event_id or hashed payload)
   - `cf_order_id text not null`
   - `event_type text not null`
   - `raw_payload jsonb not null`
   - `processed boolean default false`
   - `created_at timestamptz default now()`

### 3.5 Marketing, Loyalty & Referrals
10. `coupons`:
    - `id uuid primary key default gen_random_uuid()`
    - `code text not null unique`
    - `description text`
    - `discount_type text not null default 'PERCENT' check (discount_type in ('PERCENT', 'FLAT'))`
    - `discount_value integer not null` (percent or paise)
    - `min_order_in_paise integer default 0`
    - `max_discount_in_paise integer`
    - `usage_limit integer`
    - `usage_count integer not null default 0`
    - `per_customer_limit integer default 1`
    - `expires_at timestamptz`
    - `active boolean not null default true`
    - `is_influencer boolean default false`
    - `influencer_name text`
    - `created_at timestamptz default now()`
11. `coupon_redemptions`:
    - `id uuid primary key default gen_random_uuid()`
    - `coupon_id uuid not null references public.coupons(id)`
    - `order_id uuid not null references public.orders(id)`
    - `customer_id uuid references public.profiles(id)`
    - `customer_phone text not null`
    - `discount_applied_in_paise integer not null`
    - `created_at timestamptz default now()`
12. `loyalty_accounts`:
    - `customer_id uuid primary key references public.profiles(id) on delete cascade`
    - `points_balance integer not null default 0 check (points_balance >= 0)`
    - `lifetime_points_earned integer not null default 0`
    - `tier text not null default 'FLORET' check (tier in ('FLORET', 'BLOSSOM', 'HEIRLOOM'))`
    - `updated_at timestamptz default now()`
13. `loyalty_transactions`:
    - `id uuid primary key default gen_random_uuid()`
    - `customer_id uuid not null references public.profiles(id) on delete cascade`
    - `order_id uuid references public.orders(id)`
    - `type text not null check (type in ('EARN_PURCHASE', 'REDEEM_PURCHASE', 'REFERRAL_BONUS', 'WELCOME_BONUS', 'ADJUSTMENT', 'REFUND_REVERSAL'))`
    - `points integer not null` (positive for credit, negative for debit)
    - `description text not null`
    - `created_at timestamptz default now()`
14. `referrals`:
    - `id uuid primary key default gen_random_uuid()`
    - `referrer_id uuid not null references public.profiles(id)`
    - `referee_id uuid references public.profiles(id)`
    - `referee_phone text not null`
    - `qualifying_order_id uuid references public.orders(id)`
    - `status text not null default 'PENDING' check (status in ('PENDING', 'QUALIFIED', 'REWARDED', 'DISQUALIFIED'))`
    - `reward_points integer not null default 100`
    - `created_at timestamptz default now()`

### 3.6 Shipping & Logistics
15. `shipments`:
    - `id uuid primary key default gen_random_uuid()`
    - `order_id uuid not null references public.orders(id) on delete cascade`
    - `carrier text not null default 'MANUAL' check (carrier in ('SHIPROCKET', 'DELHIVERY', 'INDIA_POST', 'MANUAL'))`
    - `tracking_number text`
    - `tracking_url text`
    - `shipping_label_url text`
    - `status text not null default 'PENDING' check (status in ('PENDING', 'MANIFESTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RTO_INITIATED', 'RTO_DELIVERED'))`
    - `estimated_delivery_date date`
    - `created_at timestamptz default now()`
    - `updated_at timestamptz default now()`
16. `shipment_events`:
    - `id uuid primary key default gen_random_uuid()`
    - `shipment_id uuid not null references public.shipments(id) on delete cascade`
    - `status text not null`
    - `location text`
    - `description text`
    - `occurred_at timestamptz not null default now()`

### 3.7 Site Configuration & Assets (Preserving Existing Functionality)
17. `navigation`: (Preserved from existing structure)
18. `site_assets`: (Preserved from existing structure)
19. `audit_logs`:
    - `id uuid primary key default gen_random_uuid()`
    - `actor_id uuid references auth.users(id)`
    - `action text not null`
    - `entity text not null`
    - `entity_id text`
    - `details jsonb`
    - `created_at timestamptz default now()`

---

## 4. Cashfree Payment & Webhook Lifecycle

```text
Customer Cart -> Click "Proceed to Checkout"
       │
       ▼
Serverless Function: POST /api/checkout/create-order
       │ 1. Validate items, pricing from DB, coupon & inventory
       │ 2. Create Order in DB (status: PENDING_PAYMENT)
       │ 3. Call Cashfree Orders API -> create PG order
       │ 4. Store cf_order_id & payment_session_id in DB
       ▼
Frontend: Opens Cashfree Checkout SDK (Drop-in or Seamless JS)
       │
       ▼
Customer completes payment (UPI / Card / NetBanking)
       │
       ├── Browser redirect to: /order-confirmation?order_id=TPB-...
       │
       └── (CRITICAL) Cashfree sends POST /api/payments/cashfree-webhook
                │
                ├── 1. Verify Cashfree Signature (HMAC-SHA256 with timestamp)
                ├── 2. Check Idempotency: Has event_id been processed?
                ├── 3. If PAYMENT_SUCCESS:
                │      - Mark payment as SUCCESS
                │      - Transition order to PAYMENT_CONFIRMED -> PROCESSING
                │      - Deduct inventory
                │      - Record coupon redemption
                │      - Award loyalty points to customer
                │      - Trigger referral qualification
                │      - Queue confirmation notification
                └── 4. Return HTTP 200 OK
```

---

## 5. Guest Checkout & Secure Historical Order Association

1. **Guest Flow:**
   - Any visitor can checkout by providing Name, Phone number, and Shipping Address.
   - Order is created with `customer_id = NULL`, `guest_phone`, and `guest_name`.
   - Access to order tracking is secured via `order_number` + `guest_phone` OTP or signed order token.
2. **Account Linking:**
   - If a customer later registers or logs in with verified phone/email, a server action matches past guest orders with the verified phone.
   - Past orders are safely linked to the customer's profile, and any accrued loyalty points can be credited to their new loyalty account.

---

## 6. Admin Role-Based Access Control (RBAC)

1. Admin users are stored in `profiles` with `role IN ('admin', 'super_admin')` or checked via `auth.users.raw_app_meta_data->>'role' = 'admin'`.
2. Supabase RLS policies enforce `auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))` for all mutation operations on sensitive tables.
3. `AdminRoute.tsx` will be refactored to verify both active session and admin role before mounting any admin screens.
