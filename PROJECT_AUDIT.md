# PROJECT AUDIT: The Petal & Bloom

**Date:** September 2026  
**Audited By:** Senior Multidisciplinary Engineering Team (Antigravity)  
**Status:** Complete — Baseline Discovery

---

## 1. Executive Summary

"The Petal & Bloom" is an artisanal e-commerce web application for handcrafted crochet blooms, bouquets, and bespoke botanical gifts. 

The current codebase features a developed, responsive, and styled luxury frontend ("Atelier" aesthetic using Tailwind CSS and serif typography). However, **it is currently an enquiry-driven catalogue rather than a true transactional e-commerce platform**:
1. **Checkout is an enquiry link:** Clicking "Order via Gift Concierge" redirects to WhatsApp with a pre-filled text message. No orders or payments are recorded in any transactional database.
2. **Payment Gateway is Absent:** There is no integration with Cashfree Payments or any payment processor.
3. **Database & Security Gaps:** Client-side code queries Supabase directly using the anon key. Coupon usage count is incremented on the client side upon entry, without an order placement. Admin routes only check for an active user session (`!!session`) without role verification.
4. **Build & Type Health:** `npm run build` succeeds, but `npm run typecheck` fails with 4 TypeScript errors, and ESLint flags 93 lint issues and duplicate backup files with backticks in filenames.

This audit provides a factual, component-by-component and system-by-system baseline of the existing application.

---

## 2. Technology Stack Audit

| Dimension | Specification | Notes |
| :--- | :--- | :--- |
| **Runtime / Language** | TypeScript 5.5.3, Node.js v24+ | Strict typing enabled with custom aliases (`@/*` -> `./src/*`) |
| **Framework** | React 18.3.1 (Single Page Application) | Client-side CSR using `react-router-dom` v6.30.6 |
| **Build System & Bundler** | Vite 5.4.8 (`@vitejs/plugin-react` 4.3.1) | Fast HMR, production build output to `dist/` |
| **Package Manager** | npm (with `package-lock.json`) | 288 packages installed |
| **Styling Engine** | Tailwind CSS 3.4.1 + PostCSS + Autoprefixer | Custom design tokens: `linen`, `canvas`, `bark`, `rose`, `moss`, `ink`, `rounded-atelier-*` |
| **Typography** | Google Fonts: Fraunces (Display serif), Karla (Body sans) | Loaded via Google Fonts CDN in `index.html` |
| **Icons** | `lucide-react` 0.446.0 | Comprehensive icon system |
| **Database & Auth SDK** | `@supabase/supabase-js` 2.116.0 | Direct client-side calls in contexts and admin views |
| **Hosting & Deployment** | Vercel | Single Page Application rewrites defined in `vercel.json` (`/* -> /index.html`) |
| **Testing / Quality Tools**| ESLint 9.9.1, Playwright 1.63.0 (dev) | Visual audit screenshot script in `scripts/visual-audit.cjs` |

---

## 3. Frontend Architecture Audit

### 3.1 Routing & Layout
- **Router:** `BrowserRouter` configured in `src/App.tsx`.
- **Top-Level Wrapper:** `AppContent` conditionally renders the Storefront `Navbar`, `MobileBottomNav`, and `Footer` when `pathname` does not start with `/admin`.
- **Pages Inventory:**
  - `/` — `Home.tsx`: Hero banner, philosophy, occasion showcase, bestsellers, custom order CTA, craft details, trust strip.
  - `/shop` — `Shop.tsx`: Filterable product catalogue with category pills, occasions, budgets, sorting, and grid/list view toggle.
  - `/product/:code` — `ProductDetail.tsx`: Multi-image gallery, hue selection, gift wrapping add-on, delivery estimator, add-to-cart, WhatsApp CTAs, contextual FAQ, recently viewed, and related products.
  - `/custom` — `CustomOrders.tsx`: Bespoke bouquet intro, 4-step artisan process, add-ons overview, WhatsApp order link.
  - `/custom-bouquet` — `CustomBouquetBuilder.tsx`: Interactive multi-step studio builder (Scale -> Flowers -> Colours -> Wrap -> Message -> Review). Concludes with WhatsApp link.
  - `/gift-finder` — `GiftFinder.tsx`: 3-step quiz (Occasion -> Recipient -> Budget) ranking matching products.
  - `/wishlist` — `Wishlist.tsx`: Saved blooms management with move-to-bag functionality.
  - `/about` — `About.tsx`: Studio story, artisan manifesto, materials, and process.
  - `/contact` — `Contact.tsx`: Studio contact details and WhatsApp message composer.
  - `/privacy`, `/terms`, `/refund` — Policy pages using shared `PolicyPage.tsx`.
  - `/admin/login` — `AdminLogin.tsx`: Email/password form via `supabase.auth.signInWithPassword`.
  - `/admin/dashboard` — `AdminDashboard.tsx`: Inventory summary and product listing with search and delete.
  - `/admin/editor` — `AdminEditor.tsx`: Product creator and editor with image uploads to Supabase storage.
  - `/admin/navigation` — `AdminNavigation.tsx`: Navigation menu hierarchy manager.
  - `/admin/settings` — `AdminSettings.tsx`: Product category manager (CRUD).
  - `/admin/assets` — `AdminAssets.tsx`: Dynamic site-wide hero and banner asset manager.
  - `/admin/coupons` — `AdminCoupons.tsx`: Coupon creator, toggle, and deleter.
  - `*` — `NotFound.tsx`: 404 page.

