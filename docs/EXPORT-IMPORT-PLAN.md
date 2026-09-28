# EXPORT & IMPORT ENGINE PLAN: Data Portability & Governance
**The Petal & Bloom Commerce Operating System**
**Role:** Data Architect & Security Engineer

---

## 1. Governance Principles

Data portability is necessary for accounting, logistics batching, and external marketing, but it introduces significant security and privacy risks.

### Core Governance Rules:
1. **No Blind Bulk Imports:** Every import must run a dry-run validation pass with a preview of changes and atomic rollback on error.
2. **PII Masking & Least Privilege:** Plaintext export of payment tokens or sensitive internal credentials is strictly prohibited.
3. **Audit Trail on Every Extraction:** Every export action logs the operator ID, target dataset, applied filters, and row count to `audit_logs`.
4. **Standard Encoding:** All tabular files use RFC 4180 CSV encoding with UTF-8 byte order marks (BOM) to ensure clean rendering in Microsoft Excel and Google Sheets.

---

## 2. Export Specifications by Domain

| Dataset | Allowed Roles | Included Fields | Masked / Excluded Fields | Max Row Limit |
| :--- | :--- | :--- | :--- | :--- |
| **Orders Dispatch Manifest** | Super Admin, Operations | `order_number`, `created_at`, `recipient_name`, `phone`, `address`, `city`, `pincode`, `items_summary`, `carrier`, `awb_number` | Payment IDs, customer internal UUID, discount coupons | 5,000 rows |
| **Financial Sales Summary** | Super Admin Only | `order_number`, `date`, `subtotal`, `discounts`, `loyalty_redeemed`, `shipping`, `total`, `payment_status`, `payment_method`, `cf_payment_id` | Full customer addresses, recipient phone numbers | 10,000 rows |
| **Patron CRM Directory** | Super Admin Only | `full_name`, `phone`, `email`, `tier`, `points_balance`, `lifetime_points`, `orders_count`, `total_spent_inr`, `referral_code`, `joined_date` | Password hashes, session tokens, audit logs | 10,000 rows |
| **Catalog & Inventory** | Super Admin, Operations | `code`, `name`, `category`, `price_inr`, `compare_price_inr`, `inventory_count`, `is_mto`, `preparation_days`, `is_active` | Raw database internal UUIDs | 1,000 rows |
| **Loyalty Ledger** | Super Admin Only | `transaction_id`, `customer_phone`, `type`, `points`, `description`, `created_at` | Customer auth hashes | 20,000 rows |
| **Influencer Performance** | Super Admin, Marketing | `coupon_code`, `influencer_name`, `usage_count`, `gross_revenue_inr`, `commission_rate`, `commission_due_inr` | Customer individual order details | 1,000 rows |

---

## 3. Safe Import Architecture

### 3.1 Two-Stage Validation & Preview Pipeline

```
[Upload CSV File] ──► [Stage 1: Schema & Syntax Validation]
                              │
                              ├──► Errors Found? ──► [Download Error Report CSV]
                              ▼
                      [Stage 2: Dry-Run Database Simulation]
                              │
                              ▼
                      [Review Diff Preview Screen]
                      ("14 pieces to be updated, 2 new pieces added")
                              │
                              ├──► Operator Confirms Action
                              ▼
                      [Atomic Database Transaction Executed]
                              │
                              ▼
                      [Audit Log Entry Recorded]
```

### 3.2 Product Catalog Import (`products`)
* **Key Fields Supported:** `code` (Unique Key), `name`, `category_slug`, `price_in_inr`, `compare_at_price_inr`, `inventory_count`, `is_made_to_order`, `preparation_days`.
* **Validation Rules:**
  * `code`: Must match alphanumeric regex (`^[A-Z0-9_-]+$`).
  * `price_in_inr`: Must parse to a positive number (converted internally to `price_in_paise = price_inr * 100`).
  * `category_slug`: Must match an existing category in `public.categories`.
* **Error Report:** Generates an exact row-by-row error report CSV (e.g., *"Row 14: Category 'succulents' does not exist in atelier database"*).

### 3.3 Inventory Stock Update Import
* **Purpose:** Quick bulk update of available physical stock after a production batch.
* **Fields:** `product_code`, `new_inventory_count`, `adjustment_reason`.
* **Transaction Safety:** Executes inside a PostgreSQL single transaction block:
  ```sql
  BEGIN;
  -- Batch updates
  UPDATE public.products SET inventory_count = 15 WHERE code = 'ROSE-01';
  UPDATE public.products SET inventory_count = 8 WHERE code = 'DAISY-04';
  -- If any code fails, whole batch rolls back
  COMMIT;
  ```

---

## 4. Large Dataset Strategy

* For datasets $> 20,000$ rows (e.g., historical tracking events or multi-year loyalty transactions):
  * Client-side exports use cursor-based pagination (`limit=1000&offset=N`) to avoid browser memory spikes.
  * Direct streaming download to avoid Vercel 4.5MB serverless response payload limits.
