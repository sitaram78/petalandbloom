# Remaining Implementation Roadmap — The Petal & Bloom
**Audit Date:** 28 September 2026  
**Format:** Prioritised by business impact and implementation effort

---

## Priority Levels
| Priority | Meaning |
|---------|---------|
| 🔴 P0 — Blocker | Must fix before going live. Without this, the platform will fail or lose customers. |
| 🟠 P1 — Critical | Must fix within first 2 weeks of launch. Significant revenue or trust impact. |
| 🟡 P2 — Important | Should complete within first month. Important for retention or operations. |
| 🟢 P3 — Enhancement | Nice-to-have for premium positioning. Do after P0–P2 are complete. |

---

## PHASE 0 — Pre-Launch Blockers (Complete Before Accepting Real Payments)

### P0-1: Cashfree Live Credentials
**What:** Switch Cashfree from SANDBOX to PRODUCTION mode  
**Where:** `.env` and Vercel environment variables  
**What to change:**
- `CASHFREE_ENVIRONMENT=SANDBOX` → `CASHFREE_ENVIRONMENT=PRODUCTION`
- `CASHFREE_APP_ID` → Live App ID from Cashfree Dashboard
- `CASHFREE_SECRET_KEY` → Live Secret Key
- `CASHFREE_WEBHOOK_SECRET` → Separate webhook secret (not the same as secret key)
- Register webhook URL: `https://thepetalandbloom.vercel.app/api/payments/cashfree-webhook`
- **In `src/lib/cashfree.ts`:** Change `environment: 'sandbox'` to `environment: 'production'`
- **Remove** the `is_simulated` simulation flag when switching to production  
**Effort:** 30 minutes

### P0-2: Transactional Email (Order Confirmation + Dispatch)
**What:** Send automated emails at two points: (1) order confirmed, (2) order shipped  
**Recommended service:** Resend (free tier: 3,000 emails/month) or SendGrid  
**Implementation points:**
1. Create `api/lib/emailService.ts` — wraps Resend/SendGrid SDK
2. In `api/payments/cashfree-webhook.ts` (after payment confirmed): call `sendOrderConfirmationEmail()`
3. In `AdminOrders.tsx` "Save & Notify" button (when status → SHIPPED): call `POST /api/orders/notify`
4. Create `api/orders/notify.ts` — sends dispatch email with AWB + tracking URL  
**Template required:**
- Order Confirmation: Order number, items, total, estimated delivery, track link
- Dispatch notification: Order number, carrier, AWB, tracking link  
**Effort:** 4–6 hours

### P0-3: Initialize Git Repository
**What:** The project has no version control. This is a critical risk.  
**Commands:**
```bash
cd /home/sitaram/Desktop/thepetalandbloom
git init
git add .
git commit -m "Initial commit: The Petal & Bloom v1.0"
```
Then push to GitHub/GitLab for backup and CI/CD.  
**Effort:** 15 minutes

---

## PHASE 1 — Critical (Week 1 Post-Launch)

### P1-1: Google Analytics 4 (GA4)
**What:** Insert GA4 snippet so `trackEvent()` calls reach Google Analytics  
**Where:** `index.html` — add inside `<head>`  
**Code to add:**
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```
**Note:** Replace `G-XXXXXXXXXX` with actual GA4 measurement ID.  
**Effort:** 20 minutes

### P1-2: Revenue / KPI Dashboard for Admin
**What:** Replace `AdminDashboard.tsx` product-only view with business metrics  
**Metrics to add:**
- Total revenue (all time, last 30 days, today)
- Total orders (with breakdown by status)
- Average order value (AOV)
- Loyalty points issued / redeemed
- New customers (last 30 days)
- Top 5 products by revenue  
**Implementation:** Query `orders` table with date filters + aggregate functions  
**Effort:** 4–6 hours

### P1-3: Tier Auto-Upgrade Logic
**What:** Customer tiers (Floret/Blossom/Heirloom) never update — everyone stays FLORET  
**Fix options:**
- **Option A (PostgreSQL trigger):** Create a trigger on `loyalty_transactions` that updates `loyalty_accounts.tier` when `lifetime_points_earned` crosses thresholds
- **Option B (Webhook):** After awarding points in `cashfree-webhook.ts`, check lifetime earned and update tier

**Tier thresholds:**
- Floret: 0–499 `lifetime_points_earned`
- Blossom: 500–1499 `lifetime_points_earned`
- Heirloom: 1500+ `lifetime_points_earned`

**Effort:** 1–2 hours

### P1-4: Product Schema (JSON-LD) on Product Detail Pages
**What:** Add `Product` schema to each PDP for Google Shopping indexing  
**Where:** `src/pages/ProductDetail.tsx` inside the `<SEO>` component  
**Data to include:** name, description, image, price, currency (INR), availability, brand  
**Why:** Without this, products are not indexed for Google Shopping — significant traffic loss.  
**Effort:** 1–2 hours

### P1-5: Inventory Display on PDP
**What:** Show `inventory_count` on the product detail page  
**Where:** `ProductDetail.tsx` — after price, before add-to-cart  
**UX:**
- If `inventory_count <= 5`: show "Only X left — order soon"
- If `inventory_count === 0` and `is_made_to_order`: show "Made to Order — 3–5 days crafting"
- Out-of-stock non-MTO: disable "Add to Bag"  
**Effort:** 1–2 hours

### P1-6: WhatsApp Notification on Order Dispatch
**What:** When admin marks order as SHIPPED, send a WhatsApp message to customer  
**Options:**
- **Manual deep link** (immediate, free): On "Save & Notify" click, open `https://wa.me/{phone}?text={message}` with AWB + tracking URL pre-filled
- **WhatsApp Business API** (automated, paid): Gupshup / Interakt / Wati  
**Recommendation:** Start with manual deep link (5 minutes of implementation) as immediate fix, then upgrade to API  
**Effort:** 30 minutes (manual) or 1–2 weeks (API)

