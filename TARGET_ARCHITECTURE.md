# THE PETAL & BLOOM — TARGET ARCHITECTURE SPECIFICATION

**Document Version:** 1.0.0  
**Status:** APPROVED FOR PHASED EXECUTION  
**Date:** 2026-09-29  
**Platform:** The Petal & Bloom (Luxury Crochet & Floral Boutique)

---

## 1. ARCHITECTURAL PHILOSOPHY & OBJECTIVES

### 1.1 The Golden Principle
> **"Features do not own the system. The system owns the features."**

Secondary features (Loyalty, Coupons, Influencers, Referrals, Live Chat) are modular domain plugins. The core commerce engine (Catalog, Cart, Checkout, Payments, Orders) operates independently through formal contracts and can gracefully degrade if any secondary feature is toggled off or temporarily unavailable.

### 1.2 Non-Negotiables
1. **Frontend Preservation:** 100% retention of the approved Atelier visual identity (Fraunces serif headings, Karla body, linen/bark/rose palette, asymmetric border radiuses, and smooth micro-animations).
2. **Server-Side Financial & Security Authority:** The browser is a presentation layer. All prices, discounts, points, permissions, and payment amounts are calculated and validated by authoritative server-side logic.
3. **Verified Functional Reality:** Every phase requires rigorous code-level validation, zero TypeScript errors (`npx tsc --noEmit`), clean production builds, and verified execution paths.

---

## 2. HIGH-LEVEL TARGET SYSTEM ARCHITECTURE

```text
                                  CLIENT LAYER
            ┌─────────────────────────────────────────────────────────┐
            │   Preserved Luxury Atelier Storefront & Admin Portal    │
            │   (React 18 SPA + Vite + Tailwind CSS + Context State)  │
            └────────────────────────────┬────────────────────────────┘
                                         │  HTTPS / JSON / Bearer JWT
                                         ▼
                             API GATEWAY / MIDDLEWARE
            ┌─────────────────────────────────────────────────────────┐
            │  1. Request Trace ID & Correlation Header               │
            │  2. Session & Auth Verification (Supabase Auth JWT)     │
            │  3. Role & Permission Evaluator (RBAC)                  │
            │  4. Central Rate Limiter & Abuse Prevention             │
            │  5. Dynamic Feature Flag & Maintenance Interceptor      │
            └────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
                              APPLICATION DOMAIN CORE
            ┌────────────────────────────┴────────────────────────────┐
            │                                                         │
       CATALOG SERVICE                               COMMERCE ENGINE  │
  ┌───────────────────────┐                     ┌───────────────────┐ │
  │ • Category Hierarchy  │                     │ • Cart Calculator │ │
  │ • Product Data Model  │                     │ • Checkout Flow   │ │
  │ • Stock Availability  │                     │ • Order Lifecycle │ │
  │ • Atelier Lead Times  │                     │   (State Machine) │ │
  └───────────────────────┘                     └─────────┬─────────┘ │
                                                          │           │
            ┌─────────────────────────────────────────────┘           │
            ▼                                                         │
     DOMAIN SERVICES (Isolated Interfaces)                            │
  ┌─────────────────────────────────────────────────────────────────┐ │
  │ • Pricing & Coupon Engine (Single-use, caps, min-spend)         │ │
  │ • Payment Gateway Adapter (Cashfree Prepaid, HMAC Webhooks)     │ │
  │ • Shipping & Carrier Adapter (Delhivery, Shiprocket, Manual)    │ │
  │ • Loyalty Points Service (Double-Entry Ledger, Auto-Reversals)  │ │
  │ • Referral Service (Anti-Abuse Attribution & Milestones)        │ │
  │ • Notification Hub (Resend Transactional Email & WhatsApp)      │ │
  │ • Audit Logger (Server-enforced, Tamper-Proof Trail)            │ │
  └──────────────────────────────┬──────────────────────────────────┘ │
                                 │                                    │
                                 ▼                                    │
                  CENTRAL CONFIGURATION & RBAC                        │
  ┌─────────────────────────────────────────────────────────────────┐ │
  │ • 4-Drawer Settings System (Secrets, Business Rules, Flags, UI) │ │
  │ • Granular Permissions: Super Admin, Operations, Support        │ │
  └──────────────────────────────┬──────────────────────────────────┘ │
                                 │                                    │
                                 ▼                                    │
                     DATA PERSISTENCE & STORAGE                       │
  ┌─────────────────────────────────────────────────────────────────┐ │
  │ • Supabase PostgreSQL (Row-Level Security + Clean Relations)     │ │
  │ • Supabase Storage (Site Assets & Media)                        │ │
  │ • Supabase Realtime (Instant Live Concierge Messaging)          │ │
  └─────────────────────────────────────────────────────────────────┘ │
```

---

## 3. SECURITY & API GATEWAY SPECIFICATION

