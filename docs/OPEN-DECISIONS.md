# OPEN BUSINESS DECISIONS: Human Owner Confirmation Catalog
**The Petal & Bloom Commerce Operating System**
**Role:** Principal Business Operations Consultant & Systems Architect

---

## 1. Principles of Decision Governance

An architecture plan cannot arbitrarily invent commercial or legal policies. 

Technical decisions (such as using HMAC-SHA256, PostgreSQL check constraints, or React print layouts) have been finalized by the engineering team. However, the following **commercial, legal, and operational policies** require explicit sign-off by the human owner.

Every decision below is flagged with `[OWNER DECISION REQUIRED]`.

---

## 2. Catalog of Open Business Decisions

### 2.1 Commercial & Loyalty Policies

#### Decision 1: Petal Points Earning & Redemption Ratio
* **Current Implementation:**
  * Earning: 1 Petal Point per ₹10 spent (10% effective reward rate).
  * Redemption: 1 Petal Point = ₹1.00 INR direct discount at checkout.
  * Welcome Bonus: 50 Petal Points (₹50 discount) on account registration.
* **Question for Owner:** Is 1 point per ₹10 spent sustainable for your gross profit margins, or should it be adjusted to 1 point per ₹20 spent (5% effective reward rate)?
* **Tag:** `[OWNER DECISION REQUIRED]`

#### Decision 2: Referral Reward Amount & Trigger
* **Current Implementation:**
  * Referrer receives 100 Petal Points (worth ₹100 discount).
  * Trigger: Awarded automatically when the invited friend's first order is marked `PAYMENT_CONFIRMED` and completed.
* **Question for Owner:** Does ₹100 represent an acceptable Customer Acquisition Cost (CAC) for new patrons? Should there be a minimum order value for the friend (e.g., friend must spend at least ₹799)?
* **Tag:** `[OWNER DECISION REQUIRED]`

#### Decision 3: Loyalty Points Expiration Policy
* **Current Implementation:** Points do not expire.
* **Question for Owner:** Should Petal Points expire after 12 months of inactivity to limit balance sheet liability, or should they remain valid indefinitely as a luxury brand trust builder?
* **Tag:** `[OWNER DECISION REQUIRED]`

---

### 2.2 Logistics & Shipping Policies

#### Decision 4: Tiered Shipping Rates & Complimentary Threshold
* **Current Implementation:**
  * Subtotal $\ge$ ₹1,200: **Complimentary Delivery (Free)**
  * Subtotal $\ge$ ₹799: **₹49 Reduced Shipping**
  * Subtotal < ₹799: **₹69 Standard Atelier Shipping**
* **Question for Owner:** Does ₹1,200 match your packaging and courier costs (courier air cargo across India typically costs ₹70–₹120 for a volumetric floral box)? Should the free shipping threshold be increased to ₹1,499?
* **Tag:** `[OWNER DECISION REQUIRED]`

#### Decision 5: Shiprocket Automated Booking Credentials
* **Current Implementation:** Shipping carrier and AWB are entered manually by the admin in `/admin/orders`.
* **Question for Owner:** Do you currently have an active Shiprocket account to connect via API for automated label generation, or should the studio continue with manual AWB entry for launch?
* **Tag:** `[OWNER DECISION REQUIRED]`

---

### 2.3 Tax, Invoicing & Legal Policies

#### Decision 6: GST Registration Status & Invoice Display
* **Current Implementation:** Invoices display *"The Petal & Bloom Studio — Handcrafted Atelier"*. GST number field is dynamic.
* **Question for Owner:** Is The Petal & Bloom registered under GST? If yes, what is your official GSTIN and state registration code? If not registered (operating under the threshold), should the invoice clearly state *"Retail Sale Bill / Composition Scheme - Not for Input Tax Credit"*?
* **Tag:** `[OWNER DECISION REQUIRED]`

#### Decision 7: Return & Cancellation Policy for Made-to-Order Pieces
* **Current Implementation:** Admin can cancel an order in `/admin/orders` before dispatch.
* **Question for Owner:** Once an artisan has hand-sculpted a custom bouquet with personal colors, can the customer cancel with a full refund? Or should custom orders have a non-refundable deposit policy?
* **Tag:** `[OWNER DECISION REQUIRED]`

---

### 2.4 Marketing & Influencer Policies

#### Decision 8: Influencer Affiliate Commission Structure
* **Current Implementation:** Influencer coupon schema supports custom `commission_percent` (e.g., 10%).
* **Question for Owner:** What commission percentage or flat fee will you offer content creators? Will commissions be calculated on gross sales or net sales (after discounts and shipping)?
* **Tag:** `[OWNER DECISION REQUIRED]`

---

### 2.5 Communication & Concierge Policies

#### Decision 9: WhatsApp Notification Mode
* **Current Implementation:** 1-Click WhatsApp Concierge links (`https://wa.me/91...`) pre-populating dispatch messages for the admin to send via WhatsApp Web (Free, zero monthly fee, human-in-the-loop).
* **Question for Owner:** Is this 1-click manual concierge acceptable for launch, or do you want to subscribe to a paid WhatsApp Business API provider (Interakt / Gupshup / Wati at ~₹1,500/month + ₹0.80 per conversation)?
* **Tag:** `[OWNER DECISION REQUIRED]`
