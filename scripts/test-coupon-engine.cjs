/**
 * Automated Test Suite for Coupon Scoping Engine
 * Tests all edge cases: mixed cart discount bleed, flat discount clamping,
 * unit price vs line totals, category filtering, occasion scoping, and minimum spend modes.
 */

const assert = require('assert');

// Simulate the compiled coupon engine logic
function isProductEligibleForCoupon(coupon, product) {
  const scope = coupon.scope_type || 'ALL';

  switch (scope) {
    case 'ALL':
      return true;

    case 'CATEGORIES': {
      if (!coupon.applicable_categories || coupon.applicable_categories.length === 0) return true;
      const prodCategory = (product.category_slug || '').toLowerCase().trim();
      return coupon.applicable_categories.some(
        (cat) => cat.toLowerCase().trim() === prodCategory
      );
    }

    case 'SPECIFIC_PRODUCTS': {
      if (!coupon.applicable_product_codes || coupon.applicable_product_codes.length === 0) return false;
      const prodCode = product.code.toUpperCase().trim();
      return coupon.applicable_product_codes.some(
        (code) => code.toUpperCase().trim() === prodCode
      );
    }

    case 'PRICE_TIER': {
      const minPrice = coupon.min_product_price_in_paise || 0;
      return product.price_in_paise >= minPrice;
    }

    case 'OCCASION': {
      if (!coupon.applicable_occasions || coupon.applicable_occasions.length === 0) return true;
      const prodOccasions = (product.occasions || []).map((o) => o.toLowerCase().trim());
      return coupon.applicable_occasions.some((occ) =>
        prodOccasions.includes(occ.toLowerCase().trim())
      );
    }

    case 'CUSTOM_COMPOUND': {
      if (coupon.applicable_categories && coupon.applicable_categories.length > 0) {
        const prodCategory = (product.category_slug || '').toLowerCase().trim();
        const matchesCategory = coupon.applicable_categories.some(
          (cat) => cat.toLowerCase().trim() === prodCategory
        );
        if (!matchesCategory) return false;
      }

      if (coupon.applicable_product_codes && coupon.applicable_product_codes.length > 0) {
        const prodCode = product.code.toUpperCase().trim();
        const matchesProduct = coupon.applicable_product_codes.some(
          (code) => code.toUpperCase().trim() === prodCode
        );
        if (!matchesProduct) return false;
      }

      if ((coupon.min_product_price_in_paise || 0) > 0) {
        if (product.price_in_paise < (coupon.min_product_price_in_paise || 0)) {
          return false;
        }
      }

      if (coupon.applicable_occasions && coupon.applicable_occasions.length > 0) {
        const prodOccasions = (product.occasions || []).map((o) => o.toLowerCase().trim());
        const matchesOccasion = coupon.applicable_occasions.some((occ) =>
          prodOccasions.includes(occ.toLowerCase().trim())
        );
        if (!matchesOccasion) return false;
      }

      return true;
    }

    default:
      return true;
  }
}

