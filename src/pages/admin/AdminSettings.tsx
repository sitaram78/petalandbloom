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
} from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';
import AdminLayout from '@/components/AdminLayout';
import { removeCache } from '@/utils/cache';
import { CATEGORIES_CACHE } from '@/utils/cacheKeys';
import { useStoreSettings, ConciergeChannelMode } from '@/context/StoreSettingsContext';

interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

type SettingsTab = 'profile' | 'categories';

export default function AdminSettings() {
  const { showNotification } = useNotification();
  const { settings, updateSettings, loading: settingsLoading } = useStoreSettings();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

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
  });

  const [savingProfile, setSavingProfile] = useState(false);

  // Sync profile form when settings load from Supabase
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
    });

    if (result.success) {
      showNotification('Company Profile and Contact details saved successfully!', 'success');
    } else {
      showNotification('Failed to save profile: ' + (result.error || 'Unknown error'), 'error');
    }
    setSavingProfile(false);
  };

  const handleToggleConciergeMode = async (mode: ConciergeChannelMode) => {
    setProfileForm((prev) => ({ ...prev, conciergeChannelMode: mode }));
    const result = await updateSettings({ conciergeChannelMode: mode });
    if (result.success) {
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
        <div className="flex border-b border-canvas-line mb-8 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all ${
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
            onClick={() => setActiveTab('categories')}
            className={`pb-3 text-xs uppercase tracking-wider font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'categories'
                ? 'border-bark text-bark'
                : 'border-transparent text-ink-light hover:text-ink'
            }`}
          >
            <SlidersHorizontal size={15} className="text-rose" />
            Category Manager ({categories.length})
          </button>
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

            {/* 3. Legal, Invoicing & Packaging Info */}
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
        {/* TAB 2: PRODUCT CATEGORIES                                                 */}
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
      </main>
    </AdminLayout>
  );
}
