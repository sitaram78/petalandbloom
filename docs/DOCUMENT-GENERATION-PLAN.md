# DOCUMENT GENERATION PLAN: Authoritative Print & Invoicing
**The Petal & Bloom Commerce Operating System**
**Role:** Systems Architect & Compliance Designer

---

## 1. Document Taxonomy: Distinct Business Documents

In a professional retail operation, different stakeholders require different legal, logistical, and customer-facing artifacts. Conflating these into a single document creates customer confusion and operational errors.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DOCUMENT TAXONOMY                             │
├───────────────────────┬────────────────────────┬───────────────────────┤
│    CUSTOMER-FACING    │       LOGISTICAL       │      FINANCIAL /      │
│      EXPERIENCE       │       OPERATIONS       │      COMPLIANCE       │
├───────────────────────┼────────────────────────┼───────────────────────┤
│ 1. Order Confirmation │ 3. Thermal Packing     │ 4. Commercial Tax     │
│    (In-App & Email)   │    Slip (4x6")         │    Invoice (A4)       │
│ 2. Gift Card Message  │                        │ 5. Refund Credit      │
│    Card (3x4")        │                        │    Note               │
└───────────────────────┴────────────────────────┴───────────────────────┘
```

---

## 2. Specification of Core Documents

### Document 1: Commercial Tax Invoice
* **Purpose:** Legal proof of purchase for accounting and commercial compliance under Indian retail standards.
* **Format:** Standard A4 page layout (Print-CSS & downloadable PDF).
* **Numbering Scheme:** Sequential alphanumeric identifier:
  `TPB-INV-YYYY-XXXXX` (e.g., `TPB-INV-2026-00142`), linked to `orders.order_number`.
* **Header / Business Identity:**
  * Brand: *The Petal & Bloom Studio*
  * Business Address: Studio Atelier, Bengaluru, Karnataka, India
  * GSTIN: Configurable via settings (Never hardcoded or invented). Displays *"Composite Dealer / Retail Invoice"* if unregistered or below turnover threshold.
  * HSN Craft Code: `5808` (Artisan braided floral crafts)
* **Customer Block:**
  * Billed To: Purchaser Name, Phone, Email
  * Shipped To: Destination Address Snapshot, Recipient Phone
* **Line-Item Table:** Item SKU, Title, Quantity, Gross Rate, Discounts, Taxable Value, Shipping, and Final Invoice Total.
* **Footer:** Digital authorization seal, Terms of Sale, Customer Concierge contact details.

---

### Document 2: Studio Thermal Packing Slip (Logistics Work Order)
* **Purpose:** The physical document used by the studio packing station to assemble, inspect, and label the postal box without exposing pricing data to the recipient.
* **Format:** **4x6" Thermal Label Standard** (Direct-to-printer via browser print dialog).
* **Key Sections:**
  * **Order Barcode:** Code 128 barcode of `order_number` for instant handheld scanner verification.
  * **Carrier Details:** Courier Partner (`DELHIVERY`, `SHIPROCKET`, `INDIA_POST`), AWB Number, and Tracking Barcode.
  * **Destination Label:** Large, bold recipient address, PIN code, and recipient mobile for courier delivery agents.
  * **Stem Checklist:** Table of arrangements with quantity, stem length, and exact yarn shade pills (e.g. `[x1] Rose - Dusty Pink`, `[x2] Daisy - Ivory White`).
  * **Quality Sign-off:** Checkboxes for:
    * Stem wire rigidity checked [ ]
    * Petal shaping steamed [ ]
    * Archival ribbon tied [ ]
    * Moisture barrier sealed [ ]

---

### Document 3: Personalized Handwritten Gift Card Note
* **Purpose:** Printed card template or transcription guide for the customer's personal message.
* **Format:** Premium 3x4" botanical card template.
* **Content:**
  * Elegant Fraunces serif typeface typography.
  * Verbatim text from `order_items.personal_message`.
  * Subtle botanical watermark border.

---

### Document 4: Refund Credit Note
* **Purpose:** Legal document confirming refund processing for accounting reconciliation.
* **Numbering Scheme:** `TPB-CRN-YYYY-XXXXX`.
* **Content:** Original order reference, Cashfree Refund Reference ID, refunded amount in INR, refund reason, and date processed.

---

## 3. Technical Implementation Architecture

### 3.1 Browser Print-CSS Approach (Recommended Core)
* Rather than requiring heavy server-side Chromium instances (Puppeteer) that consume vast memory and introduce cold-start latency, documents are rendered as dedicated React components styled with `@media print`.
* **Advantages:**
  * Instant rendering ($< 50\text{ms}$).
  * Zero server infrastructure overhead.
  * Native browser support for direct thermal label printers (Zebra, Munbyn, TSC).
  * Perfect fidelity on both desktop and mobile devices.

### 3.2 Authoritative Source of Truth
* Documents are **never stored as static binary PDF files in the database**.
* Documents are generated **dynamically on demand from the authoritative order snapshot** (`orders`, `order_items`, `payments`, `shipments`).
* If an order is inspected 3 years later, the invoice can be reproduced with 100% mathematical fidelity.
