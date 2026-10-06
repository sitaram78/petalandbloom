import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  Ticket,
  Search,
  CheckCircle2,
  XCircle,
  Tag,
  Calendar,
  Users,
  ChevronRight,
  TrendingUp,
  Edit2,
  Sparkles,
  Layers,
  IndianRupee,
  Percent,
  Check,
  X,
  AlertCircle,
  Info,
  Lock,
  ShoppingCart,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import AdminLayout from '@/components/AdminLayout';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
} from '@/components/admin/view-system';

interface Coupon {
  id: string;
  code: string;
  recipient_name: string;
  discount_type?: 'PERCENT' | 'FLAT';
  discount_percent?: number;
  discount_value?: number;
  min_order_in_paise?: number;
  max_discount_in_paise?: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  active: boolean;
  is_influencer?: boolean;
  scope_type?: string;
  applicable_categories?: string[];
  applicable_product_codes?: string[];
  applicable_occasions?: string[];
  min_product_price_in_paise?: number;
  min_spend_mode?: string;
  cart_mix_mode?: string;
  created_at?: string;
}

interface CatalogProduct {
  id: string;
  code: string;
  name: string;
  price_in_paise: number;
  category_slug?: string;
  occasions?: string[];
  images?: string[];
  is_active?: boolean;
}

const CATEGORY_OPTIONS = [
  { slug: 'bouquets', label: 'Bouquets', icon: '💐' },
  { slug: 'flowers', label: 'Fresh Flowers', icon: '🌸' },
  { slug: 'giftboxes', label: 'Luxury Gift Boxes', icon: '🎁' },
  { slug: 'gifts', label: 'Artisanal Gifts', icon: '✨' },
  { slug: 'bags', label: 'Tote & Bags', icon: '👜' },
  { slug: 'decor', label: 'Botanical Decor', icon: '🌿' },
  { slug: 'custom', label: 'Custom Orders', icon: '🎨' },
];

const OCCASION_OPTIONS = [
  { slug: 'diwali', label: 'Diwali & Festive', emoji: '🪔' },
  { slug: 'valentines', label: "Valentine's Day", emoji: '❤️' },
  { slug: 'birthday', label: 'Birthday', emoji: '🎂' },
  { slug: 'anniversary', label: 'Anniversary', emoji: '🥂' },
  { slug: 'mothers-day', label: "Mother's Day", emoji: '🌷' },
  { slug: 'wedding', label: 'Weddings', emoji: '💍' },
  { slug: 'friendship', label: 'Friendship', emoji: '🤝' },
];

