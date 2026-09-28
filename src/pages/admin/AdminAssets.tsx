import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSiteAssets } from '@/context/SiteAssetsContext';
import { Upload, Image as ImageIcon, Loader2, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';

const FIXED_ASSET_GROUPS = [
  {
    label: 'Global Brand',
    keys: [
      { key: SITE_ASSET_KEYS.LOGO, label: 'Site Logo', desc: 'The main brand logo in the navigation bar' }
    ]
  },
  {
    label: 'Home Page',
    keys: [
      { key: SITE_ASSET_KEYS.HOME_HERO_PRIMARY, label: 'Hero Primary', desc: 'Main landing page background image' },
      { key: SITE_ASSET_KEYS.HOME_HERO_SECONDARY, label: 'Hero Secondary', desc: 'Secondary hero visual' },
      { key: SITE_ASSET_KEYS.HOME_HERO_TEXTURE, label: 'Hero Texture', desc: 'Textural detail image' },
      { key: SITE_ASSET_KEYS.HOME_HERO_HANDS, label: 'Hero Hands', desc: 'Detail shot of hands working' },
      { key: SITE_ASSET_KEYS.HOME_HERO_YARN, label: 'Hero Yarn', desc: 'Close-up of luxury yarn' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_BIRTHDAY, label: 'Occasion: Birthday', desc: 'Thumbnail for birthday collection' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_ANNIVERSARY, label: 'Occasion: Anniversary', desc: 'Thumbnail for anniversary collection' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_JUST_BECAUSE, label: 'Occasion: Just Because', desc: 'Thumbnail for just because collection' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_FRIENDSHIP, label: 'Occasion: Friendship', desc: 'Thumbnail for friendship collection' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_MOTHERS_DAY, label: 'Occasion: Mother\'s Day', desc: 'Thumbnail for Mother\'s Day collection' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_VALENTINES_DAY, label: 'Occasion: Valentine\'s Day', desc: 'Thumbnail for Valentine\'s Day collection' },
      { key: SITE_ASSET_KEYS.HOME_OCCASION_FESTIVALS, label: 'Occasion: Festivals', desc: 'Thumbnail for festival collection' },
    ]
  },
  {
    label: 'About Page',
    keys: [
      { key: SITE_ASSET_KEYS.ABOUT_HERO, label: 'About Hero', desc: 'Main visual for the About page' },
      { key: SITE_ASSET_KEYS.ABOUT_PROCESS_YARN, label: 'Process: Yarn', desc: 'Step 1: Material selection' },
      { key: SITE_ASSET_KEYS.ABOUT_PROCESS_TEXTURE, label: 'Process: Texture', desc: 'Step 2: Stitching texture' },
      { key: SITE_ASSET_KEYS.ABOUT_PROCESS_HANDS, label: 'Process: Hands', desc: 'Step 3: Artisanal shaping' },
      { key: SITE_ASSET_KEYS.ABOUT_PROCESS_FINISHED, label: 'Process: Finished', desc: 'Step 4: Final quality check' },
      { key: SITE_ASSET_KEYS.ABOUT_CTA_BG, label: 'About CTA Background', desc: 'Background for the final call to action' },
    ]
  },
  {
    label: 'Contact & Info',
    keys: [
      { key: SITE_ASSET_KEYS.CONTACT_HERO, label: 'Contact Hero', desc: 'Main visual for Contact page' },
    ]
  },
  {
    label: 'Custom & Gifting',
    keys: [
      { key: SITE_ASSET_KEYS.CUSTOM_BUILDER_HERO, label: 'Builder Hero', desc: 'Main visual for Custom Builder' },
      { key: SITE_ASSET_KEYS.CUSTOM_ORDERS_HERO, label: 'Custom Orders Hero', desc: 'Main visual for Custom Orders page' },
      { key: SITE_ASSET_KEYS.GIFT_FINDER_HERO, label: 'Gift Finder Hero', desc: 'Main visual for Gift Finder tool' },
    ]
  }
];

export default function AdminAssets() {
  const { assets, updateAsset, refreshAssets } = useSiteAssets();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<{ label: string; slug: string }[]>([]);

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('name, slug')
        .order('display_order', { ascending: true });
      if (!error && data) {
        setDynamicCategories(data.map(c => ({ label: c.name, slug: c.slug })));
      }
    }
    fetchCategories();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAssets();
    setRefreshing(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKey(key);
    setSuccessKey(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${key}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `site-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('site-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('site-assets')
        .getPublicUrl(filePath);

      const { error: updateError } = await updateAsset(key, publicUrl);
      if (updateError) throw updateError;

      setSuccessKey(key);
    } catch (error: any) {
      console.error('Asset upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploadingKey(null);
    }
  };

  // Combine fixed groups with dynamic shop categories
  const allAssetGroups = [
    ...FIXED_ASSET_GROUPS,
    {
      label: 'Shop Page & Categories',
      keys: [
        { key: SITE_ASSET_KEYS.SHOP_HERO_DEFAULT, label: 'Default Shop Hero', desc: 'Main image shown when "All" categories are selected' },
        ...dynamicCategories.map(cat => ({
          key: `cat_${cat.slug}_hero`,
          label: `${cat.label} Hero`,
          desc: `Hero image for the ${cat.label} category`
        }))
      ]
    }
  ];

  return (
    <AdminLayout activePage="assets">
      <div className="p-6 lg:p-10 max-w-6xl mx-auto">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif text-ink mb-2">Studio Visuals</h1>
            <p className="text-ink-light">Manage the fixed master list of brand assets and site images.</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary px-4 py-2 flex items-center gap-2 text-xs"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Sync Assets'}
          </button>
        </div>

        <div className="space-y-16">
          {allAssetGroups.map((group) => (
            <div key={group.label} className="space-y-6">
              <div className="flex items-center gap-4">
                <h2 className="font-serif text-xl text-bark">{group.label}</h2>
                <div className="h-px flex-1 bg-silk" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.keys.map(({ key, label, desc }) => {
                  const asset = assets[key];
                  return (
                    <div key={key} className="bg-white border border-silk p-5 rounded-sm shadow-sm flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-ink text-sm">{label}</h3>
                          <p className="text-[11px] text-ink-light leading-tight">{desc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {successKey === key && <CheckCircle2 className="text-sage-600" size={16} />}
                        </div>
                      </div>

                      <div className="aspect-video bg-parchment-100 rounded-sm overflow-hidden relative group border border-silk">
                        {asset?.image_url ? (
                          <img
                            src={asset.image_url}
                            alt={label}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-ink-light gap-2">
                            <ImageIcon size={24} className="opacity-20" />
                            <span className="text-[10px]">No custom image</span>
                          </div>
                        )}

                        {uploadingKey === key && (
                          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                            <Loader2 className="animate-spin text-ink" size={24} />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <label className="btn-primary text-[10px] py-1.5 px-3 cursor-pointer flex items-center gap-2">
                          <Upload size={12} />
                          Upload
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleUpload(e, key)}
                            disabled={uploadingKey !== null}
                          />
                        </label>
                        <span className="text-[9px] text-ink-light font-mono truncate max-w-[120px]">
                          {asset?.image_url ? asset.image_url.split('/').pop() : 'static_default'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
