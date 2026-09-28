# CRM Audit — The Petal & Bloom
**Audit Date:** 28 September 2026

---

## Executive Summary

The Petal & Bloom has **no Customer Relationship Management (CRM) module** in the admin portal. While the underlying Supabase database contains all customer data (profiles, addresses, orders, loyalty, referrals), there is no interface for the admin to browse, filter, or act upon customer records.

---

## 1. What Exists in the Database

The following tables hold CRM-relevant data and are confirmed to exist in the Supabase schema:

| Table | Purpose | Status |
|-------|---------|--------|
| `profiles` | Customer identity (name, phone, email, role, referral code) | ✅ Data exists |
| `customer_addresses` | Saved delivery addresses | ✅ Data exists |
| `orders` | Order history per customer | ✅ Data exists |
| `loyalty_accounts` | Points balance, tier, lifetime earned | ✅ Data exists |
| `loyalty_transactions` | Full ledger (earn, redeem, welcome, referral) | ✅ Data exists |
| `referrals` | Referral tracking (referrer → referee) | ✅ Schema exists |
| `coupon_redemptions` | Which customer used which coupon | ✅ Schema exists |

## 2. What is Missing: Admin CRM Interface

There is **no `AdminCustomers.tsx` page** or equivalent. The admin cannot:

### 2.1 Customer Discovery
- ❌ View a list of all registered customers
- ❌ Search by name, phone, email, or referral code
- ❌ Filter by tier (Floret / Blossom / Heirloom)
- ❌ Filter by order count (0 orders = new, 1–3 = repeat, 4+ = loyal)
- ❌ View customer acquisition date

### 2.2 Customer Profile View
- ❌ Open a single customer card showing all personal details
- ❌ See lifetime order value (LTV) per customer
- ❌ View all orders placed by that customer
- ❌ View loyalty balance, tier, and full transaction ledger
- ❌ View saved addresses
- ❌ View referral connections (who they referred)
- ❌ See which coupons they have used

### 2.3 CRM Actions
- ❌ Manually award / deduct loyalty points (admin override)
- ❌ Send a WhatsApp or email to an individual customer
- ❌ Mark a customer as VIP or high-value
- ❌ Block / deactivate a customer account
- ❌ Change a customer's referral code
- ❌ Link guest orders to a customer profile manually

### 2.4 Segmentation & Marketing
- ❌ Filter customers by tier for targeted campaigns
- ❌ Export customer list to CSV (for Mailchimp, WhatsApp Business, etc.)
- ❌ View cohort data (signups per day/week/month)
- ❌ Identify customers with ≥X unused Petal Points (re-engagement)

---

## 3. Loyalty System — Implementation Review

The loyalty system is implemented server-side. Here is an evidence-based assessment:

### 3.1 Earn Mechanics ✅
- **Welcome Bonus:** 50 points on signup — implemented in `api/account/signup.ts`
- **Purchase Earn:** 1 point per ₹10 spent — implemented in `api/payments/cashfree-webhook.ts`
- **Referral:** `referrals` table exists in schema but earn logic for referrer not implemented

### 3.2 Redeem Mechanics ✅
- **At Checkout:** 1 point = ₹1 discount — implemented via `redeemPoints` in `create-order.ts`
- **Immediate Deduction:** Points deducted at order creation (step 8b), not just on payment
- **Idempotency:** Webhook checks existing `REDEEM_PURCHASE` transaction before deducting again

### 3.3 Tier System 🟡
| Tier | Threshold | Badge |
|------|-----------|-------|
| Floret | 0–499 pts | Base tier |
| Blossom | 500–1499 pts | Mid tier |
| Heirloom | 1500+ pts | Top tier |

- **Tier display:** ✅ Shown in customer dashboard loyalty tab with progress bar
- **Tier benefits:** ❌ No actual tier-gated benefits — early access, free shipping, bonus multipliers not implemented
- **Tier upgrades:** ❌ Tier column in `loyalty_accounts` is set to `'FLORET'` at signup but no auto-upgrade function exists when `lifetime_points_earned` crosses thresholds
- **Admin tier management:** ❌ No admin interface to grant tier upgrades or exceptions

### 3.4 Referral System 🟡
- `profiles.referral_code` column exists — unique code per customer
- `referrals` table exists in schema (migration confirmed)
- Referral code shown in customer dashboard "Referrals" tab
- **Referral tracking on signup:** ❌ Not implemented — `referred_by` in profiles is never populated
- **Referral bonus points:** ❌ Not implemented — no logic to award points when a referred customer signs up or places first order

---

## 4. Customer-Facing Account Portal — Assessment

The customer Account page (`src/pages/Account.tsx`) is comprehensive. Evidence-based review:

| Feature | Status |
|---------|--------|
| Tab: Orders | ✅ With 4-step crafting progress timeline, item thumbnails, financial breakdown |
| Tab: Loyalty | ✅ Points balance, tier bar, full transaction ledger |
| Tab: Referrals | ✅ Referral code display with share link |
| Tab: Addresses | ✅ CRUD for saved addresses |
| Tab: Profile | ✅ Update name, phone, email |
| Guest order linking on signup | ✅ `api/account/signup.ts` step 4 |
| Auto-save address at checkout | ✅ Server-side deduplication in `create-order.ts` step 8c |

---

## 5. Critical CRM Gaps for Production

Ranked by business impact:

1. **No Admin Customer Directory** — Admin cannot find a customer, check their order history, or take any action without querying Supabase directly
2. **No Loyalty Admin Controls** — Cannot manually credit/debit points for goodwill, refund compensation, or error correction
3. **No Tier Auto-Upgrade Logic** — Customers who accumulate 500+ points remain on `FLORET` tier indefinitely
4. **No Referral Tracking Implementation** — Referral codes exist but serve no function
5. **No Customer Export** — No way to extract customer list for external marketing tools
6. **Wishlist Not Persisted** — Wishlist uses localStorage only; lost on device change or browser clear; not queryable by admin
7. **No Re-engagement Triggers** — Cannot identify or reach customers who haven't ordered in 30/60/90 days

---

## 6. Recommended CRM Roadmap

### Phase 1 — Minimum Viable CRM (immediate)
- Create `AdminCustomers.tsx` with customer list, search, and single customer view
- Add loyalty admin controls (award/deduct points)
- Fix tier auto-upgrade function (PostgreSQL trigger or webhook logic)

### Phase 2 — Engagement CRM
- Implement referral tracking on signup (populate `referred_by`, award referrer points)
- Add customer CSV export
- Persist wishlist to Supabase for logged-in customers

### Phase 3 — Marketing CRM
- Segment by tier, LTV, last order date
- Integrate Mailchimp / WhatsApp Business API for automated campaigns
- Create re-engagement coupon automation (e.g., auto-issue 20% coupon after 60 days of inactivity)
