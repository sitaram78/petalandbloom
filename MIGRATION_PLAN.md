# THE PETAL & BLOOM — PHASED MIGRATION PLAN

**Plan Version:** 1.0.0  
**Target:** Implementation & Verification of `TARGET_ARCHITECTURE.md`  
**Execution Strategy:** Incremental, Phased, Non-Destructive, Rigorously Verified  
**Date:** 2026-09-29  

---

## MIGRATION PRINCIPLES
1. **Safety First:** The live storefront remains fully functional at all times.
2. **No Unverified Steps:** Every single phase must be proven to actually work before moving to the next.
3. **Rollback Ready:** Every change is backwards-compatible and testable independently.

---

## PHASE 1: SECURITY & API GATEWAY LOCKDOWN
> **Primary Goal:** Close the critical security holes by introducing central authentication middleware on `/api/*` and locking down all 6 vulnerable endpoints.

### 1.1 Implementation Steps
1. Create `api/lib/authMiddleware.ts`:
   - Helper function `withAuth(handler, requiredRoleOrPermission)`.
   - Validates incoming Supabase Auth JWT token from `Authorization: Bearer <token>`.
   - Queries `profiles` table to verify user identity, role, and permissions.
   - Rejects unauthenticated or unauthorized calls with HTTP `401` or `403`.
2. Secure `/api/settings/store.ts`:
   - Enforce `super_admin` permission on `POST` and `PUT` requests.
3. Secure `/api/reviews/moderate.ts`:
   - Enforce `admin` or `super_admin` permission for approve/unapprove/delete actions.
4. Secure `/api/payments/refund.ts`:
   - Enforce `super_admin` permission for triggering monetary refunds.
5. Secure `/api/orders/cancel.ts`:
   - Enforce authenticated staff role (`admin`, `super_admin`).
6. Secure `/api/shipping/book-shipment.ts`:
   - Enforce authenticated staff role (`admin`, `super_admin`).
7. Secure `/api/account/link-orders.ts`:
   - Verify that the calling user's JWT matches the `userId` requesting the order link.
8. Add IP rate limiting on `/api/account/signup.ts` to prevent bot spam.

### 1.2 Verification & Proof Criteria
- [ ] Send unauthenticated `POST` request to `/api/settings/store` → **Must return 401 Unauthorized**.
- [ ] Send unauthenticated `POST` request to `/api/reviews/moderate` → **Must return 401 Unauthorized**.
- [ ] Send unauthenticated `POST` request to `/api/payments/refund` → **Must return 401 Unauthorized**.
- [ ] Send authenticated `super_admin` request to `/api/settings/store` → **Must succeed with 200 OK**.
- [ ] Run `npx tsc --noEmit` → **0 errors**.

---

## PHASE 2: DATABASE INTEGRITY & REVERSAL AUTOMATION
> **Primary Goal:** Eliminate financial/loyalty leaks, enforce coupon limits, and handle abandoned order expiration.

### 2.1 Implementation Steps
1. Create SQL Migration `20260929000003_data_integrity_fixes.sql`:
   - Add trigger or automated function for Loyalty Reversals:
     - When order transitions to `CANCELLED` or `REFUNDED`, insert negative record into `loyalty_transactions`.
     - Automatically recalculate `loyalty_accounts.points_balance`.
2. Update `/api/coupons/validate.ts` & `/api/checkout/create-order.ts`:
   - Implement strict check for `coupons.per_customer_limit`.
   - Query `coupon_redemptions` by customer phone/email. If limit reached, reject coupon with clear error message.
3. Implement Abandoned Checkout Expiration:
   - Mark orders in `PENDING_PAYMENT` older than 60 minutes as `PAYMENT_EXPIRED`.
4. Ensure Made-to-Order vs. Stocked Inventory distinction is atomic:
   - Atomic decrements for stock items (`WHERE inventory_count >= qty`).
   - Made-to-order items cleanly bypass stock decrements.

### 2.2 Verification & Proof Criteria
- [ ] Create an order, confirm payment, verify points earned → Cancel order → **Verify points are automatically deducted back from balance**.
- [ ] Attempt to use a `per_customer_limit = 1` coupon a second time with the same phone number → **Must be rejected with "Already claimed" error**.
- [ ] Run `npx tsc --noEmit` → **0 errors**.

---

## PHASE 3: ROLES, PERMISSIONS (RBAC) & FEATURE FLAGS
> **Primary Goal:** Build the 4-Drawer configuration system and allow Super Admin to toggle features and customize business rules without editing code.

### 3.1 Implementation Steps
1. Expand `store_settings` table:
   - Add JSONB column `feature_flags`:
     `{ enable_loyalty: true, enable_coupons: true, enable_influencers: true, enable_reviews: true, enable_live_chat: true, maintenance_mode: false }`
   - Add business rule columns:
     `free_shipping_threshold_paise`, `standard_shipping_fee_paise`, `gift_wrap_fee_paise`, `loyalty_spend_per_point_paise`, `loyalty_point_redemption_paise`, `min_loyalty_order_paise`.
2. Update `StoreSettingsContext.tsx`:
   - Expose feature flags and business rules to the application.
3. Update `create-order.ts` and `CartDrawer.tsx`:
   - Read shipping thresholds, gift wrap fees, and points values dynamically from settings instead of hardcoded numbers.
