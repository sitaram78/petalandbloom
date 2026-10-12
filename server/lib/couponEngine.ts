/**
 * The Petal & Bloom Atelier — Production Coupon Engine
 * Evaluates promotional coupons against cart items, categories, price tiers, and occasions.
 * Eliminates financial leakage, discount bleeding, and cart padding exploits.
 */

export interface CatalogProductMeta {
  id?: string;
  code: string;
  name?: string;
  price_in_paise: number;
  category_slug?: string;
  occasions?: string[];
  is_active?: boolean;
}

export interface CouponItemInput {
  code: string;
  quantity: number;
  price_in_paise?: number; // Optional fallback if pre-resolved
}

export interface CouponRecord {
  id: string;
  code: string;
  description?: string | null;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number;
  min_order_in_paise?: number;
  max_discount_in_paise?: number | null;
  usage_limit?: number | null;
  usage_count?: number;
  per_customer_limit?: number;
  expires_at?: string | null;
  active: boolean;
  scope_type?: 'ALL' | 'CATEGORIES' | 'SPECIFIC_PRODUCTS' | 'PRICE_TIER' | 'OCCASION' | 'CUSTOM_COMPOUND' | string;
  applicable_categories?: string[];
  applicable_product_codes?: string[];
  applicable_occasions?: string[];
  min_product_price_in_paise?: number;
  min_spend_mode?: 'ELIGIBLE_ITEMS_ONLY' | 'CART_TOTAL' | string;
  cart_mix_mode?: 'ALLOW_MIXED' | 'STRICT_EXCLUSIVE' | string;
}

export interface EvaluatedCouponResult {
  isValid: boolean;
  couponId?: string;
  code?: string;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  discountInPaise: number;
  discountInRupees: number;
  eligibleSubtotalInPaise: number;
  eligibleSubtotalInRupees: number;
  ineligibleSubtotalInPaise: number;
  ineligibleSubtotalInRupees: number;
  addonSubtotalInPaise: number;
  addonSubtotalInRupees: number;
  totalCatalogInPaise: number;
  totalCartInPaise: number;
  eligibleProductCodes: string[];
  eligibleItemsCount: number;
  ineligibleItemsCount: number;
  qualificationStatus: 'FULLY_QUALIFIED' | 'PARTIALLY_QUALIFIED' | 'DISQUALIFIED';
  message?: string;
  reason?: string;
  description?: string;
}

/**
 * Normalizes values that could be stored as either raw Rupees (< 1000) or Paise (>= 1000).
 */
export function normalizePaiseAmount(val?: number | null): number {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return 0;
  return val < 1000 ? Math.round(val * 100) : Math.round(val);
}

/**
 * Generates an informative, customer-friendly message when cart does not contain qualifying items.
 */
function getScopeMismatchMessage(coupon: CouponRecord): string {
  const scope = coupon.scope_type || 'ALL';

  if (scope === 'CATEGORIES' && coupon.applicable_categories?.length) {
    const cats = coupon.applicable_categories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
    return `This coupon is valid only on items in: ${cats}. Add an eligible item to your cart!`;
  }

  if (scope === 'SPECIFIC_PRODUCTS') {
    return 'This coupon is valid only for selected promotional arrangements.';
  }

  if (scope === 'PRICE_TIER' && (coupon.min_product_price_in_paise || 0) > 0) {
    const minRupees = Math.round(normalizePaiseAmount(coupon.min_product_price_in_paise) / 100);
    return `This coupon applies to premium pieces priced ₹${minRupees} or above.`;
  }

  if (scope === 'OCCASION' && coupon.applicable_occasions?.length) {
    const occs = coupon.applicable_occasions.map((o) => o.charAt(0).toUpperCase() + o.slice(1)).join(', ');
    return `This promotional code applies only to ${occs} collection items.`;
  }

  if (scope === 'CUSTOM_COMPOUND') {
    return 'Your cart does not meet the specific promotional criteria for this coupon.';
  }

  return 'Your cart does not contain items eligible for this promotion.';
}

/**
 * Evaluates whether an individual product matches the coupon's scoping criteria.
 */
