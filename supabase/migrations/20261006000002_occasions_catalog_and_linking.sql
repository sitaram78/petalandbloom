-- ==============================================================================
-- THE PETAL & BLOOM ATELIER — OCCASIONS & FESTIVE CATALOG SYSTEM
-- Migration: 20261006000002_occasions_catalog_and_linking.sql
-- Description: Creates the central public.occasions table with RLS, audit triggers,
--              canonical festive seeds, and indexing for catalog linking.
-- ==============================================================================

-- 0. Ensure handle_updated_at helper function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 1. Create central occasions table
CREATE TABLE IF NOT EXISTS public.occasions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  emoji text NOT NULL DEFAULT '🌸',
  description text,
  banner_image_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_occasions_slug ON public.occasions(slug);
CREATE INDEX IF NOT EXISTS idx_occasions_active ON public.occasions(is_active);
CREATE INDEX IF NOT EXISTS idx_occasions_display_order ON public.occasions(display_order);

-- 3. Automatic updated_at trigger
DROP TRIGGER IF EXISTS tr_occasions_updated_at ON public.occasions;
CREATE TRIGGER tr_occasions_updated_at
  BEFORE UPDATE ON public.occasions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Row Level Security (RLS)
ALTER TABLE public.occasions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active occasions" ON public.occasions;
CREATE POLICY "Public can view active occasions"
  ON public.occasions FOR SELECT
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage occasions" ON public.occasions;
CREATE POLICY "Admins can manage occasions"
  ON public.occasions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Canonical Festive & Gifting Seeds
INSERT INTO public.occasions (name, slug, emoji, description, display_order, is_active)
VALUES
  ('Diwali & Festive', 'diwali', '🪔', 'Luminous festive hampers and celebration blooms', 1, true),
  ('Valentine''s Day', 'valentines', '❤️', 'Romantic rose bouquets and intimate handcrafted gifts', 2, true),
  ('Birthday', 'birthday', '🎂', 'Celebratory arrangements for their special milestone', 3, true),
  ('Anniversary', 'anniversary', '🥂', 'Enduring everlasting florals for timeless love', 4, true),
  ('Mother''s Day', 'mothers-day', '🌷', 'Delicate pastel blooms honoring maternal warmth', 5, true),
  ('Weddings & Ceremonies', 'wedding', '💍', 'Grand artisanal floral decor and bridal arrangements', 6, true),
  ('Friendship Day', 'friendship', '🤝', 'Cheerful sunshine bouquets and bespoke tokens', 7, true),
  ('Raksha Bandhan', 'rakhi', '🪷', 'Handmade crochet threads and festive floral hampers', 8, true),
  ('Just Because', 'just-because', '✨', 'Everyday spontaneous gestures of love and appreciation', 9, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- 6. Ensure products table occasions column index exists
CREATE INDEX IF NOT EXISTS idx_products_occasions ON public.products USING GIN(occasions);

-- 7. Notify PostgREST to refresh schema cache immediately
NOTIFY pgrst, 'reload schema';
