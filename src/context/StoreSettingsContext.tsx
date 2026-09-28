import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { brandInfo } from '@/data/site';

export type ConciergeChannelMode = 'WHATSAPP' | 'IN_SYSTEM';

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
        return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeContextMessage, setActiveContextMessage] = useState('');

  // Fetch settings from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('store_settings')
          .select('*')
          .eq('id', 'primary')
          .maybeSingle();

        if (!error && data) {
          const loaded: StoreSettings = {
            whatsappNumber: data.whatsapp_number || DEFAULT_SETTINGS.whatsappNumber,
            supportEmail: data.support_email || DEFAULT_SETTINGS.supportEmail,
            instagramHandle: data.instagram_handle || DEFAULT_SETTINGS.instagramHandle,
            instagramUrl: data.instagram_url || DEFAULT_SETTINGS.instagramUrl,
            businessHours: data.business_hours || DEFAULT_SETTINGS.businessHours,
            responseTime: data.response_time || DEFAULT_SETTINGS.responseTime,
            conciergeChannelMode: (data.concierge_channel_mode as ConciergeChannelMode) || 'WHATSAPP',
            legalBusinessName: data.legal_business_name || DEFAULT_SETTINGS.legalBusinessName,
            studioAddress: data.studio_address || DEFAULT_SETTINGS.studioAddress,
            gstin: data.gstin || DEFAULT_SETTINGS.gstin,
          };

          if (isMounted) {
            setSettings(loaded);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
            } catch {
              // Ignore localStorage failures
            }
          }
        }
      } catch (err) {
        console.warn('[StoreSettings] Using cached/default settings:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateSettings = async (partial: Partial<StoreSettings>) => {
    const nextSettings = { ...settings, ...partial };
    setSettings(nextSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    } catch {
      // Ignore
    }

    try {
      const dbPayload = {
        id: 'primary',
        whatsapp_number: nextSettings.whatsappNumber,
        support_email: nextSettings.supportEmail,
        instagram_handle: nextSettings.instagramHandle,
        instagram_url: nextSettings.instagramUrl,
        business_hours: nextSettings.businessHours,
        response_time: nextSettings.responseTime,
        concierge_channel_mode: nextSettings.conciergeChannelMode,
        legal_business_name: nextSettings.legalBusinessName,
        studio_address: nextSettings.studioAddress,
        gstin: nextSettings.gstin,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('store_settings')
        .upsert(dbPayload, { onConflict: 'id' });

      if (error) {
        console.warn('[StoreSettings Upsert Warning]:', error.message);
        // Still successful locally
      }
      return { success: true };
    } catch (err: any) {
      console.error('[StoreSettings Update Exception]:', err);
      return { success: false, error: err.message };
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
