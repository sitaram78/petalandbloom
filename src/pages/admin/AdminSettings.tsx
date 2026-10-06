import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Plus,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Instagram,
  Clock,
  Building,
  MapPin,
  CheckCircle2,
  FileText,
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  SlidersHorizontal,
  Truck,
  Zap,
  ShieldCheck,
  CreditCard,
  Users,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useNotification } from '@/context/NotificationContext';
import AdminLayout from '@/components/AdminLayout';
import { removeCache } from '@/utils/cache';
import {
  useStoreSettings,
  ConciergeChannelMode,
  DEFAULT_OCCASION_BANNER,
  type OccasionBannerSettings,
  type OccasionTheme,
  type OccasionPlacement,
} from '@/context/StoreSettingsContext';
import OccasionMarquee from '@/components/OccasionMarquee';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { useRBAC } from '@/hooks/useRBAC';
import AdminTeamManager from '@/components/admin/AdminTeamManager';

interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

type SettingsTab = 'profile' | 'commerce' | 'logistics' | 'categories' | 'team';

export default function AdminSettings() {
  const { showNotification } = useNotification();
  const { can } = useRBAC();
  const { settings, updateSettings, loading: settingsLoading } = useStoreSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab') as SettingsTab | null;
  const initialTab: SettingsTab = tabParam && ['profile', 'commerce', 'logistics', 'categories', 'team'].includes(tabParam)
    ? tabParam
    : 'profile';

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'profile' ? {} : { tab });
  };

  // Company Profile Form State
  const [profileForm, setProfileForm] = useState({
    whatsappNumber: settings.whatsappNumber,
    supportEmail: settings.supportEmail,
    instagramHandle: settings.instagramHandle,
    instagramUrl: settings.instagramUrl,
    businessHours: settings.businessHours,
    responseTime: settings.responseTime,
    conciergeChannelMode: settings.conciergeChannelMode,
    legalBusinessName: settings.legalBusinessName,
    studioAddress: settings.studioAddress,
    gstin: settings.gstin,
    upiId: settings.upiId || '9931657805@ptsbi',
    upiPhone: settings.upiPhone || '9931657805',
  });

  const [savingProfile, setSavingProfile] = useState(false);

  // Feature Flags & Commerce Rules Form State
  const [flagsForm, setFlagsForm] = useState(settings.featureFlags);
  const [rulesForm, setRulesForm] = useState({
    freeShippingThresholdRupees: (settings.businessRules?.freeShippingThresholdPaise ?? 120000) / 100,
    standardShippingFeeRupees: (settings.businessRules?.standardShippingFeePaise ?? 6900) / 100,
    expressShippingFeeRupees: (settings.businessRules?.expressShippingFeePaise ?? 4900) / 100,
    giftWrapFeeRupees: (settings.businessRules?.giftWrapFeePaise ?? 7900) / 100,
    loyaltySpendPerPointRupees: (settings.businessRules?.loyaltySpendPerPointPaise ?? 2000) / 100,
    loyaltyPointRedemptionRupees: (settings.businessRules?.loyaltyPointRedemptionPaise ?? 50) / 100,
    minLoyaltyOrderRupees: (settings.businessRules?.minLoyaltyOrderPaise ?? 29900) / 100,
  });
  const [occasionForm, setOccasionForm] = useState<OccasionBannerSettings>(
    settings.occasionBanner || DEFAULT_OCCASION_BANNER
  );
  const [savingCommerce, setSavingCommerce] = useState(false);

  // Decision 5: Logistics & Courier Form State
  const [logisticsForm, setLogisticsForm] = useState({
    shiprocketEmail: settings.shiprocketEmail || '',
    shiprocketPassword: settings.shiprocketPassword || '',
    shiprocketPickupLocation: settings.shiprocketPickupLocation || 'Atelier Primary Studio',
    delhiveryApiKey: settings.delhiveryApiKey || '',
    delhiveryWarehouseName: settings.delhiveryWarehouseName || 'Atelier Central Studio',
    logisticsAutomationMode: settings.logisticsAutomationMode || 'AUTOMATED_WITH_CONFIRMATION',
    pickupContactName: settings.pickupContactName || 'The Petal & Bloom Atelier',
    pickupContactPhone: settings.pickupContactPhone || '9931653303',
    pickupPincode: settings.pickupPincode || '560001',
  });

  const [savingLogistics, setSavingLogistics] = useState(false);

  // Sync forms when settings load from Supabase
  useEffect(() => {
    setProfileForm({
      whatsappNumber: settings.whatsappNumber,
      supportEmail: settings.supportEmail,
      instagramHandle: settings.instagramHandle,
      instagramUrl: settings.instagramUrl,
      businessHours: settings.businessHours,
      responseTime: settings.responseTime,
      conciergeChannelMode: settings.conciergeChannelMode,
      legalBusinessName: settings.legalBusinessName,
      studioAddress: settings.studioAddress,
      gstin: settings.gstin,
      upiId: settings.upiId || '9931657805@ptsbi',
      upiPhone: settings.upiPhone || '9931657805',
    });

    setFlagsForm(settings.featureFlags);
    setRulesForm({
      freeShippingThresholdRupees: (settings.businessRules?.freeShippingThresholdPaise ?? 120000) / 100,
      standardShippingFeeRupees: (settings.businessRules?.standardShippingFeePaise ?? 6900) / 100,
      expressShippingFeeRupees: (settings.businessRules?.expressShippingFeePaise ?? 4900) / 100,
      giftWrapFeeRupees: (settings.businessRules?.giftWrapFeePaise ?? 7900) / 100,
      loyaltySpendPerPointRupees: (settings.businessRules?.loyaltySpendPerPointPaise ?? 2000) / 100,
      loyaltyPointRedemptionRupees: (settings.businessRules?.loyaltyPointRedemptionPaise ?? 50) / 100,
      minLoyaltyOrderRupees: (settings.businessRules?.minLoyaltyOrderPaise ?? 29900) / 100,
    });
    setOccasionForm(settings.occasionBanner || DEFAULT_OCCASION_BANNER);

    setLogisticsForm({
      shiprocketEmail: settings.shiprocketEmail || '',
      shiprocketPassword: settings.shiprocketPassword || '',
      shiprocketPickupLocation: settings.shiprocketPickupLocation || 'Atelier Primary Studio',
      delhiveryApiKey: settings.delhiveryApiKey || '',
      delhiveryWarehouseName: settings.delhiveryWarehouseName || 'Atelier Central Studio',
      logisticsAutomationMode: settings.logisticsAutomationMode || 'AUTOMATED_WITH_CONFIRMATION',
      pickupContactName: settings.pickupContactName || 'The Petal & Bloom Atelier',
      pickupContactPhone: settings.pickupContactPhone || '9931653303',
      pickupPincode: settings.pickupPincode || '560001',
    });
  }, [settings]);

  // Categories State
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', slug: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      showNotification('Error loading categories: ' + err.message, 'error');
    } finally {
      setCategoriesLoading(false);
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    const result = await updateSettings({
      whatsappNumber: profileForm.whatsappNumber.trim(),
      supportEmail: profileForm.supportEmail.trim(),
      instagramHandle: profileForm.instagramHandle.trim(),
      instagramUrl: profileForm.instagramUrl.trim(),
      businessHours: profileForm.businessHours.trim(),
      responseTime: profileForm.responseTime.trim(),
      conciergeChannelMode: profileForm.conciergeChannelMode,
      legalBusinessName: profileForm.legalBusinessName.trim(),
      studioAddress: profileForm.studioAddress.trim(),
      gstin: profileForm.gstin.trim(),
      upiId: profileForm.upiId.trim(),
      upiPhone: profileForm.upiPhone.trim(),
    });

    if (result.success) {
      logAudit({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: 'settings',
        entity_id: 'company_profile',
        new_values: {
          whatsappNumber: profileForm.whatsappNumber.trim(),
          supportEmail: profileForm.supportEmail.trim(),
          legalBusinessName: profileForm.legalBusinessName.trim(),
          upiId: profileForm.upiId.trim(),
          upiPhone: profileForm.upiPhone.trim(),
        },
        reason: 'Updated company profile and UPI settlement details from admin settings',
      });
      showNotification('Company Profile and Contact details saved successfully!', 'success');
    } else {
      showNotification('Failed to save profile: ' + (result.error || 'Unknown error'), 'error');
    }
    setSavingProfile(false);
  };

  const handleToggleConciergeMode = async (mode: ConciergeChannelMode) => {
    setProfileForm((prev) => ({ ...prev, conciergeChannelMode: mode }));
    setFlagsForm((prev) => ({ ...prev, enableLiveChat: mode === 'IN_SYSTEM' }));
    const result = await updateSettings({
      conciergeChannelMode: mode,
      featureFlags: {
        ...settings.featureFlags,
        enableLiveChat: mode === 'IN_SYSTEM',
      },
    });
    if (result.success) {
      logAudit({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: 'settings',
        entity_id: 'concierge_mode',
        new_values: { conciergeChannelMode: mode, enableLiveChat: mode === 'IN_SYSTEM' },
        reason: `Switched live concierge channel mode to ${mode}`,
      });
      showNotification(
        mode === 'IN_SYSTEM'
          ? 'Switched live concierge to In-System Live Assistant Mode across storefront!'
          : 'Switched live concierge to Direct WhatsApp Mode across storefront!',
        'success'
      );
    } else {
      showNotification('Failed to update concierge mode: ' + (result.error || 'Unknown error'), 'error');
    }
  };

  const handleSaveLogistics = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLogistics(true);

    const result = await updateSettings({
      shiprocketEmail: logisticsForm.shiprocketEmail.trim(),
      shiprocketPassword: logisticsForm.shiprocketPassword.trim(),
      shiprocketPickupLocation: logisticsForm.shiprocketPickupLocation.trim(),
      delhiveryApiKey: logisticsForm.delhiveryApiKey.trim(),
      delhiveryWarehouseName: logisticsForm.delhiveryWarehouseName.trim(),
      logisticsAutomationMode: logisticsForm.logisticsAutomationMode,
      pickupContactName: logisticsForm.pickupContactName.trim(),
      pickupContactPhone: logisticsForm.pickupContactPhone.trim(),
      pickupPincode: logisticsForm.pickupPincode.trim(),
    });

    if (result.success) {
      logAudit({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: 'settings',
        entity_id: 'logistics_config',
        new_values: {
          automationMode: logisticsForm.logisticsAutomationMode,
          shiprocketLocation: logisticsForm.shiprocketPickupLocation,
          delhiveryWarehouse: logisticsForm.delhiveryWarehouseName,
        },
        reason: 'Updated carrier logistics credentials & automation config',
      });
      showNotification('Logistics & courier automation configuration saved successfully!', 'success');
    } else {
      showNotification('Failed to save logistics settings: ' + (result.error || 'Unknown error'), 'error');
    }
    setSavingLogistics(false);
  };

  const handleSaveCommerce = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCommerce(true);

    const result = await updateSettings({
      featureFlags: flagsForm,
      businessRules: {
        freeShippingThresholdPaise: Math.round(Number(rulesForm.freeShippingThresholdRupees || 0) * 100),
        standardShippingFeePaise: Math.round(Number(rulesForm.standardShippingFeeRupees || 0) * 100),
        expressShippingFeePaise: Math.round(Number(rulesForm.expressShippingFeeRupees || 0) * 100),
        giftWrapFeePaise: Math.round(Number(rulesForm.giftWrapFeeRupees || 0) * 100),
        loyaltySpendPerPointPaise: Math.round(Number(rulesForm.loyaltySpendPerPointRupees || 0) * 100),
        loyaltyPointRedemptionPaise: Math.round(Number(rulesForm.loyaltyPointRedemptionRupees || 0) * 100),
        minLoyaltyOrderPaise: Math.round(Number(rulesForm.minLoyaltyOrderRupees || 0) * 100),
      },
      occasionBanner: occasionForm,
    });

    if (result.success) {
      logAudit({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entity: 'settings',
        entity_id: 'commerce_rules_and_flags',
        new_values: {
          featureFlags: flagsForm,
          businessRules: rulesForm,
          occasionBanner: occasionForm,
        },
        reason: 'Super Admin updated feature flags, commerce pricing rules, and festive occasion banner',
      });
      showNotification('Commerce rules, flags & occasion label saved successfully!', 'success');
    } else {
      showNotification('Failed to save commerce settings: ' + (result.error || 'Unknown error'), 'error');
    }
    setSavingCommerce(false);
  };

  async function addCategory() {
    if (!newCategory.name || !newCategory.slug) {
      showNotification('Please fill in both name and slug for the category.', 'error');
      return;
    }

    setSavingCategory(true);
    try {
      const { error } = await supabase.from('categories').insert([
        {
          name: newCategory.name.trim(),
          slug: newCategory.slug.trim(),
          display_order: categories.length,
        },
      ]);

      if (error) throw error;

      removeCache(CATEGORIES_CACHE);
      setNewCategory({ name: '', slug: '' });
      await fetchCategories();
      showNotification('Category added successfully', 'success');
    } catch (err: any) {
      showNotification(`Failed to add category: ${err.message}`, 'error');
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    setSavingCategory(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      removeCache(CATEGORIES_CACHE);
      await fetchCategories();
      showNotification('Category removed', 'success');
    } catch (err: any) {
      showNotification(`Failed to remove category: ${err.message}`, 'error');
    } finally {
      setSavingCategory(false);
    }
  }

  return (
    <AdminLayout activePage="settings">
      <main className="p-6 lg:p-10 max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
            Studio Backoffice
          </p>
          <h1 className="heading-serif text-4xl text-bark">Company Profile &amp; Settings</h1>
          <p className="text-xs text-ink-light mt-1">
            Update official company contact channels, concierge modes, and product catalog structure.
          </p>
        </header>

        {/* Tab Switcher */}
        <div className="flex border-b border-canvas-line mb-8 gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange('profile')}
            className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-bark text-bark'
                : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            <Building size={15} className="text-rose" />
            Company Profile &amp; Contact
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('commerce')}
            className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'commerce'
                ? 'border-bark text-bark'
                : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            <Zap size={15} className="text-rose" />
            Commerce &amp; Feature Flags
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('logistics')}
            className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'logistics'
                ? 'border-bark text-bark'
                : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            <Truck size={15} className="text-rose" />
            Logistics &amp; Couriers
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('categories')}
            className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'border-bark text-bark'
                : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            <SlidersHorizontal size={15} className="text-rose" />
            Category Manager ({categories.length})
          </button>
          {can('staff.manage') && (
            <button
              type="button"
              onClick={() => handleTabChange('team')}
              className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'team'
                  ? 'border-bark text-bark'
                  : 'border-transparent text-ink-light hover:text-ink'
              }`}
            >
              <Users size={15} className="text-rose" />
              Studio Team &amp; Access Control
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: COMPANY PROFILE & CONCIERGE SETTINGS                               */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-8">
            {/* 1. Decision 9: Concierge Mode Switcher Card */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-rose" />
                    <h2 className="heading-serif text-xl text-bark">
                      Customer Concierge Channel Mode
                    </h2>
                  </div>
                  <p className="text-xs text-ink-light mt-1 max-w-xl">
                    Choose how visitors and customers communicate with the studio when they click &ldquo;Studio Concierge&rdquo;, &ldquo;Chat with Us&rdquo;, or floating support.
                  </p>
                </div>

                <div className="inline-flex rounded-sm border border-canvas-line bg-canvas/40 p-1">
                  <button
                    type="button"
                    onClick={() => handleToggleConciergeMode('WHATSAPP')}
                    className={`px-3.5 py-1.5 rounded-sm text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      profileForm.conciergeChannelMode === 'WHATSAPP'
                        ? 'bg-bark text-linen shadow-sm font-semibold'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    <Phone size={12} />
                    Direct WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleConciergeMode('IN_SYSTEM')}
                    className={`px-3.5 py-1.5 rounded-sm text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      profileForm.conciergeChannelMode === 'IN_SYSTEM'
                        ? 'bg-rose text-linen shadow-sm font-semibold'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    <MessageCircle size={12} />
                    In-System Assistant
                  </button>
                </div>
              </div>

              {/* Status explanation pill */}
              <div className="p-3.5 bg-white/80 rounded-sm border border-canvas-line text-xs space-y-1">
                <p className="font-semibold text-bark">
                  Current Storefront Behavior:{' '}
                  <span className="text-rose font-bold">
                    {profileForm.conciergeChannelMode === 'WHATSAPP'
                      ? `Direct WhatsApp (${profileForm.whatsappNumber || '+91 9931653303'})`
                      : 'In-System Live Assistant Window'}
                  </span>
                </p>
                <p className="text-ink-light text-[11px] leading-relaxed">
                  {profileForm.conciergeChannelMode === 'WHATSAPP'
                    ? 'When customers tap support buttons, they are immediately redirected to WhatsApp with pre-filled enquiry text.'
                    : 'When customers tap support buttons, a sleek in-app chat drawer opens directly on the website, and messages arrive in your Admin Live Assistance Inbox.'}
                </p>
              </div>
            </div>

            {/* 2. Communication & Social Media Channels */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-5">
              <h3 className="heading-serif text-lg text-bark flex items-center gap-2">
                <Phone size={18} className="text-rose" />
                Contact &amp; Social Channels
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Studio WhatsApp Number *
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      required
                      value={profileForm.whatsappNumber}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, whatsappNumber: e.target.value })
                      }
                      placeholder="+919931653303"
                      className="w-full pl-10 pr-4 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs font-mono text-bark focus:outline-none focus:border-bark"
                    />
                  </div>
                  <p className="text-[10px] text-ink-light mt-1">
                    Updates all WhatsApp order enquiry links, footer, and admin dispatch tools instantly.
                  </p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Customer Support Email *
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="email"
                      required
                      value={profileForm.supportEmail}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, supportEmail: e.target.value })
                      }
                      placeholder="concierge@thepetalandbloom.com"
                      className="w-full pl-10 pr-4 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                  </div>
                  <p className="text-[10px] text-ink-light mt-1">
                    Displayed on invoices, order confirmations, and contact page.
                  </p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Instagram Handle
                  </label>
                  <div className="relative">
                    <Instagram size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      value={profileForm.instagramHandle}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, instagramHandle: e.target.value })
                      }
                      placeholder="@thepetalandbloom"
                      className="w-full pl-10 pr-4 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Instagram Profile URL
                  </label>
                  <input
                    type="url"
                    value={profileForm.instagramUrl}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, instagramUrl: e.target.value })
                    }
                    placeholder="https://instagram.com/thepetalandbloom"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Studio Working Hours
                  </label>
                  <div className="relative">
                    <Clock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      value={profileForm.businessHours}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, businessHours: e.target.value })
                      }
                      placeholder="Monday – Saturday, 10 AM – 7 PM IST"
                      className="w-full pl-10 pr-4 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Typical Response Time
                  </label>
                  <input
                    type="text"
                    value={profileForm.responseTime}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, responseTime: e.target.value })
                    }
                    placeholder="We typically respond within a few hours."
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
              </div>
            </div>

            {/* 3. Studio UPI Payment Settlement Details */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="heading-serif text-lg text-bark flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-700" />
                  Studio UPI Payment Settlement
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                  Active Payment Mode
                </span>
              </div>
              <p className="text-xs text-ink-light leading-relaxed">
                Configure your studio UPI ID and mobile payee number. When customers place an order, this UPI ID is automatically pre-filled into their WhatsApp payment requests and order confirmation screen.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Studio UPI ID (VPA) *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.upiId}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, upiId: e.target.value })
                    }
                    placeholder="e.g. 9931657805@ptsbi"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs font-mono font-semibold text-bark focus:outline-none focus:border-bark"
                  />
                  <p className="text-[10px] text-ink-light mt-1">
                    Format: mobile@bank or username@bank (e.g. 9931657805@ptsbi)
                  </p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    UPI Phone Number (GPay / PhonePe / Paytm / BHIM)
                  </label>
                  <input
                    type="text"
                    value={profileForm.upiPhone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, upiPhone: e.target.value })
                    }
                    placeholder="e.g. 9931657805"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs font-mono font-semibold text-bark focus:outline-none focus:border-bark"
                  />
                  <p className="text-[10px] text-ink-light mt-1">
                    Customers who search by phone number in UPI apps can transfer directly to this number.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Legal, Invoicing & Packaging Info */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-5">
              <h3 className="heading-serif text-lg text-bark flex items-center gap-2">
                <FileText size={18} className="text-rose" />
                Legal Business &amp; Tax Information (Invoice &amp; Packaging Slip)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Legal Business Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.legalBusinessName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, legalBusinessName: e.target.value })
                    }
                    placeholder="The Petal & Bloom Studio"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    GSTIN / Tax ID
                  </label>
                  <input
                    type="text"
                    value={profileForm.gstin}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, gstin: e.target.value })
                    }
                    placeholder="GSTIN-PENDING-UNREGISTERED"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs font-mono text-bark focus:outline-none focus:border-bark"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Studio / Return Address
                  </label>
                  <input
                    type="text"
                    value={profileForm.studioAddress}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, studioAddress: e.target.value })
                    }
                    placeholder="Handmade Floral Craft Studio, India"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-8 py-3 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-widest font-semibold rounded-sm flex items-center gap-2 shadow-soft transition-all disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Profile...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Save Company Profile
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: COMMERCE RULES & FEATURE FLAGS                                     */}
        {/* ========================================================================= */}
        {activeTab === 'commerce' && (
          <form onSubmit={handleSaveCommerce} className="space-y-8">
            {/* Header Description */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-3">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-rose" />
                <h2 className="heading-serif text-xl text-bark">
                  Commerce Engine &amp; Feature Flags
                </h2>
              </div>
              <p className="text-xs text-ink-light leading-relaxed max-w-2xl">
                Configure live storefront modules, checkout pricing rules, luxury packaging fees, and customer loyalty exchange rates in real-time. Changes apply immediately across all customer sessions and checkout calculations.
              </p>
            </div>

            {/* Section 1: Modular Feature Flags */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-5">
              <div>
                <h3 className="heading-serif text-lg text-bark">Storefront Module Flags</h3>
                <p className="text-xs text-ink-light mt-0.5">
                  Enable or disable commerce features without modifying or redeploying code.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Loyalty Engine */}
                <div className="flex items-center justify-between p-4 rounded-sm border border-canvas-line bg-canvas/20">
                  <div>
                    <span className="font-semibold text-xs text-bark block">Atelier Loyalty Rewards</span>
                    <span className="text-[11px] text-ink-light">Points accrual and redemption at checkout</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlagsForm(prev => ({ ...prev, enableLoyalty: !prev.enableLoyalty }))}
                    className="text-bark focus:outline-none"
                  >
                    {flagsForm.enableLoyalty ? (
                      <ToggleRight size={32} className="text-rose" />
                    ) : (
                      <ToggleLeft size={32} className="text-ink-muted" />
                    )}
                  </button>
                </div>

                {/* Coupons Engine */}
                <div className="flex items-center justify-between p-4 rounded-sm border border-canvas-line bg-canvas/20">
                  <div>
                    <span className="font-semibold text-xs text-bark block">Coupon &amp; Voucher Engine</span>
                    <span className="text-[11px] text-ink-light">Promotional coupon redemption in cart &amp; checkout</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlagsForm(prev => ({ ...prev, enableCoupons: !prev.enableCoupons }))}
                    className="text-bark focus:outline-none"
                  >
                    {flagsForm.enableCoupons ? (
                      <ToggleRight size={32} className="text-rose" />
                    ) : (
                      <ToggleLeft size={32} className="text-ink-muted" />
                    )}
                  </button>
                </div>

                {/* Influencer Program */}
                <div className="flex items-center justify-between p-4 rounded-sm border border-canvas-line bg-canvas/20">
                  <div>
                    <span className="font-semibold text-xs text-bark block">Creator &amp; Affiliate Portal</span>
                    <span className="text-[11px] text-ink-light">Influencer tracking links and commission metrics</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlagsForm(prev => ({ ...prev, enableInfluencerProgram: !prev.enableInfluencerProgram }))}
                    className="text-bark focus:outline-none"
                  >
                    {flagsForm.enableInfluencerProgram ? (
                      <ToggleRight size={32} className="text-rose" />
                    ) : (
                      <ToggleLeft size={32} className="text-ink-muted" />
                    )}
                  </button>
                </div>

                {/* Customer Reviews */}
                <div className="flex items-center justify-between p-4 rounded-sm border border-canvas-line bg-canvas/20">
                  <div>
                    <span className="font-semibold text-xs text-bark block">Verified Customer Reviews</span>
                    <span className="text-[11px] text-ink-light">Display ratings and moderation queue on product pages</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlagsForm(prev => ({ ...prev, enableReviews: !prev.enableReviews }))}
                    className="text-bark focus:outline-none"
                  >
                    {flagsForm.enableReviews ? (
                      <ToggleRight size={32} className="text-rose" />
                    ) : (
                      <ToggleLeft size={32} className="text-ink-muted" />
                    )}
                  </button>
                </div>

                {/* Maintenance Mode */}
                <div className="flex items-center justify-between p-4 rounded-sm border border-canvas-line bg-amber-50/50">
                  <div>
                    <span className="font-semibold text-xs text-bark block">Store Maintenance Mode</span>
                    <span className="text-[11px] text-ink-light">Show maintenance banner and freeze new checkout orders</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlagsForm(prev => ({ ...prev, storeMaintenanceMode: !prev.storeMaintenanceMode }))}
                    className="text-bark focus:outline-none"
                  >
                    {flagsForm.storeMaintenanceMode ? (
                      <ToggleRight size={32} className="text-amber-600" />
                    ) : (
                      <ToggleLeft size={32} className="text-ink-muted" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Festive Occasions & Seasonal Sale Label */}
            <div className={`p-6 rounded-sm border shadow-soft space-y-6 transition-all ${
              occasionForm.enabled
                ? 'bg-white border-rose/30 ring-1 ring-rose/20'
                : 'bg-white border-canvas-line'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    occasionForm.enabled ? 'bg-rose/15 text-rose' : 'bg-canvas text-ink-light'
                  }`}>
                    <Sparkles size={18} className={occasionForm.enabled ? 'text-rose' : 'text-ink-light'} />
                  </div>
                  <div>
                    <h3 className="heading-serif text-lg text-bark flex items-center gap-2">
                      Festive Occasion &amp; Seasonal Sale Label
                      {occasionForm.enabled && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose/10 text-rose uppercase tracking-wider">
                          Active on Storefront
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-ink-light mt-0.5">
                      Display an infinite running marquee label across the homepage and site header during special occasions and seasonal sales.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOccasionForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className="text-bark focus:outline-none self-start sm:self-auto"
                >
                  {occasionForm.enabled ? (
                    <ToggleRight size={34} className="text-rose" />
                  ) : (
                    <ToggleLeft size={34} className="text-ink-muted" />
                  )}
                </button>
              </div>

              {/* Form Controls */}
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Occasion Title */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      Occasion Edition / Badge *
                    </label>
                    <input
                      type="text"
                      value={occasionForm.occasionTitle}
                      onChange={(e) => setOccasionForm(prev => ({ ...prev, occasionTitle: e.target.value }))}
                      placeholder="e.g. Mother's Day Special"
                      className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                    <span className="text-[10px] text-ink-muted mt-1 block">Highlighted pill badge in the ticker</span>
                  </div>

                  {/* Coupon Code */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      Highlight Coupon Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={occasionForm.couponCode}
                      onChange={(e) => setOccasionForm(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                      placeholder="e.g. MOM15"
                      className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs font-mono font-medium text-bark focus:outline-none focus:border-bark"
                    />
                    <span className="text-[10px] text-ink-muted mt-1 block">Provides 1-click copy for shoppers</span>
                  </div>

                  {/* Target URL */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                      Shop Destination Link
                    </label>
                    <input
                      type="text"
                      value={occasionForm.targetUrl}
                      onChange={(e) => setOccasionForm(prev => ({ ...prev, targetUrl: e.target.value }))}
                      placeholder="e.g. /shop or /shop?occasion=Mothers+Day"
                      className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                    />
                    <span className="text-[10px] text-ink-muted mt-1 block">Link opened when shoppers click Explore</span>
                  </div>
                </div>

                {/* Marquee Text */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Running Marquee Ticker Message *
                  </label>
                  <input
                    type="text"
                    value={occasionForm.marqueeText}
                    onChange={(e) => setOccasionForm(prev => ({ ...prev, marqueeText: e.target.value }))}
                    placeholder="e.g. 🌸 Celebrate with Everlasting Blooms · Complimentary Studio Packaging on All Occasion Orders · Handcrafted with Love"
                    className="w-full px-3.5 py-2.5 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">
                    Continuously loops across the screen. You may use floral symbols like 🌸, ✦, 🌿.
                  </span>
                </div>

                {/* Theme Palette & Placement */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Theme Palette */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-2">
                      Occasion Color Theme
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'rose' as OccasionTheme, name: 'Blush Rose', bg: 'bg-[#FBF4F5] text-rose-deep border-rose-300' },
                        { id: 'gold' as OccasionTheme, name: 'Festive Gold', bg: 'bg-[#FDF8EE] text-[#684812] border-amber-300' },
                        { id: 'sage' as OccasionTheme, name: 'Sage Garden', bg: 'bg-[#F1F6EE] text-[#3E4F32] border-[#7C8B5C]/50' },
                        { id: 'wine' as OccasionTheme, name: 'Royal Wine', bg: 'bg-[#2E151C] text-[#F8EAE3] border-[#4E2430]' },
                        { id: 'linen' as OccasionTheme, name: 'Atelier Linen', bg: 'bg-canvas/40 text-bark border-canvas-line' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOccasionForm(prev => ({ ...prev, theme: t.id }))}
                          className={`p-2 rounded-sm border text-center transition-all cursor-pointer ${t.bg} ${
                            occasionForm.theme === t.id
                              ? 'ring-2 ring-bark shadow-xs font-semibold'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                        >
                          <div className="text-[11px] leading-tight font-serif">{t.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Placement */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-2">
                      Display Placement
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'both' as OccasionPlacement, label: 'Both (Recommended)', desc: 'Home + Header' },
                        { id: 'home_only' as OccasionPlacement, label: 'Home Page Strip', desc: 'Hero transition only' },
                        { id: 'site_wide' as OccasionPlacement, label: 'Site-Wide Header', desc: 'Top of all pages' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setOccasionForm(prev => ({ ...prev, placement: p.id }))}
                          className={`p-2 rounded-sm border text-left transition-all cursor-pointer ${
                            occasionForm.placement === p.id
                              ? 'border-bark bg-canvas/40 ring-1 ring-bark font-semibold'
                              : 'border-canvas-line bg-canvas/20 hover:bg-canvas/30 text-ink-light'
                          }`}
                        >
                          <div className="text-xs text-bark font-medium">{p.label}</div>
                          <div className="text-[10px] text-ink-muted">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Interactive Preview Box */}
                <div className="pt-2">
                  <span className="block text-[11px] uppercase tracking-wider text-bark font-medium mb-1.5">
                    Live Storefront Preview
                  </span>
                  <div className="rounded-sm border border-canvas-line overflow-hidden bg-parchment-50 shadow-inner">
                    <OccasionMarquee
                      settings={{ ...occasionForm, enabled: true }}
                      variant="strip"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Pricing & Shipping Rules */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-5">
              <div>
                <h3 className="heading-serif text-lg text-bark">Shipping &amp; Packaging Rules</h3>
                <p className="text-xs text-ink-light mt-0.5">
                  Set live currency thresholds for dispatch and luxury presentation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Free Shipping Min Spend (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rulesForm.freeShippingThresholdRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, freeShippingThresholdRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">Free delivery above this cart subtotal</span>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Standard Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rulesForm.standardShippingFeeRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, standardShippingFeeRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">Standard surface dispatch rate</span>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Express Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rulesForm.expressShippingFeeRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, expressShippingFeeRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">Air express priority surcharge</span>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Luxury Gift Wrap Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rulesForm.giftWrapFeeRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, giftWrapFeeRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">Wax-sealed bespoke calligraphy box</span>
                </div>
              </div>
            </div>

            {/* Section 3: Loyalty Points Rules */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-5">
              <div>
                <h3 className="heading-serif text-lg text-bark">Loyalty Exchange Rules</h3>
                <p className="text-xs text-ink-light mt-0.5">
                  Define points earning velocity and redemption rates for Atelier members.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Earn Velocity (₹ spend per 1 point)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={rulesForm.loyaltySpendPerPointRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, loyaltySpendPerPointRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">e.g. ₹20 spend earns 1 point (5%)</span>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Redemption Value (₹ discount per 1 point)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.05"
                    value={rulesForm.loyaltyPointRedemptionRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, loyaltyPointRedemptionRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">e.g. 1 point = ₹0.50 discount</span>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1.5">
                    Min Order Subtotal to Redeem (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rulesForm.minLoyaltyOrderRupees}
                    onChange={(e) => setRulesForm({ ...rulesForm, minLoyaltyOrderRupees: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <span className="text-[10px] text-ink-muted mt-1 block">Cart threshold required before points apply</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingCommerce}
                className="px-8 py-3 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-widest font-semibold rounded-sm flex items-center gap-2 shadow-soft transition-all disabled:opacity-50"
              >
                {savingCommerce ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Rules &amp; Flags...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Save Commerce Rules &amp; Flags
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LOGISTICS & COURIERS (DECISION 5)                                  */}
        {/* ========================================================================= */}
        {activeTab === 'logistics' && (
          <form onSubmit={handleSaveLogistics} className="space-y-8">
            {/* Header Notice Card */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-3">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-rose" />
                <h2 className="heading-serif text-xl text-bark">
                  Logistics &amp; Courier Automation Hub (Decision 5)
                </h2>
              </div>
              <p className="text-xs text-ink-light leading-relaxed max-w-2xl">
                Because Petal &amp; Bloom floral pieces are bespoke made-to-order creations, orders enter crafting first. Once crafting and packaging are complete, you can trigger automated 1-click pickup booking or manual dispatch with Delhivery, Shiprocket, or India Post.
              </p>
            </div>

            {/* Automation Policy Mode */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-4">
              <h3 className="heading-serif text-lg text-bark flex items-center gap-2">
                <ShieldCheck size={16} className="text-rose" />
                Dispatch &amp; Booking Workflow
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  className={`p-4 rounded-sm border cursor-pointer transition-all flex flex-col justify-between ${
                    logisticsForm.logisticsAutomationMode === 'AUTOMATED_WITH_CONFIRMATION'
                      ? 'border-bark bg-canvas/40 shadow-xs ring-1 ring-bark'
                      : 'border-canvas-line bg-canvas/20 hover:bg-canvas/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-bark flex items-center gap-1.5">
                        <Zap size={14} className="text-rose" />
                        Automated API Booking (With Confirmation)
                      </span>
                      <input
                        type="radio"
                        name="logisticsAutomationMode"
                        value="AUTOMATED_WITH_CONFIRMATION"
                        checked={logisticsForm.logisticsAutomationMode === 'AUTOMATED_WITH_CONFIRMATION'}
                        onChange={() =>
                          setLogisticsForm({
                            ...logisticsForm,
                            logisticsAutomationMode: 'AUTOMATED_WITH_CONFIRMATION',
                          })
                        }
                        className="accent-rose"
                      />
                    </div>
                    <p className="text-[11px] text-ink-light leading-relaxed">
                      Recommended. When packaging is done, click <strong>Auto-Book Pickup</strong> in the courier modal. You will be prompted to approve the parcel specs and customer address, and the system automatically calls the carrier API to book and fetch the AWB tracking number.
                    </p>
                  </div>
                </label>

                <label
                  className={`p-4 rounded-sm border cursor-pointer transition-all flex flex-col justify-between ${
                    logisticsForm.logisticsAutomationMode === 'MANUAL_ONLY'
                      ? 'border-bark bg-canvas/40 shadow-xs ring-1 ring-bark'
                      : 'border-canvas-line bg-canvas/20 hover:bg-canvas/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-bark">
                        Manual AWB Entry Only
                      </span>
                      <input
                        type="radio"
                        name="logisticsAutomationMode"
                        value="MANUAL_ONLY"
                        checked={logisticsForm.logisticsAutomationMode === 'MANUAL_ONLY'}
                        onChange={() =>
                          setLogisticsForm({
                            ...logisticsForm,
                            logisticsAutomationMode: 'MANUAL_ONLY',
                          })
                        }
                        className="accent-rose"
                      />
                    </div>
                    <p className="text-[11px] text-ink-light leading-relaxed">
                      All parcels are booked externally through physical post office drops (e.g. India Post Speed Post) or carrier portals. Admin manually pastes the consignment AWB into the dispatch slip.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Shiprocket Partner Credentials */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="heading-serif text-lg text-bark">Shiprocket Partner Credentials</h3>
                  <p className="text-xs text-ink-light">Multi-carrier aggregator (BlueDart, Delhivery, DTDC, XpressBees).</p>
                </div>
                <span className="text-[10px] font-mono uppercase bg-rose/10 text-rose-deep border border-rose/20 px-2 py-0.5 rounded-full">
                  Aggregator
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Shiprocket User Email
                  </label>
                  <input
                    type="email"
                    value={logisticsForm.shiprocketEmail}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, shiprocketEmail: e.target.value })
                    }
                    placeholder="e.g. logistics@thepetalandbloom.com"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Shiprocket API Password
                  </label>
                  <input
                    type="password"
                    value={logisticsForm.shiprocketPassword}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, shiprocketPassword: e.target.value })
                    }
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Pickup Location Nickname (As Registered on Shiprocket Dashboard)
                  </label>
                  <input
                    type="text"
                    value={logisticsForm.shiprocketPickupLocation}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, shiprocketPickupLocation: e.target.value })
                    }
                    placeholder="e.g. Atelier Primary Studio or Hub-Bangalore"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                  <p className="text-[10px] text-ink-light mt-1">
                    Must match the exact pickup nickname registered under your Shiprocket pickup addresses.
                  </p>
                </div>
              </div>
            </div>

            {/* Delhivery Direct Credentials */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="heading-serif text-lg text-bark">Delhivery Surface / Express Direct</h3>
                  <p className="text-xs text-ink-light">Direct B2C API contract with Delhivery logistics network.</p>
                </div>
                <span className="text-[10px] font-mono uppercase bg-canvas/50 text-bark border border-canvas-line px-2 py-0.5 rounded-full">
                  Direct API
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Delhivery API Key / Client Token
                  </label>
                  <input
                    type="password"
                    value={logisticsForm.delhiveryApiKey}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, delhiveryApiKey: e.target.value })
                    }
                    placeholder="e.g. c39f82810a9f82..."
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Registered Warehouse Name
                  </label>
                  <input
                    type="text"
                    value={logisticsForm.delhiveryWarehouseName}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, delhiveryWarehouseName: e.target.value })
                    }
                    placeholder="e.g. Atelier Central Studio"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
              </div>
            </div>

            {/* Studio Pickup Details */}
            <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft space-y-4">
              <h3 className="heading-serif text-lg text-bark">Atelier Studio Dispatch Origin</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Dispatch Contact Person
                  </label>
                  <input
                    type="text"
                    value={logisticsForm.pickupContactName}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, pickupContactName: e.target.value })
                    }
                    placeholder="The Petal & Bloom Atelier"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Pickup Mobile Contact
                  </label>
                  <input
                    type="tel"
                    value={logisticsForm.pickupContactPhone}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, pickupContactPhone: e.target.value })
                    }
                    placeholder="9931653303"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Origin Postal PIN Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={logisticsForm.pickupPincode}
                    onChange={(e) =>
                      setLogisticsForm({ ...logisticsForm, pickupPincode: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="560001"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingLogistics}
                className="px-8 py-3 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-widest font-semibold rounded-sm flex items-center gap-2 shadow-soft transition-all disabled:opacity-50"
              >
                {savingLogistics ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Configuration...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Save Logistics Configuration
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PRODUCT CATEGORIES                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            {/* Add Category Form */}
            <div className="bg-white p-6 rounded-sm border border-canvas-line shadow-soft space-y-4">
              <h3 className="heading-serif text-lg text-bark">Create New Category</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="e.g. Hair Accessories"
                    className="w-full px-3 py-2 text-xs border border-canvas-line focus:border-bark outline-none rounded-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-ink-light font-bold mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={newCategory.slug}
                    onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                    placeholder="e.g. hair-accessories"
                    className="w-full px-3 py-2 text-xs border border-canvas-line focus:border-bark outline-none rounded-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={addCategory}
                disabled={savingCategory}
                className="px-6 py-2.5 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-semibold rounded-sm flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {savingCategory ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Category
              </button>
            </div>

            {/* Category List */}
            <div className="bg-white border border-canvas-line rounded-sm shadow-soft divide-y divide-canvas-line">
              {categoriesLoading ? (
                <div className="p-8 text-center">
                  <Loader2 size={24} className="animate-spin text-rose mx-auto" />
                </div>
              ) : categories.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-light">No categories found.</div>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-xs text-bark">{cat.name}</p>
                      <p className="text-[10px] font-mono text-ink-light mt-0.5">/{cat.slug}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCategory(cat.id)}
                      className="p-1.5 text-ink-light hover:text-rose transition-colors"
                      title="Delete category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: STUDIO TEAM & ACCESS CONTROL                                       */}
        {/* ========================================================================= */}
        {activeTab === 'team' && can('staff.manage') && (
          <AdminTeamManager />
        )}
      </main>
    </AdminLayout>
  );
}
