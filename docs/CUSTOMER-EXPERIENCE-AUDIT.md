# Customer Experience Audit — The Petal & Bloom
**Audit Date:** 28 September 2026

---

## Executive Summary

The customer-facing experience of The Petal & Bloom is **premium, coherent, and well-designed**. The storefront, product discovery, checkout, and account portal all reflect the luxury botanical Atelier brand identity. Key experience gaps are in post-purchase communication, the reviews system, real-time tracking, and the wishlist persistence.

---

## 1. Brand & Design System Audit

### 1.1 Design Tokens
| Token | Usage | Status |
|-------|-------|--------|
| `linen` | Page backgrounds | ✅ Consistent |
| `canvas` | Section backgrounds, input fills | ✅ Consistent |
| `bark` | Primary text, CTAs | ✅ Consistent |
| `rose` | Accents, prices, highlights | ✅ Consistent |
| `Fraunces` (serif) | Headings, hero text, price display | ✅ Consistent |
| `Karla` (sans) | Body, labels, captions | ✅ Consistent |
| `canvas-line` | Borders, dividers | ✅ Consistent |
| `ink` / `ink-light` | Paragraph text, secondary labels | ✅ Consistent |

**Assessment:** Design system is rigorously applied across all pages. No design inconsistencies found between admin and storefront (they are intentionally separate layouts).

### 1.2 Animation & Motion
- **Reveal component:** Fade-in-up on scroll — applied throughout
- **Gentle zoom on hero images:** `animate-gentle-zoom` class
- **Hover transitions:** Scale, color, opacity on product cards, buttons
- **Cart drawer:** Slide-in with backdrop blur
- **Product thumbnails:** Scale hover on category rail blobs

**Assessment:** Motion design is intentional and premium — not excessive. Animations serve hierarchy and delight.

---

## 2. Navigation & Discovery

### 2.1 Navigation
| Feature | Status | Evidence |
|---------|--------|---------|
| CMS-managed navigation (add/edit/delete) | ✅ | `AdminNavigation.tsx`, `navigation` table |
| Dropdown menus | ✅ | `type: 'dropdown'` nav items |
| Sticky navbar | ✅ | `sticky top-0` in `Navbar.tsx` |
| Mobile bottom nav | ✅ | `MobileBottomNav.tsx` — home, shop, wishlist, account, cart |
| Announcement bar | ✅ | `AnnouncementBar.tsx` |
| Search in navbar | ✅ | Routes to `/shop?search=...` |
| Cart count badge | ✅ | `CartContext` item count |

### 2.2 Product Discovery
| Feature | Status | Evidence |
|---------|--------|---------|
| Shop by category (blob rail) | ✅ | Dynamic from Supabase categories |
| Shop by occasion | ✅ | Occasion chips in Shop toolbar |
| Shop by budget | ✅ | Budget filters from `site.ts` |
| Customisable-only filter | ✅ | Toggle chip |
| Sort: recommended, newest, price asc/desc | ✅ | `sortOptions` array |
| Search | ✅ | `filterProducts()` — searches name, description, code, occasions |
| Grid / List view toggle | ✅ | View mode state |
| Empty state with WhatsApp | ✅ | "No blooms found" fallback |
| Quick view | ✅ | `QuickView` component with modal |
| Recently viewed | ✅ | `useRecentlyViewed()` with localStorage |

**Gap:** No faceted sidebar filter (price range slider, multi-select occasion). Currently one occasion at a time. Budget filter requires URL param — not visible to casual users.

---

## 3. Product Detail Page (PDP) UX

