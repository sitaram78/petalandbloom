# AUDIT LOG SPECIFICATION: Tamper-Resistant Traceability
**The Petal & Bloom Commerce Operating System**
**Role:** Principal Security Architect & Governance Engineer

---

## 1. Governance Mandate: The 6 Questions

In an operational system managing financial transactions, customer addresses, and physical goods, every sensitive mutation must be traceable. 

The Petal & Bloom audit system must answer six questions for every administrative modification:

1. **WHO** performed the action? (`actor_id`, `actor_role`, `actor_email`)
2. **WHAT** action was taken? (`action` verb, e.g., `ORDER_STATUS_UPDATE`, `POINTS_ADJUSTMENT`, `REFUND_ISSUED`)
3. **WHEN** was it performed? (`created_at` in authoritative UTC)
4. **WHICH RECORD** was altered? (`entity`, `entity_id`, e.g., `orders`, `TPB-KT9X2-8921`)
5. **WHAT CHANGED**? (`before_state` vs. `after_state` JSON diff)
6. **WHY** was it done? (`reason_note`, mandatory for sensitive mutations)

---

## 2. Relational Schema (`public.audit_logs`)

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT 'admin',
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- B-Tree indexes for fast chronological and entity lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

---

## 3. Audited Business Actions

| Action Key | Entity | Captured Data Snapshot | Mandatory Reason? |
| :--- | :--- | :--- | :--- |
| `ORDER_STATUS_TRANSITION` | `orders` | Previous order status, new order status, carrier, AWB | Optional |
| `ORDER_CANCELLED` | `orders` | Restored items, restored points, cancellation cause | **Yes** |
| `PAYMENT_REFUNDED` | `payments` | Refund amount in paise, Cashfree refund ID, gateway status | **Yes** |
| `POINTS_ADJUSTED` | `loyalty_accounts` | Old points balance, new points balance, delta points | **Yes** |
| `PRODUCT_PRICE_CHANGED` | `products` | Old price in paise, new price in paise, compare price | **Yes** |
| `PRODUCT_DEACTIVATED` | `products` | Product code, title, deactivation timestamp | Optional |
| `COUPON_CREATED` | `coupons` | Code, discount type, value, usage limits, expiration | Optional |
| `COUPON_RATE_MODIFIED` | `coupons` | Old discount value, new discount value, limits | **Yes** |
| `CUSTOMER_PII_EXPORTED` | `profiles` | Applied filter query, exported row count, format | **Yes** |
| `STAFF_ROLE_MODIFIED` | `profiles` | Target user ID, previous role, new assigned role | **Yes** |

---

## 4. Tamper-Resistance & Security

1. **Append-Only Database Rule:**
   * PostgreSQL permissions and RLS policies forbid `UPDATE` and `DELETE` queries on `public.audit_logs` for all standard and administrative roles.
   ```sql
   ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
   
   -- Only service role and super admin can query audit logs
   CREATE POLICY "Super admin can view audit logs" ON public.audit_logs
     FOR SELECT USING (public.is_super_admin());
     
   -- Disallow updates and deletes completely
   REVOKE UPDATE, DELETE ON public.audit_logs FROM public, authenticated;
   ```
2. **Dedicated Service Helper:**
   * Audit writes execute through `api/lib/auditService.ts` using the service role to ensure logging occurs even if the user session drops mid-request.

---

## 5. Audit Log Explorer Screen (`/admin/audit-logs`)

A specialized interface for Super Admins to investigate operational discrepancies:
* **Timeline Filter:** Filter logs by date range, specific actor, action verb, or target entity.
* **Diff Viewer:** Visual side-by-side comparison showing previous values in red and modified values in green.
* **1-Click Entity Link:** Clicking `entity_id` navigates directly to the affected order or customer record.
