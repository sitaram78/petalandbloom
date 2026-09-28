# THE PETAL & BLOOM — ENGINEERING GUIDELINES

**Project:** The Petal & Bloom  
**Development Environment:** Antigravity  
**Frontend Strategy:** Preserve the existing frontend/UI/UX  
**Database:** Completely NEW Supabase project, isolated from the current live site  
**Hosting:** Vercel  
**Current Domain:** `thepetalandbloom.vercel.app`  
**Future Domain:** `thepetalandbloom.in`  
**Payment:** Cashfree Payments — prepaid only  
**Shipping:** Shiprocket + Delhivery + India Post  
**Customer Checkout:** Guest checkout must be supported  
**Primary Objective:** Transform the existing application into a secure, scalable, production-grade ecommerce platform without breaking the existing live website.

---

## 1. NON-NEGOTIABLE PROJECT RULE

The existing frontend is already designed and should be preserved.

The engineering agent must:

- inspect the entire existing codebase first
- understand the current component structure
- understand routing
- understand product/catalogue structure
- understand cart and checkout
- understand current Supabase usage
- understand existing APIs/server actions
- understand authentication
- understand state management
- understand Vercel configuration
- identify reusable components
- identify technical debt
- identify areas that actually require replacement

### Do NOT

- rebuild the frontend from scratch without a technical reason
- randomly rename components
- replace working UI components unnecessarily
- change the visual identity unnecessarily
- remove existing functionality
- redesign the customer experience without a requirement
- connect the new application to the production Supabase project

The objective is:

> Keep the existing frontend experience while transforming the underlying application into a production-grade commerce platform.

---

## 2. CRITICAL DATABASE ISOLATION RULE

The existing live website and the new project MUST use different Supabase projects.

### Existing production system

```text
Current Website
      ↓
Current Supabase
      ↓
LIVE DATA
```

### New system

```text
New Application
      ↓
NEW Supabase Project
      ↓
NEW DATABASE
```

There must be NO accidental connection between them.

Inspect the existing `.env`, configuration files and Supabase client implementation to determine which variables currently point to the old Supabase project.

Configure new environment variables for the new Supabase project.

For example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Use the actual conventions already established by the project where appropriate.

### Absolutely prohibited

```text
Old Supabase URL → new application
Old Supabase service role key → new application
Old production database → development testing
```

unless explicitly approved.

Before ANY database operation:

1. Identify the target Supabase project.
2. Verify its URL/project ID.
3. Confirm it belongs to the NEW Supabase project.
4. Confirm it is NOT the existing production project.
5. Only then execute the operation.

If there is uncertainty, STOP and ask for confirmation.

---

## 3. FIRST PHASE: AUDIT BEFORE IMPLEMENTATION

Before writing significant code, perform a complete engineering audit.

Create:

```text
PROJECT_AUDIT.md
```

Document:

### Frontend

- framework
- version
- build system
- routing
- component architecture
- styling system
- UI library
- state management
- data fetching
- forms
- validation
- image handling
- SEO
- analytics
- checkout
- cart
- product pages
- search
- filters
- responsive behavior

### Backend

Determine whether the current application has:

- API routes
- server actions
- Supabase functions
- database access
- authentication
- authorization
- webhooks
- payment integration
- shipping integration
- order management

### Database

Document:

- existing tables
- relationships
- indexes
- RLS policies
- triggers
- functions
- storage buckets
- database types
- migrations

### Deployment

Document:

- Vercel configuration
- environment variables
- build command
- deployment configuration
- domains
- redirects
- cron jobs
- webhook URLs

### Third-party integrations

Identify all:

- Cashfree
- Supabase
- Shiprocket
- Delhivery
- India Post
- email services
- analytics
- other APIs

---

## 4. CREATE AN ARCHITECTURE PLAN

Before major implementation, create:

```text
ARCHITECTURE.md
```

It should explain:

```text
Browser
   ↓
Frontend
   ↓
Server/API layer
   ↓
Business logic
   ↓
Supabase
   ↓
External integrations
```

Payment and shipping integrations must not be directly controlled by insecure client-side code.

---

## 5. DATABASE ARCHITECTURE

The new Supabase database should be designed around the actual business.

Evaluate the need for:

### Products

```text
products
product_variants
product_images
categories
```

