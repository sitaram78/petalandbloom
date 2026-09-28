const fs = require('fs');
const path = require('path');

// Extract products from src/data/products.ts
const productsFilePath = path.resolve(__dirname, '../src/data/products.ts');
const content = fs.readFileSync(productsFilePath, 'utf8');

// Match the products array
const startIdx = content.indexOf('export const products: Product[] = [');
if (startIdx === -1) {
  console.error('Could not find products array');
  process.exit(1);
}

// Evaluate the products array using a safe function
const sub = content.substring(startIdx + 'export const products: Product[] = '.length);
const endIdx = sub.lastIndexOf('];');
const arrayStr = sub.substring(0, endIdx + 1);

let products = [];
try {
  products = eval(arrayStr);
} catch (e) {
  console.error('Eval error:', e);
  process.exit(1);
}

console.log(`Parsed ${products.length} products.`);

const categories = [
  { name: 'Flowers', slug: 'flowers', display_order: 1 },
  { name: 'Bouquets', slug: 'bouquets', display_order: 2 },
  { name: 'Gifts', slug: 'gifts', display_order: 3 },
  { name: 'Bags', slug: 'bags', display_order: 4 },
  { name: 'Home Décor', slug: 'decor', display_order: 5 },
  { name: 'Gift Boxes', slug: 'giftboxes', display_order: 6 },
  { name: 'Custom', slug: 'custom', display_order: 7 },
];

let sql = `-- Migration: 20260928000006_seed_catalog.sql
-- Description: Seed initial categories and catalog products for NEW Supabase project

-- 1. Insert Categories
insert into public.categories (name, slug, display_order, is_active)
values
${categories.map(c => `  ('${c.name.replace(/'/g, "''")}', '${c.slug}', ${c.display_order}, true)`).join(',\n')}
on conflict (slug) do update set
  name = excluded.name,
  display_order = excluded.display_order;

-- 2. Insert Products
`;

function esc(str) {
  if (!str) return "''";
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escArray(arr) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return "ARRAY[]::text[]";
  return `ARRAY[${arr.map(item => esc(item)).join(', ')}]::text[]`;
}

for (const p of products) {
  const slug = p.code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const priceInPaise = Math.round(Number(p.price || 0) * 100);
  const compareAtPaise = p.compareAtPrice ? Math.round(Number(p.compareAtPrice) * 100) : 'null';

  sql += `
insert into public.products (
  code,
  name,
  slug,
  category_slug,
  price_in_paise,
  compare_at_price_in_paise,
  description,
  long_description,
  inventory_count,
  is_made_to_order,
  is_customisable,
  is_bestseller,
  is_featured,
  is_active,
  preparation_days,
  bouquet_size,
  images,
  colors,
  occasions,
  recipients,
  whats_included
) values (
  ${esc(p.code)},
  ${esc(p.name)},
  ${esc(slug)},
  ${esc(p.category || 'flowers')},
  ${priceInPaise},
  ${compareAtPaise},
  ${esc(p.description)},
  ${esc(p.longDescription || '')},
  15,
  ${p.madeToOrder !== false},
  ${!!p.customisable},
  ${!!p.bestseller},
  ${!!p.featured},
  true,
  ${esc(p.preparationDays || '3–5 days')},
  ${esc(p.bouquetSize || '')},
  ${escArray(p.images)},
  ${escArray(p.colors)},
  ${escArray(p.occasions)},
  ${escArray(p.recipients)},
  ${escArray(p.whatsIncluded)}
)
on conflict (code) do update set
  name = excluded.name,
  category_slug = excluded.category_slug,
  price_in_paise = excluded.price_in_paise,
  description = excluded.description,
  images = excluded.images;
`;
}

const outputPath = path.resolve(__dirname, '../supabase/migrations/20260928000006_seed_catalog.sql');
fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`Generated seed SQL at ${outputPath}`);
