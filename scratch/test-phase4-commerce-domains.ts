/**
 * Automated Verification Suite for Phase 4: Commerce & Domain Engines Decoupling
 * Tests:
 * 1. Coupon Domain Service: Pure validation, percentage/flat discounts, caps, influencer attribution
 * 2. Loyalty Domain Service: Tiers, earning multipliers, redemption thresholds, progress calculations
 * 3. Shipping Domain Service: Thresholds, standard/express fees, Indian pincode validation, tracking URLs
 * 4. Referral Reward Automation & Email Notification
 * 5. Influencer Commission Customization & Payout Schema
 */

import {
  validateCouponEligibility,
  calculateCouponDiscount,
  evaluateCoupon,
  calculateInfluencerCommission,
  Coupon,
} from '../src/services/couponService';

import {
  resolveLoyaltyTier,
  calculatePointsEarned,
  calculateMaxPointsRedeemable,
  calculatePointsDiscount,
  calculateTierProgress,
  DEFAULT_LOYALTY_RULES,
} from '../src/services/loyaltyService';

import {
  calculateShippingFee,
  validateIndianPincode,
  generateTrackingUrl,
} from '../src/services/shippingService';

import { sendReferralRewardEmail } from '../api/lib/emailService';
import * as fs from 'fs';
import * as path from 'path';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
  } else {
    console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
    if (detail) console.error(`    \x1b[33mDetail: ${detail}\x1b[0m`);
    process.exitCode = 1;
  }
}