4. Implement Graceful Degradation:
   - If `enable_loyalty = false`, hide loyalty widget in cart and ignore loyalty calculations in checkout without errors.

### 3.2 Verification & Proof Criteria
- [ ] Toggle `enable_loyalty` to `false` in Admin Settings → Open Cart Drawer → **Loyalty points toggle cleanly disappears; checkout completes normally with 0 loyalty discount**.
- [ ] Change Free Shipping Threshold from ₹1,200 to ₹500 in Admin Settings → **Cart correctly applies Free Shipping on a ₹600 order without code deployment**.
- [ ] Run `npx tsc --noEmit` → **0 errors**.

---

## PHASE 4: COMMERCE & DOMAIN ENGINES DECOUPLING
> **Primary Goal:** Cleanly isolate domain services, finish the Referral reward lifecycle, and fix Influencer commission tracking.

### 4.1 Implementation Steps
1. Formalize Domain Service Interfaces:
   - `src/services/couponService.ts`
   - `src/services/loyaltyService.ts`
   - `src/services/shippingService.ts`
2. Complete Referral Reward Automation:
   - In `cashfree-webhook.ts`, when an order completes:
     - Check if customer was referred.
     - If referee's first completed order, award 100 points to referrer.
     - Update `referrals` status from `PENDING` to `REWARDED`.
     - Send notification email to referrer.
3. Fix Influencer Commission Calculations (`AdminInfluencers.tsx`):
   - Replace in-memory full order table download with fast server aggregation query.
   - Respect creator's custom `commission_percent` instead of hardcoded 10%.
   - Add "Record Commission Payout" button with payout audit history.

### 4.2 Verification & Proof Criteria
- [ ] Complete first purchase using a referral code → **Referrer account is automatically credited with 100 points and status updates to REWARDED**.
- [ ] View Influencers admin screen → **Commission respects custom rate; load time is instantaneous (<100ms)**.
- [ ] Run `npx tsc --noEmit` → **0 errors**.

---

## PHASE 5: ADMIN BACKOFFICE & REALTIME ASSISTANCE
> **Primary Goal:** Route admin UI actions through authenticated APIs, make audit logging server-enforced, and replace 2-second chat polling with Supabase Realtime.

### 5.1 Implementation Steps
1. Connect Admin Screens to Authenticated APIs:
   - Move direct Supabase mutations in `AdminOrders.tsx`, `AdminCustomers.tsx`, `AdminSettings.tsx` to secure `/api/admin/*` endpoints.
2. Server-Enforced Tamper-Proof Audit Logging:
   - Update API mutation handlers to automatically record `audit_logs` entries on the server with verified `actor_id` from JWT session.
3. Upgrade Live Concierge Chat (`AdminMessages.tsx` & `AtelierConciergeWidget.tsx`):
   - Replace `setInterval(fetchConversations, 2000)` with `supabase.channel('assistance_realtime').on('postgres_changes', ...)`.
   - Eliminate battery drain and continuous database queries.

### 5.2 Verification & Proof Criteria
- [ ] Change order status in `AdminOrders.tsx` → **Check `audit_logs` table → Exact verified admin email and old/new status diff recorded automatically**.
- [ ] Send customer message from storefront widget → **Instantly appears in AdminMessages without waiting for a 2-second timer**.
- [ ] Run `npx tsc --noEmit` → **0 errors**.

---

## PHASE 6: PERFORMANCE, BUNDLE SPLITTING & FINAL VERIFICATION
> **Primary Goal:** Optimize mobile loading speeds, verify all end-to-end flows, and complete production build.

### 6.1 Implementation Steps
1. Route-Level Code Splitting (`App.tsx`):
   - Wrap admin pages and heavy secondary tools in `React.lazy()` and `<Suspense fallback={<AtelierLoadingScreen />}>`.
   - Keep initial storefront bundle minimal.
2. Build & Type Check Verification:
   - Execute `npx tsc --noEmit`.
   - Execute `npm run build` and inspect chunk sizes.
3. End-to-End Walkthrough Verification:
   - Guest Customer: Browse bouquet → Add to cart → Apply coupon → Checkout → Verify Cashfree popup.
   - Admin: Log in → View dashboard → Update order status → Inspect drawer → Verify audit log.

### 6.2 Verification & Proof Criteria
- [ ] Initial JS bundle drops from >500 kB to ~120 kB.
- [ ] `npm run build` succeeds with **0 errors**.
- [ ] Complete customer purchase and admin fulfillment cycle verified functional.

---

## SUMMARY OF ACCEPTANCE GATEWAYS

| Phase | Core Deliverable | Gate Check |
| :--- | :--- | :--- |
| **Phase 1** | Security Lockdown | Unauthenticated requests to sensitive APIs are blocked with 401/403. |
| **Phase 2** | Data Integrity | Cancelled orders reverse points; single-use coupons cannot be reused. |
| **Phase 3** | Settings & Flags | Super Admin can toggle features & change shipping rules without code edits. |
| **Phase 4** | Domain Services | Referrals reward automatically; influencer commissions calculate accurately. |
| **Phase 5** | Admin & Realtime | Tamper-proof server audit trail active; live chat uses Realtime (no polling). |
| **Phase 6** | Speed & Build | Storefront code-split to ~120 kB; clean production build with 0 errors. |
