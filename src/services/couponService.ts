/**
 * The Petal & Bloom — Domain Coupon Service
 * Encapsulates promotional rules, discount computation, validation, and influencer attribution.
 */

export type CouponDiscountType = 'PERCENT' | 'FLAT';
export type CouponScopeType = 'ALL' | 'CATEGORIES' | 'SPECIFIC_PRODUCTS' | 'PRICE_TIER' | 'OCCASION' | 'CUSTOM_COMPOUND';
export type CouponMinSpendMode = 'ELIGIBLE_ITEMS_ONLY' | 'CART_TOTAL';
export type CouponCartMixMode = 'ALLOW_MIXED' | 'STRICT_EXCLUSIVE';

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  recipient_name?: string | null;
  discount_type: CouponDiscountType;
  discount_value: number; // e.g. 15 for 15% or 5000 for ₹50.00
  min_order_in_paise?: number;
  max_discount_in_paise?: number | null;
  usage_limit?: number | null;
  usage_count?: number;
  per_customer_limit?: number;
  expires_at?: string | null;
  active: boolean;
  is_influencer?: boolean;
  influencer_name?: string | null;
  commission_percent?: number;
  commission_paid_inr?: number;
  scope_type?: CouponScopeType;
  applicable_categories?: string[];
  applicable_product_codes?: string[];
  applicable_occasions?: string[];
  min_product_price_in_paise?: number;
  min_spend_mode?: CouponMinSpendMode;
  cart_mix_mode?: CouponCartMixMode;
}

export interface CouponValidationInput {
  cartSubtotalInPaise: number;
  customerPhone?: string | null;
  customerRedemptionCount?: number;
  now?: Date;
}

export interface CouponValidationResult {
  isValid: boolean;
  code?: string;
  discountInPaise: number;
  discountInRupees: number;
  netSubtotalInPaise: number;
  reason?: string;
  description?: string;
}

/**
 * Validates whether a coupon can be applied to the current cart and customer.
 */
export function validateCouponEligibility(
  coupon: Coupon,
  input: CouponValidationInput
): { isValid: boolean; reason?: string } {
  if (!coupon.active) {
    return { isValid: false, reason: 'This promotional code is no longer active.' };
  }

  const currentDate = input.now || new Date();
  if (coupon.expires_at && new Date(coupon.expires_at) <= currentDate) {
    return { isValid: false, reason: 'This promotional code has expired.' };
  }

  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined) {
    if ((coupon.usage_count || 0) >= coupon.usage_limit) {
      return { isValid: false, reason: 'This coupon has reached its maximum total redemptions.' };
    }
  }

  const minOrder = coupon.min_order_in_paise || 0;
  if (input.cartSubtotalInPaise < minOrder) {
    const minOrderRupees = (minOrder / 100).toLocaleString('en-IN');
    return {
      isValid: false,
      reason: `This coupon requires a minimum bouquet order of ₹${minOrderRupees}.`,
    };
  }

  const perCustLimit = coupon.per_customer_limit ?? 1;
  if (perCustLimit > 0 && (input.customerRedemptionCount || 0) >= perCustLimit) {
    return {
      isValid: false,
      reason: 'You have already redeemed this promotional code the maximum number of times.',
    };
  }

  return { isValid: true };
}

/**
 * Calculates exact discount amount in paise and rupees based on coupon rules.
 */
export function calculateCouponDiscount(
  coupon: Coupon,
  cartSubtotalInPaise: number
): { discountInPaise: number; discountInRupees: number; netTotalInPaise: number } {
  if (cartSubtotalInPaise <= 0) {
    return { discountInPaise: 0, discountInRupees: 0, netTotalInPaise: 0 };
  }

  let discountInPaise = 0;

  if (coupon.discount_type === 'PERCENT') {
    const percentage = Math.max(0, Math.min(100, coupon.discount_value));
    const calculated = Math.round((cartSubtotalInPaise * percentage) / 100);
    discountInPaise = coupon.max_discount_in_paise
      ? Math.min(calculated, coupon.max_discount_in_paise)
      : calculated;
  } else {
    // FLAT discount: In Petal & Bloom, flat discounts are stored in paise (e.g. ₹10 = 1,000 paise).
    // If raw rupees (< 100) are ever provided, normalize to paise; otherwise preserve paise.
    const flatAmount = coupon.discount_value < 100 ? coupon.discount_value * 100 : coupon.discount_value;
    discountInPaise = Math.min(cartSubtotalInPaise, flatAmount);
  }

  const netTotalInPaise = Math.max(0, cartSubtotalInPaise - discountInPaise);

  return {
    discountInPaise,
    discountInRupees: discountInPaise / 100,
    netTotalInPaise,
  };
}

/**
 * Pure evaluation function combining validation and discount computation.
 */
export function evaluateCoupon(
  coupon: Coupon,
  input: CouponValidationInput
): CouponValidationResult {
  const check = validateCouponEligibility(coupon, input);
  if (!check.isValid) {
    return {
      isValid: false,
      discountInPaise: 0,
      discountInRupees: 0,
      netSubtotalInPaise: input.cartSubtotalInPaise,
      reason: check.reason,
    };
  }

  const { discountInPaise, discountInRupees, netTotalInPaise } = calculateCouponDiscount(
    coupon,
    input.cartSubtotalInPaise
  );

  return {
    isValid: true,
    code: coupon.code,
    discountInPaise,
    discountInRupees,
    netSubtotalInPaise: netTotalInPaise,
    description: coupon.description || (coupon.discount_type === 'PERCENT' ? `${coupon.discount_value}% off your arrangement` : `₹${discountInRupees} off`),
  };
}

/**
 * Calculates creator affiliate commission for an influencer promo code.
 */
export function calculateInfluencerCommission(
  coupon: Pick<Coupon, 'commission_percent'>,
  grossRevenueInPaise: number
): { commissionEarnedInr: number; commissionPercent: number } {
  const rate = Number(coupon.commission_percent) || 10;
  const grossInr = Math.round(grossRevenueInPaise / 100);
  const commissionEarnedInr = Math.round((grossInr * rate) / 100);

  return {
    commissionEarnedInr,
    commissionPercent: rate,
  };
}
