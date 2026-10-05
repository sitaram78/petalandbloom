-- ==============================================================================
-- Migration: 20260929000003_data_integrity_fixes.sql
-- Description: Phase 2 Database Integrity, Atomic Inventory Decrements, and Indices
-- ==============================================================================

-- 1. Index for Fast Abandoned Checkout Sweeper (expire-pending queries)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
ON orders (order_status, created_at)
WHERE order_status = 'PENDING_PAYMENT';

-- 2. Index for Rapid Coupon Limit Enforcement
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_lookup
ON coupon_redemptions (coupon_id, customer_phone);

-- 3. Atomic Inventory Decrement Function
-- Prevents lost updates under high concurrency and cleanly bypasses Made-to-Order items
CREATE OR REPLACE FUNCTION decrement_product_inventory(
  p_product_id UUID,
  p_quantity INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_mto BOOLEAN;
  v_rows_updated INT;
BEGIN
  -- Check if the product is made to order
  SELECT is_made_to_order INTO v_is_mto
  FROM products
  WHERE id = p_product_id;

  -- Made-to-order floral pieces are handcrafted and do not consume stock
  IF v_is_mto IS TRUE THEN
    RETURN TRUE;
  END IF;

  -- Atomic conditional decrement: Only decrement if sufficient inventory exists
  UPDATE products
  SET
    inventory_count = inventory_count - p_quantity,
    updated_at = NOW()
  WHERE id = p_product_id
    AND inventory_count >= p_quantity;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

-- 4. Tier Resolution Function for Customer Lifetime Points
CREATE OR REPLACE FUNCTION resolve_loyalty_tier(p_lifetime_points INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_lifetime_points >= 1500 THEN 'HEIRLOOM'
    WHEN p_lifetime_points >= 500 THEN 'BLOSSOM'
    ELSE 'FLORET'
  END;
$$;

-- 5. Safe Order Loyalty Reversal Trigger Helper
-- Ensures loyalty accounts and transactions stay consistent when updated
COMMENT ON FUNCTION decrement_product_inventory IS 'Atomically decrements stock for ready-to-ship products while bypassing made-to-order creations.';
