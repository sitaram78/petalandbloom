-- ==============================================================================
-- THE PETAL & BLOOM ATELIER — STORE SETTINGS EXPANDED COLUMNS
-- Migration: 20261006000004_store_settings_columns.sql
-- Description: Adds jsonb feature_flags, business_rules, occasion_banner, 
--              and UPI settlement columns to public.store_settings.
-- ==============================================================================

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS upi_id text DEFAULT '9931657805@ptsbi',
  ADD COLUMN IF NOT EXISTS upi_phone text DEFAULT '9931657805',
  ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{"enableLoyalty": true, "enableCoupons": true, "enableInfluencerProgram": true, "enableReviews": true, "enableLiveChat": true, "storeMaintenanceMode": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_rules jsonb DEFAULT '{"freeShippingThresholdPaise": 120000, "standardShippingFeePaise": 6900, "expressShippingFeePaise": 4900, "giftWrapFeePaise": 7900, "loyaltySpendPerPointPaise": 2000, "loyaltyPointRedemptionPaise": 50, "minLoyaltyOrderPaise": 29900}'::jsonb,
  ADD COLUMN IF NOT EXISTS occasion_banner jsonb DEFAULT '{"enabled": false, "occasionTitle": "Special Occasion", "marqueeText": "Handcrafted with Love", "couponCode": "BLOOM10", "targetUrl": "/shop", "theme": "rose", "placement": "both"}'::jsonb;
