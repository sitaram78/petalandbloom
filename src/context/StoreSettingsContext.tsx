import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { brandInfo } from '@/data/site';
import { authFetch } from '@/lib/apiClient';

export type ConciergeChannelMode = 'WHATSAPP' | 'IN_SYSTEM';

export interface StoreFeatureFlags {
  enableLoyalty: boolean;
  enableCoupons: boolean;
  enableInfluencerProgram: boolean;
  enableReviews: boolean;
  enableLiveChat: boolean;
  storeMaintenanceMode: boolean;
}

export interface StoreBusinessRules {
  freeShippingThresholdPaise: number;
  standardShippingFeePaise: number;
  expressShippingFeePaise: number;
  giftWrapFeePaise: number;
  loyaltySpendPerPointPaise: number;
  loyaltyPointRedemptionPaise: number;
  minLoyaltyOrderPaise: number;
}

export const DEFAULT_FEATURE_FLAGS: StoreFeatureFlags = {
  enableLoyalty: true,
  enableCoupons: true,
  enableInfluencerProgram: true,
  enableReviews: true,
  enableLiveChat: true,
  storeMaintenanceMode: false,
};

export const DEFAULT_BUSINESS_RULES: StoreBusinessRules = {
  freeShippingThresholdPaise: 120000,
  standardShippingFeePaise: 6900,
  expressShippingFeePaise: 4900,
  giftWrapFeePaise: 7900,
  loyaltySpendPerPointPaise: 2000,
  loyaltyPointRedemptionPaise: 50,
  minLoyaltyOrderPaise: 29900,
};

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

export interface StoreSettings {
  whatsappNumber: string;
  supportEmail: string;
  instagramHandle: string;
  instagramUrl: string;
  businessHours: string;
  responseTime: string;
  conciergeChannelMode: ConciergeChannelMode;
  legalBusinessName: string;
  studioAddress: string;
  gstin: string;
  // Manual UPI Payment Settlement Details
  upiId: string;
  upiPhone: string;
  // Decision 5: Logistics & Courier Automation Configuration
  shiprocketEmail: string;
  shiprocketPassword: string;
  shiprocketPickupLocation: string;
  delhiveryApiKey: string;
  delhiveryWarehouseName: string;
  logisticsAutomationMode: 'AUTOMATED_WITH_CONFIRMATION' | 'MANUAL_ONLY';
  pickupContactName: string;
  pickupContactPhone: string;
  pickupPincode: string;
  // 4-Drawer Architecture
  featureFlags: StoreFeatureFlags;
  businessRules: StoreBusinessRules;
  // Festive & Occasion Sale Label
  occasionBanner: OccasionBannerSettings;
}

const DEFAULT_SETTINGS: StoreSettings = {
  whatsappNumber: brandInfo.whatsappNumber || '+919931653303',
  supportEmail: brandInfo.email || 'concierge@thepetalandbloom.com',
  instagramHandle: brandInfo.instagram || '@thepetalandbloom',
  instagramUrl: brandInfo.instagramUrl || 'https://instagram.com/thepetalandbloom',
  businessHours: brandInfo.businessHours || 'Monday – Saturday, 10 AM – 7 PM IST',
  responseTime: brandInfo.responseTime || 'We typically respond within a few hours during business hours.',
  conciergeChannelMode: 'WHATSAPP', // Default mode; easily toggled to IN_SYSTEM via Admin Panel
  legalBusinessName: 'The Petal & Bloom Studio',
  studioAddress: 'Handmade Floral Craft Studio, India',
  gstin: 'GSTIN-PENDING-UNREGISTERED',
  upiId: '9931657805@ptsbi',
  upiPhone: '9931657805',
  // Decision 5 defaults
  shiprocketEmail: '',
  shiprocketPassword: '',
  shiprocketPickupLocation: 'Atelier Primary Studio',
  delhiveryApiKey: '',
  delhiveryWarehouseName: 'Atelier Central Studio',
  logisticsAutomationMode: 'AUTOMATED_WITH_CONFIRMATION',
  pickupContactName: 'The Petal & Bloom Atelier',
  pickupContactPhone: '9931653303',
  pickupPincode: '560001',
  featureFlags: DEFAULT_FEATURE_FLAGS,
  businessRules: DEFAULT_BUSINESS_RULES,
  occasionBanner: DEFAULT_OCCASION_BANNER,
};

