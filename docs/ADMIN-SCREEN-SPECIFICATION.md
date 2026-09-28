# ADMIN SCREEN SPECIFICATIONS: The Petal & Bloom Commerce OS
**Detailed Operational Screen Architecture**
**Project:** The Petal & Bloom (`thepetalandbloom.in`)

---

## Screen 1: Operational Command Center (Executive Dashboard)

* **Screen Name:** Atelier Overview Dashboard
* **Route:** `/admin/dashboard`
* **Purpose:** Serves as the executive morning standup screen; provides real-time visibility into financial intake, active crafting queues, average order value, and recent order events.
* **Who Can Access It:** Super Admin, Operations Manager.
* **Primary User:** Founder / General Manager.
* **Data Displayed:** Gross Captured Revenue (INR), Active Work Orders count (Processing + Packed), Average Order Value (AOV), Total Registered Patrons, 5 Most Recent Orders, Catalog Distribution Summary.
* **Table Columns (Recent Orders Feed):** Order Number, Customer Name & Timestamp, Status Badge, Order Value (INR), Inspection Link.
* **Filters:** Quick date ranges (Today, 7 Days, 30 Days, All-Time).
* **Search:** Quick piece search by name or SKU code within catalog section.
* **Sorting:** Recent orders sorted by `created_at DESC`.
* **Views:** Default executive KPI view with embedded catalog manager.
* **Bulk Actions:** None (Dashboard is primarily monitoring).
* **Individual Actions:** Click to inspect order in Orders Workbench; click to edit piece in Catalog Editor; delete piece with confirmation.
* **Forms:** Search input for piece inventory.
* **Validation:** Code delete validation prevents accidental deletion without confirmation dialog.
* **Confirmation:** Browser modal: *"Are you sure you want to delete product {CODE}? This action cannot be undone."*
* **Error States:** Toast notification if Supabase query fails with retry option.
* **Empty States:** "No orders received yet" illustration if fresh database.
* **Loading States:** Centered Atelier spinner with message: *"Loading executive analytics..."*
* **Success States:** Real-time metrics counters displayed with currency formatting.
* **Permissions:** `analytics.read`, `orders.read`, `products.write`.
* **Audit Requirements:** Log admin deletion of products to `audit_logs`.
* **Related Screens:** `/admin/orders`, `/admin/customers`, `/admin/editor`.
* **Database Entities Used:** `orders`, `profiles`, `products`.
* **API/Service Requirements:** Supabase client with read permissions on `orders` and `profiles`.
* **Edge Cases:** Orders with 0 value; zero completed orders (AOV safely falls back to ₹0 without division by zero error).
* **Mobile Behavior:** 4-column metric grid stacks into 1 column on mobile; quick action buttons collapse into wrap.

---

## Screen 2: Orders & Logistics Workbench

* **Screen Name:** Orders Workbench
* **Route:** `/admin/orders`
* **Purpose:** The core operational engine for studio fulfillment; manages orders from payment verification through artisan crafting, packaging inspection, and carrier dispatch.
* **Who Can Access It:** Super Admin, Operations Manager, Packing Clerk.
* **Primary User:** Studio Fulfillment Lead.
* **Data Displayed:** Comprehensive order table with financial breakdowns, customer notes, status badges, carrier assignments, and AWB tracking links.
* **Table Columns:** Order Number & Date, Patron Name & Mobile, Items Summary & Yarn Shades, Financial Total & Discounts, Payment Status, Order Status, Logistics Partner & AWB, Action Buttons.
* **Filters:** Status tabs: `ALL`, `CONFIRMED` (`PAYMENT_CONFIRMED`), `IN CRAFTING` (`PROCESSING`), `PACKED`, `SHIPPED`, `DELIVERED`, `AWAITING PAYMENT` (`PENDING_PAYMENT`).
* **Search:** Real-time search by `order_number`, customer name, phone number, or applied coupon code.
* **Sorting:** `created_at DESC` (default), order value ascending/descending.
* **Views:** Table view (default), Order Detail Modal / Slide-out Drawer.
* **Bulk Actions:** (Future Phase 3) Bulk print packing slips, bulk mark as PACKED.
* **Individual Actions:**
  * Open Order Detail Modal.
  * Update Order Status (State machine transition).
  * Assign Logistics Carrier (`SHIPROCKET`, `DELHIVERY`, `INDIA_POST`, `MANUAL`).
  * Enter AWB Tracking Number & Auto-generate tracking URL.
  * "Save & Notify" — Dispatches email and generates pre-filled WhatsApp Concierge dispatch link.
  * 1-Click Copy Shipping Address to Clipboard for thermal label printer.
  * Cancel Order / Trigger Refund.
