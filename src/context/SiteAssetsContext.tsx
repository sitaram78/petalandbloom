import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getCache, setCache, removeCache } from '@/utils/cache';
import { heroImages } from '@/data/site';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';

export interface SiteAsset {
  section_key: string;
  label: string;
  description: string;
  image_url: string;
  updated_at?: string;
}

interface SiteAssetsContextType {
  assets: Record<string, SiteAsset>;
  loading: boolean;
  updateAsset: (key: string, url: string) => Promise<{ error?: Error }>;
  refreshAssets: () => Promise<void>;
}

const SiteAssetsContext = createContext<SiteAssetsContextType | undefined>(undefined);

export function SiteAssetsProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Record<string, SiteAsset>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchAssets() {
      try {
        const cached = getCache<Record<string, SiteAsset>>('site_assets_cache');
        if (cached && Object.keys(cached).length > 0) {
          if (isMounted) {
            setAssets(cached);
            setLoading(false);
          }
        } else {
          // Clear empty or stale cache
          removeCache('site_assets_cache');
        }

        const { data, error } = await supabase
          .from('site_assets')
          .select('section_key, label, description, image_url, updated_at');

        if (error) {
          console.error('Error fetching site assets:', error);
        } else if (data && data.length > 0) {
          const assetsMap: Record<string, SiteAsset> = {};
          data.forEach((asset) => {
            assetsMap[asset.section_key] = asset;
          });
          if (isMounted) {
            setAssets(assetsMap);
            setCache('site_assets_cache', assetsMap);
          }
        }
      } catch (err) {
        console.error('Unexpected error fetching site assets:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateAsset = async (key: string, url: string) => {
    try {
      const now = new Date().toISOString();
      const { data, error: updateError } = await supabase
        .from('site_assets')
        .update({ image_url: url, updated_at: now })
        .eq('section_key', key)
        .select();

      if (updateError) throw updateError;

      if (!data || data.length === 0) {
        const { error: insertError } = await supabase
          .from('site_assets')
          .insert({
            section_key: key,
            label: key.replace(/_/g, ' '),
            image_url: url,
            updated_at: now,
          });

        if (insertError) throw insertError;
      }

      setAssets((prev) => ({
        ...prev,
        [key]: {
          section_key: key,
          label: prev[key]?.label || key.replace(/_/g, ' '),
          description: prev[key]?.description || '',
          image_url: url,
          updated_at: now,
        } as SiteAsset,
      }));
      removeCache('site_assets_cache');
      return { error: null };
    } catch (error: any) {
      console.error(`Asset Update Error for ${key}:`, error);
      return { error };
    }
  };

  const refreshAssets = async () => {
    setLoading(true);
    removeCache('site_assets_cache');
    try {
      const { data, error } = await supabase
        .from('site_assets')
        .select('section_key, label, description, image_url, updated_at');

      if (error) {
        console.error('Error refreshing site assets:', error);
      } else if (data && data.length > 0) {
        const assetsMap: Record<string, SiteAsset> = {};
        data.forEach((asset) => {
          assetsMap[asset.section_key] = asset;
        });
        setAssets(assetsMap);
        setCache('site_assets_cache', assetsMap);
      }
    } catch (err) {
      console.error('Unexpected error refreshing site assets:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteAssetsContext.Provider value={{ assets, loading, updateAsset, refreshAssets }}>
      {children}
    </SiteAssetsContext.Provider>
  );
}

export function useSiteAssets() {
  const context = useContext(SiteAssetsContext);
  if (context === undefined) {
    throw new Error('useSiteAssets must be used within a SiteAssetsProvider');
  }
  return context;
}

export function getDynamicAsset(assets: Record<string, SiteAsset>, key: string) {
  const mapping: Record<string, keyof typeof heroImages> = {
    [SITE_ASSET_KEYS.HOME_HERO_PRIMARY]: 'primary',
    [SITE_ASSET_KEYS.HOME_HERO_SECONDARY]: 'secondary',
    [SITE_ASSET_KEYS.HOME_HERO_TEXTURE]: 'texture',
    [SITE_ASSET_KEYS.HOME_HERO_HANDS]: 'hands',
    [SITE_ASSET_KEYS.HOME_HERO_YARN]: 'yarn',
    [SITE_ASSET_KEYS.GIFT_FINDER_HERO]: 'giftBox',
  };

  const staticKey = mapping[key];
  const url = assets[key]?.image_url || (staticKey ? heroImages[staticKey] : '');

  if (!url) return '';

  if (url.includes('supabase.co')) {
    const updatedAt = assets[key]?.updated_at;
    const v = updatedAt ? new Date(updatedAt).getTime() : '1';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${v}`;
  }

  return url;
}