### 3.2 State Management
Global state is provided via nested React Context providers in `src/App.tsx`:
1. `NotificationProvider`: Toast notifications (info, success, error) with optional action callbacks.
2. `WishlistProvider`: Array of product codes stored in `localStorage` (`tpb-wishlist`).
3. `ProductProvider`: Fetches all products from Supabase `products` table into memory. Helper getters for code lookup, bestsellers, and featured items.
4. `CartProvider`: Items stored in `localStorage` (`tpb-cart`). Manages quantities, options (color, giftWrap, message), coupon application, subtotal/shipping/discount calculation, and WhatsApp checkout generation.
5. `QuickViewProvider`: Modal state for previewing products from grids.
6. `SiteAssetsProvider`: Fetches key-value dynamic banner images from Supabase `site_assets` with `localStorage` TTL caching.
7. `NavigationProvider`: Fetches dynamic menu hierarchy from Supabase `navigation` table with caching.

---

## 4. Backend & Data Architecture Audit

### 4.1 Server / API Layer
- **Current State:** **NONE.** The application is a 100% static client-side SPA.
- There are no Next.js API routes, no Express server, no Vercel Serverless Functions (`/api/*`), and no Supabase Edge Functions in the repository.
- All database queries and storage uploads run directly from the browser through `@supabase/supabase-js`.

### 4.2 Database Tables Currently Referenced
From inspecting the code queries, the existing database uses:
1. `products`:
   - Columns: `id`, `code` (unique text), `name`, `category`, `price`, `compare_at_price`, `description`, `long_description`, `bestseller`, `featured`, `customisable`, `made_to_order`, `images` (array), `occasions` (array), `colors` (array), `whats_included` (array), `recipients` (array), `preparation_days`, `bouquet_size`, `created_at`.
2. `categories`:
   - Columns: `id`, `name`, `slug`, `display_order`, `image_url`, `created_at`.
3. `navigation`:
   - Columns: `id`, `label`, `path`, `parent_id`, `order`, `type` (`link` | `dropdown`).
4. `site_assets`:
   - Columns: `section_key`, `label`, `description`, `image_url`, `updated_at`.
5. `coupons`:
   - Columns: `id`, `code` (unique text), `recipient_name`, `discount_percent`, `expires_at`, `usage_limit`, `usage_count`, `active`, `created_at`.

### 4.3 Supabase Storage Buckets Referenced
1. `product-images`: Public bucket for product photography uploaded via `AdminEditor.tsx`.
2. `site-assets`: Public bucket for hero and category visuals uploaded via `AdminAssets.tsx`.

---

## 5. Security Audit (Existing Vulnerabilities)

1. **Direct Coupon Mutation by Anonymous Client:**
   In `src/context/CartContext.tsx` line 168:
   ```typescript
   await supabase.from('coupons').update({ usage_count: data.usage_count + 1 }).eq('code', normalizedCode);
   ```
   An unauthenticated browser directly increments the coupon usage before any payment or order confirmation! If a user applies a coupon and abandons the cart, the coupon count is permanently consumed.
2. **Missing Role-Based Access Control (Admin Privilege Escalation):**
   In `src/components/AdminRoute.tsx`:
   ```typescript
   const { data: { session } } = await supabase.auth.getSession();
   setIsAuthenticated(!!session);
   ```
   Any user with an account in the Supabase Auth instance is granted full access to the admin portal (`/admin/dashboard`, `/admin/editor`, `/admin/coupons`, `/admin/settings`, `/admin/assets`). There is no check for admin role (`app_metadata.role === 'admin'` or an `admin_users` table).
