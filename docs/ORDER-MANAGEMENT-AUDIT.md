# Order Management Audit — The Petal & Bloom
**Audit Date:** 28 September 2026

---

## Executive Summary

Order management is the **strongest operational component** of the platform. The order creation pipeline, payment processing, status management, and logistics tracking are all substantially implemented. Key gaps are: no automated notifications, no refund workflow, no Shiprocket/Delhivery API, and basic admin analytics only.

---

## 1. Order Creation Pipeline

**File:** `api/checkout/create-order.ts`

The pipeline is well-structured with clear numbered steps:

| Step | Description | Status |
|------|-------------|--------|
| 1 | Validate customer name, phone, address, pincode, items | ✅ |
| 2 | Fetch authoritative prices from database (anti-price-tampering) | ✅ |
| 3 | Server-side coupon evaluation (expiry, limit, min-order, PERCENT/FLAT) | ✅ |
| 4 | Loyalty point redemption (with balance check) | ✅ |
| 5 | Tiered shipping fee calculation (₹69/₹49/free) | ✅ |
| 6 | Human-readable order number generation (`TPB-{base36}-{random4}`) | ✅ |
| 7 | Insert `orders` record with full snapshot | ✅ |
| 7b | Insert `order_items` (price snapshot at time of order) | ✅ |
| 8 | Insert initial `order_status_history` entry | ✅ |
| 8b | Immediate loyalty point deduction (prevents oversell) | ✅ |
| 8c | Auto-save new delivery address to customer profile | ✅ |
| 9 | Create Cashfree PG session | 🔒 SANDBOX |
| 10 | Record `payments` row | ✅ |

**Strengths:**
- Price re-validation server-side prevents client-side price manipulation
- Gift wrap, add-ons (`ADDON-*`), and catalog items handled separately
- Address stored as JSON snapshot (immutable historical record)
- Coupon supports both PERCENT and FLAT discount types with max cap
- Immediate loyalty deduction prevents point-oversell race condition

**Gaps:**
- No inventory reservation / stock hold during payment window (race condition possible for high-demand items)
- No minimum order amount enforcement (beyond coupon min-order)
- `custom_options` in `order_items` is not a DB column — color, gift_wrap, message are individual columns (correctly implemented)

---

## 2. Payment Webhook Processing

**File:** `api/payments/cashfree-webhook.ts`

| Step | Description | Status |
|------|-------------|--------|
| Signature verification | HMAC-SHA256 check with timestamp | ✅ |
| Simulation bypass | Dev testing mode with `is_simulated` flag | ✅ |
| Idempotency check | `payment_events` table with `event_id` deduplication | ✅ |
| Order lookup | By `order_number` (not internal UUID) | ✅ |
| Order status update | `PAYMENT_CONFIRMED` or `PAYMENT_FAILED` | ✅ |
| Payment record update | CF payment ID, method, details stored | ✅ |
| Audit log | `order_status_history` entry with payment ID | ✅ |
| Coupon increment | `usage_count` +1 + redemption record | ✅ |
| Inventory decrement | Per product item, floor at 0 | ✅ |
| Loyalty earn | 1 pt/₹10, account upsert if missing | ✅ |
| Loyalty deduction idempotency | Checks existing `REDEEM_PURCHASE` before deducting again | ✅ |
| Payment failure | Order → `PAYMENT_FAILED`, payment → `FAILED` | ✅ |
| Mark event processed | `is_processed = true` | ✅ |

**Strengths:**
- Comprehensive, production-grade webhook handler
- Idempotent — safe to retry
- Handles both success and failure paths
- Dual idempotency (event-level + loyalty transaction level)

**Gaps:**
- No retry/dead-letter queue for webhook failures (if webhook handler throws, event may not be re-processed)
- `CASHFREE_WEBHOOK_SECRET` is same as `CASHFREE_SECRET_KEY` — should be a separate webhook secret in production
- No webhook for refund events (`REFUND_*`)
- No customer email/WhatsApp notification on payment success (webhook is the ideal trigger point)

---

## 3. Admin Order Management

**File:** `src/pages/admin/AdminOrders.tsx`

### 3.1 What the Admin Can Do

| Capability | Status |
|-----------|--------|
| View all orders (newest first) | ✅ |
| Search by order number, name, phone, coupon code | ✅ |
| Filter by status tab (All / Confirmed / Processing / Packed / Shipped / Delivered / Pending) | ✅ |
| Open order detail modal | ✅ |
| See full delivery address | ✅ |
| Copy address to clipboard (for label generation) | ✅ |
| See financial breakdown (subtotal, discount, loyalty, shipping) | ✅ |
| See loyalty points redeemed per order | ✅ |
| See coupon code used | ✅ |
| View ordered items with quantities | ✅ |
| See gift notes per item | ✅ |
| Update order status (8 possible statuses) | ✅ |
| Enter carrier (Delhivery / Shiprocket / India Post / Manual) | ✅ |
| Enter AWB tracking number | ✅ |
| Auto-generate tracking URL from carrier + AWB | ✅ |
| Override tracking URL (custom field) | ✅ |
| Status change audit log | ✅ |
| Refresh orders | ✅ |

