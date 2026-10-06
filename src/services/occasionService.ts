/**
 * The Petal & Bloom — Occasion & Festive Catalog Service
 * Manages central occasion definitions, product linking, and coupon/storefront synchronizations.
 */

import { supabase } from '@/lib/supabaseClient';

export interface Occasion {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  description?: string | null;
  banner_image_url?: string | null;
  is_active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface OccasionWithProductCount extends Occasion {
  product_count: number;
}

export interface CatalogProductForLinking {
  id: string;
  code: string;
  name: string;
  category_slug: string;
  price_in_paise: number;
  images: string[];
  occasions: string[];
  is_active: boolean;
}

/**
 * Canonical fallback occasions used before database initialization
 * or when offline.
 */
export const DEFAULT_OCCASIONS: Occasion[] = [
  { id: '1', name: 'Diwali & Festive', slug: 'diwali', emoji: '🪔', description: 'Luminous festive hampers and celebration blooms', is_active: true, display_order: 1 },
  { id: '2', name: "Valentine's Day", slug: 'valentines', emoji: '❤️', description: 'Romantic rose bouquets and intimate handcrafted gifts', is_active: true, display_order: 2 },
  { id: '3', name: 'Birthday', slug: 'birthday', emoji: '🎂', description: 'Celebratory arrangements for their special milestone', is_active: true, display_order: 3 },
  { id: '4', name: 'Anniversary', slug: 'anniversary', emoji: '🥂', description: 'Enduring everlasting florals for timeless love', is_active: true, display_order: 4 },
  { id: '5', name: "Mother's Day", slug: 'mothers-day', emoji: '🌷', description: 'Delicate pastel blooms honoring maternal warmth', is_active: true, display_order: 5 },
  { id: '6', name: 'Weddings & Ceremonies', slug: 'wedding', emoji: '💍', description: 'Grand artisanal floral decor and bridal arrangements', is_active: true, display_order: 6 },
  { id: '7', name: 'Friendship Day', slug: 'friendship', emoji: '🤝', description: 'Cheerful sunshine bouquets and bespoke tokens', is_active: true, display_order: 7 },
  { id: '8', name: 'Raksha Bandhan', slug: 'rakhi', emoji: '🪷', description: 'Handmade crochet threads and festive floral hampers', is_active: true, display_order: 8 },
  { id: '9', name: 'Just Because', slug: 'just-because', emoji: '✨', description: 'Everyday spontaneous gestures of love and appreciation', is_active: true, display_order: 9 },
];

/**
 * Generates a clean URL slug from an occasion name.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Checks if a product's occasions array matches a target occasion (by slug or name).
 */
export function productMatchesOccasion(productOccasions: string[] | undefined, target: Occasion): boolean {
  if (!productOccasions || productOccasions.length === 0) return false;
  const targetSlug = target.slug.toLowerCase().trim();
  const targetName = target.name.toLowerCase().trim();

  return productOccasions.some((occ) => {
    if (!occ) return false;
    const cleanOcc = occ.toLowerCase().trim();
    return (
      cleanOcc === targetSlug ||
      cleanOcc === targetName ||
      cleanOcc.includes(targetSlug) ||
      targetSlug.includes(cleanOcc) ||
      cleanOcc.includes(targetName) ||
      targetName.includes(cleanOcc)
    );
  });
}

/**
 * Fetches all occasions from Supabase.
 * Gracefully falls back to DEFAULT_OCCASIONS if table is not yet migrated.
 */
export async function fetchOccasions(options?: {
  activeOnly?: boolean;
  includeProductCount?: boolean;
}): Promise<OccasionWithProductCount[]> {
  try {
    let query = supabase
      .from('occasions')
      .select('*')
      .order('display_order', { ascending: true });

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    let occasionsList: Occasion[] = [];

    if (error) {
      console.warn('[occasionService] Could not fetch occasions from DB, using defaults:', error.message);
      occasionsList = options?.activeOnly
        ? DEFAULT_OCCASIONS.filter(o => o.is_active)
        : [...DEFAULT_OCCASIONS];
    } else {
      occasionsList = (data || []) as Occasion[];
    }

    // Optionally calculate product counts
    if (options?.includeProductCount) {
      const { data: prodData } = await supabase
        .from('products')
        .select('occasions');

      const allProds = prodData || [];

      return occasionsList.map((occ) => {
        const count = allProds.filter((p) =>
          productMatchesOccasion(p.occasions as string[], occ)
        ).length;
        return {
          ...occ,
          product_count: count,
        };
      });
    }

    return occasionsList.map((occ) => ({ ...occ, product_count: 0 }));
  } catch (err) {
    console.error('[occasionService] Unexpected error in fetchOccasions:', err);
    return DEFAULT_OCCASIONS.map((occ) => ({ ...occ, product_count: 0 }));
  }
}

/**
 * Fetches a single occasion by slug.
 */
export async function fetchOccasionBySlug(slug: string): Promise<Occasion | null> {
  try {
    const { data, error } = await supabase
      .from('occasions')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      const fallback = DEFAULT_OCCASIONS.find(o => o.slug === slug);
      return fallback || null;
    }

    return data as Occasion;
  } catch (err) {
    console.error('[occasionService] Error in fetchOccasionBySlug:', err);
    return DEFAULT_OCCASIONS.find(o => o.slug === slug) || null;
  }
}