* **Forms:** Order Update Form inside modal: Status selector, Carrier dropdown, AWB text field, Custom tracking URL override, Status change internal note.
* **Validation:** Cannot set status to `SHIPPED` without selecting a carrier and entering an AWB number. Phone number must be 10 digits for WhatsApp launch.
* **Confirmation:** Dialog required when transitioning to `CANCELLED` or initiating a refund.
* **Error States:** Inline error toast if Supabase update fails or network drops.
* **Empty States:** *"No orders found matching the selected filter."*
* **Loading States:** Skeleton rows while orders are queried from Supabase.
* **Success States:** Green toast: *"Order TPB-XXXX updated to SHIPPED! Dispatch email sent."*
* **Permissions:** `orders.read`, `orders.update_status`, `orders.notify`, `orders.refund`.
* **Audit Requirements:** Every status change writes to `order_status_history` with actor, old status, new status, note, and timestamp.
* **Related Screens:** `/admin/dashboard`, `/admin/customers`, `/track`.
* **Database Entities Used:** `orders`, `order_items`, `shipments`, `order_status_history`, `payments`.
* **API/Service Requirements:** `POST /api/orders/notify`, `POST /api/orders/cancel`, `POST /api/payments/refund`.
* **Edge Cases:** Address lines missing line 2; coupon code deleted after order placement (retained via order snapshot).
* **Mobile Behavior:** Horizontal table scroll with sticky Order Number column; modal adapts to full-screen view.

---

## Screen 3: Patrons CRM & Loyalty Ledger

* **Screen Name:** Customer CRM & Petal Points Management
* **Route:** `/admin/customers`
* **Purpose:** Single source of truth for customer relationships, lifetime gifting value, address books, and Petal Points balances.
* **Who Can Access It:** Super Admin, Concierge Lead.
* **Primary User:** Founder / Customer Concierge.
* **Data Displayed:** Patron identity (Name, Phone, Email, Role), Tier designation (`FLORET`, `BLOSSOM`, `HEIRLOOM`), Petal Points balance & lifetime earned, Order count & total spend in INR, Referral code & inviter, Joined date.
* **Table Columns:** Customer Identity, Loyalty Tier & Balance, Orders & Total Spend, Referral Attribution, Joined Date, Actions.
* **Filters:** Tier chips (`ALL`, `FLORET`, `BLOSSOM`, `HEIRLOOM`).
* **Search:** Search across name, phone, email, and referral code.
* **Sorting:** Spend descending, order count descending, join date descending.
* **Views:** Patron Directory Table, Customer 360 Detail Modal.
* **Bulk Actions:** Export Filtered Customer List to CSV.
* **Individual Actions:**
  * Open Customer 360 Modal.
  * Direct 1-Click WhatsApp Chat with Patron.
  * Manually Credit or Debit Petal Points with mandatory audit reason.
  * Inspect specific customer order receipts.