### 3.2 What is Missing

| Missing Capability | Impact |
|-------------------|--------|
| Notify customer on status update | 🔴 HIGH — "Save & Notify" button does nothing |
| Cancel order workflow | 🔴 HIGH — No cancellation logic, no inventory restore |
| Refund workflow | 🔴 HIGH — No Cashfree refund API call |
| Mark as COD / WhatsApp checkout orders | 🟡 MEDIUM — WhatsApp orders not tracked in DB |
| Bulk status update | 🟡 MEDIUM — Must open each order individually |
| Export orders to CSV | 🟡 MEDIUM — No export |
| Print packing slip / label | 🟡 MEDIUM — No PDF generation |
| Order search by email | 🟡 MEDIUM — `guest_email` not in search |
| Order notes (admin-internal) | 🟡 MEDIUM — `customer_note` visible but no admin notes field |
| Filter by date range | 🟡 MEDIUM — No date picker filter |
| Customer link from order | 🟡 MEDIUM — Cannot navigate to customer CRM from order |

---

## 4. Order Status State Machine

Current states defined in the admin:

```
PENDING_PAYMENT → PAYMENT_CONFIRMED → PROCESSING → PACKED → SHIPPED → DELIVERED
                                                                     → CANCELLED
                   PAYMENT_FAILED
```

**Gaps in state machine:**
- No `RETURN_REQUESTED` state
- No `RETURN_ACCEPTED` / `RETURN_REJECTED` states
- No `REFUND_INITIATED` / `REFUND_PROCESSED` states
- No `OUT_FOR_DELIVERY` state (exists in `TrackOrder.tsx` mapping but not in admin dropdown)
- No `REFUND_FAILED` state

---

## 5. Order Tracking (Customer-Facing)

**File:** `src/pages/TrackOrder.tsx` + `api/orders/track.ts`

| Feature | Status |
|---------|--------|
| Track by order number + phone | ✅ |
| Security: phone verification before showing data | ✅ |
| Visual status timeline (6 stages) | ✅ |
| Order items listed | ✅ |
| Shipment carrier + AWB displayed | ✅ |
| Tracking URL clickable link | ✅ |
| Estimated delivery date from DB | 🟡 — falls back to "3–6 business days" static string |
| Real-time carrier API (Delhivery/Shiprocket) | ❌ — AWB URL only; no live carrier status API |
| Auto-prefill order number from URL param | ✅ — `searchParams.get('order_id')` |

---

## 6. Coupon System

**Files:** `AdminCoupons.tsx`, `api/coupons/validate.ts`, `api/checkout/create-order.ts`

| Feature | Status |
|---------|--------|
| Coupon CRUD in admin | ✅ |
| Recipient name (for personalisation) | ✅ |
| Discount percent | ✅ |
| Expiry date | ✅ |
| Usage limit | ✅ |
| Active/inactive toggle | ✅ |
| Server-side validation (expiry, limit, min-order) | ✅ |
| PERCENT discount type | ✅ |
| FLAT discount type | ✅ |
| Max discount cap (`max_discount_in_paise`) | ✅ |
| Coupon redemption record (`coupon_redemptions`) | ✅ |
| First-order-only coupon | ❌ |
| Per-customer usage limit (1 use per customer) | ❌ |
| Bulk coupon generation | ❌ |
| Coupon analytics in admin (revenue impact, conversion) | ❌ |

---

## 7. Add-ons Handling

Add-on items use the `ADDON-` prefix convention:

```
ADDON-Greeting Card     → ₹49
ADDON-Personalised Message → ₹39
ADDON-Name Customisation   → ₹79
ADDON-Premium Ribbon       → ₹49
ADDON-Premium Wrapping     → ₹79
ADDON-Extra Flower         → ₹199
```

These are hardcoded in `create-order.ts`. There is no admin UI to add/edit/price add-ons. They appear in order_items but with `product_id: null`.

---

## 8. Inventory Management

| Feature | Status |
|---------|--------|
| `inventory_count` column on products | ✅ |
| Decrement on payment confirmed (webhook) | ✅ |
| Floor at 0 (never negative) | ✅ |
| Inventory display to customers on PDP | ❌ |
| Low-stock admin alert | ❌ |
| Out-of-stock prevention at checkout | ❌ — Product is `is_active` checked but inventory not |
| Inventory restore on order cancel | ❌ |
| Inventory reserve on cart add (prevent oversell) | ❌ |

---

## 9. Summary Scorecard

| Category | Score | Note |
|---------|-------|------|
| Order creation pipeline | 9/10 | Excellent — only gap is inventory reservation |
| Payment webhook | 9/10 | Production-grade with idempotency |
| Admin order management | 6/10 | Good UI, critical notifications and refunds missing |
| Order tracking (customer) | 7/10 | Works well, no live carrier API |
| Coupon system | 7/10 | Solid foundation, missing per-customer limits |
| Inventory management | 4/10 | Backend only, no frontend integration |
| **Overall** | **7/10** | Strong backend, weak notifications & refunds |
