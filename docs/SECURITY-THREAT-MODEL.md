# SECURITY THREAT MODEL & DEFENSE-IN-DEPTH MATRIX
**The Petal & Bloom Commerce Operating System**
**Role:** Principal Security Architect & Ethical Hacker

---

## 1. Threat Modeling Methodology

The Petal & Bloom security architecture adopts an **adversarial mindset (STRIDE Model)**. We assume that client-side code can be completely inspected, modified, or bypassed by malicious actors using automated bots, proxy interceptors (Burp Suite), or modified HTTP clients.

---

## 2. Threat Vector Analysis & Mitigation Matrix

### 2.1 Threat Vector 1: Client-Side Price & Discount Tampering
* **Attack Scenario:** An attacker intercepts the checkout request via proxy and modifies `total_in_paise` from `149900` (₹1,499) to `100` (₹1), or modifies product prices in the cart JSON before posting.
* **Impact:** Direct financial loss; goods shipped below manufacturing cost.
* **Architectural Defense:**
  * **Zero Client Price Trust:** `api/checkout/create-order.ts` completely ignores all submitted prices, totals, or discount calculations from the client.
  * The server queries `public.products` directly to obtain the authoritative `price_in_paise`.
  * The server recalculates add-on fees, gift wrap fees, coupon discounts, shipping fees, and grand total in a closed serverless execution context.

---

### 2.2 Threat Vector 2: Fake Payment Webhooks & Signature Spoofing
* **Attack Scenario:** An attacker posts an artificial HTTP POST request to `/api/payments/cashfree-webhook` with `{ "payment_status": "SUCCESS" }` for an unpaid order.
* **Impact:** Order is fraudulently marked as paid; studio crafts and ships pieces without receiving funds.
* **Architectural Defense:**
  * **Cryptographic HMAC-SHA256 Verification:** `api/lib/cashfreeServer.ts` computes:
    $$\text{Expected Signature} = \text{Base64}(\text{HMAC-SHA256}(\text{timestamp} + \text{rawBody}, \text{CASHFREE\_WEBHOOK\_SECRET}))$$
  * Verification uses `crypto.timingSafeEqual` to prevent timing attacks.
  * If the signature does not match or is absent, the request is rejected with `400 Bad Request` and zero database mutations occur.

---

### 2.3 Threat Vector 3: Webhook Replay Attacks
* **Attack Scenario:** An attacker captures a legitimate payment webhook from a past order and replays the same network payload multiple times.
* **Impact:** Multiple duplicate loyalty points awarded; inventory erroneously decremented multiple times.
* **Architectural Defense:**
  * **Idempotency Table:** Every webhook records its unique `event_id` in `public.payment_events` with a database unique constraint.
  * If `payment_events` already contains `event_id` with `is_processed = true`, the webhook handler terminates immediately with `200 OK` and skips all loyalty credits or stock updates.

---

### 2.4 Threat Vector 4: Insecure Direct Object Reference (IDOR) & Customer PII Leakage
* **Attack Scenario:** Customer A logs in, intercepts network traffic, and changes `order_id` in URL parameters to view Customer B's orders, addresses, and phone numbers.
* **Impact:** Severe privacy violation under Indian Digital Personal Data Protection (DPDP) Act.
* **Architectural Defense:**
  * **PostgreSQL Row Level Security (RLS):**
    ```sql
    CREATE POLICY "Customers view own orders" ON public.orders
      FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
      
    CREATE POLICY "Customers view own addresses" ON public.customer_addresses
      FOR ALL USING (auth.uid() = customer_id);
    ```
  * Even if client-side code requests another user's UUID, PostgreSQL returns an empty set.

---

### 2.5 Threat Vector 5: Administrative Privilege Escalation
* **Attack Scenario:** A customer registers an account, modifies their local JWT token or localStorage role flag to `admin`, and attempts to access `/admin/orders`.
* **Impact:** Unauthorized access to commercial financials, customer address lists, and shipping tools.
* **Architectural Defense:**
  * **Server-Side Role Authority:** Roles are stored in `public.profiles.role` on the database server.
  * `AdminRoute.tsx` queries the database directly to confirm `is_admin()`.
  * Administrative API endpoints use `SUPABASE_SERVICE_ROLE_KEY` to verify the caller's JWT against `auth.users` and check `profiles.role IN ('admin', 'super_admin')`. Client claims are never trusted.

---

### 2.6 Threat Vector 6: Loyalty Points Gaming & Self-Referral Fraud
* **Attack Scenario:** A user creates multiple fake accounts using their own referral code to farm 100 Petal Points (₹100) rewards without buying anything, or uses race conditions to spend the same 50 points across two simultaneous checkouts.
* **Impact:** Uncontrolled discount erosion; financial fraud.
* **Architectural Defense:**
  * **Immediate Points Reservation:** When an order is created, `api/checkout/create-order.ts` immediately deducts redeemed points from `loyalty_accounts`. A second concurrent checkout finds a balance of 0 points and fails.
  * **Delayed Referral Reward:** Referral points are **never awarded on signup**. They are only triggered when the referee's first order is verified as `PAYMENT_CONFIRMED` and completed.
  * **Self-Referral Block:** Database check prevents `referrer_id = referee_id` and flags matching phone numbers.

---

### 2.7 Threat Vector 7: Malicious File Uploads to Supabase Storage
* **Attack Scenario:** An attacker attempts to upload executable binaries (PHP, Shell, HTML with stored XSS) disguised as product photographs.
* **Impact:** Remote code execution or Cross-Site Scripting (XSS).
* **Architectural Defense:**
  * **Storage Bucket Policies:** The `product-images` and `site-assets` buckets enforce strict MIME-type whitelisting (`image/jpeg`, `image/png`, `image/webp`).
  * Maximum file size restricted to 5MB.
  * Files served with `Content-Disposition: inline` and immutable cache headers.

---

### 2.8 Threat Vector 8: Bulk Scraping & Denial of Service
* **Attack Scenario:** A competitor runs automated scrapers against `/api/orders/track` to harvest customer names and shipping addresses.
* **Impact:** Brand reputation damage; commercial data loss.
* **Architectural Defense:**
  * **Two-Factor Lookup Requirement:** `api/orders/track.ts` requires **both** the exact human-readable order number (`TPB-XXXXX`) **and** the matching 10-digit mobile number.
  * Without both matching, the endpoint returns `404 Order not found` with zero customer data.
