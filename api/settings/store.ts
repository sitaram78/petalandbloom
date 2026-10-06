import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseServer';
import { requireAuth } from '../lib/authMiddleware';

export interface StoreFeatureFlags {
  enableLoyalty: boolean;
  enableCoupons: boolean;
  enableInfluencerProgram: boolean;
  enableReviews: boolean;
  enableLiveChat: boolean;
  storeMaintenanceMode: boolean;
}

export interface StoreBusinessRules {
  freeShippingThresholdPaise: number; // e.g. 120000 = ₹1,200
  standardShippingFeePaise: number;   // e.g. 6900 = ₹69
  expressShippingFeePaise: number;    // e.g. 4900 = ₹49
  giftWrapFeePaise: number;           // e.g. 7900 = ₹79
  loyaltySpendPerPointPaise: number;  // e.g. 2000 = 1 pt per ₹20
  loyaltyPointRedemptionPaise: number;// e.g. 50 = ₹0.50 per pt
  minLoyaltyOrderPaise: number;       // e.g. 29900 = ₹299
}

export type OccasionTheme = 'rose' | 'sage' | 'gold' | 'linen' | 'wine';
export type OccasionPlacement = 'home_only' | 'site_wide' | 'both';

export interface OccasionBannerSettings {
  enabled: boolean;
  occasionTitle: string;
  marqueeText: string;
  couponCode: string;
  targetUrl: string;
  theme: OccasionTheme;
  placement: OccasionPlacement;
}

export const DEFAULT_OCCASION_BANNER: OccasionBannerSettings = {
  enabled: false,
  occasionTitle: "Mother's Day Special",
  marqueeText: "🌸 Celebrate with Everlasting Blooms · Complimentary Studio Packaging on All Occasion Orders · Handcrafted with Love",
  couponCode: "MOM15",
  targetUrl: "/shop",
  theme: "rose",
  placement: "both",
};

const DEFAULT_FEATURE_FLAGS: StoreFeatureFlags = {
  enableLoyalty: true,
  enableCoupons: true,
  enableInfluencerProgram: true,
  enableReviews: true,
  enableLiveChat: true,
  storeMaintenanceMode: false,
};

const DEFAULT_BUSINESS_RULES: StoreBusinessRules = {
  freeShippingThresholdPaise: 120000,
  standardShippingFeePaise: 6900,
  expressShippingFeePaise: 4900,
  giftWrapFeePaise: 7900,
  loyaltySpendPerPointPaise: 2000,
  loyaltyPointRedemptionPaise: 50,
  minLoyaltyOrderPaise: 29900,
};

const DEFAULT_SETTINGS = {
  whatsappNumber: '+919931653303',
  supportEmail: 'concierge@thepetalandbloom.com',
  instagramHandle: '@thepetalandbloom',
  instagramUrl: 'https://instagram.com/thepetalandbloom',
  businessHours: 'Monday – Saturday, 10 AM – 7 PM IST',
  responseTime: 'We typically respond within a few hours during business hours.',
  conciergeChannelMode: 'WHATSAPP',
  legalBusinessName: 'The Petal & Bloom Studio',
  studioAddress: 'Handmade Floral Craft Studio, India',
  gstin: 'GSTIN-PENDING-UNREGISTERED',
  upiId: '9931657805@ptsbi',
  upiPhone: '9931657805',
  // Logistics
  shiprocketEmail: '',
  shiprocketPassword: '',
  shiprocketPickupLocation: 'Atelier Primary Studio',
  delhiveryApiKey: '',
  delhiveryWarehouseName: 'Atelier Central Studio',
  logisticsAutomationMode: 'AUTOMATED_WITH_CONFIRMATION',
  pickupContactName: 'The Petal & Bloom Atelier',
  pickupContactPhone: '9931653303',
  pickupPincode: '560001',
  // 4-Drawer Architecture
  featureFlags: DEFAULT_FEATURE_FLAGS,
  businessRules: DEFAULT_BUSINESS_RULES,
  // Festive & Occasion Sale Label
  occasionBanner: DEFAULT_OCCASION_BANNER,
};

// In-memory server fallback cache
let serverCache = { ...DEFAULT_SETTINGS };

export function getCachedStoreSettings() {
  return serverCache;
}