### Customers

```text
customers
customer_addresses
```

### Orders

```text
orders
order_items
order_status_history
```

### Payments

```text
payments
payment_events
```

### Shipping

```text
shipments
shipment_events
```

### Loyalty

```text
loyalty_accounts
loyalty_transactions
```

### Referral

```text
referral_codes
referrals
referral_rewards
```

### Coupons

```text
coupons
coupon_redemptions
```

### Administration

```text
admin_users
admin_activity_logs
```

The exact schema must be determined after auditing the existing application and requirements.

Do not create unnecessary tables merely to make the architecture appear complex.

---

## 6. GUEST CHECKOUT

Customers must NOT be forced to create an account before purchasing.

The flow should support:

```text
Browse
 ↓
Add to cart
 ↓
Checkout
 ↓
Enter customer information
 ↓
Enter address
 ↓
Cashfree payment
 ↓
Payment verification
 ↓
Order confirmation
```

No login should be required.

Customer information must still be associated with the order securely.

---

## 7. CUSTOMER HISTORY

The system should support a customer identity model that can later associate purchases.

Example:

```text
Customer
   │
   ├── Order 1
   ├── Order 2
   ├── Order 3
   └── Loyalty activity
```

A guest customer may later create/authenticate an account and have eligible historical orders associated through a secure verification mechanism.

Never expose order history merely because someone knows an email address.

---

## 8. PAYMENT ARCHITECTURE — CASHFREE

The selected payment provider is:

> Cashfree Payments

The store is:

> PREPAID ONLY

The frontend must never be trusted as the source of truth for payment success.

Preferred flow:

```text
Customer
   ↓
Checkout
   ↓
Server creates order
   ↓
Cashfree payment session/order
   ↓
Customer pays
   ↓
Cashfree webhook
   ↓
Server verifies event
   ↓
Payment marked successful
   ↓
Order confirmed
```

Do not rely only on a browser-side "payment success" result.

Use Cashfree's current official documentation when implementing the integration.

---

## 9. PAYMENT WEBHOOKS

Webhook processing must be:

### Secure

Verify authenticity according to Cashfree's current documentation.

### Idempotent

If the same event arrives multiple times:

```text
Webhook #1 → process
Webhook #2 → recognize already processed
Webhook #3 → safely ignore
```

Never create duplicate orders, payments, loyalty rewards or other business events.

Maintain payment event records.

---

## 10. ORDER STATE MACHINE

Orders should have explicit states.

Example:

```text
PENDING_PAYMENT
      ↓
PAYMENT_SUCCESS
      ↓
ORDER_CONFIRMED
      ↓
PROCESSING
      ↓
SHIPPED
      ↓
OUT_FOR_DELIVERY
      ↓
DELIVERED
```

Other possible states:

```text
PAYMENT_FAILED
PAYMENT_EXPIRED
CANCELLED
RETURN_REQUESTED
RETURNED
REFUNDED
```

Finalize the exact state machine during implementation.

Do not allow arbitrary invalid status transitions.

Maintain order status history.

---

## 11. SHIPPING ARCHITECTURE

The intended shipping ecosystem is:

- Shiprocket
- Delhivery
- India Post

Avoid tightly coupling the entire application to one provider.

Prefer an abstraction:

```text
ShippingService
      │
      ├── Shiprocket
      ├── Delhivery
      └── India Post
```

This allows providers to be changed or expanded later.

Use official APIs/documentation for actual implementation.

---

## 12. SHIPPING DATA

Store the address used for a specific order independently from a customer's mutable profile.

Example:

```text
Order
 └── Shipping Address Snapshot
```

Historical orders should retain the address used for that order, subject to appropriate privacy and retention practices.

---

## 13. LOYALTY POINT SYSTEM

Implement loyalty points using a transaction/ledger model.

Do not rely only on:

```text
points = 500
```

Prefer:

```text
+100 purchase reward
+50 referral reward
-200 redemption
+100 promotional reward
```

Example:

```text
loyalty_transactions

id
customer_id
type
points
reference_id
description
created_at
```

Every adjustment must have a traceable reason.

Business rules should be configurable where practical.

---

## 14. REFERRAL SYSTEM

Support:

```text
Customer
   ↓
Unique referral code
   ↓
New customer
   ↓
Qualifying successful order
   ↓
Referral reward
```