3. **Overly Permissive RLS in Migration:**
   In `supabase/migrations/20260916000000_pricing_and_coupons.sql`:
   ```sql
   create policy "Authenticated admins can manage coupons"
     on public.coupons for all to authenticated using (true) with check (true);
   ```
   Any authenticated Supabase user can delete, create, or modify coupons.
4. **Client-Side Financial Calculations:**
   All subtotals, shipping thresholds (₹799 / ₹1200), and discount percentages are calculated in `CartDrawer.tsx` and `CartContext.tsx` in the user's browser.
5. **Hard-Coded Host in SEO:**
   In `src/components/SEO.tsx`:
   ```typescript
   const canonical = canonicalPath ? `https://petal-bloom-d2c-webs-k5dq.bolt.host${canonicalPath}` : window.location.href;
   ```
   Points to a legacy Bolt hosting URL rather than the official domain.

---

## 6. Payment & Checkout Audit

1. **Payment Gateway:** None. No Cashfree SDK or API integration exists in the repository.
2. **Orders:** There is no `orders`, `order_items`, or `payments` table in the database.
3. **Checkout Experience:**
   - The user opens `CartDrawer.tsx`.
   - Clicks "Order via Gift Concierge".
   - A modal requests Customer Name and 6-digit PIN code.
   - Submitting triggers `buildWhatsAppLink(cartEnquiryMessage(...))` and clears the cart.
   - The user is redirected to WhatsApp to chat with the store owner.
4. **Order Status Tracking:**
   - An `OrderStatus.tsx` component exists with mockup states (`received`, `handcrafting`, `packed`, `shipped`, `out_for_delivery`, `delivered`), but it contains hardcoded demo text: *"This is a demonstration of our order tracking. When you place an order, we will share real-time updates on WhatsApp."* It is not tied to any database records.

---

## 7. Technical Debt & Code Health

1. **TypeScript Typecheck Failures (4 Errors):**
   - `src/pages/GiftFinder.tsx:262`: `Reveal` does not accept `role` or `aria-live`.
   - `src/pages/Shop.tsx:77`: `image_url` accessed on `{ name, slug }` select result.
   - `src/pages/admin/AdminNavigation.tsx:260`: `formData.path` (`string | null`) passed directly to input `value`.
   - `src/pages/admin/AdminSettings.tsx:23`: Destructuring `notify` from `useNotification()` which only exports `showNotification`.
2. **Dangling Backup Files with Backticks:**
   - `src/components/AdminLayout.tsx\``
   - `src/components/ProductList.tsx\``
   - `src/pages/admin/AdminNavigation.tsx\``
   These files are unreferenced and clutter the repository.
3. **Lint Warnings & Errors (93 issues):**
   - Unused imports (`MessageCircle`, `Link`, `heroImages`, `formatPrice`, `Star`, etc.) across multiple pages.
   - Frequent usage of `any` in error handlers and callbacks.
4. **Missing Production Infrastructure:**
   - No server-side API or webhook endpoint for Cashfree.
   - No customer authentication or account dashboard (`/account`, `/account/orders`).
   - No loyalty point ledger or referral reward system.
   - No shipping provider integration (Shiprocket / Delhivery / India Post).

---

## 8. Preserved Components & Assets (Foundational Assets)

The following components and styles are approved, high-quality, and must be preserved:
- **Design System:** `tailwind.config.js` tokens (`linen`, `canvas`, `bark`, `rose`, `moss`), custom button radii (`rounded-atelier-btn`), and typography (`Fraunces` + `Karla`).
- **Storefront Components:** `Navbar.tsx`, `Footer.tsx`, `MobileBottomNav.tsx`, `CartDrawer.tsx`, `ProductCard.tsx`, `ProductGrid.tsx`, `QuickView.tsx`, `RecentlyViewed.tsx`, `DeliveryEstimator.tsx`, `OrderStatus.tsx`, `Reveal.tsx`, `PolicyPage.tsx`.
- **Customer Pages:** `Home.tsx`, `Shop.tsx`, `ProductDetail.tsx`, `CustomOrders.tsx`, `CustomBouquetBuilder.tsx`, `GiftFinder.tsx`, `Wishlist.tsx`, `About.tsx`, `Contact.tsx`.
- **Admin Visuals & Layout:** `AdminLayout.tsx` aesthetics, `AdminDashboard.tsx`, `AdminEditor.tsx`, `AdminAssets.tsx`, `AdminNavigation.tsx`, `AdminSettings.tsx`, `AdminCoupons.tsx`.
