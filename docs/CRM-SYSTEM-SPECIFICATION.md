# CRM SYSTEM SPECIFICATION: Customer 360 Architecture
**The Petal & Bloom Commerce Operating System**
**Role:** CRM Architect & D2C Retention Strategist

---

## 1. CRM Philosophy: The Customer 360

In bespoke gifting, customers are not anonymous checkout rows; they are patrons celebrating intimate life moments. The Petal & Bloom CRM is structured around the **Customer 360 Principle**: When an artisan, concierge, or founder opens a patron's record, they must immediately understand the patron's entire history, gifting patterns, and sentiment without opening another tool.

```
                  ┌───────────────────────────────┐
                  │          PATRON 360           │
                  │   Identity & Contact Details  │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   TRANSACTIONS   │    │  ENGAGEMENT &    │    │   OPERATIONS &   │
│   & LIFETIME     │    │  PETAL POINTS    │    │    LOGISTICS     │
├──────────────────┤    ├──────────────────┤    ├──────────────────┤
│• Orders & Items  │    │• Loyalty Balance │    │• Saved Addresses │
│• Total Spend LTV │    │• Tier Progress   │    │• Delivery Notes  │
│• AOV & Frequency │    │• Referral Codes  │    │• Courier Issues  │
│• Gift Recipients │    │• Ledger History  │    │• WhatsApp Log    │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 2. Customer Identity Resolution & Merging

A major challenge in D2C e-commerce is the proliferation of duplicate records caused by guest checkouts.

### Identity Resolution Engine:
1. **Primary Key:** `profiles.id` (UUID linked to Supabase Auth).
2. **Deterministic Identifiers:**
   * **Phone Number:** Normalized to 10-digit Indian mobile standard (e.g., `9876543210`). Strips leading `+91`, `0`, spaces, and dashes.
   * **Email Address:** Trimmed, lowercased, and validated against standard RFC regex.
3. **Automatic Guest Order Linking:**
   * When a customer registers via `api/account/signup.ts`, Step 4 immediately executes an atomic database update:
     ```sql
     UPDATE public.orders
     SET customer_id = new_user_id
     WHERE customer_id IS NULL
       AND (
         guest_email = clean_email
         OR guest_phone LIKE '%' || clean_phone || '%'
       );
     ```
   * All past guest orders placed with that phone number or email are instantly linked to the new patron profile.

---

## 3. Patron Profile & Data Model

The patron record aggregates data across five distinct tables:

### 3.1 Identity Attributes (`public.profiles`)
* `full_name`: Patron's full legal or preferred name.
* `phone`: Normalized unique mobile number.
* `email`: Unique verified or login email.
* `role`: System authorization role (`customer`, `admin`, `super_admin`).
* `referral_code`: Unique immutable referral code (e.g., `BLOOM-9821-412`).
* `referred_by`: Code of the patron who invited this customer.
* `created_at`: Registration timestamp.

### 3.2 Address Book (`public.customer_addresses`)
* Supports multiple addresses per customer (Home, Office, Parents, Partner).
* Fields: `recipient_name`, `phone`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `is_default`.
* Deduplication logic during checkout auto-saves new delivery addresses to the profile if not already present.

### 3.3 Loyalty Account (`public.loyalty_accounts`)
* `points_balance`: Redeemable Petal Points (1 pt = ₹1 INR).
* `lifetime_points_earned`: Cumulative points earned across all purchases.
* `tier`: Patron tier (`FLORET`, `BLOSSOM`, `HEIRLOOM`).

---

## 4. Value Metrics & RFM Segmentation

The CRM calculates standard Recency-Frequency-Monetary (RFM) metrics dynamically:

### 4.1 Calculated Value Metrics
* **Customer Lifetime Value (LTV):**
  $$\text{LTV} = \sum \text{orders.total\_in\_paise} \quad (\text{where } \text{payment\_status} = \text{'SUCCESS'})$$
* **Average Order Value (AOV):**
  $$\text{AOV} = \frac{\text{LTV}}{\text{Total Confirmed Orders}}$$
* **Order Frequency:** Count of completed orders.
* **Recency:** Days elapsed since the most recent completed order.

### 4.2 Dynamic Patron Segments

| Segment | Criteria | Strategic Action |
| :--- | :--- | :--- |
| **New Patrons** | 1 order, placed within last 30 days | Welcome follow-up; prompt for feedback & referral code share. |
| **Loyal Patrons** | $\ge 3$ orders or LTV $\ge$ ₹5,000 | Hand-written artisan thank you note; priority studio slot. |
| **Heirloom VIPs** | Lifetime Petal Points $\ge 1,500$ | Free shipping on every order; WhatsApp direct access to founder. |
| **Dormant / At-Risk** | Last order $> 120$ days ago | Targeted seasonal re-engagement coupon (e.g., Mother's Day). |
| **Advocates** | $\ge 2$ successful referrals rewarded | Special gift bouquet reward for brand ambassadorship. |

---

## 5. Administrative CRM Actions

From the CRM Workbench (`/admin/customers`), authorized operators can execute:

### 5.1 1-Click WhatsApp Concierge
* Generates an instant WhatsApp chat link to the customer's phone:
  `https://wa.me/91{PHONE}`
* Enables white-glove communication regarding stem color choices, delivery timing, or custom card wording.

### 5.2 Administrative Petal Points Adjustment
* Allows an operator to credit or debit points directly:
  * **Credit Scenario:** Customer experienced a shipping delay or minor packaging crease. Concierge credits 100 Petal Points (₹100 value) as goodwill compensation.
  * **Debit Scenario:** Manual offline refund processed for a returned order.
* **Audit Trail:** Mandatory `reason` field written to `loyalty_transactions` with `type = 'ADMIN_CREDIT'` or `type = 'ADMIN_DEBIT'`.

### 5.3 Secure Customer Data Export
* Generates an RFC 4180-compliant CSV file containing filtered patron records.
* Masks sensitive authentication hashes; includes only operational metrics for marketing campaigns.

---

## 6. Privacy & Data Governance

1. **Row Level Security (RLS):** Customers can only read and mutate their own profile and address book rows via `auth.uid() = id`.
2. **Admin Isolation:** Only users with `role IN ('admin', 'super_admin')` can access the CRM endpoint or query multi-customer data.
3. **No Card Data Storage:** Credit card and UPI VPA details are processed directly by Cashfree PCI-DSS Level 1 servers and are never stored in the CRM database.