export function isProductEligibleForCoupon(
  coupon: CouponRecord,
  product: CatalogProductMeta
): boolean {
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
      const minPrice = normalizePaiseAmount(coupon.min_product_price_in_paise);
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
      // Must satisfy every criterion that is configured
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
        const minPrice = normalizePaiseAmount(coupon.min_product_price_in_paise);
        if (product.price_in_paise < minPrice) {
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

/**
 * Core Coupon Evaluation Engine.
 * Evaluates scope, item eligibility, minimum spend, and computes tamper-proof discount.
 */
export function evaluateCoupon(params: {
  coupon: CouponRecord;
  items?: CouponItemInput[];
  productsMap?: Map<string, CatalogProductMeta>;
  cartSubtotalInPaise?: number;
}): EvaluatedCouponResult {
  const { coupon, items, productsMap, cartSubtotalInPaise } = params;

  // 1. Basic coupon status checks
  if (!coupon.active) {
    return {
      isValid: false,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise: 0,
      eligibleSubtotalInRupees: 0,
      ineligibleSubtotalInPaise: 0,
      ineligibleSubtotalInRupees: 0,
      addonSubtotalInPaise: 0,
      addonSubtotalInRupees: 0,
      totalCatalogInPaise: 0,
      totalCartInPaise: 0,
      eligibleProductCodes: [],
      eligibleItemsCount: 0,
      ineligibleItemsCount: 0,
      qualificationStatus: 'DISQUALIFIED',
      message: 'This promotional code is no longer active.',
    };
  }

  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
    return {
      isValid: false,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise: 0,
      eligibleSubtotalInRupees: 0,
      ineligibleSubtotalInPaise: 0,
      ineligibleSubtotalInRupees: 0,
      addonSubtotalInPaise: 0,
      addonSubtotalInRupees: 0,
      totalCatalogInPaise: 0,
      totalCartInPaise: 0,
      eligibleProductCodes: [],
      eligibleItemsCount: 0,
      ineligibleItemsCount: 0,
      qualificationStatus: 'DISQUALIFIED',
      message: 'This coupon has expired.',
    };
  }

  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined) {
    if ((coupon.usage_count || 0) >= coupon.usage_limit) {
      return {
        isValid: false,
        discountInPaise: 0,
        discountInRupees: 0,
        eligibleSubtotalInPaise: 0,
        eligibleSubtotalInRupees: 0,
        ineligibleSubtotalInPaise: 0,
        ineligibleSubtotalInRupees: 0,
        addonSubtotalInPaise: 0,
        addonSubtotalInRupees: 0,
        totalCatalogInPaise: 0,
        totalCartInPaise: 0,
        eligibleProductCodes: [],
        eligibleItemsCount: 0,
        ineligibleItemsCount: 0,
        qualificationStatus: 'DISQUALIFIED',
        message: 'This coupon has reached its total usage limit.',
      };
    }
  }

  // 2. Item-level and Scope Evaluation
  const scope = coupon.scope_type || 'ALL';
  const cartMixMode = coupon.cart_mix_mode || 'ALLOW_MIXED';
  const hasItems = Array.isArray(items) && items.length > 0 && productsMap && productsMap.size > 0;

  let totalCatalogInPaise = 0;
  let eligibleSubtotalInPaise = 0;
  let ineligibleCatalogSubtotalInPaise = 0;
  let addonSubtotalInPaise = 0;
  const eligibleProductCodes: string[] = [];
  let eligibleItemsCount = 0;
  let ineligibleItemsCount = 0;

  if (hasItems) {
    for (const item of items) {
      const qty = Math.max(1, Math.min(50, Math.floor(Number(item.quantity) || 1)));

      // Add-on items are tracked in the ledger but are strictly excluded from coupon discount and exclusivity checks
      if (item.code.startsWith('ADDON-')) {
        const fallbackPrice = item.price_in_paise || 4900;
        addonSubtotalInPaise += fallbackPrice * qty;
        continue;
      }

      const trimmedCode = (item.code || '').trim();
      const product =
        productsMap.get(trimmedCode) ||
        productsMap.get(trimmedCode.toUpperCase()) ||
        productsMap.get(trimmedCode.toLowerCase());

      if (!product || product.is_active === false) continue;

      const lineItemTotalInPaise = product.price_in_paise * qty;
      totalCatalogInPaise += lineItemTotalInPaise;

      const isEligible = isProductEligibleForCoupon(coupon, product);
      if (isEligible) {
        eligibleSubtotalInPaise += lineItemTotalInPaise;
        eligibleProductCodes.push(product.code);
        eligibleItemsCount += qty;
      } else {
        ineligibleCatalogSubtotalInPaise += lineItemTotalInPaise;
        ineligibleItemsCount += qty;
      }
    }
  } else {
    // Fallback if items were not provided (legacy subtotal validation)
    totalCatalogInPaise = Math.max(0, Number(cartSubtotalInPaise) || 0);
    if (scope === 'ALL') {
      eligibleSubtotalInPaise = totalCatalogInPaise;
      eligibleItemsCount = 1;
    } else {
      eligibleSubtotalInPaise = 0;
    }
  }

  const totalCartInPaise = totalCatalogInPaise + addonSubtotalInPaise;

  // 3. Verify that cart contains qualifying items (for scoped coupons)
  if (scope !== 'ALL' && eligibleSubtotalInPaise <= 0) {
    return {
      isValid: false,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise: 0,
      eligibleSubtotalInRupees: 0,
      ineligibleSubtotalInPaise: ineligibleCatalogSubtotalInPaise,
      ineligibleSubtotalInRupees: ineligibleCatalogSubtotalInPaise / 100,
      addonSubtotalInPaise,
      addonSubtotalInRupees: addonSubtotalInPaise / 100,
      totalCatalogInPaise,
      totalCartInPaise,
      eligibleProductCodes: [],
      eligibleItemsCount: 0,
      ineligibleItemsCount,
      qualificationStatus: 'DISQUALIFIED',
      message: getScopeMismatchMessage(coupon),
    };
  }

  // 3b. Verify Basket Exclusivity (Strictly rejects if cart contains non-eligible items)
  if (scope !== 'ALL' && cartMixMode === 'STRICT_EXCLUSIVE' && ineligibleItemsCount > 0) {
    return {
      isValid: false,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountInPaise: 0,
      discountInRupees: 0,
      eligibleSubtotalInPaise,
      eligibleSubtotalInRupees: eligibleSubtotalInPaise / 100,
      ineligibleSubtotalInPaise: ineligibleCatalogSubtotalInPaise,
      ineligibleSubtotalInRupees: ineligibleCatalogSubtotalInPaise / 100,
      addonSubtotalInPaise,
      addonSubtotalInRupees: addonSubtotalInPaise / 100,
      totalCatalogInPaise,
      totalCartInPaise,
      eligibleProductCodes,
      eligibleItemsCount,
      ineligibleItemsCount,
      qualificationStatus: 'DISQUALIFIED',
      message: 'This exclusive coupon can only be used when your cart contains ONLY qualifying promotional pieces (no other items).',
    };
  }

  // 4. Verify Minimum Spend Threshold
  const minSpendMode = coupon.min_spend_mode || 'ELIGIBLE_ITEMS_ONLY';
  const minRequiredInPaise = normalizePaiseAmount(coupon.min_order_in_paise);

  if (minRequiredInPaise > 0) {
    const spendToVerify = minSpendMode === 'CART_TOTAL' ? totalCatalogInPaise : eligibleSubtotalInPaise;

    if (spendToVerify < minRequiredInPaise) {
      const minRequiredRupees = Math.round(minRequiredInPaise / 100);
      const currentRupees = Math.round(spendToVerify / 100);
      const targetLabel = minSpendMode === 'CART_TOTAL' ? 'a collection merchandise total' : 'qualifying promotional items total';
      return {
        isValid: false,
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        discountInPaise: 0,
        discountInRupees: 0,
        eligibleSubtotalInPaise,
        eligibleSubtotalInRupees: eligibleSubtotalInPaise / 100,
        ineligibleSubtotalInPaise: ineligibleCatalogSubtotalInPaise,
        ineligibleSubtotalInRupees: ineligibleCatalogSubtotalInPaise / 100,
        addonSubtotalInPaise,
        addonSubtotalInRupees: addonSubtotalInPaise / 100,
        totalCatalogInPaise,
        totalCartInPaise,
        eligibleProductCodes,
        eligibleItemsCount,
        ineligibleItemsCount,
        qualificationStatus: 'DISQUALIFIED',
        message: `This coupon requires ${targetLabel} of at least ₹${minRequiredRupees}. Currently: ₹${currentRupees}.`,
      };
    }
  }

  // 5. Calculate Discount (Guaranteed Zero-Bleed)
  let discountInPaise = 0;

  if (coupon.discount_type === 'PERCENT') {
    const percent = Math.max(0, Math.min(100, Number(coupon.discount_value) || 0));
    const rawDiscount = Math.round((eligibleSubtotalInPaise * percent) / 100);
    const maxDiscountInPaise = coupon.max_discount_in_paise ? normalizePaiseAmount(coupon.max_discount_in_paise) : null;
    discountInPaise = maxDiscountInPaise !== null
      ? Math.min(rawDiscount, maxDiscountInPaise)
      : rawDiscount;
  } else {
    const flatAmountInPaise = normalizePaiseAmount(coupon.discount_value);
    discountInPaise = Math.min(eligibleSubtotalInPaise, flatAmountInPaise);
  }

  const qualificationStatus: 'FULLY_QUALIFIED' | 'PARTIALLY_QUALIFIED' =
    ineligibleItemsCount > 0 || addonSubtotalInPaise > 0 ? 'PARTIALLY_QUALIFIED' : 'FULLY_QUALIFIED';

  let description = coupon.description;
  if (!description) {
    if (coupon.discount_type === 'PERCENT') {
      const pct = coupon.discount_value;
      description = qualificationStatus === 'PARTIALLY_QUALIFIED'
        ? `${pct}% off ${eligibleItemsCount} eligible ${eligibleItemsCount === 1 ? 'item' : 'items'}`
        : `${pct}% off your order`;
    } else {
      const amt = Math.round(discountInPaise / 100);
      description = `Flat ₹${amt} off eligible items`;
    }
  }

  return {
    isValid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    discountInPaise,
    discountInRupees: discountInPaise / 100,
    eligibleSubtotalInPaise,
    eligibleSubtotalInRupees: eligibleSubtotalInPaise / 100,
    ineligibleSubtotalInPaise: ineligibleCatalogSubtotalInPaise,
    ineligibleSubtotalInRupees: ineligibleCatalogSubtotalInPaise / 100,
    addonSubtotalInPaise,
    addonSubtotalInRupees: addonSubtotalInPaise / 100,
    totalCatalogInPaise,
    totalCartInPaise,
    eligibleProductCodes,
    eligibleItemsCount,
    ineligibleItemsCount,
    qualificationStatus,
    description,
  };
}