Do not reward merely because a link was clicked.

Prevent:

- self-referrals
- duplicate rewards
- repeated rewards for the same qualifying order
- obvious referral manipulation

Referral rewards must be triggered by verified business events.

---

## 15. INFLUENCER COUPONS

Support influencer-specific coupon/referral codes.

Potential influencer information:

- influencer profile
- unique code
- attributed orders
- usage statistics
- rewards/commission tracking if enabled later

Coupons should support, where needed:

```text
code
discount_type
discount_value
minimum_order_value
maximum_discount
usage_limit
per_customer_limit
valid_from
valid_until
active
```

Do not invent fixed business values without clearly marking them as configurable.

---

## 16. COUPON SECURITY

Coupon validation must happen server-side.

Validate:

- coupon exists
- active status
- date
- usage limit
- customer usage
- minimum order
- eligible products
- eligible categories
- maximum discount

Never trust a discount amount supplied by the browser.

---

## 17. ADMIN SYSTEM

Build a proper admin architecture for:

### Dashboard

- orders
- revenue/appropriate business metrics
- pending actions
- inventory alerts
- payment status
- shipping status

### Products

- create
- edit
- archive
- inventory
- pricing
- images
- variants

### Orders

- view
- filter
- search
- status
- payment
- shipping

### Customers

- profiles
- order history
- loyalty
- referral activity

### Coupons

- create
- activate/deactivate
- usage tracking

### Referrals

- codes
- conversions
- rewards

### Shipping

- tracking
- provider
- shipment status

---

## 18. ADMIN SECURITY

Never secure admin functionality only by hiding a URL.

Use proper authentication and authorization.

Server-side authorization is required.

Do not expose service-role credentials to the browser.

---

## 19. SUPABASE RLS

RLS must be enabled and reviewed for all sensitive tables.

For each table explicitly determine:

```text
Who can SELECT?
Who can INSERT?
Who can UPDATE?
Who can DELETE?
```

Customers must not be able to:

- access another customer's orders
- change payment status
- award themselves loyalty points
- create fraudulent referral rewards
- alter coupon rules
- access admin data

Privileged operations must happen through trusted server-side mechanisms.

---

## 20. SECRETS MANAGEMENT

Never commit secrets to Git.

Never place the following in client-side source:

```text
SUPABASE_SERVICE_ROLE_KEY
Cashfree secret credentials
Shiprocket credentials
Delhivery credentials
private API keys
webhook secrets
```

Use environment variables.

Create:

```text
.env.example
```

with variable names only.

---

## 21. DEVELOPMENT / PRODUCTION SEPARATION

Maintain appropriate environment separation.

At minimum distinguish:

```text
Development
Production
```

Do not use production data for experimentation.

Do not test destructive migrations against production.

---

## 22. DATABASE MIGRATIONS

Database changes must be reproducible through migrations.

Do not rely on undocumented manual changes.

Use an organized migration history.

For example:

```text
001_initial_schema
002_products
003_customers
004_orders
005_payments
006_shipping
007_loyalty
008_referrals
009_coupons
```

The exact naming convention may differ.

Another engineer should be able to reproduce the database from the repository.

---

## 23. TYPES AND TYPE SAFETY

If using TypeScript, maintain strong types.

Avoid unnecessary:

```typescript
any
```

Prefer clear domain types/interfaces for:

- Product
- Customer
- Order
- Payment
- Shipment
- Coupon
- Referral
- LoyaltyTransaction

Database types should reflect the actual Supabase schema.

---

## 24. ERROR HANDLING

Every external service can fail.

Consider:

- Cashfree unavailable
- Supabase timeout
- shipping API failure
- invalid webhook
- network failure
- payment pending
- payment failure
- duplicate request

Use:

- structured errors
- safe customer-facing messages
- server logging
- appropriate retry behavior
- idempotency
- clear status handling

Never expose secrets or raw server errors to customers.

---

## 25. LOGGING

Important operations should be observable.

Examples:

```text
ORDER_CREATED
PAYMENT_INITIATED
PAYMENT_SUCCESS
PAYMENT_FAILED
PAYMENT_WEBHOOK_RECEIVED
ORDER_CONFIRMED
SHIPMENT_CREATED
SHIPMENT_FAILED
COUPON_REDEEMED
LOYALTY_REWARD_GRANTED
REFERRAL_REWARDED
```