const SCOPE_TYPE_OPTIONS = [
  { id: 'ALL', label: 'All Products', icon: '🌐', desc: 'Applies to any product across the atelier' },
  { id: 'CATEGORIES', label: 'Category Only', icon: '💐', desc: 'Restricted to selected product categories' },
  { id: 'SPECIFIC_PRODUCTS', label: 'Handpicked Items', icon: '🎯', desc: 'Restricted to exact chosen products' },
  { id: 'PRICE_TIER', label: 'Price Tier (≥ ₹X)', icon: '💎', desc: 'Only high-value pieces priced at or above ₹X' },
  { id: 'OCCASION', label: 'Festive / Occasion', icon: '🎊', desc: 'Restricted to festive celebration pieces' },
  { id: 'CUSTOM_COMPOUND', label: 'Compound Criteria', icon: '⚙️', desc: 'Combine multiple category, price, and festive filters' },
];

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  // Search input inside product picker modal
  const [productPickerSearch, setProductPickerSearch] = useState('');

  const [form, setForm] = useState({
    code: '',
    recipientName: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FLAT',
    discountValue: 10,
    maxDiscountInRupees: '',
    minOrderInRupees: '',
    minSpendMode: 'ELIGIBLE_ITEMS_ONLY',
    scopeType: 'ALL',
    applicableCategories: [] as string[],
    applicableProductCodes: [] as string[],
    applicableOccasions: [] as string[],
    minProductPriceInRupees: '',
    cartMixMode: 'ALLOW_MIXED' as 'ALLOW_MIXED' | 'STRICT_EXCLUSIVE',
    expiresAt: '',
    usageLimit: '',
  });

  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editForm, setEditForm] = useState({
    code: '',
    recipientName: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FLAT',
    discountValue: 10,
    maxDiscountInRupees: '',
    minOrderInRupees: '',
    minSpendMode: 'ELIGIBLE_ITEMS_ONLY',
    scopeType: 'ALL',
    applicableCategories: [] as string[],
    applicableProductCodes: [] as string[],
    applicableOccasions: [] as string[],
    minProductPriceInRupees: '',
    cartMixMode: 'ALLOW_MIXED' as 'ALLOW_MIXED' | 'STRICT_EXCLUSIVE',
    expiresAt: '',
    usageLimit: '',
  });

  // Unified Admin View System hook
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
  } = useAdminView({
    defaultView: 'table',
    defaultTab: 'ALL',
    searchParamKey: 'q',
    tabParamKey: 'status',
    viewParamKey: 'view',
  });

  const loadCoupons = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      const promotionalOnly = (data || []).filter((c: any) => !c.is_influencer);
      const mapped = promotionalOnly.map((c: any) => ({
        ...c,
        discount_percent: c.discount_percent ?? (c.discount_type === 'PERCENT' ? c.discount_value : 0),
      }));
      setCoupons(mapped);
    }
    setLoading(false);
  };

  const loadCatalogProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, code, name, price_in_paise, category_slug, occasions, images, is_active')
      .eq('is_active', true)
      .order('name');
    if (data) {
      setCatalogProducts(data);
    }
  };

  useEffect(() => {
    loadCoupons();
    loadCatalogProducts();
  }, []);

  // Compute live matching products for the create form
  const createMatchingProducts = useMemo(() => {
    const minPricePaise = form.minProductPriceInRupees ? Math.round(Number(form.minProductPriceInRupees) * 100) : 0;
    return computeMatchingProducts(
      form.scopeType,
      form.applicableCategories,
      form.applicableProductCodes,
      form.applicableOccasions,
      minPricePaise,
      catalogProducts
    );
  }, [form, catalogProducts]);

  // Compute live matching products for the edit form
  const editMatchingProducts = useMemo(() => {
    const minPricePaise = editForm.minProductPriceInRupees ? Math.round(Number(editForm.minProductPriceInRupees) * 100) : 0;
    return computeMatchingProducts(
      editForm.scopeType,
      editForm.applicableCategories,
      editForm.applicableProductCodes,
      editForm.applicableOccasions,
      minPricePaise,
      catalogProducts
    );
  }, [editForm, catalogProducts]);

  function computeMatchingProducts(
    scopeType: string,
    categories: string[],
    productCodes: string[],
    occasions: string[],
    minPricePaise: number,
    products: CatalogProduct[]
  ) {
    if (scopeType === 'ALL') return products;

    return products.filter((p) => {
      switch (scopeType) {
        case 'CATEGORIES':
          return categories.length === 0 || categories.includes(p.category_slug || '');
        case 'SPECIFIC_PRODUCTS':
          return productCodes.map((c) => c.toUpperCase()).includes((p.code || '').toUpperCase());
        case 'PRICE_TIER':
          return p.price_in_paise >= minPricePaise;
        case 'OCCASION': {
          if (occasions.length === 0) return true;
          const prodOccs = (p.occasions || []).map((o) => o.toLowerCase());
          return occasions.some((occ) => prodOccs.includes(occ.toLowerCase()));
        }
        case 'CUSTOM_COMPOUND': {
          const catOk = categories.length === 0 || categories.includes(p.category_slug || '');
          const codeOk = productCodes.length === 0 || productCodes.map((c) => c.toUpperCase()).includes((p.code || '').toUpperCase());
          const priceOk = minPricePaise === 0 || p.price_in_paise >= minPricePaise;
          const occOk = occasions.length === 0 || (Array.isArray(p.occasions) && occasions.some((occ) => (p.occasions || []).map((o) => o.toLowerCase()).includes(occ.toLowerCase())));
          return catOk && codeOk && priceOk && occOk;
        }
        default:
          return true;
      }
    });
  }

  const resetCreateForm = () => {
    setForm({
      code: '',
      recipientName: '',
      discountType: 'PERCENT',
      discountValue: 10,
      maxDiscountInRupees: '',
      minOrderInRupees: '',
      minSpendMode: 'ELIGIBLE_ITEMS_ONLY',
      scopeType: 'ALL',
      applicableCategories: [],
      applicableProductCodes: [],
      applicableOccasions: [],
      minProductPriceInRupees: '',
      cartMixMode: 'ALLOW_MIXED',
      expiresAt: '',
      usageLimit: '',
    });
    setProductPickerSearch('');
    setError('');
  };

  const createCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    const couponCode = form.code.trim().toUpperCase();
    if (!couponCode) {
      setError('Coupon code is required.');
      setSaving(false);
      return;
    }

    if (form.scopeType === 'SPECIFIC_PRODUCTS' && form.applicableProductCodes.length === 0) {
      setError('Please select at least one handpicked product.');
      setSaving(false);
      return;
    }

    if (form.scopeType === 'CATEGORIES' && form.applicableCategories.length === 0) {
      setError('Please select at least one product category.');
      setSaving(false);
      return;
    }

    if (form.scopeType === 'OCCASION' && form.applicableOccasions.length === 0) {
      setError('Please select at least one festive occasion.');
      setSaving(false);
      return;
    }

    if (form.scopeType === 'PRICE_TIER' && (!form.minProductPriceInRupees || Number(form.minProductPriceInRupees) <= 0)) {
      setError('Please specify a minimum product price threshold.');
      setSaving(false);
      return;
    }

    const isSchemaCacheError = (msg?: string) => {
      if (!msg) return false;
      const lower = msg.toLowerCase();
      return (
        lower.includes('schema cache') ||
        lower.includes('applicable_categories') ||
        lower.includes('applicable_occasions') ||
        lower.includes('applicable_product_codes') ||
        lower.includes('scope_type') ||
        lower.includes('min_product_price_in_paise') ||
        lower.includes('min_spend_mode') ||
        lower.includes('cart_mix_mode')
      );
    };

    let { error: insertError } = await supabase.from('coupons').insert({
      code: couponCode,
      recipient_name: form.recipientName.trim(),
      discount_type: form.discountType,
      discount_value: form.discountType === 'PERCENT' ? Number(form.discountValue) : Math.round(Number(form.discountValue) * 100),
      max_discount_in_paise: form.maxDiscountInRupees ? Math.round(Number(form.maxDiscountInRupees) * 100) : null,
      min_order_in_paise: form.minOrderInRupees ? Math.round(Number(form.minOrderInRupees) * 100) : 0,
      min_spend_mode: form.minSpendMode,
      scope_type: form.scopeType,
      cart_mix_mode: form.cartMixMode,
      applicable_categories: form.applicableCategories,
      applicable_product_codes: form.applicableProductCodes,
      applicable_occasions: form.applicableOccasions,
      min_product_price_in_paise: form.minProductPriceInRupees ? Math.round(Number(form.minProductPriceInRupees) * 100) : 0,
      is_influencer: false,
      active: true,
      expires_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
    });

    // Graceful fallback: If the database is missing scoping columns and the coupon is store-wide (ALL), retry with baseline columns
    if (insertError && isSchemaCacheError(insertError.message) && form.scopeType === 'ALL') {
      const retryResult = await supabase.from('coupons').insert({
        code: couponCode,
        recipient_name: form.recipientName.trim(),
        discount_type: form.discountType,
        discount_value: form.discountType === 'PERCENT' ? Number(form.discountValue) : Math.round(Number(form.discountValue) * 100),
        max_discount_in_paise: form.maxDiscountInRupees ? Math.round(Number(form.maxDiscountInRupees) * 100) : null,
        min_order_in_paise: form.minOrderInRupees ? Math.round(Number(form.minOrderInRupees) * 100) : 0,
        is_influencer: false,
        active: true,
        expires_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
        usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
      });
      insertError = retryResult.error;
    }

    if (insertError) {
      if (isSchemaCacheError(insertError.message)) {
        setError(
          'Database migration required: The table "coupons" is missing the scoping columns in Supabase. Please run the migration SQL in Supabase Dashboard -> SQL Editor to enable category, occasion, and product filtering.'
        );
      } else {
        setError(insertError.message);
      }
    } else {
      logAudit({
        action: AUDIT_ACTIONS.COUPON_CREATED,
        entity: 'coupons',
        entity_id: couponCode,
        new_values: {
          code: couponCode,
          recipient_name: form.recipientName.trim(),
          discount_type: form.discountType,
          discount_value: form.discountValue,
          scope_type: form.scopeType,
          usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
        },
        reason: 'New scoped promotional coupon created',
      });
      resetCreateForm();
      setIsCreateDrawerOpen(false);
      await loadCoupons();
    }
    setSaving(false);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    const isPercent = coupon.discount_type !== 'FLAT';
    const discVal = isPercent
      ? (coupon.discount_percent || coupon.discount_value || 10)
      : Math.round((coupon.discount_value || 0) / 100);

    setEditForm({
      code: coupon.code,
      recipientName: coupon.recipient_name,
      discountType: coupon.discount_type || 'PERCENT',
      discountValue: discVal,
      maxDiscountInRupees: coupon.max_discount_in_paise ? String(coupon.max_discount_in_paise / 100) : '',
      minOrderInRupees: coupon.min_order_in_paise ? String(coupon.min_order_in_paise / 100) : '',
      minSpendMode: coupon.min_spend_mode || 'ELIGIBLE_ITEMS_ONLY',
      scopeType: coupon.scope_type || 'ALL',
      applicableCategories: coupon.applicable_categories || [],
      applicableProductCodes: coupon.applicable_product_codes || [],
      applicableOccasions: coupon.applicable_occasions || [],
      minProductPriceInRupees: coupon.min_product_price_in_paise ? String(coupon.min_product_price_in_paise / 100) : '',
      cartMixMode: (coupon.cart_mix_mode as any) || 'ALLOW_MIXED',
      expiresAt: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      usageLimit: coupon.usage_limit ? String(coupon.usage_limit) : '',
    });
    setProductPickerSearch('');
    setSelectedCoupon(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    setSaving(true);
    setError('');

    const newCode = editForm.code.trim().toUpperCase();

    if (editForm.scopeType === 'SPECIFIC_PRODUCTS' && editForm.applicableProductCodes.length === 0) {
      setError('Please select at least one handpicked product.');
      setSaving(false);
      return;
    }

    if (editForm.scopeType === 'CATEGORIES' && editForm.applicableCategories.length === 0) {
      setError('Please select at least one product category.');
      setSaving(false);
      return;
    }

    if (editForm.scopeType === 'OCCASION' && editForm.applicableOccasions.length === 0) {
      setError('Please select at least one festive occasion.');
      setSaving(false);
      return;
    }

    if (editForm.scopeType === 'PRICE_TIER' && (!editForm.minProductPriceInRupees || Number(editForm.minProductPriceInRupees) <= 0)) {
      setError('Please specify a minimum product price threshold.');
      setSaving(false);
      return;
    }

    let { error: updateError } = await supabase
      .from('coupons')
      .update({
        code: newCode,
        recipient_name: editForm.recipientName.trim(),
        discount_type: editForm.discountType,
        discount_value: editForm.discountType === 'PERCENT' ? Number(editForm.discountValue) : Math.round(Number(editForm.discountValue) * 100),
        max_discount_in_paise: editForm.maxDiscountInRupees ? Math.round(Number(editForm.maxDiscountInRupees) * 100) : null,
        min_order_in_paise: editForm.minOrderInRupees ? Math.round(Number(editForm.minOrderInRupees) * 100) : 0,
        min_spend_mode: editForm.minSpendMode,
        scope_type: editForm.scopeType,
        cart_mix_mode: editForm.cartMixMode,
        applicable_categories: editForm.applicableCategories,
        applicable_product_codes: editForm.applicableProductCodes,
        applicable_occasions: editForm.applicableOccasions,
        min_product_price_in_paise: editForm.minProductPriceInRupees ? Math.round(Number(editForm.minProductPriceInRupees) * 100) : 0,
        expires_at: editForm.expiresAt ? new Date(`${editForm.expiresAt}T23:59:59`).toISOString() : null,
        usage_limit: editForm.usageLimit ? Number(editForm.usageLimit) : null,
      })
      .eq('id', editingCoupon.id);

    // Graceful fallback: If the database is missing scoping columns and the coupon is store-wide (ALL), retry with baseline columns
    if (updateError && isSchemaCacheError(updateError.message) && editForm.scopeType === 'ALL') {
      const retryResult = await supabase
        .from('coupons')
        .update({
          code: newCode,
          recipient_name: editForm.recipientName.trim(),
          discount_type: editForm.discountType,
          discount_value: editForm.discountType === 'PERCENT' ? Number(editForm.discountValue) : Math.round(Number(editForm.discountValue) * 100),
          max_discount_in_paise: editForm.maxDiscountInRupees ? Math.round(Number(editForm.maxDiscountInRupees) * 100) : null,
          min_order_in_paise: editForm.minOrderInRupees ? Math.round(Number(editForm.minOrderInRupees) * 100) : 0,
          expires_at: editForm.expiresAt ? new Date(`${editForm.expiresAt}T23:59:59`).toISOString() : null,
          usage_limit: editForm.usageLimit ? Number(editForm.usageLimit) : null,
        })
        .eq('id', editingCoupon.id);
      updateError = retryResult.error;
    }

    if (updateError) {
      if (isSchemaCacheError(updateError.message)) {
        setError(
          'Database migration required: The table "coupons" is missing the scoping columns in Supabase. Please run the migration SQL in Supabase Dashboard -> SQL Editor to enable category, occasion, and product filtering.'
        );
      } else {
        setError(updateError.message);
      }
    } else {
      logAudit({
        action: AUDIT_ACTIONS.COUPON_RATE_MODIFIED,
        entity: 'coupons',
        entity_id: newCode,
        old_values: editingCoupon,
        new_values: {
          code: newCode,
          recipient_name: editForm.recipientName.trim(),
          scope_type: editForm.scopeType,
        },
        reason: `Promotional coupon updated with scope rules: ${editForm.scopeType}`,
      });
      setEditingCoupon(null);
      await loadCoupons();
    }
    setSaving(false);
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    const target = coupons.find((c) => c.id === id);
    const { error: deleteError } = await supabase.from('coupons').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      logAudit({
        action: AUDIT_ACTIONS.COUPON_RATE_MODIFIED,
        entity: 'coupons',
        entity_id: target?.code || id,
        old_values: target || null,
        new_values: { active: false, deleted: true },
        reason: 'Coupon deleted from admin workbench',
      });
      setCoupons((current) => current.filter((coupon) => coupon.id !== id));
      if (selectedCoupon?.id === id) {
        setSelectedCoupon(null);
      }
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    const { error: updateError } = await supabase
      .from('coupons')
      .update({ active: !coupon.active })
      .eq('id', coupon.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setCoupons((current) =>
        current.map((item) => (item.id === coupon.id ? { ...item, active: !item.active } : item))
      );
      if (selectedCoupon?.id === coupon.id) {
        setSelectedCoupon({ ...coupon, active: !coupon.active });
      }
    }
  };

  const filteredCoupons = coupons.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.code.toLowerCase().includes(q) ||
      (c.recipient_name && c.recipient_name.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (activeTab === 'ACTIVE') return c.active;
    if (activeTab === 'INACTIVE') return !c.active;
    return true;
  });

  const totalCoupons = coupons.length;
  const activeCount = coupons.filter((c) => c.active).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usage_count || 0), 0);

  // Render a friendly scope badge
  const renderScopeBadge = (coupon: Coupon) => {
    const scope = coupon.scope_type || 'ALL';
    const isExclusive = coupon.cart_mix_mode === 'STRICT_EXCLUSIVE';

    const scopeBadge = (() => {
      switch (scope) {
        case 'ALL':
          return <span className="px-2 py-0.5 rounded text-[11px] bg-canvas border border-canvas-line text-ink-light">🌐 All Products</span>;
        case 'CATEGORIES': {
          const count = coupon.applicable_categories?.length || 0;
          return <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200">💐 {count} {count === 1 ? 'Category' : 'Categories'}</span>;
        }
        case 'SPECIFIC_PRODUCTS': {
          const count = coupon.applicable_product_codes?.length || 0;
          return <span className="px-2 py-0.5 rounded text-[11px] bg-rose/10 text-rose-deep border border-rose/30">🎯 {count} {count === 1 ? 'Product' : 'Products'}</span>;
        }
        case 'PRICE_TIER': {
          const minPrice = coupon.min_product_price_in_paise ? (coupon.min_product_price_in_paise / 100).toLocaleString('en-IN') : '0';
          return <span className="px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-800 border border-amber-200">💎 ≥ ₹{minPrice}</span>;
        }
        case 'OCCASION': {
          const count = coupon.applicable_occasions?.length || 0;
          return <span className="px-2 py-0.5 rounded text-[11px] bg-purple-50 text-purple-800 border border-purple-200">🎊 {coupon.applicable_occasions?.[0] || 'Festive'} {count > 1 ? `+${count - 1}` : ''}</span>;
        }
        case 'CUSTOM_COMPOUND':
          return <span className="px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200">⚙️ Compound Rule</span>;
        default:
          return <span className="px-2 py-0.5 rounded text-[11px] bg-canvas border border-canvas-line text-ink-light">🌐 All</span>;
      }
    })();

    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {scopeBadge}
        {scope !== 'ALL' && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${
              isExclusive
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-canvas text-ink-light border-canvas-line'
            }`}
          >
            {isExclusive ? (
              <>
                <Lock size={10} className="text-amber-700" /> Exclusive
              </>
            ) : (
              <>
                <ShoppingCart size={10} className="text-forest" /> Mixed Ok
              </>
            )}
          </span>
        )}
      </div>
    );
  };

  /**
   * Reusable Scope Builder Form Component
   */
  const renderScopeBuilder = (
    currentForm: typeof form,
    setFormData: (updated: any) => void,
    matchingProducts: CatalogProduct[]
  ) => {
    return (
      <div className="space-y-5 pt-3 border-t border-canvas-line">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-bark flex items-center gap-1.5">
            <Layers size={14} className="text-rose" /> Eligibility Scope & Filters
          </label>
          <span className="text-[11px] text-ink-light">Zero-bleed targeting</span>
        </div>

        {/* Scope Type Selector Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SCOPE_TYPE_OPTIONS.map((opt) => {
            const isSelected = currentForm.scopeType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFormData({ ...currentForm, scopeType: opt.id })}
                className={`p-2.5 rounded-sm border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-bark bg-bark/5 text-bark shadow-xs'
                    : 'border-canvas-line bg-white hover:border-canvas-line-hover text-ink-light'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{opt.icon}</span>
                  <span className="text-xs font-semibold text-bark">{opt.label}</span>
                </div>
                <p className="text-[10px] text-ink-light leading-snug">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Conditional Category Filter */}
        {(currentForm.scopeType === 'CATEGORIES' || currentForm.scopeType === 'CUSTOM_COMPOUND') && (
          <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-2">
            <label className="text-xs font-semibold text-bark block">
              Select Eligible Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const isChecked = currentForm.applicableCategories.includes(cat.slug);
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => {
                      const next = isChecked
                        ? currentForm.applicableCategories.filter((c) => c !== cat.slug)
                        : [...currentForm.applicableCategories, cat.slug];
                      setFormData({ ...currentForm, applicableCategories: next });
                    }}
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      isChecked
                        ? 'bg-bark text-linen border-bark'
                        : 'bg-white text-ink border-canvas-line hover:border-canvas-line-hover'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {isChecked && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Conditional Specific Product Picker */}
        {(currentForm.scopeType === 'SPECIFIC_PRODUCTS' || currentForm.scopeType === 'CUSTOM_COMPOUND') && (
          <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-bark">
                Handpicked Eligible Products ({currentForm.applicableProductCodes.length} selected)
              </label>
            </div>

            {/* Selected Chips */}
            {currentForm.applicableProductCodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white border border-canvas-line rounded-sm">
                {currentForm.applicableProductCodes.map((code) => {
                  const prod = catalogProducts.find((p) => p.code.toUpperCase() === code.toUpperCase());
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-canvas border border-canvas-line text-bark"
                    >
                      <strong>{code}</strong> {prod ? `(${prod.name})` : ''}
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...currentForm,
                            applicableProductCodes: currentForm.applicableProductCodes.filter((c) => c !== code),
                          })
                        }
                        className="text-rose hover:text-rose-deep ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Search and Product List */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-ink-light" />
              <input
                type="text"
                placeholder="Search products by title or SKU code..."
                value={productPickerSearch}
                onChange={(e) => setProductPickerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-canvas-line bg-white border border-canvas-line rounded-sm">
              {catalogProducts
                .filter((p) => {
                  const q = productPickerSearch.toLowerCase().trim();
                  return !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
                })
                .map((prod) => {
                  const isSelected = currentForm.applicableProductCodes.some(
                    (c) => c.toUpperCase() === prod.code.toUpperCase()
                  );
                  return (
                    <button
                      key={prod.id || prod.code}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? currentForm.applicableProductCodes.filter((c) => c.toUpperCase() !== prod.code.toUpperCase())
                          : [...currentForm.applicableProductCodes, prod.code];
                        setFormData({ ...currentForm, applicableProductCodes: next });
                      }}
                      className={`w-full p-2 text-left flex items-center justify-between text-xs transition-colors hover:bg-canvas/40 ${
                        isSelected ? 'bg-rose/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {prod.images?.[0] ? (
                          <img src={prod.images[0]} alt="" className="w-7 h-7 object-cover rounded-xs" />
                        ) : (
                          <div className="w-7 h-7 bg-canvas rounded-xs flex items-center justify-center text-[10px]">🌸</div>
                        )}
                        <div>
                          <p className="font-semibold text-bark leading-tight">{prod.name}</p>
                          <span className="text-[10px] font-mono text-ink-light">{prod.code}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-bark">₹{(prod.price_in_paise / 100).toLocaleString('en-IN')}</span>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-bark border-bark text-linen' : 'border-canvas-line'
                          }`}
                        >
                          {isSelected && <Check size={11} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Conditional Price Tier Filter */}
        {(currentForm.scopeType === 'PRICE_TIER' || currentForm.scopeType === 'CUSTOM_COMPOUND') && (
          <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-2">
            <label className="text-xs font-semibold text-bark block">
              Minimum Product Price Threshold (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-ink-light">₹</span>
              <input
                type="number"
                min="0"
                placeholder="e.g. 999 (Only pieces priced ₹999+ qualify)"
                value={currentForm.minProductPriceInRupees}
                onChange={(e) => setFormData({ ...currentForm, minProductPriceInRupees: e.target.value })}
                className="w-full pl-7 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
              />
            </div>
            <p className="text-[11px] text-ink-light">
              Protects low-value accessories, gift add-ons, and single stems from being discounted.
            </p>
          </div>
        )}

        {/* Conditional Occasion Filter */}
        {(currentForm.scopeType === 'OCCASION' || currentForm.scopeType === 'CUSTOM_COMPOUND') && (
          <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-2">
            <label className="text-xs font-semibold text-bark block">
              Select Festive Occasions
            </label>
            <div className="flex flex-wrap gap-2">
              {OCCASION_OPTIONS.map((occ) => {
                const isChecked = currentForm.applicableOccasions.includes(occ.slug);
                return (
                  <button
                    key={occ.slug}
                    type="button"
                    onClick={() => {
                      const next = isChecked
                        ? currentForm.applicableOccasions.filter((o) => o !== occ.slug)
                        : [...currentForm.applicableOccasions, occ.slug];
                      setFormData({ ...currentForm, applicableOccasions: next });
                    }}
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      isChecked
                        ? 'bg-purple-900 text-linen border-purple-900'
                        : 'bg-white text-ink border-canvas-line hover:border-canvas-line-hover'
                    }`}
                  >
                    <span>{occ.emoji}</span>
                    <span>{occ.label}</span>
                    {isChecked && <Check size={12} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Minimum Spend & Anti-Padding Guard */}
        <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-bark block">
              Minimum Spend Requirement (Optional ₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-ink-light">₹</span>
              <input
                type="number"
                min="0"
                placeholder="0 (No minimum order required)"
                value={currentForm.minOrderInRupees}
                onChange={(e) => setFormData({ ...currentForm, minOrderInRupees: e.target.value })}
                className="w-full pl-7 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
              />
            </div>
          </div>

          {Number(currentForm.minOrderInRupees) > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-canvas-line">
              <label className="text-[11px] font-semibold text-bark uppercase tracking-wider">
                Minimum Spend Target Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <label className="flex items-start gap-2 p-2 bg-white rounded-sm border border-canvas-line cursor-pointer">
                  <input
                    type="radio"
                    name={`minSpendMode-${currentForm === form ? 'create' : 'edit'}`}
                    checked={currentForm.minSpendMode === 'ELIGIBLE_ITEMS_ONLY'}
                    onChange={() => setFormData({ ...currentForm, minSpendMode: 'ELIGIBLE_ITEMS_ONLY' })}
                    className="mt-0.5 text-bark"
                  />
                  <div>
                    <span className="font-semibold text-bark block">Eligible Items Subtotal</span>
                    <span className="text-[10px] text-ink-light leading-snug block">
                      Safest: Qualifying pieces alone must reach threshold. Defeats cart padding.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2 bg-white rounded-sm border border-canvas-line cursor-pointer">
                  <input
                    type="radio"
                    name={`minSpendMode-${currentForm === form ? 'create' : 'edit'}`}
                    checked={currentForm.minSpendMode === 'CART_TOTAL'}
                    onChange={() => setFormData({ ...currentForm, minSpendMode: 'CART_TOTAL' })}
                    className="mt-0.5 text-bark"
                  />
                  <div>
                    <span className="font-semibold text-bark block">Entire Cart Total</span>
                    <span className="text-[10px] text-ink-light leading-snug block">
                      Any products in cart reaching threshold unlock the discount.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Basket Compatibility / Exclusivity Mode */}
        <div className="p-3.5 bg-canvas/30 rounded-sm border border-canvas-line space-y-2">
          <label className="text-xs font-semibold text-bark block">
            Basket Compatibility Mode
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <label className="flex items-start gap-2 p-2.5 bg-white rounded-sm border border-canvas-line cursor-pointer transition-colors hover:border-canvas-line-hover">
              <input
                type="radio"
                name={`cartMixMode-${currentForm === form ? 'create' : 'edit'}`}
                checked={currentForm.cartMixMode !== 'STRICT_EXCLUSIVE'}
                onChange={() => setFormData({ ...currentForm, cartMixMode: 'ALLOW_MIXED' })}
                className="mt-0.5 text-bark"
              />
              <div>
                <span className="font-semibold text-bark flex items-center gap-1.5">
                  <ShoppingCart size={13} className="text-emerald-700" /> Allow Mixed Cart
                </span>
                <span className="text-[10px] text-ink-light leading-snug block mt-0.5">
                  Qualifying items get the discount; other non-eligible items pay normal full price.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2 p-2.5 bg-white rounded-sm border border-canvas-line cursor-pointer transition-colors hover:border-canvas-line-hover">
              <input
                type="radio"
                name={`cartMixMode-${currentForm === form ? 'create' : 'edit'}`}
                checked={currentForm.cartMixMode === 'STRICT_EXCLUSIVE'}
                onChange={() => setFormData({ ...currentForm, cartMixMode: 'STRICT_EXCLUSIVE' })}
                className="mt-0.5 text-bark"
              />
              <div>
                <span className="font-semibold text-bark flex items-center gap-1.5">
                  <Lock size={13} className="text-amber-700" /> Strict Basket Exclusivity
                </span>
                <span className="text-[10px] text-ink-light leading-snug block mt-0.5">
                  Cart must contain ONLY qualifying items. Blocked if mixed with any other items.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Live Catalog Impact Preview */}
        <div className="p-3 bg-white rounded-sm border border-canvas-line space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-bark flex items-center gap-1.5">
              <Sparkles size={13} className="text-rose" /> Live Catalog Preview
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                matchingProducts.length > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {matchingProducts.length} {matchingProducts.length === 1 ? 'Product' : 'Products'} Match
            </span>
          </div>

          {matchingProducts.length > 0 ? (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {matchingProducts.slice(0, 15).map((p) => (
                <span
                  key={p.code}
                  className="px-2 py-0.5 bg-canvas/40 text-[10px] text-bark rounded-xs border border-canvas-line font-mono"
                >
                  {p.code}
                </span>
              ))}
              {matchingProducts.length > 15 && (
                <span className="px-2 py-0.5 text-[10px] text-ink-light">
                  +{matchingProducts.length - 15} more
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-amber-700 flex items-center gap-1.5">
              <AlertCircle size={13} />
              No active products match your configured criteria. Please adjust filters.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout activePage="coupons">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Studio Offers & Loyalty"
          title="Coupons & Scoped Promotions"
          subtitle="Create transparent, occasion-specific discounts, category scopes, and tamper-proof coupon rules."
          stats={[
            {
              label: 'Total Coupons',
              value: totalCoupons,
              icon: <Ticket size={18} />,
              subtext: 'Configured discounts',
            },
            {
              label: 'Active Campaigns',
              value: activeCount,
              icon: <CheckCircle2 size={18} className="text-emerald-700" />,
              subtext: 'Currently redeemable',
            },
            {
              label: 'Total Redemptions',
              value: totalRedemptions,
              icon: <TrendingUp size={18} className="text-rose" />,
              subtext: 'Checkout redemptions',
            },
          ]}
          primaryAction={{
            label: 'Create Coupon',
            icon: <Plus size={14} />,
            onClick: () => {
              resetCreateForm();
              setIsCreateDrawerOpen(true);
            },
          }}
        />

        {/* Standardized View Toolbar */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search coupon code, recipient name..."
          tabs={[
            { id: 'ALL', label: 'All Coupons', count: totalCoupons },
            { id: 'ACTIVE', label: 'Active', count: activeCount },
            { id: 'INACTIVE', label: 'Inactive', count: totalCoupons - activeCount },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table', 'grid']}
          onRefresh={loadCoupons}
          isRefreshing={loading}
        />

        {/* Content Views: Table vs Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 bg-linen rounded-sm border border-canvas-line shadow-soft">
            <Loader2 size={28} className="animate-spin text-rose" />
            <p className="text-xs text-ink-light">Fetching promotional coupons...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-linen rounded-sm border border-canvas-line shadow-soft">
            <Ticket size={36} className="mx-auto text-rose/50" />
            <h3 className="heading-serif text-xl text-bark">No Coupons Found</h3>
            <p className="text-xs text-ink-light max-w-sm mx-auto">
              Create bespoke promo codes for VIP patrons, campaigns, or festive celebrations.
            </p>
            <button
              onClick={() => {
                resetCreateForm();
                setIsCreateDrawerOpen(true);
              }}
              className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs font-medium rounded-sm inline-flex items-center gap-2"
            >
              <Plus size={14} /> Create First Coupon
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCoupons.map((coupon) => {
              const isFlat = coupon.discount_type === 'FLAT';
              const discountDisplay = isFlat
                ? `₹${Math.round((coupon.discount_value || 0) / 100)} FLAT`
                : `${coupon.discount_percent || coupon.discount_value || 0}% OFF`;

              return (
                <div
                  key={coupon.id}
                  className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft hover:border-canvas-line-hover transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded bg-canvas border border-canvas-line font-mono font-bold text-sm text-bark">
                        {coupon.code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          coupon.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {coupon.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-serif font-bold text-xl text-bark">
                        {discountDisplay}
                      </h4>
                      <p className="text-xs text-ink-light mt-0.5">
                        For: <strong className="text-bark">{coupon.recipient_name}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderScopeBadge(coupon)}
                    </div>

                    <div className="bg-canvas/40 p-3 rounded-sm space-y-1 text-xs text-ink-light">
                      <div className="flex justify-between">
                        <span>Redemptions</span>
                        <span className="font-mono font-medium text-bark">
                          {coupon.usage_count}
                          {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ' (Unlimited)'}
                        </span>
                      </div>
                      {coupon.min_order_in_paise && coupon.min_order_in_paise > 0 ? (
                        <div className="flex justify-between">
                          <span>Min Spend</span>
                          <span className="font-mono text-bark">₹{coupon.min_order_in_paise / 100}</span>
                        </div>
                      ) : null}
                      {coupon.expires_at && (
                        <div className="flex justify-between">
                          <span>Expires</span>
                          <span>{new Date(coupon.expires_at).toLocaleDateString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-canvas-line flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleCoupon(coupon)}
                      className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                        coupon.active
                          ? 'bg-canvas hover:bg-canvas-line text-ink-light'
                          : 'bg-emerald-700 text-linen hover:bg-emerald-800'
                      }`}
                    >
                      {coupon.active ? 'Deactivate' : 'Activate'}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(coupon)}
                      className="px-2.5 py-1.5 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm border border-canvas-line transition-all flex items-center gap-1"
                      title="Edit coupon"
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => setSelectedCoupon(coupon)}
                      className="px-3 py-1.5 bg-canvas hover:bg-bark hover:text-linen text-bark text-xs font-medium rounded-sm border border-canvas-line transition-all flex items-center gap-1"
                    >
                      Inspect
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <section className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-canvas/60 text-bark font-mono uppercase tracking-wider border-b border-canvas-line">
                  <tr>
                    <th className="p-4">Coupon Code</th>
                    <th className="p-4">Recipient / Campaign</th>
                    <th className="p-4 text-center">Discount</th>
                    <th className="p-4">Scope & Targeting</th>
                    <th className="p-4 text-center">Usage Count</th>
                    <th className="p-4">Expires</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-line bg-parchment/20">
                  {filteredCoupons.map((coupon) => {
                    const isFlat = coupon.discount_type === 'FLAT';
                    const discountDisplay = isFlat
                      ? `₹${Math.round((coupon.discount_value || 0) / 100)}`
                      : `${coupon.discount_percent || coupon.discount_value || 0}%`;

                    return (
                      <tr key={coupon.id} className="hover:bg-canvas/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-bark text-sm">
                          {coupon.code}
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-bark">{coupon.recipient_name}</p>
                        </td>
                        <td className="p-4 text-center font-serif font-bold text-rose text-sm">
                          {discountDisplay}
                        </td>
                        <td className="p-4">
                          {renderScopeBadge(coupon)}
                        </td>
                        <td className="p-4 text-center font-mono text-ink">
                          {coupon.usage_count}
                          {coupon.usage_limit ? ` of ${coupon.usage_limit}` : ' (No limit)'}
                        </td>
                        <td className="p-4 text-ink-light">
                          {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('en-IN') : 'Never'}
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              coupon.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {coupon.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => toggleCoupon(coupon)}
                              className={`p-1.5 rounded-sm transition-colors ${
                                coupon.active
                                  ? 'text-ink-light hover:text-ink hover:bg-canvas'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={coupon.active ? 'Deactivate' : 'Activate'}
                            >
                              {coupon.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                            </button>
                            <button
                              onClick={() => handleOpenEdit(coupon)}
                              className="p-1.5 text-bark hover:bg-canvas rounded-sm transition-colors"
                              title="Edit coupon"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setSelectedCoupon(coupon)}
                              className="p-1.5 text-bark hover:bg-canvas rounded-sm transition-colors"
                              title="Inspect details"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Create Coupon Drawer */}
        <AdminEntityDrawer
          isOpen={isCreateDrawerOpen}
          onClose={() => setIsCreateDrawerOpen(false)}
          title="Create Coupon"
          subtitle="Configure targeted promo code with zero-bleed scoping rules"
          widthClass="max-w-2xl"
        >
          <form onSubmit={createCoupon} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Coupon Code *
                </label>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. DIWALI20"
                  className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono font-bold text-bark focus:outline-none focus:border-bark"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Promotion / Recipient Name *
                </label>
                <input
                  required
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                  placeholder="e.g. Diwali Festive Bouquet Promo"
                  className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            {/* Discount Type Toggle */}
            <div className="p-3 bg-canvas/30 rounded-sm border border-canvas-line space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Discount Value & Type
                </label>
                <div className="flex bg-white rounded-sm border border-canvas-line p-0.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discountType: 'PERCENT' })}
                    className={`px-3 py-1 text-xs font-medium rounded-xs flex items-center gap-1 ${
                      form.discountType === 'PERCENT'
                        ? 'bg-bark text-linen'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    <Percent size={12} /> Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, discountType: 'FLAT' })}
                    className={`px-3 py-1 text-xs font-medium rounded-xs flex items-center gap-1 ${
                      form.discountType === 'FLAT'
                        ? 'bg-bark text-linen'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    <IndianRupee size={12} /> Flat Amount (₹)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-ink-light block">
                    {form.discountType === 'PERCENT' ? 'Discount Percentage (%)' : 'Flat Discount (₹)'}
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max={form.discountType === 'PERCENT' ? 100 : undefined}
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                {form.discountType === 'PERCENT' && (
                  <div className="space-y-1">
                    <label className="text-xs text-ink-light block">
                      Max Discount Cap (Optional ₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500 (No cap if blank)"
                      value={form.maxDiscountInRupees}
                      onChange={(e) => setForm({ ...form, maxDiscountInRupees: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Scope Builder */}
            {renderScopeBuilder(form, setForm, createMatchingProducts)}

            {/* Limits and Expiry */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-canvas-line">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Usage Limit (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder="Unlimited if blank"
                  className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose/10 border border-rose/30 rounded text-xs text-rose leading-relaxed flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-canvas-line">
              <button
                type="button"
                onClick={() => setIsCreateDrawerOpen(false)}
                className="px-4 py-2 text-xs text-ink-light hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-bark text-linen hover:bg-rose-deep text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-2 shadow-soft disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Save Coupon
              </button>
            </div>
          </form>
        </AdminEntityDrawer>

        {/* Edit Coupon Drawer */}
        <AdminEntityDrawer
          isOpen={!!editingCoupon}
          onClose={() => setEditingCoupon(null)}
          title={`Edit Coupon: ${editingCoupon?.code || ''}`}
          subtitle="Update promotional parameters, category scopes, or festive conditions"
          widthClass="max-w-2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Coupon Code *
                </label>
                <input
                  required
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono font-bold tracking-wider text-bark focus:outline-none focus:border-bark"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Promotion / Recipient Name *
                </label>
                <input
                  required
                  value={editForm.recipientName}
                  onChange={(e) => setEditForm({ ...editForm, recipientName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            {/* Discount Type Toggle */}
            <div className="p-3 bg-canvas/30 rounded-sm border border-canvas-line space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Discount Value & Type
                </label>
                <div className="flex bg-white rounded-sm border border-canvas-line p-0.5">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, discountType: 'PERCENT' })}
                    className={`px-3 py-1 text-xs font-medium rounded-xs flex items-center gap-1 ${
                      editForm.discountType === 'PERCENT'
                        ? 'bg-bark text-linen'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    <Percent size={12} /> Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, discountType: 'FLAT' })}
                    className={`px-3 py-1 text-xs font-medium rounded-xs flex items-center gap-1 ${
                      editForm.discountType === 'FLAT'
                        ? 'bg-bark text-linen'
                        : 'text-ink-light hover:text-ink'
                    }`}
                  >
                    <IndianRupee size={12} /> Flat Amount (₹)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-ink-light block">
                    {editForm.discountType === 'PERCENT' ? 'Discount Percentage (%)' : 'Flat Discount (₹)'}
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max={editForm.discountType === 'PERCENT' ? 100 : undefined}
                    value={editForm.discountValue}
                    onChange={(e) => setEditForm({ ...editForm, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                {editForm.discountType === 'PERCENT' && (
                  <div className="space-y-1">
                    <label className="text-xs text-ink-light block">
                      Max Discount Cap (Optional ₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 500 (No cap if blank)"
                      value={editForm.maxDiscountInRupees}
                      onChange={(e) => setEditForm({ ...editForm, maxDiscountInRupees: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Scope Builder */}
            {renderScopeBuilder(editForm, setEditForm, editMatchingProducts)}

            {/* Limits and Expiry */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-canvas-line">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Usage Limit (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={editForm.usageLimit}
                  onChange={(e) => setEditForm({ ...editForm, usageLimit: e.target.value })}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={editForm.expiresAt}
                  onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose/10 border border-rose/30 rounded text-xs text-rose leading-relaxed flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-canvas-line">
              <button
                type="button"
                onClick={() => setEditingCoupon(null)}
                className="px-4 py-2 border border-canvas-line text-xs font-medium text-bark rounded-sm hover:bg-canvas/30"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-bark text-linen hover:bg-rose-deep text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-2 shadow-soft disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Update Coupon
              </button>
            </div>
          </form>
        </AdminEntityDrawer>

        {/* Coupon Detail Inspector Drawer */}
        <AdminEntityDrawer
          isOpen={!!selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
          title={selectedCoupon ? selectedCoupon.code : ''}
          subtitle={selectedCoupon ? `Created for ${selectedCoupon.recipient_name}` : ''}
          badge={
            selectedCoupon && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedCoupon.active
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {selectedCoupon.active ? 'Active' : 'Inactive'}
              </span>
            )
          }
          widthClass="max-w-xl"
          footerActions={
            selectedCoupon && (
              <div className="flex items-center justify-between w-full">
                <button
                  type="button"
                  onClick={() => deleteCoupon(selectedCoupon.id)}
                  className="px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Coupon
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedCoupon)}
                    className="px-3.5 py-2 text-xs font-semibold text-bark hover:bg-canvas-line/50 border border-canvas-line rounded-sm transition-colors flex items-center gap-1.5"
                  >
                    <Edit2 size={13} /> Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCoupon(selectedCoupon)}
                    className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-semibold rounded-sm transition-colors"
                  >
                    {selectedCoupon.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          }
        >
          {selectedCoupon && (
            <div className="space-y-6">
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Discount Value</span>
                  <span className="font-serif text-xl font-bold text-rose">
                    {selectedCoupon.discount_type === 'FLAT'
                      ? `Flat ₹${Math.round((selectedCoupon.discount_value || 0) / 100)} OFF`
                      : `${selectedCoupon.discount_percent || selectedCoupon.discount_value || 0}% OFF`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-light">Recipient / Campaign</span>
                  <strong className="text-bark">{selectedCoupon.recipient_name}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Eligibility Scope</span>
                  <div>{renderScopeBadge(selectedCoupon)}</div>
                </div>
                {selectedCoupon.applicable_categories && selectedCoupon.applicable_categories.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Categories</span>
                    <span className="font-medium text-bark capitalize">
                      {selectedCoupon.applicable_categories.join(', ')}
                    </span>
                  </div>
                )}
                {selectedCoupon.applicable_product_codes && selectedCoupon.applicable_product_codes.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Handpicked Products</span>
                    <span className="font-mono text-bark">
                      {selectedCoupon.applicable_product_codes.join(', ')}
                    </span>
                  </div>
                )}
                {selectedCoupon.applicable_occasions && selectedCoupon.applicable_occasions.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Occasions</span>
                    <span className="font-medium text-bark capitalize">
                      {selectedCoupon.applicable_occasions.join(', ')}
                    </span>
                  </div>
                )}
                {selectedCoupon.min_product_price_in_paise && selectedCoupon.min_product_price_in_paise > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Min Product Price</span>
                    <span className="font-mono text-bark">≥ ₹{selectedCoupon.min_product_price_in_paise / 100}</span>
                  </div>
                ) : null}
                {selectedCoupon.min_order_in_paise && selectedCoupon.min_order_in_paise > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Minimum Order</span>
                    <span className="font-mono text-bark">
                      ₹{selectedCoupon.min_order_in_paise / 100}{' '}
                      <span className="text-[10px] text-ink-light">
                        ({selectedCoupon.min_spend_mode === 'CART_TOTAL' ? 'Cart Total' : 'Eligible Items'})
                      </span>
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-ink-light">Times Redeemed</span>
                  <span className="font-mono text-bark font-bold">{selectedCoupon.usage_count}</span>
                </div>
                {selectedCoupon.usage_limit && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Usage Ceiling</span>
                    <span className="font-mono text-bark">{selectedCoupon.usage_limit}</span>
                  </div>
                )}
                {selectedCoupon.expires_at && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Valid Until</span>
                    <span>{new Date(selectedCoupon.expires_at).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </AdminEntityDrawer>
      </main>
    </AdminLayout>
  );
}