* **Forms:** Points Adjustment Form: Action (`+ Credit` / `- Debit`), Points amount (1–5000), Reason / Note.
* **Validation:** Deducting points cannot force the customer balance below 0. Reason field is mandatory.
* **Confirmation:** Dialog on point debit: *"Confirm debiting {X} Petal Points from {Patron Name}?"*
* **Error States:** Toast error if database constraint rejects transaction.
* **Empty States:** *"No matching patrons found."*
* **Loading States:** Centered spinner with message: *"Accessing patron archives..."*
* **Success States:** Toast: *"Petal points updated! New balance: {N} points."*
* **Permissions:** `customers.read`, `customers.export`, `customers.adjust_points`.
* **Audit Requirements:** Every point adjustment inserts an immutable row into `loyalty_transactions` with `ADMIN_CREDIT` or `ADMIN_DEBIT` and audit note.
* **Related Screens:** `/admin/orders`, `/admin/dashboard`.
* **Database Entities Used:** `profiles`, `loyalty_accounts`, `loyalty_transactions`, `customer_addresses`, `orders`.
* **API/Service Requirements:** Supabase client with admin privileges on `loyalty_transactions`.
* **Edge Cases:** Anonymous guest checkouts without registered profiles (handled via email/phone search in Orders screen).
* **Mobile Behavior:** Customer card stack replaces wide table; CSV export button remains accessible in top bar.

---

## Screen 4: Product & Floral Catalog Editor

* **Screen Name:** Atelier Piece Editor
* **Route:** `/admin/editor`
* **Purpose:** Create, configure, price, and publish handcrafted floral arrangements, bouquets, and seasonal creations.
* **Who Can Access It:** Super Admin, Operations Manager.
* **Primary User:** Creative Director / Studio Manager.
* **Data Displayed:** Product title, SKU code, category, price in INR, compare-at price, inventory count, MTO lead time, description, high-res photo gallery, available yarn colors, gifting occasions, recipients, and what's included.
* **Table Columns:** N/A (Form / Live Preview screen).
* **Filters:** N/A.
* **Search:** Code parameter query (`?code=ROSE-01`) for editing existing pieces.
* **Sorting:** N/A.
* **Views:** Split screen: Left half = Edit Form; Right half = Real-time Customer Storefront Preview.
* **Bulk Actions:** None.
* **Individual Actions:** Upload photos to Supabase Storage, add color pills, publish piece, deactivate piece.
* **Forms:** Multi-step piece form with text inputs, rich description area, file drop zone, and tag selectors.
* **Validation:** Price must be $\ge 0$; SKU code must be unique and alphanumeric; at least one photograph is required.
* **Confirmation:** Warning prompt if navigating away with unsaved form changes.
* **Error States:** Highlight invalid inputs in red; display upload failure toast if image exceeds size limit.
* **Empty States:** Fresh form with default placeholder bloom for new creations.
* **Loading States:** "Publishing piece to atelier..." overlay with spinner.
* **Success States:** Toast: *"Piece published successfully!"* and redirect to catalog overview.
* **Permissions:** `products.write`, `storage.upload`.
* **Audit Requirements:** Log product creations, price changes, and deactivations to `audit_logs`.
* **Related Screens:** `/admin/dashboard`, `/product/:code`.
* **Database Entities Used:** `products`, `categories`.
* **API/Service Requirements:** Supabase Storage client uploading to `product-images` bucket.
* **Edge Cases:** Network failure during multi-image upload (partial images cleaned up or retried).
* **Mobile Behavior:** Live preview stacks below edit form.

---

## Screen 5: Promotions & Coupon Controller

* **Screen Name:** Promo & Influencer Coupons
* **Route:** `/admin/coupons`
* **Purpose:** Author, monitor, and revoke discount codes for seasonal campaigns, customer retention, and influencer partnerships.
* **Who Can Access It:** Super Admin, Marketing Lead.
* **Primary User:** Marketing Director.
* **Data Displayed:** Coupon code, internal description, recipient/influencer name, discount type (`PERCENT` or `FLAT`), discount value, minimum cart spend, maximum discount cap, global usage limit, current redemption count, expiration date, active status.
* **Table Columns:** Code, Discount, Minimum Order, Usage Stats, Expiry, Status, Actions.
* **Filters:** Active vs. Inactive, Standard Promo vs. Influencer Affiliate.
* **Search:** Search by coupon code or influencer name.
* **Sorting:** Expiration date ascending, usage count descending.
* **Views:** Coupon Table + Quick Creation Modal.
* **Bulk Actions:** Deactivate expired coupons.
* **Individual Actions:** Toggle active/inactive state, delete coupon, inspect redemption log.
* **Forms:** Create Coupon Form: Code input, Discount type selector, Value, Minimum order in INR, Max cap, Usage limit, Expiration date picker, Influencer toggle.
* **Validation:** Code must be uppercase without spaces; discount percent must be between 1 and 100; discount flat must be $> 0$.
* **Confirmation:** Modal before deleting a coupon with recorded redemptions.
* **Error States:** Toast: *"Coupon code already exists."*
* **Empty States:** *"No coupons configured. Create your first promotional code."*
* **Loading States:** Table shimmer animation while fetching coupons.
* **Success States:** Toast: *"Coupon {CODE} created and live!"*
* **Permissions:** `coupons.manage`.
* **Audit Requirements:** Log coupon creation and rate modifications to `audit_logs`.
* **Related Screens:** `/admin/dashboard`.
* **Database Entities Used:** `coupons`, `coupon_redemptions`.
* **API/Service Requirements:** `POST /api/coupons/validate`.
* **Edge Cases:** Coupon redeemed while being deactivated (database transaction isolation level handles gracefully).
* **Mobile Behavior:** Responsive table converts to cards on mobile screens.