### 3.1 Unified API Security Middleware (`api/lib/authMiddleware.ts`)
All serverless endpoints in `/api/*` will route through a standard security wrapper:

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'operations' | 'support' | 'customer';
  permissions: string[];
}

export function withAuth(
  handler: (req: VercelRequest, res: VercelResponse, user: AuthenticatedUser) => Promise<void>,
  requiredPermission?: string
)
```

1. **Token Extraction:** Verifies the `Authorization: Bearer <JWT>` header using Supabase Auth.
2. **Permission Check:** Evaluates whether `user.permissions` includes `requiredPermission`.
3. **Unauthorized Handling:** Returns standardized HTTP `401 Unauthorized` or `403 Forbidden` JSON with no internal server details leaked.

### 3.2 Endpoint Access Control Matrix

| Endpoint | Method | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/checkout/create-order` | POST | Public (with Rate Limit) | Creates pending order & initiates Cashfree session |
| `/api/payments/cashfree-webhook`| POST | Cashfree HMAC Signature | Authoritative payment confirmation & order confirmation |
| `/api/payments/refund` | POST | `refunds.issue` (Super Admin) | Issues monetary refund via Cashfree & updates records |
| `/api/orders/cancel` | POST | `orders.cancel` (Admin/Ops) | Cancels order and triggers automated reversals |
| `/api/settings/store` | POST/PUT | `settings.update` (Super Admin) | Updates business configuration & logistics settings |
| `/api/reviews/moderate` | POST | `reviews.moderate` (Support/Admin) | Approves, unpublishes, or deletes customer reviews |
| `/api/account/link-orders` | POST | Authenticated Customer (Self) | Links historical guest orders matching verified phone/email |
| `/api/shipping/book-shipment` | POST | `shipping.book` (Ops/Admin) | Generates AWB tracking number & books courier pickup |
| `/api/audit/list` | GET | `audit.view` (Super Admin) | Reads immutable system audit trail |

---

## 4. DATABASE & DATA INTEGRITY ARCHITECTURE

### 4.1 Authoritative Master Schema
- Master source of truth: `supabase/schema.sql`.
- Inconsistent legacy files (`COMPLETE_NEW_SETUP.sql`) are formally superseded and archived.

### 4.2 Data Integrity Upgrades
1. **Loyalty Double-Entry Ledger:**
   - `loyalty_accounts.points_balance` is strictly mirrored by `loyalty_transactions`.
   - Any order cancellation or refund executes an automated reversal:
     ```sql
     INSERT INTO loyalty_transactions (customer_id, order_id, type, points, description)
     VALUES (v_customer_id, v_order_id, 'REVERSAL_CANCELLED', -v_points, 'Points deducted due to order cancellation');
     ```
2. **Single Payment Authority:**
   - `payments` table is the sole source of truth for payment status.
   - `orders.payment_status` is updated strictly via the verified Cashfree webhook.
3. **Pending Order Lifecycle & Housekeeping:**
   - Orders in `PENDING_PAYMENT` are held for a maximum of 60 minutes.
   - Unpaid checkouts automatically transition to `PAYMENT_EXPIRED` to prevent inventory locking and report distortion.
4. **Made-to-Order vs. Stocked Inventory:**
   - Products with `is_made_to_order = true` bypass stock quantity restrictions.
   - Limited ready-to-ship pieces (`is_made_to_order = false`) employ atomic database decrements:
     ```sql
     UPDATE products 
     SET inventory_count = inventory_count - v_qty 
     WHERE code = v_code AND inventory_count >= v_qty;
     ```

---

## 5. COMMERCE & DOMAIN ENGINES DECOUPLING

### 5.1 Pricing & Coupon Engine
- **Decoupled Interface:** `validateCoupon(code, subtotalInPaise, customerPhone, customerEmail)`
- **Enforcements:**
  1. `active == true` and `now() < expires_at`
  2. `subtotalInPaise >= min_order_in_paise`
  3. Single-use enforcement: Queries `coupon_redemptions` by customer contact to ensure `usage_count < per_customer_limit`.
  4. Discount calculation: Supports `PERCENT` (capped at `max_discount_in_paise`) and `FLAT`.

### 5.2 Payment Gateway Adapter (Cashfree)
- **Prepaid Only:** Standardized flow through Cashfree SDK modal.
- **Idempotent Webhook Processing:**
  - Evaluates `payment_events.event_id`. If already processed, immediately responds with `200 OK`.
  - Atomically transitions order to `PAYMENT_CONFIRMED`, decrements stock, issues loyalty points, and dispatches confirmation email.

### 5.3 Shipping & Carrier Service
- **Provider Abstraction (`src/services/shippingService.ts`):**
  - Carrier adapters for `DELHIVERY`, `SHIPROCKET`, `INDIA_POST`, and `MANUAL`.
  - Centralized tracking URL generation and human-readable crafting/delivery window estimators.
  - Automated status synchronization hooks when carriers post milestone webhooks.