---

## PHASE 2 — Important (Month 1 Post-Launch)

### P2-1: Admin Customer CRM Page
**What:** Create `src/pages/admin/AdminCustomers.tsx`  
**Features (Phase 1):**
- Customer list with search (name, phone, email)
- Sort by: signup date, LTV, order count, loyalty tier
- Single customer view: profile, orders, loyalty balance, addresses  
**Features (Phase 2):**
- Manually award / deduct loyalty points (with reason note)
- Export customer list to CSV
- Filter by tier  
**Effort:** 8–12 hours

### P2-2: Referral System Implementation
**What:** Make referral codes actually work  
**Implementation:**
1. On signup form, add optional "Referral Code" input field
2. In `api/account/signup.ts`: validate referral code, populate `profiles.referred_by`
3. Insert row in `referrals` table: `{ referrer_id, referee_id, status: 'PENDING' }`
4. On referee's first successful payment (webhook): award 100 pts to referrer, update `referrals.status = 'REWARDED'`
5. In customer dashboard Referrals tab: show referred count + pts earned  
**Effort:** 4–6 hours

### P2-3: Address Edit in Customer Dashboard
**What:** Currently addresses can only be added or deleted, not edited  
**Where:** `Account.tsx` addresses tab  
**Add:** Edit modal/form that populates existing address values  
**Effort:** 2–3 hours

### P2-4: Tier Benefits Display
**What:** Tell customers what each tier gives them (currently tiers exist but mean nothing to the customer)  
**Where:** Customer Account loyalty tab  
**Benefits to define and display:**
- Floret: Standard earn rate
- Blossom: 1.25x earn rate on purchases (not yet implemented)
- Heirloom: Free shipping + 1.5x earn rate + early access  
**Note:** Benefits must be implemented backend too — not just display  
**Effort:** 2 hours (display only) or 6–8 hours (full implementation)

### P2-5: Wishlist Persistence to Supabase
**What:** Save wishlist to `customer_wishlists` table for logged-in users  
**Where:** `WishlistContext.tsx`  
**Schema needed:** `{ customer_id, product_code, created_at }`  
**On login:** Merge localStorage wishlist with server wishlist  
**Effort:** 3–4 hours

### P2-6: "Free Shipping" Nudge in Cart
**What:** Show "Add ₹X more for free shipping" when subtotal is between ₹0–₹1199  
**Where:** `CartDrawer.tsx` — below cart items, above coupon section  
**Logic:**
- If subtotal < ₹1200: show "Add ₹{1200 - subtotal} more for complimentary delivery"
- If subtotal >= ₹1200: show "✓ Complimentary delivery applied"  
**Effort:** 30 minutes

### P2-7: Order Cancellation Workflow
**What:** Allow customer or admin to cancel PENDING or PROCESSING orders  
**Customer-facing:** Add "Cancel Order" button in Account.tsx orders tab (only for PENDING_PAYMENT or PROCESSING status)  
**Admin-facing:** Already has CANCELLED status option in dropdown  
**Backend:** `api/orders/cancel.ts` — updates status, restores inventory, triggers refund if paid  
**Effort:** 4–6 hours

### P2-8: Refund Workflow
**What:** Process refunds for cancelled paid orders via Cashfree Refund API  
**Implementation:**
1. Create `api/payments/refund.ts` — calls Cashfree `POST /refunds` with `cf_payment_id` and amount
2. Add refund button in `AdminOrders.tsx` (only visible for PAYMENT_CONFIRMED orders)
3. Record refund in `payments` table  
**Effort:** 4–6 hours

---

## PHASE 3 — Enhancements (Months 2–3)