| Feature | Status | Experience Quality |
|---------|--------|--------------------|
| Image gallery with thumbnail switcher | ✅ | Premium — smooth transition |
| "Studio Choice" bestseller badge | ✅ | Clear visual hierarchy |
| Compare-at price with discount % | ✅ | Honest pricing display |
| Preparation window displayed | ✅ | "3–5 days" expectation setting |
| Bouquet size info | ✅ | When populated |
| Color palette pills | ✅ | Clear selection state |
| Quantity selector with +/- | ✅ | Standard UX |
| Gift wrap toggle with preview | ✅ | Thoughtful touch |
| Personal message textarea | ✅ | Adds emotional value |
| "What's Included" section | ✅ | Trust builder |
| Delivery estimator | ✅ | `DeliveryEstimator` component |
| WhatsApp enquiry | ✅ | Pre-formatted message |
| Cross-sell section | ✅ | `CrossSell` component |
| Related products | ✅ | Same category |
| Reviews section | 🟡 | Placeholder — "Be one of the first" |
| Inventory status ("Only 3 left!") | ❌ | `inventory_count` not shown |
| Sticky Add to Cart on mobile | ❌ | Not implemented |
| Zoom on image click | ❌ | No lightbox/zoom |
| Video support | ❌ | Images only |

---

## 4. Checkout Flow UX

### 4.1 Cart Drawer
| Feature | Status |
|---------|--------|
| Product thumbnails in cart | ✅ |
| Quantity adjustment | ✅ |
| Remove item | ✅ |
| Add-ons (greeting card, ribbon, etc.) | ✅ |
| Coupon code input | ✅ |
| Coupon discount display | ✅ |
| Loyalty points redemption (if logged in) | ✅ |
| Shipping fee breakdown | ✅ |
| Free shipping threshold display | 🟡 — Shipping fee shown but no "X more for free shipping" nudge |
| WhatsApp checkout alternative | ✅ |

### 4.2 Checkout Form
| Feature | Status |
|---------|--------|
| Saved address auto-populate (if logged in) | ✅ |
| Multiple address picker (if logged in) | ✅ |
| New address form | ✅ |
| "Save to profile" checkbox | ✅ |
| Guest checkout (no account required) | ✅ |
| Upsell prompt for guest ("Sign up for X pts off") | ❌ — Guest sees form directly |
| Form validation | ✅ — Server-side + client input masking |
| Phone number masking | ✅ |
| Pincode validation | ✅ — 6 digits checked server-side |

### 4.3 Payment UX
| Feature | Status |
|---------|--------|
| Cashfree PG modal | 🔒 SANDBOX |
| Payment success → Order confirmation redirect | ✅ |
| Payment failed handling | ✅ — Status updated, user not left hanging |
| Order confirmation page | ✅ |
| Order number prominently displayed | ✅ |

---

## 5. Post-Purchase Experience

This is the **weakest area** of customer experience.

| Feature | Status | Impact |
|---------|--------|--------|
| Order confirmation email | ❌ | 🔴 HIGH — customers receive no email |
| Order status update email | ❌ | 🔴 HIGH — no notification on dispatch |
| WhatsApp notification on dispatch | ❌ | 🔴 HIGH — only manual concierge link |
| Tracking notification (SMS) | ❌ | 🔴 HIGH |
| Order confirmation page | ✅ | Shows order number |
| Track order page | ✅ | Must actively check |
| Proactive delivery update | ❌ | Customer has no way to know when shipped |
| Returns / exchange process | ❌ | Refund policy page exists but no process |
| Post-delivery review request | ❌ | No automated review ask |

**Critical gap:** A customer who completes payment has **no automated confirmation**. They must remember their order number and actively visit `/track`. This is a significant trust and retention risk.

---

## 6. Customer Account Experience

### 6.1 Dashboard
| Feature | Status |
|---------|--------|
| Hero card with quick stats (Points, Orders, Referral) | ✅ |
| Admin session banner (warn admin if logged in as customer) | ✅ |
| Atelier circle avatar | ✅ |

### 6.2 Orders Tab
| Feature | Status |
|---------|--------|
| Order list with status badge | ✅ |
| 4-step crafting progress timeline per order | ✅ |
| Item thumbnails per order | ✅ |
| Yarn shade / color badge per item | ✅ |
| Gift wrap tag | ✅ |
| Personal message snippet | ✅ |
| Financial breakdown per order | ✅ |
| WhatsApp Studio Concierge button per order | ✅ |
| Receipt / tracking link | ✅ — Links to `/track?order_id=...` |