### 5.4 Referral & Affiliate Engine
- **Referral Attribution:** 14-day persistent referral attribution for new customers.
- **Milestone Rewards:** Referrer receives 100 Petal Points upon verified completion of the referee's first purchase.
- **Influencer Payouts:** Respects individual creator `commission_percent` and adds administrative payout tracking (`commission_paid_inr`, payout history).

---

## 6. CONFIGURATION & FEATURE FLAGS (THE 4-DRAWER MODEL)

```text
DRAWER 1: DEPLOYMENT SECRETS (Environment Variables)
├── SUPABASE_SERVICE_ROLE_KEY
├── CASHFREE_APP_ID & CASHFREE_SECRET_KEY
├── CASHFREE_WEBHOOK_SECRET
└── RESEND_API_KEY

DRAWER 2: BUSINESS SETTINGS (Database: store_settings)
├── Free Shipping Minimum Spend (Default: ₹1,200)
├── Standard Shipping Fee (Default: ₹69)
├── Express Shipping Fee (Default: ₹49)
├── Gift Wrap Charge (Default: ₹79 / item)
├── Loyalty Earning Ratio (Default: 1 pt per ₹20 spent)
├── Loyalty Redemption Value (Default: 1 pt = ₹0.50)
└── Minimum Order for Points (Default: ₹299)

DRAWER 3: FEATURE FLAGS (Database: store_settings.feature_flags)
├── ENABLE_LOYALTY (Default: true)
├── ENABLE_COUPONS (Default: true)
├── ENABLE_INFLUENCER_PROGRAM (Default: true)
├── ENABLE_REVIEWS (Default: true)
├── ENABLE_LIVE_CHAT (Default: true)
└── STORE_MAINTENANCE_MODE (Default: false)

DRAWER 4: PUBLIC BRAND PROFILE (Database: store_settings)
├── WhatsApp Support Number (+91 9861615937)
├── Support Email (concierge@thepetalandbloom.com)
├── Instagram Handle (@thepetalandbloom)
└── Studio Crafting Address & GSTIN
```

**Graceful Degradation Guarantee:** When any feature flag in Drawer 3 is disabled, the frontend UI removes the feature's interactive controls, and backend APIs treat the feature as a zero-op without errors.

---

## 7. ADMIN CONTROL CENTER & AUDIT LOGGING

### 7.1 Unified View System Integration
- Standardized UI across all admin screens:
  - `AdminViewHeader`: KPI summary metrics & executive actions.
  - `AdminViewToolbar`: Debounced search, count badges, and view mode switcher (`table`, `grid`, `kanban`).
  - `AdminEntityDrawer`: Slide-over inspector replacing popup modals.
  - `AdminKanbanBoard`: Pipeline stage columns for fulfillment and moderation.
- Direct database writes from client components are replaced with authenticated API calls.

### 7.2 Server-Enforced Tamper-Proof Audit Trail
- All state-altering operations automatically insert records into `audit_logs` server-side:
  - `actor_id` and `actor_email` derived directly from verified JWT session.
  - `old_values` and `new_values` JSON diff snapshot.
  - Client cannot forge or delete audit log entries.

### 7.3 Supabase Realtime for Concierge Messages
- Replaces the 2-second HTTP polling loop in `AdminMessages.tsx` with Supabase native WebSocket channel subscriptions (`assistance_conversations`, `assistance_messages`).
- 0ms latency, zero battery or server quota drain.

---

## 8. PERFORMANCE & SEO SPECIFICATION

### 8.1 Route-Level Code Splitting
- Storefront routes and Admin routes are split using `React.lazy()` and `React.Suspense`.
- Initial storefront bundle drops from >500 kB to ~120 kB.
- Admin dependencies (recharts, CSV export, heavy tables) are only fetched when navigating to `/admin/*`.

### 8.2 SEO & Social Sharing
- Public product pages dynamically generate Open Graph headers for rich preview cards across WhatsApp, Instagram, and iMessage.
- XML Sitemap generator (`/api/sitemap.ts`) automatically indexes active product and category routes.

---

## 9. VERIFICATION & QUALITY ASSURANCE PROTOCOL

No phase will be considered complete without satisfying these explicit criteria:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. STATIC ANALYSIS: npx tsc --noEmit (0 errors)             │
├─────────────────────────────────────────────────────────────┤
│ 2. BUILD VERIFICATION: npm run build (clean bundle)         │
├─────────────────────────────────────────────────────────────┤
│ 3. PERMISSION TEST: Unauthorized API requests return 401/403│
├─────────────────────────────────────────────────────────────┤
│ 4. INTEGRITY TEST: Cancelled orders cleanly reverse points  │
├─────────────────────────────────────────────────────────────┤
│ 5. UX TEST: Zero visual regression on storefront or admin   │
└─────────────────────────────────────────────────────────────┘
```