### P3-1: Verified Product Reviews
**What:** Allow customers who purchased a product to leave a review  
**Schema needed:** `product_reviews` table: `{ product_code, customer_id, order_id, rating (1-5), review_text, photos[], created_at, is_verified, is_approved }`  
**Customer flow:** Post-delivery email with "Leave a Review" link → simple 1-5 star + text + optional photo  
**Admin flow:** Review moderation in admin  
**Display:** On PDP, aggregate rating + individual reviews  
**Effort:** 12–16 hours

### P3-2: Shiprocket API Integration
**What:** Auto-book shipments via Shiprocket API instead of manual AWB  
**Integration points:**
- On PACKED → trigger Shiprocket order creation via API
- Receive AWB automatically
- Auto-populate tracking URL  
**Note:** Requires Shiprocket account and API credentials  
**Effort:** 8–12 hours

### P3-3: Abandoned Cart Recovery
**What:** Email customers who added to cart but didn't complete checkout  
**Implementation approach:**
- Requires email capture before payment (done — guest email field)
- After 1 hour of inactivity: send recovery email with cart contents
- Needs email service (P0-2) + scheduled function or cron  
**Effort:** 6–8 hours (after email service is set up)

### P3-4: Instagram Feed Integration
**What:** Embed live Instagram feed as social proof on homepage or About page  
**Options:** Instagram Basic Display API (free) or EmbedSocial / Elfsight (paid widget)  
**Effort:** 2–4 hours

### P3-5: Custom Bouquet Builder → Direct Checkout
**What:** Allow custom bouquet configurations to be added directly to cart instead of only WhatsApp  
**Implementation:** Convert `CustomBouquetBuilder.tsx` final step to call `addItem()` with a custom product code (e.g., `CUSTOM-BOUQUET`) and encoded options  
**Challenge:** Custom bouquets need manual processing; needs admin workflow  
**Effort:** 6–8 hours

### P3-6: Product Variant / Inventory Management
**What:** Colour variants as separate inventory items (e.g., Pink Poppy - Red: 5 units, Pink: 3 units)  
**Schema change:** Add `product_variants` table  
**Effort:** 16–24 hours (significant schema change)

### P3-7: Sitemap.xml + robots.txt
**What:** Required for proper Google indexing  
**Implementation:**
- `public/robots.txt` — allow all, point to sitemap
- Generate dynamic `sitemap.xml` as Vercel function at `/api/sitemap.ts` — includes all product pages  
**Effort:** 2–3 hours

### P3-8: Facebook Pixel
**What:** Required for Facebook / Instagram ad retargeting  
**Where:** `index.html` — add FB Pixel base code  
**Events:** `ViewContent` on PDP, `AddToCart`, `InitiateCheckout`, `Purchase` (via `trackEvent()`)  
**Effort:** 1–2 hours

### P3-9: PWA (Progressive Web App)
**What:** Allow customers to "install" the site as an app on mobile  
**Implementation:** `public/manifest.json` + service worker via `vite-plugin-pwa`  
**Effort:** 4–6 hours

---

## Implementation Summary

| Phase | Items | Est. Total Hours | Depends On |
|-------|-------|-----------------|-----------|
| Phase 0 (Blockers) | 3 | 6–8h | Nothing |
| Phase 1 (Critical) | 6 | 12–17h | Phase 0 |
| Phase 2 (Important) | 8 | 28–40h | Phase 1 |
| Phase 3 (Enhancements) | 9 | 57–85h | Phase 2 |
| **Total** | **26** | **103–150h** | Sequentially |

---

## Recommended Launch Sequence

```
Week 1: Phase 0 (Blockers)
  → Git init, Cashfree live, Email service

Week 2: Phase 1 Critical items
  → GA4, Admin Dashboard KPIs, Tier upgrade, Product schema, Inventory display, WhatsApp dispatch link

Week 3–4: Phase 2 Priority items
  → Admin CRM, Referral system, Cart nudge, Refund workflow, Wishlist persistence

Month 2+: Phase 3 Enhancements
  → Reviews, Shiprocket, Abandoned cart, Instagram feed, Custom builder checkout
```

---

## What the Platform Gets Right (Do Not Break)

These are production-quality implementations that should be preserved and not refactored:

1. ✅ `api/checkout/create-order.ts` — 10-step pipeline with price validation, loyalty, coupon, and address auto-save
2. ✅ `api/payments/cashfree-webhook.ts` — Idempotent payment processing with full audit trail
3. ✅ Supabase RLS policies — Comprehensive security per `20260928000005_rls_policies.sql`
4. ✅ Admin/Customer login isolation — Bidirectional block
5. ✅ Design system (linen, bark, rose, Fraunces, Karla) — Consistent and premium
6. ✅ `src/pages/Account.tsx` customer dashboard — Luxury UI with tier bar, timeline, concierge links
7. ✅ `AdminAssets.tsx` — CMS-based image management for all site sections
8. ✅ `shippingService.ts` — Carrier abstraction with URL generation