Do not log sensitive payment information or credentials.

---

## 26. IDEMPOTENCY

Pay special attention to:

- payments
- payment webhooks
- order creation
- shipment creation
- loyalty rewards
- referral rewards
- coupon redemption

Retries must not create duplicate business effects.

---

## 27. INVENTORY

Inventory must be controlled server-side.

The frontend must not be allowed to decide inventory state.

Consider concurrency so two simultaneous customers cannot purchase the same final unit incorrectly.

---

## 28. PRODUCT ARCHITECTURE

Product information should be data-driven.

Products should support, where applicable:

```text
name
slug
short_description
long_description
price
compare_at_price
category
images
inventory
status
SKU
metadata
SEO title
SEO description
```

Preserve the existing product presentation.

---

## 29. SEO

Maintain and improve technical SEO without unnecessarily changing the visual frontend.

Review:

- metadata
- unique product URLs
- canonical URLs
- Open Graph
- structured data
- sitemap
- robots.txt
- product schema
- breadcrumb schema
- organization schema
- image alt text
- clean URLs
- indexability

Never promise a guaranteed Google ranking.

---

## 30. PERFORMANCE

Audit:

- image optimization
- JavaScript bundle size
- client/server boundaries
- database queries
- N+1 queries
- caching
- unnecessary requests
- loading states
- Core Web Vitals
- mobile performance

Do not sacrifice maintainability for insignificant micro-optimizations.

---

## 31. FRONTEND PRESERVATION

The existing UI/UX is considered approved unless a change is necessary.

Do not:

- replace the entire design
- introduce an unrelated design system
- rewrite pages without reason
- change branding
- unnecessarily redesign checkout
- unnecessarily redesign product cards

Frontend changes are appropriate when required for:

- backend integration
- new functionality
- accessibility
- responsiveness
- security
- error handling
- loading states
- account functionality
- order tracking
- loyalty
- referrals
- admin functionality

---

## 32. RESPONSIVENESS

Do not regress current mobile behavior.

Test:

```text
Mobile
Tablet
Desktop
```

Especially:

- homepage
- product pages
- cart
- checkout
- payment
- order confirmation
- account
- admin

---

## 33. ACCESSIBILITY

Maintain:

- semantic HTML
- keyboard navigation
- labels
- focus states
- accessible buttons
- alt text
- appropriate contrast
- understandable errors
- screen-reader-friendly interactions

---

## 34. MONEY HANDLING

Do not rely on floating-point arithmetic for currency.

Use an appropriate integer representation such as paise.

For example:

```text
₹499 → 49900 paise
```

Use the appropriate representation consistently throughout the financial system.

---

## 35. SERVER-SIDE CHECKOUT CALCULATION

The backend must calculate:

```text
subtotal
- discount
+ shipping
= final amount
```

The frontend's total is for display only.

The server recalculates and validates the amount before creating the payment.

---

## 36. PAYMENT AMOUNT PROTECTION

Never allow browser manipulation of:

- product price
- discount
- shipping
- final amount

The Cashfree payment amount must originate from trusted server-side calculations.

---

## 37. TESTING

Critical business logic must be tested.

Test at least:

### Cart

- quantity
- pricing
- invalid products
- unavailable products

### Checkout

- guest checkout
- invalid address
- invalid coupon

### Payment

- success
- failure
- duplicate webhook
- delayed webhook

### Orders

- creation
- status transitions

### Loyalty

- reward
- redemption
- duplicate prevention

### Referral

- valid referral
- self-referral
- duplicate reward

### Shipping

- shipment creation
- provider failure

---

## 38. PAYMENT TESTING

Use the appropriate Cashfree sandbox/test environment during development.

Do not use production payment credentials for routine testing.

---

## 39. SECURITY REVIEW

Before production deployment, explicitly review:

- authentication
- authorization
- RLS
- API routes
- input validation
- database access
- payment webhooks
- admin routes
- secrets
- CORS where applicable
- rate limiting where appropriate
- customer data exposure
- order access
- coupon abuse
- referral abuse

---

## 40. INPUT VALIDATION

Validate important inputs server-side.

