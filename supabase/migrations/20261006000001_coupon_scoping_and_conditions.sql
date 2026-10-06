-- ==============================================================================
-- THE PETAL & BLOOM ATELIER — PRODUCTION COUPON SCOPING & OCCASION FILTERING
-- Migration: 20261006000001_coupon_scoping_and_conditions.sql
-- Description: Adds granular targeting rules to coupons:
--   1. scope_type ('ALL', 'CATEGORIES', 'SPECIFIC_PRODUCTS', 'PRICE_TIER', 'OCCASION', 'CUSTOM_COMPOUND')
--   2. applicable_categories (e.g. ['bouquets', 'flowers'])
--   3. applicable_product_codes (e.g. ['PB-BOUQ-01', 'PB-LUX-ROSE'])
--   4. applicable_occasions (e.g. ['diwali', 'valentines', 'anniversary'])
--   5. min_product_price_in_paise (e.g. 99900 for only items >= ₹999)
--   6. min_spend_mode ('ELIGIBLE_ITEMS_ONLY', 'CART_TOTAL')
-- Zero disruption: All existing coupons default to 'ALL' scope and 'CART_TOTAL'.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Ensure scope_type exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'scope_type'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN scope_type text NOT NULL DEFAULT 'ALL' 
        CHECK (scope_type IN ('ALL', 'CATEGORIES', 'SPECIFIC_PRODUCTS', 'PRICE_TIER', 'OCCASION', 'CUSTOM_COMPOUND'));
    END IF;

    -- 2. Ensure applicable_categories exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'applicable_categories'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN applicable_categories text[] NOT NULL DEFAULT '{}';
    END IF;

    -- 3. Ensure applicable_product_codes exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'applicable_product_codes'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN applicable_product_codes text[] NOT NULL DEFAULT '{}';
    END IF;

    -- 4. Ensure applicable_occasions exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'applicable_occasions'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN applicable_occasions text[] NOT NULL DEFAULT '{}';
    END IF;

    -- 5. Ensure min_product_price_in_paise exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'min_product_price_in_paise'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN min_product_price_in_paise integer NOT NULL DEFAULT 0 
        CHECK (min_product_price_in_paise >= 0);
    END IF;

    -- 6. Ensure min_spend_mode exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'min_spend_mode'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN min_spend_mode text NOT NULL DEFAULT 'ELIGIBLE_ITEMS_ONLY' 
        CHECK (min_spend_mode IN ('ELIGIBLE_ITEMS_ONLY', 'CART_TOTAL'));
    END IF;

    -- 7. Ensure cart_mix_mode exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'coupons' 
          AND column_name = 'cart_mix_mode'
    ) THEN
        ALTER TABLE public.coupons 
        ADD COLUMN cart_mix_mode text NOT NULL DEFAULT 'ALLOW_MIXED' 
        CHECK (cart_mix_mode IN ('ALLOW_MIXED', 'STRICT_EXCLUSIVE'));
    END IF;
END $$;

-- Optimize index coverage for scope queries
CREATE INDEX IF NOT EXISTS idx_coupons_scope_type ON public.coupons(scope_type);