---

## Screen 6: Studio Visuals CMS (Media Assets)

* **Screen Name:** Studio Visuals Manager
* **Route:** `/admin/assets`
* **Purpose:** Manage dynamic editorial photography for homepage hero banners, philosophy strips, gifting occasion blobs, and seasonal collections.
* **Who Can Access It:** Super Admin, Creative Director.
* **Primary User:** Creative Director.
* **Data Displayed:** Section key, visual slot label, current image preview, image dimensions, last updated timestamp.
* **Table Columns:** Slot Name, Section Identifier, Current Visual, Dimensions, Action.
* **Filters:** Homepage vs. Shop Rails vs. About Page.
* **Search:** Search by asset slot key.
* **Sorting:** Section order.
* **Views:** Visual Grid layout displaying active photography with upload overlays.
* **Bulk Actions:** None.
* **Individual Actions:** Drag-and-drop new high-res image, replace asset, preview in live site context.
* **Forms:** File drop zone with crop preview.
* **Validation:** Images must be PNG, JPEG, or WebP; maximum file size 5MB.
* **Confirmation:** Alert when replacing core brand hero photography.
* **Error States:** Toast on image format mismatch.
* **Empty States:** Placeholder botanical sketch if slot is unpopulated.
* **Loading States:** Progress bar showing upload percentage to Supabase Storage `site-assets` bucket.
* **Success States:** Immediate cache-busted update of image on storefront.
* **Permissions:** `assets.manage`, `storage.upload`.
* **Audit Requirements:** Log asset updates to `audit_logs`.
* **Related Screens:** `/`, `/shop`, `/about`.
* **Database Entities Used:** `site_assets`.
* **API/Service Requirements:** Supabase Storage client.
* **Edge Cases:** Browser aggressive image caching (handled via timestamp query param e.g. `?t=1727500000`).
* **Mobile Behavior:** 2-column image grid on mobile.

---

## Screen 7: Thermal Packing Slip & Invoice Print Station

* **Screen Name:** Packing Slip & Document Station
* **Route:** Triggered via Order Detail Modal in `/admin/orders`
* **Purpose:** Generates a 4x6" thermal printable packing slip and full A4 tax invoice for zero-error fulfillment.
* **Who Can Access It:** Super Admin, Operations Manager, Packing Clerk.
* **Primary User:** Studio Packing Station Clerk.
* **Data Displayed:** Order Number barcode, Carrier AWB barcode, Shipping Address with recipient phone, Itemized stem list with yarn shade badges, Personal Handwritten Card Note in prominent callout box, Special packing instructions (e.g. "Gift wrap with sage ribbon").
* **Views:** Clean browser print preview styled via `@media print`.
* **Individual Actions:** 1-Click Print (triggers native system print dialog targeted to 4x6" thermal label or A4 printer).
* **Validation:** Verified that order is in `PACKED` or `PROCESSING` state before generating packing slip.
* **Success States:** Document renders cleanly with crisp vector barcodes and zero UI chrome.
* **Permissions:** `orders.read`.
* **Audit Requirements:** None for printing read-only slips.
