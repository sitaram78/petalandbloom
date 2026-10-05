/**
 * The Petal & Bloom — Domain Loyalty Service
 * Encapsulates Petal Points earning rules, tier progression, redemption thresholds, and benefits.
 */

export type LoyaltyTier = 'FLORET' | 'BLOSSOM' | 'HEIRLOOM';

export type LoyaltyTransactionType =
  | 'EARN_PURCHASE'
  | 'REDEEM_PURCHASE'
  | 'REFERRAL_BONUS'
  | 'PROMOTIONAL_GRANT'
  | 'ADMIN_ADJUSTMENT'
  | 'RETURN_REVERSAL';

export interface LoyaltyRules {
  spendPerPointPaise: number; // e.g. 2000 = ₹20 per 1 pt
  redemptionValuePaise: number; // e.g. 50 = 1 pt is worth ₹0.50
  minOrderPaise: number; // e.g. 29900 = ₹299 min order to redeem
  maxRedemptionPercentage: number; // e.g. 50 = max 50% of cart can be paid with points
  referralRewardPoints: number; // e.g. 100 points
}

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  spendPerPointPaise: 2000,
  redemptionValuePaise: 50,
  minOrderPaise: 29900,
  maxRedemptionPercentage: 50,
  referralRewardPoints: 100,
};

export interface TierDetails {
  id: LoyaltyTier;
  name: string;
  minPoints: number;
  multiplier: number;
  tagline: string;
  perks: string[];
}

export const TIER_CONFIG: Record<LoyaltyTier, TierDetails> = {
  FLORET: {
    id: 'FLORET',
    name: 'Floret Collector',
    minPoints: 0,
    multiplier: 1.0,
    tagline: 'Welcome to the Petal & Bloom circle',
    perks: ['1 Petal Point per ₹20 spent', 'Member-only early seasonal access', 'Birthday studio surprise'],
  },
  BLOSSOM: {
    id: 'BLOSSOM',
    name: 'Blossom Connoisseur',
    minPoints: 500,
    multiplier: 1.25,
    tagline: 'Elevated appreciation with 1.25x earning power',
    perks: ['1.25x Petal Points per ₹20 spent', 'Complimentary artisan gift wrap', 'Invitations to limited botanicals'],
  },
  HEIRLOOM: {
    id: 'HEIRLOOM',
    name: 'Heirloom Patron',
    minPoints: 1500,
    multiplier: 1.5,
    tagline: 'VIP Atelier Tier with bespoke concierge crafting',
    perks: [
      '1.5x Petal Points per ₹20 spent',
      'Complimentary archival gift wrap & calligraphy card on all orders',
      'Dedicated atelier artisan priority crafting queue',
      'Complimentary standard courier on bespoke bouquets',
    ],
  },
};

/**
 * Resolves the member tier strictly from cumulative lifetime points.
 */
export function resolveLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  const points = Math.max(0, lifetimePoints || 0);
  if (points >= 1500) return 'HEIRLOOM';
  if (points >= 500) return 'BLOSSOM';
  return 'FLORET';
}

/**
 * Returns perks and descriptive details for a given tier.
 */
export function getTierDetails(tier: LoyaltyTier): TierDetails {
  return TIER_CONFIG[tier] || TIER_CONFIG.FLORET;
}

/**
 * Calculates petal points earned for an order total considering tier multiplier.
 */
export function calculatePointsEarned(
  totalInPaise: number,
  tier: LoyaltyTier = 'FLORET',
  customRules?: Partial<LoyaltyRules>
): number {
  if (totalInPaise <= 0) return 0;
  const rules = { ...DEFAULT_LOYALTY_RULES, ...customRules };
  const basePoints = Math.floor(totalInPaise / rules.spendPerPointPaise);
  const multiplier = TIER_CONFIG[tier]?.multiplier || 1.0;
  return Math.floor(basePoints * multiplier);
}

/**
 * Determines maximum allowable points redeemable against a cart subtotal.
 */
export function calculateMaxPointsRedeemable(
  pointsBalance: number,
  cartSubtotalInPaise: number,
  customRules?: Partial<LoyaltyRules>
): number {
  const rules = { ...DEFAULT_LOYALTY_RULES, ...customRules };
  if (pointsBalance <= 0 || cartSubtotalInPaise < rules.minOrderPaise) {
    return 0;
  }

  // Max discount cap (e.g. 50% of cart)
  const maxDiscountPaise = Math.floor((cartSubtotalInPaise * rules.maxRedemptionPercentage) / 100);
  const maxPointsByOrderCap = Math.floor(maxDiscountPaise / rules.redemptionValuePaise);

  return Math.min(pointsBalance, maxPointsByOrderCap);
}

/**
 * Converts points to financial discount amount in paise and rupees.
 */
export function calculatePointsDiscount(
  pointsToRedeem: number,
  customRules?: Partial<LoyaltyRules>
): { discountInPaise: number; discountInRupees: number } {
  if (pointsToRedeem <= 0) {
    return { discountInPaise: 0, discountInRupees: 0 };
  }
  const rules = { ...DEFAULT_LOYALTY_RULES, ...customRules };
  const discountInPaise = pointsToRedeem * rules.redemptionValuePaise;
  return {
    discountInPaise,
    discountInRupees: discountInPaise / 100,
  };
}

/**
 * Calculates progress toward the next tier.
 */
export function calculateTierProgress(lifetimePoints: number): {
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number;
  percentage: number;
} {
  const currentTier = resolveLoyaltyTier(lifetimePoints);

  if (currentTier === 'HEIRLOOM') {
    return {
      currentTier,
      nextTier: null,
      pointsToNextTier: 0,
      percentage: 100,
    };
  }

  if (currentTier === 'BLOSSOM') {
    const needed = Math.max(0, 1500 - lifetimePoints);
    const progress = Math.min(100, Math.round(((lifetimePoints - 500) / 1000) * 100));
    return {
      currentTier,
      nextTier: 'HEIRLOOM',
      pointsToNextTier: needed,
      percentage: Math.max(0, progress),
    };
  }

  // FLORET
  const needed = Math.max(0, 500 - lifetimePoints);
  const progress = Math.min(100, Math.round((lifetimePoints / 500) * 100));
  return {
    currentTier,
    nextTier: 'BLOSSOM',
    pointsToNextTier: needed,
    percentage: Math.max(0, progress),
  };
}