const STORAGE_KEY = 'tpb_store_settings_cache';

interface StoreSettingsContextType {
  settings: StoreSettings;
  loading: boolean;
  updateSettings: (partial: Partial<StoreSettings>) => Promise<{ success: boolean; error?: string }>;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  activeContextMessage: string;
  triggerAssistance: (contextMessage?: string) => void;
  buildWhatsAppUrl: (message: string) => string;
}

const StoreSettingsContext = createContext<StoreSettingsContextType | undefined>(undefined);

export function StoreSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          featureFlags: { ...DEFAULT_FEATURE_FLAGS, ...(parsed.featureFlags || {}) },
          businessRules: { ...DEFAULT_BUSINESS_RULES, ...(parsed.businessRules || {}) },
          occasionBanner: { ...DEFAULT_OCCASION_BANNER, ...(parsed.occasionBanner || {}) },
        };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeContextMessage, setActiveContextMessage] = useState('');

  // Sync settings across tabs, custom events, and Supabase
  useEffect(() => {
    let isMounted = true;

    // Cross-tab broadcast listener (0ms latency between tabs on same device)
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('tpb_store_settings_sync');
        bc.onmessage = (event) => {
          if (event.data && isMounted) {
            setSettings((prev) => ({ ...prev, ...event.data }));
          }
        };
      } catch (err) {
        console.warn('[StoreSettings] BroadcastChannel unavailable:', err);
      }
    }

    // Storage event listener (syncs across tabs via localStorage)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && isMounted) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSettings((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Same-window custom event listener
    const handleCustomEvent = (e: Event) => {
      const customEv = e as CustomEvent<StoreSettings>;
      if (customEv.detail && isMounted) {
        setSettings((prev) => ({ ...prev, ...customEv.detail }));
      }
    };
    window.addEventListener('tpb_store_settings_change', handleCustomEvent);

    // Initial fetch from Server API
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings/store');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.settings && isMounted) {
            setSettings((prev) => ({ ...prev, ...json.settings }));
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(json.settings));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[StoreSettings] API fetch error, using cached/default:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSettings();

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tpb_store_settings_change', handleCustomEvent);
      if (bc) bc.close();
    };
  }, []);

  const updateSettings = async (partial: Partial<StoreSettings>) => {
    const nextSettings = { ...settings, ...partial };
    setSettings(nextSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
      window.dispatchEvent(new CustomEvent('tpb_store_settings_change', { detail: nextSettings }));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('tpb_store_settings_sync');
        bc.postMessage(nextSettings);
        bc.close();
      }
    } catch {
      // Ignore
    }

    try {
      await authFetch('/api/settings/store', {
        method: 'POST',
        body: JSON.stringify(nextSettings),
      });
      return { success: true };
    } catch (err: any) {
      console.warn('[StoreSettings Update Warning]:', err);
      return { success: true };
    }
  };

  const buildWhatsAppUrl = (message: string): string => {
    const cleanNumber = (settings.whatsappNumber || '').replace(/\D/g, '');
    const encoded = encodeURIComponent(message);
    if (cleanNumber) {
      return `https://wa.me/${cleanNumber}?text=${encoded}`;
    }
    return `https://wa.me/?text=${encoded}`;
  };

  const triggerAssistance = (contextMessage?: string) => {
    const msg = contextMessage || "Hi The Petal & Bloom! I have a question about your handcrafted blooms.";
    if (settings.conciergeChannelMode === 'IN_SYSTEM') {
      setActiveContextMessage(msg);
      setIsChatOpen(true);
    } else {
      // Direct WhatsApp Mode
      const url = buildWhatsAppUrl(msg);
      window.open(url, '_blank');
    }
  };

  return (
    <StoreSettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        isChatOpen,
        setIsChatOpen,
        activeContextMessage,
        triggerAssistance,
        buildWhatsAppUrl,
      }}
    >
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    throw new Error('useStoreSettings must be used within a StoreSettingsProvider');
  }
  return context;
}
