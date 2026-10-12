-- ==============================================================================
-- THE PETAL & BLOOM ATELIER — PACKAGING & GIFT ADD-ON FEES
-- Migration: 20261011000001_packaging_and_gift_fees.sql
-- Description: Extends store_settings.business_rules JSONB with dynamic fees
--              for greeting cards, custom messages, luxury bouquet wraps,
--              stem-to-bouquet wrapping, and rigid gift boxes.
-- ==============================================================================

-- 1. Update the default JSONB schema for business_rules
ALTER TABLE public.store_settings 
  ALTER COLUMN business_rules SET DEFAULT '{
    "freeShippingThresholdPaise": 120000,
    "standardShippingFeePaise": 6900,
    "expressShippingFeePaise": 4900,
    "giftWrapFeePaise": 7900,
    "greetingCardFeePaise": 4900,
    "personalisedMessageFeePaise": 3900,
    "bouquetLuxuryWrapUpgradeFeePaise": 5900,
    "stemBouquetWrapFeePaise": 7900,
    "luxuryGiftBoxFeePaise": 14900,
    "loyaltySpendPerPointPaise": 2000,
    "loyaltyPointRedemptionPaise": 50,
    "minLoyaltyOrderPaise": 29900,
    "companionGifts": [
      {"id": "addon-flower", "name": "Extra Handcrafted Flower", "description": "Add an additional matching crochet bloom to your piece.", "priceRupees": 199},
      {"id": "addon-charm", "name": "Name Customisation Charm", "description": "A custom initial or name charm woven onto your piece.", "priceRupees": 79},
      {"id": "addon-vase", "name": "Petite Ceramic Bud Vase", "description": "Hand-thrown matte ceramic vase for displaying everlasting stems.", "priceRupees": 249},
      {"id": "addon-pouch", "name": "Linen Keepsake Storage Pouch", "description": "Dust-free heirloom drawstring pouch for safekeeping.", "priceRupees": 129}
    ]
  }'::jsonb;

-- 2. Safely merge new packaging fee and companion gift keys into existing primary settings row
UPDATE public.store_settings
SET business_rules = COALESCE(business_rules, '{}'::jsonb) || '{
  "greetingCardFeePaise": 4900,
  "personalisedMessageFeePaise": 3900,
  "bouquetLuxuryWrapUpgradeFeePaise": 5900,
  "stemBouquetWrapFeePaise": 7900,
  "luxuryGiftBoxFeePaise": 14900,
  "companionGifts": [
    {"id": "addon-flower", "name": "Extra Handcrafted Flower", "description": "Add an additional matching crochet bloom to your piece.", "priceRupees": 199},
    {"id": "addon-charm", "name": "Name Customisation Charm", "description": "A custom initial or name charm woven onto your piece.", "priceRupees": 79},
    {"id": "addon-vase", "name": "Petite Ceramic Bud Vase", "description": "Hand-thrown matte ceramic vase for displaying everlasting stems.", "priceRupees": 249},
    {"id": "addon-pouch", "name": "Linen Keepsake Storage Pouch", "description": "Dust-free heirloom drawstring pouch for safekeeping.", "priceRupees": 129}
  ]
}'::jsonb
WHERE id = 'primary'
  AND (
    business_rules->>'greetingCardFeePaise' IS NULL 
    OR business_rules->'companionGifts' IS NULL
  );

-- ==============================================================================
-- OPTIONAL: If standalone SQL columns are ever desired alongside JSONB:
-- ==============================================================================
-- ALTER TABLE public.store_settings
--   ADD COLUMN IF NOT EXISTS greeting_card_fee_paise integer DEFAULT 4900,
--   ADD COLUMN IF NOT EXISTS personalised_message_fee_paise integer DEFAULT 3900,
--   ADD COLUMN IF NOT EXISTS bouquet_luxury_wrap_upgrade_fee_paise integer DEFAULT 5900,
--   ADD COLUMN IF NOT EXISTS stem_bouquet_wrap_fee_paise integer DEFAULT 7900,
--   ADD COLUMN IF NOT EXISTS luxury_gift_box_fee_paise integer DEFAULT 14900;