### 6.3 Loyalty Tab
| Feature | Status |
|---------|--------|
| Points balance prominent | ✅ |
| Tier badge (Floret/Blossom/Heirloom) | ✅ |
| Progress bar to next tier | ✅ |
| Transaction ledger (earn/redeem/bonus) | ✅ |
| Tier benefits display | ❌ — No visible perks listed per tier |
| Redeem at checkout (explained) | 🟡 — Not explained in loyalty tab |

### 6.4 Referrals Tab
| Feature | Status |
|---------|--------|
| Unique referral code displayed | ✅ |
| Share link / copy to clipboard | ✅ |
| Referral count / earnings | ❌ — No data (referral tracking not implemented) |
| "How it works" explanation | ❌ |

### 6.5 Addresses Tab
| Feature | Status |
|---------|--------|
| List saved addresses | ✅ |
| Add new address | ✅ |
| Delete address | ✅ |
| Set as default | 🟡 — `is_default` column exists but toggle UI unclear |
| Edit existing address | ❌ — No edit UI; must delete and re-add |

### 6.6 Profile Tab
| Feature | Status |
|---------|--------|
| Edit name | ✅ |
| Edit phone | ✅ |
| Edit email | ✅ |
| Change password | 🟡 — Must use Supabase reset link; no in-app form |
| Delete account | ❌ |

---

## 7. Custom Bouquet Builder UX

| Feature | Status |
|---------|--------|
| 6-step wizard | ✅ |
| Live composition panel (sticky) | ✅ |
| Estimated price display | ✅ |
| Preparation time estimate | ✅ |
| Step validation (cannot advance without selection) | ✅ |
| WhatsApp "Send to Studio" | ✅ |
| Direct checkout path | ❌ — Builder ends at WhatsApp; cannot add to cart |
| Save/resume builder | ❌ — Refreshing loses all selections |

---

## 8. Accessibility Assessment

| Feature | Status |
|---------|--------|
| Semantic HTML headings hierarchy | 🟡 — Generally correct but some sections use divs |
| ARIA labels on icon-only buttons | 🟡 — Some present (coupon delete), some missing |
| Focus management in modals | 🟡 — Cart drawer has some, not all modals |
| Color contrast (bark on linen) | ✅ — High contrast |
| Image alt text | 🟡 — Present on products, some decorative images missing |
| Keyboard navigation | 🟡 — Partially navigable |
| Screen reader compatibility | ❌ — Not tested, no aria-live regions for cart updates |

---

## 9. Mobile Experience

| Feature | Status |
|---------|--------|
| Mobile bottom navigation | ✅ |
| Responsive layouts (all pages) | ✅ |
| Mobile filter expand/collapse | ✅ |
| Touch-friendly tap targets | ✅ |
| Mobile checkout form | ✅ |
| Cart drawer full-screen on mobile | ✅ |
| Sticky mobile CTA on PDP | ❌ — No "Add to Bag" sticky footer on mobile |
| PWA / installable app | ❌ — No `manifest.json`, no service worker |

---

## 10. Customer Experience Score Summary

| Area | Score | Critical Gaps |
|------|-------|---------------|
| Brand & Design | 9/10 | None |
| Navigation & Discovery | 8/10 | No faceted filter |
| Product Detail Page | 7/10 | No inventory display, no zoom |
| Checkout Flow | 8/10 | No upsell prompt for guests |
| Post-Purchase | 3/10 | No email/WhatsApp notifications |
| Account Portal | 8/10 | No address edit, no tier benefits |
| Mobile Experience | 7/10 | No sticky PDP CTA, no PWA |
| Accessibility | 5/10 | Partial ARIA, no a11y testing |
| **Overall** | **6.9/10** | **Post-purchase is the critical gap** |