function evaluateCoupon(params) {
  const { coupon, items, productsMap, cartSubtotalInPaise } = params;

  if (!coupon.active) return { isValid: false, message: 'Inactive' };
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    return { isValid: false, message: 'Expired' };
  }

  const scope = coupon.scope_type || 'ALL';
  const hasItems = Array.isArray(items) && items.length > 0 && productsMap && productsMap.size > 0;

  let totalCartInPaise = 0;
  let eligibleSubtotalInPaise = 0;
  const eligibleProductCodes = [];
  let eligibleItemsCount = 0;
  let ineligibleItemsCount = 0;

  if (hasItems) {
    for (const item of items) {
      if (item.code.startsWith('ADDON-')) continue;
      const product = productsMap.get(item.code) || productsMap.get(item.code.toUpperCase());
      if (!product || product.is_active === false) continue;

      const qty = item.quantity || 1;
      const lineTotal = product.price_in_paise * qty;
      totalCartInPaise += lineTotal;

      if (isProductEligibleForCoupon(coupon, product)) {
        eligibleSubtotalInPaise += lineTotal;
        eligibleProductCodes.push(product.code);
        eligibleItemsCount += qty;
      } else {
        ineligibleItemsCount += qty;
      }
    }
  } else {
    totalCartInPaise = cartSubtotalInPaise || 0;
    if (scope === 'ALL') {
      eligibleSubtotalInPaise = totalCartInPaise;
      eligibleItemsCount = 1;
    }
  }

  if (scope !== 'ALL' && eligibleSubtotalInPaise <= 0) {
    return { isValid: false, message: 'No eligible items', discountInPaise: 0 };
  }

  const cartMixMode = coupon.cart_mix_mode || 'ALLOW_MIXED';
  if (scope !== 'ALL' && cartMixMode === 'STRICT_EXCLUSIVE' && ineligibleItemsCount > 0) {
    return {
      isValid: false,
      message: 'This exclusive coupon cannot be combined with other items in your cart. Only qualifying pieces are allowed.',
      discountInPaise: 0,
    };
  }

  const minSpendMode = coupon.min_spend_mode || 'ELIGIBLE_ITEMS_ONLY';
  const minRequired = coupon.min_order_in_paise || 0;

  if (minRequired > 0) {
    const spend = minSpendMode === 'CART_TOTAL' ? totalCartInPaise : eligibleSubtotalInPaise;
    if (spend < minRequired) {
      return { isValid: false, message: 'Minimum spend not met', discountInPaise: 0 };
    }
  }

  let discountInPaise = 0;
  if (coupon.discount_type === 'PERCENT') {
    const raw = Math.round((eligibleSubtotalInPaise * coupon.discount_value) / 100);
    discountInPaise = coupon.max_discount_in_paise ? Math.min(raw, coupon.max_discount_in_paise) : raw;
  } else {
    const flatAmount = coupon.discount_value < 100 ? coupon.discount_value * 100 : coupon.discount_value;
    discountInPaise = Math.min(eligibleSubtotalInPaise, flatAmount);
  }

  return {
    isValid: true,
    discountInPaise,
    discountInRupees: discountInPaise / 100,
    eligibleSubtotalInPaise,
    totalCartInPaise,
    eligibleProductCodes,
    eligibleItemsCount,
  };
}

console.log('--- RUNNING COUPON ENGINE VERIFICATION SUITE ---');

const catalog = new Map([
  ['PB-BOUQ-01', { code: 'PB-BOUQ-01', name: 'Royal Crimson', price_in_paise: 200000, category_slug: 'bouquets', occasions: ['anniversary', 'valentines'], is_active: true }],
  ['PB-FLOW-02', { code: 'PB-FLOW-02', name: 'Single Rose Stem', price_in_paise: 15000, category_slug: 'flowers', occasions: ['casual'], is_active: true }],
  ['PB-BAG-03', { code: 'PB-BAG-03', name: 'Luxury Leather Bag', price_in_paise: 500000, category_slug: 'bags', occasions: ['birthday'], is_active: true }],
  ['PB-DIWALI-01', { code: 'PB-DIWALI-01', name: 'Golden Marigold Box', price_in_paise: 120000, category_slug: 'giftboxes', occasions: ['diwali', 'festive'], is_active: true }],
]);

// Test 1: Category Scope & Mixed Cart Discount Bleed Prevention
{
  const coupon = {
    id: 'c1',
    code: 'BOUQUET20',
    discount_type: 'PERCENT',
    discount_value: 20,
    scope_type: 'CATEGORIES',
    applicable_categories: ['bouquets'],
    active: true,
  };

  // Cart: 1 Royal Crimson Bouquet (₹2,000) + 1 Luxury Bag (₹5,000) = ₹7,000 cart total
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'PB-BOUQ-01', quantity: 1 },
      { code: 'PB-BAG-03', quantity: 1 },
    ],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, true, 'Coupon should be valid');
  assert.strictEqual(res.eligibleSubtotalInPaise, 200000, 'Eligible subtotal must be exactly ₹2,000 (bouquets only)');
  assert.strictEqual(res.totalCartInPaise, 700000, 'Total cart must be ₹7,000');
  // Crucial: 20% of ₹2,000 is ₹400 (40000 paise). NOT 20% of ₹7,000 (which would be ₹1,400)!
  assert.strictEqual(res.discountInPaise, 40000, 'Discount must be ₹400 (only on bouquet, zero bleed to bag)');
  console.log('✅ Test 1 Passed: Mixed Cart Discount Bleed Prevented (20% applied strictly to eligible bouquet)');
}