Examples:

```text
email
phone
address
quantity
product ID
coupon
payment amount
order ID
```

Never trust:

- URL parameters
- form fields
- cookies
- headers
- client-side calculations

without appropriate validation.

---

## 41. EXTERNAL API DISCIPLINE

Do not invent API behavior.

If an integration requires:

- API credentials
- merchant verification
- webhook configuration
- production activation
- business verification

document the requirement clearly.

Use current official provider documentation for actual implementation details.

---

## 42. DOCUMENTATION

Maintain:

```text
/docs
   architecture.md
   database.md
   payments.md
   shipping.md
   loyalty.md
   referrals.md
   coupons.md
   deployment.md
   security.md
   testing.md
   operations.md
```

Also maintain:

```text
PROJECT_AUDIT.md
ARCHITECTURE.md
TODO.md
CHANGELOG.md
.env.example
```

Documentation must be understandable to a beginner.

---

## 43. CHANGE MANAGEMENT

For each major feature:

```text
BEFORE
→ CHANGE
→ AFTER
→ TEST
```

Avoid making hundreds of unrelated changes simultaneously.

Group work into logical phases.

After each major group:

```text
Build
↓
Type check
↓
Test
↓
Review
↓
Fix
```

---

## 44. SELF-REVIEW REQUIREMENT

THIS IS MANDATORY.

After every major implementation, the engineering agent must review its own work.

Ask:

### Architecture

Does this fit the overall architecture?

### Code

Is the code correctly organized?

### Duplication

Did I unnecessarily duplicate existing functionality?

### Security

Did I expose a secret or privileged operation?

### Database

Is the schema correct?

### Supabase

Am I definitely using the NEW Supabase project?

### Payments

Can the client manipulate payment status or amount?

### Orders

Can duplicate requests create duplicate orders?

### Loyalty

Can a customer manipulate their points?

### Referrals

Can a customer abuse referral rewards?

### Frontend

Did I accidentally alter the existing UI/UX?

### Errors

What happens when the operation fails?

### Maintainability

Could another engineer understand this implementation?

If a problem is discovered:

> FIX IT BEFORE MOVING ON.

Then test again.

---

## 45. REQUIRED ENGINEERING LOOP

Every major feature must follow:

```text
UNDERSTAND
   ↓
PLAN
   ↓
IMPLEMENT
   ↓
TEST
   ↓
SELF-REVIEW
   ↓
FIX
   ↓
TEST AGAIN
   ↓
DOCUMENT
```

Never simply:

```text
IMPLEMENT
   ↓
MOVE ON
```

---

## 46. AVOID OVERENGINEERING

The goal is not maximum complexity.

The goal is:

> The simplest architecture that is secure, maintainable, scalable and appropriate for The Petal & Bloom.

Before introducing a new:

- library
- dependency
- service
- abstraction
- database table

ask whether it is genuinely necessary.

---

## 47. DEPENDENCY DISCIPLINE

Before installing a new package:

1. Check whether the framework already provides the functionality.
2. Check whether an existing dependency can solve it.
3. Check whether a small internal utility is sufficient.
4. Only then add a new dependency.

Avoid dependency bloat.

---

## 48. DO NOT BREAK EXISTING FUNCTIONALITY

Before changing existing code:

```text
Understand
   ↓
Modify
   ↓
Test
```

If a working subsystem must be replaced, document:

- current implementation
- reason for replacement
- new implementation
- migration strategy
- risks
- rollback strategy

---

## 49. ROLLBACK THINKING

For every production-impacting change ask:

> If this breaks tomorrow, how do we safely revert it?

Pay particular attention to:

- database migrations
- payment integration
- checkout
- order processing
- shipping
- authentication

---

## 50. DEPLOYMENT

The existing live website must remain operational while the new system is developed.

Development should initially use:

```text
NEW CODE
+
NEW SUPABASE
+
SEPARATE ENVIRONMENT
```

Only after testing should deployment to the intended production environment be considered.

Do not replace the existing live deployment prematurely.

---

## 51. DOMAIN STRATEGY

For now:

```text
thepetalandbloom.vercel.app
```

is the working domain.

The future domain is:

```text
thepetalandbloom.in
```

The custom domain is not a prerequisite for development.

Use a configurable site URL:

