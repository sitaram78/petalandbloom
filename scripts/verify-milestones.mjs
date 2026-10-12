/**
 * The Petal & Bloom Atelier — Milestone Verification Suite
 * Tests Line-Item Identity, Deconstructed Pricing, Packaging Multipliers, and Coupon Hardening.
 */

import { evaluateCoupon, normalizePaiseAmount, isProductEligibleForCoupon } from '../server/lib/couponEngine.ts';

// Inline replication of pure CartContext functions for unit verification
function getItemConfigKey(item) {
  const code = (item.code || '').trim().toUpperCase();
  const color = (item.color || 'default').trim().toLowerCase();
  const tier = (item.packagingTier || 'standard').trim().toLowerCase();
  const card = item.hasGreetingCard ? (item.greetingCardMessage || '').trim() : '';
  const note = item.hasPersonalNote ? (item.personalNoteMessage || '').trim() : '';
  return `${code}::${color}::${tier}::${card}::${note}`;
}

function calculateItemSubtotal(item) {
  const qty = Math.max(1, item.quantity || 1);
  const base = typeof item.basePrice === 'number' ? item.basePrice : item.price;
  const pkgFee = item.packagingFee ?? 0;
  const isPerUnit = item.packagingMultiplier === 'per_unit' || item.packagingTier === 'luxury_wrap';
  const cardFee = item.cardFee ?? (item.hasGreetingCard ? 49 : 0);
  const noteFee = item.noteFee ?? (item.hasPersonalNote ? 39 : 0);

  const packagingTotal = isPerUnit ? pkgFee * qty : pkgFee;
  const flatExtras = cardFee + noteFee;

  return (base * qty) + packagingTotal + flatExtras;
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('  MILESTONE 1: LINE-ITEM IDENTITY & PACKAGING MATH');
console.log('======================================================');

// 1. Config Key Uniqueness
const keyBase = getItemConfigKey({ code: 'FLW-005', color: 'Blush Pink', packagingTier: 'standard' });
const keyUpgraded = getItemConfigKey({ code: 'FLW-005', color: 'Blush Pink', packagingTier: 'luxury_wrap' });
const keyCard = getItemConfigKey({ code: 'FLW-005', color: 'Blush Pink', packagingTier: 'luxury_wrap', hasGreetingCard: true, greetingCardMessage: 'Happy Birthday' });

assert(keyBase === 'FLW-005::blush pink::standard::::', 'Base item fingerprint formats deterministically');
assert(keyUpgraded === 'FLW-005::blush pink::luxury_wrap::::', 'Upgraded item fingerprint captures packaging tier');
assert(keyBase !== keyUpgraded, 'Base and upgraded items produce distinct keys (no collision)');
assert(keyUpgraded !== keyCard, 'Greeting card produces distinct key from plain upgraded item');

// 2. Subtotal & Multiplier Math
const bouquetBase = { code: 'FLW-001', basePrice: 599, price: 599, quantity: 1, packagingTier: 'standard', packagingFee: 0 };
assert(calculateItemSubtotal(bouquetBase) === 599, 'Base bouquet qty 1 = ₹599');

bouquetBase.quantity = 2;
assert(calculateItemSubtotal(bouquetBase) === 1198, 'Base bouquet qty 2 = ₹1,198 (599 × 2)');

const bouquetSilkWrap = {
  code: 'FLW-001',
  basePrice: 599,
  price: 658,
  quantity: 1,
  packagingTier: 'luxury_wrap',
  packagingFee: 59,
  packagingMultiplier: 'per_unit'
};
assert(calculateItemSubtotal(bouquetSilkWrap) === 658, 'Bouquet + Luxury Silk Wrap qty 1 = ₹658 (599 + 59)');

bouquetSilkWrap.quantity = 2;
assert(calculateItemSubtotal(bouquetSilkWrap) === 1316, 'Bouquet + Luxury Silk Wrap qty 2 scales per unit = ₹1,316 (2 × 658)');

// Loose stems assembly math: ₹79 flat once
const looseStemsBouquet = {
  code: 'STM-001',
  basePrice: 149,
  price: 149,
  quantity: 5,
  packagingTier: 'bouquet_wrap',
  packagingFee: 79,
  packagingMultiplier: 'flat'
};
assert(calculateItemSubtotal(looseStemsBouquet) === 824, 'Loose stems (5 × 149 = 745) + flat assembly (79) = ₹824 (NOT ₹395!)');

looseStemsBouquet.quantity = 6;
assert(calculateItemSubtotal(looseStemsBouquet) === 973, 'Loose stems (6 × 149 = 894) + flat assembly (79) = ₹973');

// 3. Cart State Simulation (Adding base then adding upgrade)
let cart = [];
const addItemSim = (product, opts) => {
  const incomingKey = getItemConfigKey({
    code: product.code,
    color: opts.color,
    packagingTier: opts.packagingTier,
    hasGreetingCard: opts.hasGreetingCard,
    greetingCardMessage: opts.greetingCardMessage,
  });

  const existingIdx = cart.findIndex((i) => getItemConfigKey(i) === incomingKey);
  if (existingIdx !== -1) {
    cart[existingIdx].quantity += (opts.quantity || 1);
  } else {
    cart.push({
      id: `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: product.code,
      name: product.name,
      basePrice: opts.basePrice ?? product.price,
      packagingFee: opts.packagingFee ?? 0,
      packagingMultiplier: opts.packagingMultiplier ?? (opts.packagingTier === 'luxury_wrap' ? 'per_unit' : 'flat'),
      packagingTier: opts.packagingTier || 'standard',
      price: opts.unitPrice ?? product.price,
      quantity: opts.quantity || 1,
    });
  }
};

// Add 1 base bouquet
addItemSim({ code: 'BQT-100', name: 'Rose Dream', price: 599 }, { packagingTier: 'standard' });
assert(cart.length === 1 && cart[0].price === 599, 'Cart contains 1 item with base price ₹599');

// Add same bouquet with Luxury Silk Wrap (+₹59)
addItemSim({ code: 'BQT-100', name: 'Rose Dream', price: 599 }, {
  packagingTier: 'luxury_wrap',
  packagingFee: 59,
  packagingMultiplier: 'per_unit',
  basePrice: 599,
  unitPrice: 658,
});
assert(cart.length === 2, 'Adding upgraded variant creates distinct line item (length = 2)');
assert(cart[0].price === 599, 'Base item price preserved at ₹599');
assert(cart[1].price === 658, 'Upgraded item has upgrade price ₹658');

// Increment upgraded variant
addItemSim({ code: 'BQT-100', name: 'Rose Dream', price: 599 }, {
  packagingTier: 'luxury_wrap',
  packagingFee: 59,
  packagingMultiplier: 'per_unit',
  basePrice: 599,
  unitPrice: 658,
});
assert(cart.length === 2 && cart[1].quantity === 2, 'Re-adding upgraded variant increments its quantity to 2');

// Remove base item by id
const baseId = cart[0].id;
cart = cart.filter((i) => i.id !== baseId);
assert(cart.length === 1, 'Removing base item by id leaves 1 item');
assert(cart[0].packagingTier === 'luxury_wrap' && cart[0].quantity === 2, 'Upgraded item remains untouched with qty 2');


console.log('\n======================================================');
console.log('  MILESTONE 2: SERVER COUPON ENGINE HARDENING');
console.log('======================================================');

// 1. Normalization helper
assert(normalizePaiseAmount(10) === 1000, 'normalizePaiseAmount(10) converts raw ₹10 to 1,000 paise');
assert(normalizePaiseAmount(50) === 5000, 'normalizePaiseAmount(50) converts raw ₹50 to 5,000 paise');
assert(normalizePaiseAmount(1000) === 1000, 'normalizePaiseAmount(1000) preserves 1,000 paise');
assert(normalizePaiseAmount(99900) === 99900, 'normalizePaiseAmount(99900) preserves 99,900 paise');

// Mock products map
const mockProducts = new Map([
  ['FLW-001', { code: 'FLW-001', name: 'Classic Rose', price_in_paise: 59900, category_slug: 'bouquets', is_active: true }],
  ['FLW-002', { code: 'FLW-002', name: 'Premium Orchid', price_in_paise: 129900, category_slug: 'bouquets', is_active: true }],
  ['DEC-001', { code: 'DEC-001', name: 'Ceramic Vase', price_in_paise: 49900, category_slug: 'decor', is_active: true }],
]);

// 2. Percentage Coupon with Add-on in cart
const percentCoupon = {
  id: 'coup-1',
  code: 'ROSE15',
  active: true,
  discount_type: 'PERCENT',
  discount_value: 15,
  scope_type: 'CATEGORIES',
  applicable_categories: ['bouquets'],
};

const mixedCartItems = [
  { code: 'FLW-001', quantity: 1 },
  { code: 'ADDON-GREETING-CARD', quantity: 1, price_in_paise: 4900 },
];

const resPercent = evaluateCoupon({
  coupon: percentCoupon,
  items: mixedCartItems,
  productsMap: mockProducts,
  cartSubtotalInPaise: 59900 + 4900,
});

assert(resPercent.isValid === true, 'Coupon ROSE15 qualifies for bouquets in mixed cart');
assert(resPercent.eligibleSubtotalInPaise === 59900, 'Eligible subtotal is 59,900 paise (strictly excludes add-on)');
assert(resPercent.addonSubtotalInPaise === 4900, 'Add-on correctly recorded in ledger (4,900 paise)');
assert(resPercent.discountInPaise === Math.round(59900 * 0.15), 'Discount applies ONLY to the eligible bouquet (₹89.85 rounded to 8985 paise)');
assert(resPercent.qualificationStatus === 'PARTIALLY_QUALIFIED', 'Qualification status marked as PARTIALLY_QUALIFIED due to add-on');

// 3. Minimum Spend Exploitation Prevention
const minSpendCoupon = {
  id: 'coup-2',
  code: 'SAVE200',
  active: true,
  discount_type: 'FLAT',
  discount_value: 200, // ₹200
  min_order_in_paise: 100000, // ₹1,000 min spend
  min_spend_mode: 'ELIGIBLE_ITEMS_ONLY',
  scope_type: 'CATEGORIES',
  applicable_categories: ['bouquets'],
};

// Cart has ₹599 bouquet + ₹450 decor + ₹100 addon = ₹1,149 total cart, but only ₹599 eligible bouquet
const paddedCart = [
  { code: 'FLW-001', quantity: 1 }, // 599
  { code: 'DEC-001', quantity: 1 }, // 499 (not in bouquets)
  { code: 'ADDON-RIBBON', quantity: 2, price_in_paise: 4900 }, // 98
];

const resMinSpend = evaluateCoupon({
  coupon: minSpendCoupon,
  items: paddedCart,
  productsMap: mockProducts,
  cartSubtotalInPaise: 119600,
});

assert(resMinSpend.isValid === false, 'Min spend coupon REJECTS padded cart because eligible items (₹599) < required (₹1,000)');
assert(resMinSpend.qualificationStatus === 'DISQUALIFIED', 'Status is DISQUALIFIED');
assert(resMinSpend.message.includes('₹1000'), 'Error message informs customer of ₹1000 requirement');

// 4. Price Tier Scoping
const luxuryTierCoupon = {
  id: 'coup-3',
  code: 'LUXE100',
  active: true,
  discount_type: 'FLAT',
  discount_value: 100,
  scope_type: 'PRICE_TIER',
  min_product_price_in_paise: 100000, // Individual items must be >= ₹1,000
};

assert(isProductEligibleForCoupon(luxuryTierCoupon, mockProducts.get('FLW-001')) === false, '₹599 piece does not meet ≥ ₹1,000 price tier');
assert(isProductEligibleForCoupon(luxuryTierCoupon, mockProducts.get('FLW-002')) === true, '₹1,299 piece meets ≥ ₹1,000 price tier');

console.log('\n======================================================');
console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