// Test 2: Flat Discount Clamped to Eligible Subtotal (No Negative / Spillover)
{
  const coupon = {
    id: 'c2',
    code: 'FLAT500',
    discount_type: 'FLAT',
    discount_value: 50000, // ₹500
    scope_type: 'CATEGORIES',
    applicable_categories: ['flowers'],
    active: true,
  };

  // Cart: 1 Single Rose Stem (₹150) + 1 Luxury Bag (₹5,000)
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'PB-FLOW-02', quantity: 1 },
      { code: 'PB-BAG-03', quantity: 1 },
    ],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, true, 'Coupon should be valid');
  // Eligible subtotal is ₹150. A ₹500 flat coupon must be clamped to ₹150!
  assert.strictEqual(res.discountInPaise, 15000, 'Discount must clamp to ₹150 eligible items total');
  console.log('✅ Test 2 Passed: Flat Discount Clamped (Prevented spillover into bag)');
}

// Test 3: Product Price Tier vs Quantity (Keychain multiplier exploit)
{
  const coupon = {
    id: 'c3',
    code: 'LUXURY1000',
    discount_type: 'PERCENT',
    discount_value: 10,
    scope_type: 'PRICE_TIER',
    min_product_price_in_paise: 100000, // Only items >= ₹1,000
    active: true,
  };

  // Cart: 10 units of ₹150 item = ₹1,500 line total. But unit price is ₹150 (< ₹1,000)
  const res = evaluateCoupon({
    coupon,
    items: [{ code: 'PB-FLOW-02', quantity: 10 }],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, false, 'Coupon must reject items whose unit price is below threshold');
  console.log('✅ Test 3 Passed: Price Tier enforces unit price, prevents bulk quantity loophole');
}

// Test 4: Occasion Scoping
{
  const coupon = {
    id: 'c4',
    code: 'DIWALI15',
    discount_type: 'PERCENT',
    discount_value: 15,
    scope_type: 'OCCASION',
    applicable_occasions: ['diwali'],
    active: true,
  };

  // Cart has Diwali box + Bouquet
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'PB-DIWALI-01', quantity: 1 },
      { code: 'PB-BOUQ-01', quantity: 1 },
    ],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.eligibleSubtotalInPaise, 120000, 'Only Diwali box qualifies');
  assert.strictEqual(res.discountInPaise, 18000, '15% of ₹1,200 is ₹180');
  console.log('✅ Test 4 Passed: Occasion filtering works accurately');
}

// Test 5: Specific Product Whitelist
{
  const coupon = {
    id: 'c5',
    code: 'SELECTPROMO',
    discount_type: 'PERCENT',
    discount_value: 25,
    scope_type: 'SPECIFIC_PRODUCTS',
    applicable_product_codes: ['PB-BOUQ-01'],
    active: true,
  };

  const res1 = evaluateCoupon({
    coupon,
    items: [{ code: 'PB-DIWALI-01', quantity: 1 }],
    productsMap: catalog,
  });
  assert.strictEqual(res1.isValid, false, 'Non-whitelisted product rejected');

  const res2 = evaluateCoupon({
    coupon,
    items: [{ code: 'PB-BOUQ-01', quantity: 1 }],
    productsMap: catalog,
  });
  assert.strictEqual(res2.isValid, true, 'Whitelisted product accepted');
  assert.strictEqual(res2.discountInPaise, 50000, '25% of ₹2,000 = ₹500');
  console.log('✅ Test 5 Passed: Whitelist validation works accurately');
}

// Test 6: Cart Padding Loophole with ELIGIBLE_ITEMS_ONLY
{
  const coupon = {
    id: 'c6',
    code: 'BOUQUET_MIN3K',
    discount_type: 'PERCENT',
    discount_value: 10,
    scope_type: 'CATEGORIES',
    applicable_categories: ['bouquets'],
    min_order_in_paise: 300000, // ₹3,000 min
    min_spend_mode: 'ELIGIBLE_ITEMS_ONLY',
    active: true,
  };

  // Customer has 1 Bouquet (₹2,000) + 1 Bag (₹5,000) = Cart Total ₹7,000.
  // But Bouquet subtotal is only ₹2,000 (< ₹3,000 threshold).
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'PB-BOUQ-01', quantity: 1 },
      { code: 'PB-BAG-03', quantity: 1 },
    ],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, false, 'Cart padding rejected because eligible subtotal < ₹3,000');
  console.log('✅ Test 6 Passed: Cart Padding Exploit Defeated (min_spend_mode ELIGIBLE_ITEMS_ONLY enforced)');
}