/**
 * Creates a new occasion.
 */
export async function createOccasion(input: {
  name: string;
  slug?: string;
  emoji?: string;
  description?: string;
  banner_image_url?: string;
  is_active?: boolean;
  display_order?: number;
}): Promise<Occasion> {
  const name = input.name.trim();
  const slug = (input.slug && input.slug.trim()) || generateSlug(name);
  const emoji = input.emoji?.trim() || '🌸';
  const description = input.description?.trim() || null;
  const banner_image_url = input.banner_image_url?.trim() || null;
  const is_active = input.is_active !== undefined ? input.is_active : true;
  const display_order = input.display_order ?? 0;

  const { data, error } = await supabase
    .from('occasions')
    .insert([
      {
        name,
        slug,
        emoji,
        description,
        banner_image_url,
        is_active,
        display_order,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[occasionService] Error creating occasion:', error);
    throw error;
  }

  return data as Occasion;
}

/**
 * Updates an existing occasion.
 */
export async function updateOccasion(
  id: string,
  updates: Partial<Occasion>
): Promise<Occasion> {
  const payload: Record<string, any> = { ...updates };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;

  if (payload.name && !payload.slug) {
    payload.slug = generateSlug(payload.name);
  }

  const { data, error } = await supabase
    .from('occasions')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[occasionService] Error updating occasion:', error);
    throw error;
  }

  return data as Occasion;
}

/**
 * Deletes an occasion by ID.
 */
export async function deleteOccasion(id: string): Promise<void> {
  const { error } = await supabase
    .from('occasions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[occasionService] Error deleting occasion:', error);
    throw error;
  }
}

/**
 * Fetches all products with their basic info and occasions tags for bulk linking.
 */
export async function fetchProductsForOccasionLinking(): Promise<CatalogProductForLinking[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, code, name, category_slug, price_in_paise, images, occasions, is_active')
    .order('name', { ascending: true });

  if (error) {
    console.error('[occasionService] Error fetching products for linking:', error);
    throw error;
  }

  return (data || []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category_slug: p.category_slug,
    price_in_paise: p.price_in_paise,
    images: p.images || [],
    occasions: p.occasions || [],
    is_active: p.is_active,
  }));
}

/**
 * Performs atomic bulk linking/unlinking of products to a specific occasion.
 * Updates the `products.occasions` text array column.
 */
export async function bulkLinkProductsToOccasion(
  targetOccasionSlug: string,
  productCodesToLink: string[],
  productCodesToUnlink: string[] = []
): Promise<{ linkedCount: number; unlinkedCount: number }> {
  let linkedCount = 0;
  let unlinkedCount = 0;

  const targetSlug = targetOccasionSlug.toLowerCase().trim();

  // 1. Process Links
  if (productCodesToLink.length > 0) {
    const { data: prodsToLink, error: fetchLinkErr } = await supabase
      .from('products')
      .select('code, occasions')
      .in('code', productCodesToLink);

    if (fetchLinkErr) throw fetchLinkErr;

    for (const prod of prodsToLink || []) {
      const currentOccs: string[] = prod.occasions || [];
      const alreadyHas = currentOccs.some(
        (o) => o.toLowerCase().trim() === targetSlug
      );

      if (!alreadyHas) {
        const nextOccs = [...currentOccs, targetSlug];
        const { error: updErr } = await supabase
          .from('products')
          .update({ occasions: nextOccs })
          .eq('code', prod.code);

        if (!updErr) linkedCount++;
      }
    }
  }

  // 2. Process Unlinks
  if (productCodesToUnlink.length > 0) {
    const { data: prodsToUnlink, error: fetchUnlinkErr } = await supabase
      .from('products')
      .select('code, occasions')
      .in('code', productCodesToUnlink);

    if (fetchUnlinkErr) throw fetchUnlinkErr;

    for (const prod of prodsToUnlink || []) {
      const currentOccs: string[] = prod.occasions || [];
      const hasOcc = currentOccs.some(
        (o) => o.toLowerCase().trim() === targetSlug
      );

      if (hasOcc) {
        const nextOccs = currentOccs.filter(
          (o) => o.toLowerCase().trim() !== targetSlug
        );
        const { error: updErr } = await supabase
          .from('products')
          .update({ occasions: nextOccs })
          .eq('code', prod.code);

        if (!updErr) unlinkedCount++;
      }
    }
  }

  return { linkedCount, unlinkedCount };
}
