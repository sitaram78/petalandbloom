# ORDER MANAGEMENT SPECIFICATION: 360° Order Lifecycle
**The Petal & Bloom Commerce Operating System**
**Role:** E-Commerce Operations Architect & Systems Designer

---

## 1. Architectural Principles of Order Management

In an artisan e-commerce model, an Order is not a static database row; it is a **dynamic contract** between the gift-giver, the studio artisan, and the logistics carrier.

### Core Order Invariants:
1. **Immutability of Historical Snapshots:** When an order is placed, customer details, shipping address, line-item titles, and unit prices are stored as immutable snapshots in `orders` and `order_items`. Later changes to product prices in the catalog never alter historical orders.
2. **Authoritative Server-Side Calculation:** Taxes, discounts, shipping fees, and loyalty redemptions are computed by `api/checkout/create-order.ts`. The client submits only product codes and quantities.
3. **Decoupled Lifecycle States:** Financial status, fulfillment status, and courier shipment status operate as distinct dimensions.

---

## 2. The Three State Dimensions

An order's operational state is defined across three orthogonal axes:

```
[Payment Status]      PENDING  ──►  SUCCESS  ──►  REFUNDED / FAILED
                         │
                         ▼
[Fulfillment Status]  PENDING  ──►  PROCESSING  ──►  PACKED  ──►  CANCELLED
                                       │
                                       ▼
[Shipment Status]     PENDING  ──►  IN_TRANSIT  ──►  OUT_FOR_DELIVERY  ──►  DELIVERED
```

### 2.1 Complete Status Definitions

| State Dimension | Status Value | Business Meaning |
| :--- | :--- | :--- |
| **Payment Status** | `PENDING` | Checkout initiated; awaiting Cashfree payment session completion. |
| | `SUCCESS` | Gateway confirmed payment capture via verified HMAC webhook. |
| | `FAILED` | Payment dropped, declined, or timed out. |
| | `REFUNDED` | Full or partial funds returned to customer via Cashfree Refund API. |
| **Order Status** | `PENDING_PAYMENT` | Initial checkout record awaiting payment capture. |
| | `PAYMENT_CONFIRMED` | Paid and queued for artisan scheduling. |
| | `PROCESSING` | In active handcrafting; yarn assigned, stems being sculpted. |
| | `PACKED` | Stems inspected, card written, securely placed in archival box. |
| | `SHIPPED` | Consignment handed to courier partner; AWB generated. |
| | `OUT_FOR_DELIVERY` | Consignment on delivery vehicle at destination city. |
| | `DELIVERED` | Recipient signed/received parcel. |
| | `CANCELLED` | Order terminated prior to dispatch; inventory restored. |
| **Shipment Status** | `PENDING` | Parcel not yet manifested with carrier. |
| | `IN_TRANSIT` | Parcel moving through logistics hubs. |
| | `OUT_FOR_DELIVERY` | Final-mile delivery attempted. |
| | `DELIVERED` | Successfully delivered to recipient. |
| | `RTO_INITIATED` | Return to Origin triggered due to incorrect address or refusal. |
| | `RTO_DELIVERED` | Parcel returned to studio. |

---

## 3. Order Data Architecture

### 3.1 Order Aggregate Root (`public.orders`)
* `id`: UUID primary key.
* `order_number`: Human-readable identifier (Format: `TPB-{BASE36_TIMESTAMP}-{RANDOM4}`, e.g., `TPB-KT9X2-8921`).
* `customer_id`: UUID foreign key to `profiles.id` (nullable for guest orders).
* `guest_name`: Recipient / purchaser name.
* `guest_phone`: 10-digit mobile number.
* `guest_email`: Customer notification email.
* `shipping_address_snapshot`: JSONB immutable snapshot:
  ```json
  {
    "recipientName": "Ananya Sharma",
    "phone": "9876543210",
    "addressLine1": "Apartment 4B, Lotus Heights",
    "addressLine2": "Indiranagar",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560038"
  }
  ```
* `subtotal_in_paise`: Gross catalog value before discounts.
* `discount_in_paise`: Coupon savings applied.
* `loyalty_discount_in_paise`: Petal Points redemption discount (1 pt = 100 paise).
* `loyalty_points_redeemed`: Number of points redeemed.
* `shipping_fee_in_paise`: Calculated delivery fee (0, 4900, or 6900 paise).
* `total_in_paise`: Final amount payable and captured.
* `applied_coupon_code`: Code applied at checkout.
* `customer_note`: Optional instructions from customer.