// Test 7: Exact ₹10 Flat Discount (discount_value: 1000 paise) on ₹981 Cart
{
  const catalogWithUserItems = new Map([
    ['CHC-K001', { code: 'CHC-K001', name: 'Blush Bloom Clutcher', price_in_paise: 8900, category_slug: 'accessories', is_active: true }],
    ['CLD-K001', { code: 'CLD-K001', name: "Kanha's Petal Poshak", price_in_paise: 14900, category_slug: 'poshak', is_active: true }],
    ['KEY-001', { code: 'KEY-001', name: 'Crochet Keychain', price_in_paise: 12900, category_slug: 'keychains', is_active: true }],
  ]);

  const coupon = {
    id: 'c-flat10',
    code: 'FLAT10',
    discount_type: 'FLAT',
    discount_value: 1000, // ₹10 stored as 1,000 paise in DB
    scope_type: 'ALL',
    min_order_in_paise: 49900, // ₹499 minimum spend
    min_spend_mode: 'ELIGIBLE_ITEMS_ONLY',
    active: true,
  };

  // Cart: 5 Clutchers (5 x 89 = 445) + 1 Poshak (1 x 149 = 149) + 3 Keychains (3 x 129 = 387) = ₹981
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'CHC-K001', quantity: 5 },
      { code: 'CLD-K001', quantity: 1 },
      { code: 'KEY-001', quantity: 3 },
    ],
    productsMap: catalogWithUserItems,
  });

  assert.strictEqual(res.isValid, true, 'Coupon FLAT10 should be valid on ₹981 cart');
  assert.strictEqual(res.eligibleSubtotalInPaise, 98100, 'Eligible subtotal must be exactly ₹981 (98,100 paise)');
  assert.strictEqual(res.discountInPaise, 1000, 'Discount must be exactly ₹10 (1,000 paise), NOT ₹1,000 or ₹981!');
  assert.strictEqual(res.discountInRupees, 10, 'Discount in rupees must be 10');
  console.log('✅ Test 7 Passed: FLAT ₹10 Discount Evaluates Strictly to ₹10 (Never multi-converted or bleeding)');
}

// Test 8: Strict Basket Exclusivity - Rejected when ineligible item is mixed in
{
  const coupon = {
    id: 'c-exclusive',
    code: 'TWO_ITEMS_ONLY',
    discount_type: 'PERCENT',
    discount_value: 15,
    scope_type: 'SPECIFIC_PRODUCTS',
    applicable_product_codes: ['PB-BOUQ-01', 'PB-FLOW-02'], // Only these two items
    cart_mix_mode: 'STRICT_EXCLUSIVE', // Strict basket exclusivity enabled
    active: true,
  };

  // Cart contains 1 eligible item (PB-BOUQ-01) AND 1 ineligible item (PB-BAG-03)
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'PB-BOUQ-01', quantity: 1 },
      { code: 'PB-BAG-03', quantity: 1 }, // Non-eligible piece
    ],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, false, 'Coupon must be rejected because cart contains an ineligible item');
  assert.ok(res.message.includes('exclusive coupon'), 'Message explains basket exclusivity');
  console.log('✅ Test 8 Passed: Strict Basket Exclusivity Defeats Mixed Cart Attempt (Rejected when mixed with non-selected items)');
}

// Test 9: Strict Basket Exclusivity - Approved when cart has ONLY eligible items
{
  const coupon = {
    id: 'c-exclusive-ok',
    code: 'TWO_ITEMS_ONLY',
    discount_type: 'PERCENT',
    discount_value: 15,
    scope_type: 'SPECIFIC_PRODUCTS',
    applicable_product_codes: ['PB-BOUQ-01', 'PB-FLOW-02'],
    cart_mix_mode: 'STRICT_EXCLUSIVE',
    active: true,
  };

  // Cart contains ONLY the two eligible items
  const res = evaluateCoupon({
    coupon,
    items: [
      { code: 'PB-BOUQ-01', quantity: 1 },
      { code: 'PB-FLOW-02', quantity: 1 },
    ],
    productsMap: catalog,
  });

  assert.strictEqual(res.isValid, true, 'Coupon must be valid because ALL items in cart are qualifying pieces');
  assert.strictEqual(res.eligibleItemsCount, 2);
  console.log('✅ Test 9 Passed: Strict Basket Exclusivity Passes When All Cart Items Are Eligible');
}

console.log('----------------------------------------------------');
console.log('🎉 ALL 9 COMPREHENSIVE COUPON ENGINE TESTS PASSED! 🎉');