export function setCachedStoreSettings(newSettings: Partial<typeof DEFAULT_SETTINGS>) {
  serverCache = { ...serverCache, ...newSettings };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('store_settings')
        .select('*')
        .eq('id', 'primary')
        .maybeSingle();

      if (!error && data) {
        serverCache = {
          ...serverCache,
          whatsappNumber: data.whatsapp_number || serverCache.whatsappNumber,
          supportEmail: data.support_email || serverCache.supportEmail,
          instagramHandle: data.instagram_handle || serverCache.instagramHandle,
          instagramUrl: data.instagram_url || serverCache.instagramUrl,
          businessHours: data.business_hours || serverCache.businessHours,
          responseTime: data.response_time || serverCache.responseTime,
          conciergeChannelMode: data.concierge_channel_mode || serverCache.conciergeChannelMode,
          legalBusinessName: data.legal_business_name || serverCache.legalBusinessName,
          studioAddress: data.studio_address || serverCache.studioAddress,
          gstin: data.gstin || serverCache.gstin,
          upiId: data.upi_id || serverCache.upiId,
          upiPhone: data.upi_phone || serverCache.upiPhone,
          shiprocketEmail: data.shiprocket_email || serverCache.shiprocketEmail,
          shiprocketPassword: data.shiprocket_password || serverCache.shiprocketPassword,
          shiprocketPickupLocation: data.shiprocket_pickup_location || serverCache.shiprocketPickupLocation,
          delhiveryApiKey: data.delhivery_api_key || serverCache.delhiveryApiKey,
          delhiveryWarehouseName: data.delhivery_warehouse_name || serverCache.delhiveryWarehouseName,
          logisticsAutomationMode: data.logistics_automation_mode || serverCache.logisticsAutomationMode,
          pickupContactName: data.pickup_contact_name || serverCache.pickupContactName,
          pickupContactPhone: data.pickup_contact_phone || serverCache.pickupContactPhone,
          pickupPincode: data.pickup_pincode || serverCache.pickupPincode,
          featureFlags: data.feature_flags ? { ...DEFAULT_FEATURE_FLAGS, ...data.feature_flags } : serverCache.featureFlags,
          businessRules: data.business_rules ? { ...DEFAULT_BUSINESS_RULES, ...data.business_rules } : serverCache.businessRules,
          occasionBanner: data.occasion_banner ? { ...DEFAULT_OCCASION_BANNER, ...data.occasion_banner } : serverCache.occasionBanner,
        };
      }
    } catch (err) {
      // Return serverCache on table missing / DB offline
    }

    return res.status(200).json({ success: true, settings: serverCache });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    // Lock down setting changes to authenticated super_admin or admin
    const authUser = await requireAuth(req, res, { allowedRoles: ['super_admin', 'admin'] });
    if (!authUser) return; // Response sent by requireAuth

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    
    serverCache = {
      ...serverCache,
      ...payload,
      featureFlags: {
        ...serverCache.featureFlags,
        ...(payload.featureFlags || {}),
      },
      businessRules: {
        ...serverCache.businessRules,
        ...(payload.businessRules || {}),
      },
      occasionBanner: {
        ...serverCache.occasionBanner,
        ...(payload.occasionBanner || {}),
      },
    };

    try {
      const dbPayload = {
        id: 'primary',
        whatsapp_number: serverCache.whatsappNumber,
        support_email: serverCache.supportEmail,
        instagram_handle: serverCache.instagramHandle,
        instagram_url: serverCache.instagramUrl,
        business_hours: serverCache.businessHours,
        response_time: serverCache.responseTime,
        concierge_channel_mode: serverCache.conciergeChannelMode,
        legal_business_name: serverCache.legalBusinessName,
        studio_address: serverCache.studioAddress,
        gstin: serverCache.gstin,
        upi_id: serverCache.upiId,
        upi_phone: serverCache.upiPhone,
        shiprocket_email: serverCache.shiprocketEmail,
        shiprocket_password: serverCache.shiprocketPassword,
        shiprocket_pickup_location: serverCache.shiprocketPickupLocation,
        delhivery_api_key: serverCache.delhiveryApiKey,
        delhivery_warehouse_name: serverCache.delhiveryWarehouseName,
        logistics_automation_mode: serverCache.logisticsAutomationMode,
        pickup_contact_name: serverCache.pickupContactName,
        pickup_contact_phone: serverCache.pickupContactPhone,
        pickup_pincode: serverCache.pickupPincode,
        feature_flags: serverCache.featureFlags,
        business_rules: serverCache.businessRules,
        occasion_banner: serverCache.occasionBanner,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from('store_settings')
        .upsert(dbPayload, { onConflict: 'id' });
    } catch (err) {
      // Keep server cache valid even if DB table doesn't have columns yet
    }

    return res.status(200).json({ success: true, settings: serverCache });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
