# API & SERVICE ARCHITECTURE: Modular Service Boundaries
**The Petal & Bloom Commerce Operating System**
**Role:** Backend Systems Architect & API Designer

---

## 1. Architectural Philosophy: The Modular Monolith

Rather than deploying distributed microservices that introduce distributed transaction problems and high operational overhead, The Petal & Bloom utilizes a **Modular Monolith Architecture** deployed on Vercel Serverless Functions.

Each service is encapsulated in `/api/lib` with clean public interfaces, authoritative business validations, and explicit database transaction boundaries.

```
       [HTTP API Layer: /api/*]
                 │
                 ▼
     [Domain Service Layer: /api/lib/*]
   ┌─────────────┼─────────────┬─────────────┐
   ▼             ▼             ▼             ▼
OrderService  PaymentService  LoyaltyService ShippingService ...
   └─────────────┼─────────────┴─────────────┘
                 │
                 ▼
      [Supabase PostgreSQL Layer]
```

---

## 2. Core Service Boundaries & Responsibilities

### 2.1 CheckoutService & OrderService
* **File:** `api/checkout/create-order.ts`, `api/orders/track.ts`, `api/orders/cancel.ts`
* **Responsibilities:**
  * Validates customer identity and shipping address format.
  * Re-evaluates all catalog product prices against authoritative database records.
  * Evaluates coupon rules (expiry, usage limits, minimum spend).
  * Enforces loyalty balance checks and reserves Petal Points.
  * Inserts immutable order and line-item snapshots.
  * Orchestrates Cashfree PG order creation.

### 2.2 PaymentService & RefundService
* **File:** `api/lib/cashfreeServer.ts`, `api/payments/cashfree-webhook.ts`, `api/payments/refund.ts`
* **Responsibilities:**
  * Generates Cashfree drop-in payment sessions.
  * Cryptographically verifies incoming webhook HMAC-SHA256 signatures.
  * Enforces webhook idempotency via `payment_events` table.
  * Executes refunds via Cashfree Refund API.
  * Reconciles gateway payment IDs with internal orders.

### 2.3 LoyaltyService & ReferralService
* **File:** `api/account/signup.ts`, `api/payments/cashfree-webhook.ts`
* **Responsibilities:**
  * Issues 50 welcome Petal Points on patron registration.
  * Awards 1 Petal Point per ₹10 spent on confirmed orders.
  * Dynamically calculates and upgrades loyalty tiers (`FLORET`, `BLOSSOM`, `HEIRLOOM`).
  * Attaches referral attribution during signup.
  * Rewards 100 Petal Points to referrer upon referee's first delivered order.

### 2.4 ShippingService
* **File:** `src/services/shippingService.ts`, `api/orders/notify.ts`
* **Responsibilities:**
  * Carrier abstraction across Shiprocket, Delhivery, India Post, and Manual studio delivery.
  * Generates tracking URLs based on carrier patterns.
  * Updates shipment tracking milestones in `shipments` and `shipment_events`.

### 2.5 NotificationService
* **File:** `api/lib/emailService.ts`, `api/orders/notify.ts`
* **Responsibilities:**
  * Renders luxury, brand-compliant HTML emails for Order Confirmation and Dispatch.
  * Dispatches emails via Resend HTTPS API.
  * Formats pre-filled WhatsApp Concierge dispatch messages.

### 2.6 CouponService
* **File:** `api/coupons/validate.ts`
* **Responsibilities:**
  * Validates coupon codes against cart subtotals and customer history.
  * Computes percentage and flat discounts with max cap enforcement.
  * Tracks global and per-customer usage counters.

---

## 3. Authoritative API Specifications

### 3.1 `POST /api/checkout/create-order`
Creates an immutable order record and initializes a Cashfree payment session.

* **Request Payload (DTO):**
  ```typescript
  interface CreateOrderRequest {
    customer: {
      name: string;
      phone: string;
      email?: string;
      customerId?: string; // UUID if signed in
    };
    shippingAddress: {
      recipientName: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      pincode: string;
    };
    items: Array<{
      productCode: string;
      quantity: number;
      selectedColor?: string;
      giftWrap?: boolean;
      personalMessage?: string;
    }>;
    couponCode?: string;
    redeemPoints?: number;
    customerNote?: string;
  }
  ```
* **Response Payload (DTO):**
  ```typescript
  interface CreateOrderResponse {
    success: boolean;
    orderId: string;       // e.g. "TPB-KT9X2-8921"
    orderNumber: string;
    totalAmount: number;   // in Rupees, e.g. 1499.00
    paymentSessionId: string; // Cashfree PG drop-in session
    isSimulated: boolean;
  }
  ```

---

### 3.2 `POST /api/payments/cashfree-webhook`
Asynchronous payment capture callback from Cashfree.

* **Headers Required:**
  * `x-webhook-signature`: Base64 HMAC-SHA256 signature.
  * `x-webhook-timestamp`: Request timestamp.
* **Payload Structure:**
  ```json
  {
    "event_time": "2026-09-28T10:15:22+05:30",
    "type": "PAYMENT_SUCCESS_WEBHOOK",
    "data": {
      "order": { "order_id": "TPB-KT9X2-8921", "order_amount": 1499.00 },
      "payment": {
        "cf_payment_id": "981293812",
        "payment_status": "SUCCESS",
        "payment_method": "UPI"
      }
    }
  }
  ```
* **Execution Pipeline:**
  1. Verify HMAC signature.
  2. Check idempotency in `payment_events`.
  3. Update `orders.order_status = 'PAYMENT_CONFIRMED'` and `payments.status = 'SUCCESS'`.
  4. Decrement product inventory atomically.
  5. Award loyalty points and check tier progression.
  6. Check referral reward conditions.
  7. Send luxury HTML confirmation email.

---

### 3.3 `POST /api/orders/notify`
Admin endpoint to trigger dispatch notifications.

* **Request Payload (DTO):**
  ```typescript
  interface OrderNotifyRequest {
    orderId: string;       // UUID
    awbNumber: string;
    carrier: 'SHIPROCKET' | 'DELHIVERY' | 'INDIA_POST' | 'MANUAL';
    trackingUrl?: string;
    estimatedDelivery?: string;
  }
  ```
* **Response Payload (DTO):**
  ```typescript
  interface OrderNotifyResponse {
    success: boolean;
    emailSent: boolean;
    whatsappLink: string;  // Pre-filled wa.me link
    recipientPhone: string;
  }
  ```

---

### 3.4 `POST /api/orders/cancel`
Cancels an order, restores stock, and credits back redeemed points.

* **Request Payload (DTO):**
  ```typescript
  interface CancelOrderRequest {
    orderId: string;
    reason?: string;
  }
  ```

---

### 3.5 `POST /api/payments/refund`
Executes gateway refund via Cashfree API.

* **Request Payload (DTO):**
  ```typescript
  interface RefundRequest {
    orderId: string;
    amountInRupees?: number; // Optional partial refund
    reason?: string;
  }
  ```