### 3.2 Line Item Snapshots (`public.order_items`)
* `order_id`: UUID reference to parent order.
* `product_id`: Reference to catalog piece (nullable if piece is later retired).
* `product_code`: SKU code at time of purchase.
* `product_name`: Title at time of purchase.
* `unit_price_in_paise`: Unit price paid.
* `quantity`: Number of units.
* `selected_color`: Chosen yarn shade (e.g., "Dusty Rose").
* `gift_wrap`: Boolean flag indicating premium packaging.
* `personal_message`: Custom note to be transcribed onto gift card.

---

## 4. The 360° Order Detail Operational View

When an operator opens an order in `/admin/orders`, the slide-out drawer displays six comprehensive sections:

1. **Header & Core Identifiers:**
   * Order Number with quick copy button.
   * Creation timestamp & elapsed time (e.g., "Placed 2 hours ago").
   * Current Payment, Order, and Shipment status badges.
2. **Customer Information:**
   * Name, phone, and email with 1-click WhatsApp link.
   * Account status: "Registered Patron (Heirloom Tier)" vs. "Guest Customer".
   * Prior order count and total spend.
3. **Delivery Destination:**
   * Full address with 1-click "Copy Address" button formatted for thermal printers.
   * Delivery PIN code serviceability check.
4. **Itemized Work Order:**
   * High-resolution thumbnail for visual verification.
   * Arrangement title, quantity, and unit price.
   * Yarn shade badge.
   * Personalized Gift Message callout box (highlighted in gold for packing clerks).
5. **Financial Breakdown:**
   * Item Subtotal, Coupon Savings, Petal Points Redeemed, Shipping Fee, and Grand Total.
   * Gateway reference (Cashfree Order ID and Payment ID).
6. **Logistics & Dispatch Controller:**
   * Carrier selector (`SHIPROCKET`, `DELHIVERY`, `INDIA_POST`, `MANUAL`).
   * AWB tracking text input.
   * Auto-generated tracking link.
   * Status change note input.
   * "Save & Notify" button: Fired webhook sends dispatch email and launches WhatsApp dispatch link.

---

## 5. Order Lifecycle Timeline (Audit History)

The order timeline answers the vital question: *"What exactly happened to this order, when, and by whom?"*

Stored in `public.order_status_history`:
```
[2026-09-28 10:15:22 UTC] PENDING_PAYMENT -> PAYMENT_CONFIRMED
Actor: cashfree_webhook
Note: Payment successfully captured via Cashfree (Payment ID: cf_pay_918239128)

[2026-09-28 11:30:00 UTC] PAYMENT_CONFIRMED -> PROCESSING
Actor: admin_ananya (Studio Operations)
Note: Assigned to Artisan Priya for hand-sculpting (Dusty Rose yarn lot #4)

[2026-09-28 16:45:10 UTC] PROCESSING -> PACKED
Actor: admin_rahul (Packing Station)
Note: Stems inspected, personal note printed, sealed in archival box

[2026-09-28 18:00:25 UTC] PACKED -> SHIPPED
Actor: admin_rahul (Packing Station)
Note: Handed to Delhivery Air Express (AWB: 142385920194). Dispatch email sent.
```

---

## 6. Administrative Actions & Permission Gates

| Action | Allowed Role | Prerequisite Condition | System Side-Effects |
| :--- | :--- | :--- | :--- |
| **Mark Processing** | Operations, Super Admin | Payment confirmed | Updates status, logs timeline. |
| **Mark Packed** | Operations, Super Admin | Status is Processing | Updates status, unlocks AWB entry. |
| **Dispatch Order** | Operations, Super Admin | Status is Packed, Carrier & AWB entered | Updates status to `SHIPPED`, sends email, generates WhatsApp link. |
| **Cancel Order** | Super Admin, Operations | Order not yet shipped | Restores inventory, restores Petal Points, updates status to `CANCELLED`. |
| **Issue Refund** | Super Admin Only | Payment status is `SUCCESS` | Calls Cashfree Refund API, updates status to `REFUNDED`, logs audit. |
| **Resend Email** | Concierge, Super Admin | Valid customer email | Re-triggers `sendOrderConfirmationEmail` or `sendDispatchEmail`. |