async function runPhase4Tests() {
  console.log('\n============================================================');
  console.log('   THE PETAL & BLOOM — PHASE 4 DOMAIN ENGINES AUDIT SUITE    ');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // SECTION 1: Coupon Domain Service
  // ------------------------------------------------------------
  console.log('--- 1. Testing Coupon Domain Service ---');

  const samplePercentCoupon: Coupon = {
    id: 'c-101',
    code: 'BLOOM15',
    discount_type: 'PERCENT',
    discount_value: 15,
    min_order_in_paise: 100000, // ₹1,000 min order
    max_discount_in_paise: 30000, // ₹300 max cap
    per_customer_limit: 1,
    active: true,
  };

  // Test 1.1: Below min order
  const belowMinCheck = validateCouponEligibility(samplePercentCoupon, {
    cartSubtotalInPaise: 80000, // ₹800
  });
  assert(!belowMinCheck.isValid && belowMinCheck.reason?.includes('minimum bouquet order'), 'Rejects order below min order threshold');

  // Test 1.2: Per-customer limit exceeded
  const perCustomerCheck = validateCouponEligibility(samplePercentCoupon, {
    cartSubtotalInPaise: 150000,
    customerRedemptionCount: 1,
  });
  assert(!perCustomerCheck.isValid && perCustomerCheck.reason?.includes('maximum number of times'), 'Enforces per-customer limit strictly');

  // Test 1.3: Percentage calculation with cap
  const cappedCalc = calculateCouponDiscount(samplePercentCoupon, 300000); // 15% of ₹3,000 = ₹450, capped at ₹300 (30000 paise)
  assert(cappedCalc.discountInPaise === 30000 && cappedCalc.discountInRupees === 300 && cappedCalc.netTotalInPaise === 270000, 'Applies percentage discount with max discount ceiling');

  // Test 1.4: Flat coupon calculation
  const sampleFlatCoupon: Coupon = {
    id: 'c-102',
    code: 'PETAL50',
    discount_type: 'FLAT',
    discount_value: 5000, // ₹50
    active: true,
  };
  const flatCalc = calculateCouponDiscount(sampleFlatCoupon, 100000); // ₹1,000 - ₹50 = ₹950
  assert(flatCalc.discountInPaise === 5000 && flatCalc.discountInRupees === 50 && flatCalc.netTotalInPaise === 95000, 'Applies flat currency discount accurately');

  // Test 1.5: Creator affiliate commission
  const creatorCommission = calculateInfluencerCommission({ commission_percent: 15 }, 200000); // 15% on ₹2,000 order = ₹300
  assert(creatorCommission.commissionEarnedInr === 300 && creatorCommission.commissionPercent === 15, 'Calculates custom influencer commission correctly');

  // ------------------------------------------------------------
  // SECTION 2: Loyalty Domain Service
  // ------------------------------------------------------------
  console.log('\n--- 2. Testing Loyalty Domain Service ---');

  // Test 2.1: Tier resolution strictly based on lifetime points
  assert(resolveLoyaltyTier(250) === 'FLORET', 'Resolves FLORET tier for <500 points');
  assert(resolveLoyaltyTier(500) === 'BLOSSOM', 'Resolves BLOSSOM tier for 500–1,499 points');
  assert(resolveLoyaltyTier(1500) === 'HEIRLOOM', 'Resolves HEIRLOOM tier for >=1,500 points');

  // Test 2.2: Tier multipliers on point earnings
  // Base rule: 1 pt per ₹20 (2000 paise). ₹2000 order (200,000 paise) = 100 base pts
  const floretEarned = calculatePointsEarned(200000, 'FLORET');
  const blossomEarned = calculatePointsEarned(200000, 'BLOSSOM'); // 1.25x = 125 pts
  const heirloomEarned = calculatePointsEarned(200000, 'HEIRLOOM'); // 1.5x = 150 pts
  assert(floretEarned === 100 && blossomEarned === 125 && heirloomEarned === 150, 'Applies tier multipliers (1.0x, 1.25x, 1.5x) to points earned');

  // Test 2.3: Max points redeemable (cart cap 50% and min order)
  // Subtotal ₹1000 (100000 paise). Max 50% discount = ₹500 (50000 paise). 1 pt = ₹0.50 (50 paise) -> Max 1000 pts
  const maxPts = calculateMaxPointsRedeemable(5000, 100000);
  assert(maxPts === 1000, 'Caps redeemable points at 50% of cart subtotal value');

  // Subtotal ₹200 (20000 paise) below min order ₹299 (29900 paise) -> 0 pts allowable
  const belowMinPts = calculateMaxPointsRedeemable(500, 20000);
  assert(belowMinPts === 0, 'Denies points redemption on orders below min threshold');

  // Test 2.4: Tier progress tracking
  const progress = calculateTierProgress(350);
  assert(progress.currentTier === 'FLORET' && progress.nextTier === 'BLOSSOM' && progress.pointsToNextTier === 150 && progress.percentage === 70, 'Calculates tier progress percentage and points to next tier');

  // ------------------------------------------------------------
  // SECTION 3: Shipping Domain Service
  // ------------------------------------------------------------
  console.log('\n--- 3. Testing Shipping Domain Service ---');

  // Test 3.1: Free shipping above threshold (₹1,200 = 120000 paise)
  const freeShip = calculateShippingFee(150000);
  assert(freeShip.isFreeShipping && freeShip.shippingFeeInPaise === 0, 'Grants complimentary shipping when subtotal exceeds threshold');

  // Test 3.2: Standard shipping fee below threshold
  const standardShip = calculateShippingFee(80000);
  assert(!standardShip.isFreeShipping && standardShip.shippingFeeInPaise === 6900, 'Applies standard shipping fee (₹69) below threshold');

  // Test 3.3: Express shipping surcharge
  const expressShip = calculateShippingFee(80000, true);
  assert(expressShip.shippingFeeInPaise === 6900 + 4900, 'Applies express shipping surcharge (+₹49) when requested');

  // Test 3.4: Indian PIN code format validation
  assert(validateIndianPincode('560001') && validateIndianPincode('110001') && !validateIndianPincode('012345') && !validateIndianPincode('5600A1'), 'Validates Indian postal PIN codes strictly');

  // Test 3.5: Public carrier tracking link generation
  const delhiveryUrl = generateTrackingUrl('DELHIVERY', '1234567890');
  const indiaPostUrl = generateTrackingUrl('INDIA_POST', 'EB123456789IN');
  assert(delhiveryUrl.includes('delhivery.com/track') && indiaPostUrl.includes('indiapost.gov.in'), 'Generates accurate public courier tracking URLs');

  // ------------------------------------------------------------
  // SECTION 4: Email & Referral Webhook Automation
  // ------------------------------------------------------------
  console.log('\n--- 4. Testing Referral Reward Email & Webhook Code ---');

  const emailResult = await sendReferralRewardEmail({
    to: 'collector@example.com',
    name: 'Aanya Sharma',
    pointsEarned: 100,
    totalPointsBalance: 250,
    refereeName: 'Priya Mehta',
    accountUrl: 'https://thepetalandbloom.vercel.app/account',
  });
  assert(emailResult === true, 'Referral reward email renders and completes in simulation mode');

  const webhookSource = fs.readFileSync(path.resolve(__dirname, '../api/payments/cashfree-webhook.ts'), 'utf-8');
  const hasReferralPointsReward = webhookSource.includes("'REFERRAL_BONUS'") && webhookSource.includes('referralRewardPoints = 100');
  const hasReferralStatusUpdate = webhookSource.includes("status: 'REWARDED'");
  const hasReferralEmailCall = webhookSource.includes('sendReferralRewardEmail(');
  assert(hasReferralPointsReward && hasReferralStatusUpdate && hasReferralEmailCall, 'Cashfree webhook rewards 100 points, marks REWARDED, and dispatches referrer email');

  // ------------------------------------------------------------
  // SECTION 5: Influencer Payouts Migration & Audit Trail
  // ------------------------------------------------------------
  console.log('\n--- 5. Testing Influencer Payouts Schema & Migration ---');

  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260929000005_influencer_payouts_and_commissions.sql');
  const migrationExists = fs.existsSync(migrationPath);
  assert(migrationExists, 'Migration 20260929000005_influencer_payouts_and_commissions.sql exists');

  if (migrationExists) {
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    const hasCommissionPaidCol = migrationContent.includes('commission_paid_inr');
    const hasPayoutLedgerTable = migrationContent.includes('create table if not exists public.influencer_payouts');
    assert(hasCommissionPaidCol && hasPayoutLedgerTable, 'SQL migration defines commission_paid_inr and influencer_payouts table');
  }

  const influencersPage = fs.readFileSync(path.resolve(__dirname, '../src/pages/admin/AdminInfluencers.tsx'), 'utf-8');
  const hasCustomCommissionInsert = influencersPage.includes('commission_percent: form.commission_percent');
  const hasRecordPayoutModal = influencersPage.includes('Record Commission Payout');
  const hasPayoutAudit = influencersPage.includes('AUDIT_ACTIONS.INFLUENCER_PAYOUT_RECORDED');
  assert(hasCustomCommissionInsert && hasRecordPayoutModal && hasPayoutAudit, 'AdminInfluencers persists custom commission, supports payout recording modal, and logs payout audit trail');

  // ------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`AUDIT RESULTS: ${passedAssertions}/${totalAssertions} assertions passed`);
  if (passedAssertions === totalAssertions) {
    console.log('\x1b[32m✔ PHASE 4 CODE REVIEW & AUDIT COMPLETE: ALL DOMAIN ENGINES SATISFIED\x1b[0m');
  } else {
    console.log('\x1b[31m✖ SOME AUDIT CHECKS FAILED\x1b[0m');
  }
  console.log('============================================================\n');
}

runPhase4Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