```env
NEXT_PUBLIC_SITE_URL=
```

The application should not require code rewrites when the custom domain is eventually connected.

---

## 52. BEGINNER-FRIENDLY ADMIN EXPERIENCE

The owner should easily understand:

- which orders require action
- which orders are paid
- which orders are pending
- which products are low in stock
- customer activity
- coupon usage
- referral rewards
- loyalty points
- pending shipments
- failed payments

Avoid unnecessarily complicated administrative workflows.

---

## 53. FINAL PRODUCTION CHECKLIST

### Frontend

- [ ] Existing UI preserved
- [ ] Mobile tested
- [ ] Desktop tested
- [ ] Product pages working
- [ ] Cart working
- [ ] Checkout working

### Database

- [ ] NEW Supabase project
- [ ] Existing production Supabase untouched
- [ ] Migrations documented
- [ ] RLS configured
- [ ] Indexes reviewed

### Customer

- [ ] Guest checkout
- [ ] Customer records
- [ ] Order history
- [ ] Secure customer access

### Payment

- [ ] Cashfree integrated
- [ ] Server-side amount calculation
- [ ] Webhook verification
- [ ] Idempotency
- [ ] Payment failure handling

### Orders

- [ ] Order state machine
- [ ] Order history
- [ ] Order item snapshots
- [ ] Status transitions

### Shipping

- [ ] Shiprocket architecture
- [ ] Delhivery compatibility
- [ ] India Post compatibility
- [ ] Tracking
- [ ] Failure handling

### Loyalty

- [ ] Points ledger
- [ ] Rewards
- [ ] Redemption
- [ ] Duplicate prevention

### Referral

- [ ] Referral codes
- [ ] Conversion tracking
- [ ] Reward rules
- [ ] Abuse prevention

### Coupons

- [ ] Coupon creation
- [ ] Validation
- [ ] Usage tracking
- [ ] Influencer codes

### Admin

- [ ] Authentication
- [ ] Authorization
- [ ] Product management
- [ ] Order management
- [ ] Customer management
- [ ] Coupon management

### Security

- [ ] Secrets protected
- [ ] RLS reviewed
- [ ] API validation
- [ ] Admin authorization
- [ ] Webhooks secured
- [ ] Sensitive data protected

### Deployment

- [ ] Vercel build succeeds
- [ ] Environment variables configured
- [ ] New Supabase configured
- [ ] Current Vercel domain works
- [ ] Future `.in` domain can be configured without restructuring

---

## 54. DEFINITION OF DONE

A feature is NOT complete merely because the code compiles.

A feature is complete when:

```text
Requirement understood
        ↓
Implementation complete
        ↓
Database correct
        ↓
Security reviewed
        ↓
Error cases handled
        ↓
Tests performed
        ↓
Existing functionality verified
        ↓
Self-review completed
        ↓
Documentation updated
```

---

## 55. FINAL PROJECT OBJECTIVE

Transform:

```text
Beautiful ecommerce frontend
```

into:

```text
             THE PETAL & BLOOM
                    │
        ┌───────────┴───────────┐
        │                       │
     STOREFRONT              ADMIN
        │                       │
        └───────────┬───────────┘
                    │
              APPLICATION
                 LOGIC
                    │
       ┌────────────┼────────────┐
       │            │            │
   SUPABASE      CASHFREE     SHIPPING
       │                         │
       │              ┌──────────┼──────────┐
       │              │          │          │
       │         Shiprocket  Delhivery  India Post
       │
       ├── Customers
       ├── Products
       ├── Orders
       ├── Payments
       ├── Loyalty
       ├── Referrals
       ├── Coupons
       └── Analytics
```

The final result should be a real, secure, maintainable ecommerce platform while retaining the existing frontend that has already been designed.

---

# FINAL ENGINEERING PRINCIPLE

Before doing anything destructive or architectural:

> **Inspect first. Understand second. Plan third. Implement fourth. Test fifth. Review your own work sixth.**

After every major phase, explicitly verify:

> **Have I preserved the existing frontend, isolated the new Supabase project from the live system, maintained security, handled failure cases, and kept the architecture clean and maintainable?**

If the answer is no, fix the issue before proceeding.

**Never sacrifice data safety, payment correctness, security, or maintainability merely to finish a feature faster.**
