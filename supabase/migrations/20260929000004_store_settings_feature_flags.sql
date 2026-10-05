-- ==============================================================================
-- Migration: 20260929000004_store_settings_feature_flags.sql
-- Description: Phase 3 4-Drawer Architecture, Feature Flags & Dynamic Business Rules
-- ==============================================================================

-- 1. Add feature_flags and business_rules JSONB columns to store_settings
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{
  "enableLoyalty": true,
  "enableCoupons": true,
  "enableInfluencerProgram": true,
  "enableReviews": true,
  "enableLiveChat": true,
  "storeMaintenanceMode": false
}'::jsonb;

ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS business_rules JSONB NOT NULL DEFAULT '{
  "freeShippingThresholdPaise": 120000,
  "standardShippingFeePaise": 6900,
  "expressShippingFeePaise": 4900,
  "giftWrapFeePaise": 7900,
  "loyaltySpendPerPointPaise": 2000,
  "loyaltyPointRedemptionPaise": 50,
  "minLoyaltyOrderPaise": 29900
}'::jsonb;

-- 2. Update existing 'primary' row if empty
UPDATE public.store_settings
SET
  feature_flags = COALESCE(feature_flags, '{
    "enableLoyalty": true,
    "enableCoupons": true,
    "enableInfluencerProgram": true,
    "enableReviews": true,
    "enableLiveChat": true,
    "storeMaintenanceMode": false
  }'::jsonb),
  business_rules = COALESCE(business_rules, '{
    "freeShippingThresholdPaise": 120000,
    "standardShippingFeePaise": 6900,
    "expressShippingFeePaise": 4900,
    "giftWrapFeePaise": 7900,
    "loyaltySpendPerPointPaise": 2000,
    "loyaltyPointRedemptionPaise": 50,
    "minLoyaltyOrderPaise": 29900
  }'::jsonb)
WHERE id = 'primary';

COMMENT ON COLUMN public.store_settings.feature_flags IS 'Modular toggles for loyalty, coupons, creator program, reviews, concierge chat, and maintenance mode.';
COMMENT ON COLUMN public.store_settings.business_rules IS 'Live pricing rules for free shipping spend, delivery fees, luxury gift wrapping, and loyalty conversion rates.';
