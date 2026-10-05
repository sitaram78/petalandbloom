import { useEffect, useState } from 'react';
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
  discount_percent: number;
  discount_value?: number;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  active: boolean;
  is_influencer?: boolean;
  created_at?: string;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  const [form, setForm] = useState({
    code: '',
    recipientName: '',
    discountPercent: 10,
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

  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editForm, setEditForm] = useState({
    code: '',
    recipientName: '',
    discountPercent: 10,
    expiresAt: '',
    usageLimit: '',
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
      // Exclude creator/influencer coupons (is_influencer === true) from promotional coupons list
      const promotionalOnly = (data || []).filter((c: any) => !c.is_influencer);
      const mapped = promotionalOnly.map((c: any) => ({
        ...c,
        discount_percent: c.discount_percent ?? c.discount_value ?? 0,
      }));
      setCoupons(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const createCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const couponCode = form.code.trim().toUpperCase();
    const { error: insertError } = await supabase.from('coupons').insert({
      code: couponCode,
      recipient_name: form.recipientName.trim(),
      discount_type: 'PERCENT',
      discount_value: form.discountPercent,
      is_influencer: false,
      min_order_in_paise: 0,
      active: true,
      expires_at: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      logAudit({
        action: AUDIT_ACTIONS.COUPON_CREATED,
        entity: 'coupons',
        entity_id: couponCode,
        new_values: {
          code: couponCode,
          recipient_name: form.recipientName.trim(),
          discount_percent: form.discountPercent,
          usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
        },
        reason: 'New promotional coupon created',
      });
      setForm({ code: '', recipientName: '', discountPercent: 10, expiresAt: '', usageLimit: '' });
      setIsCreateDrawerOpen(false);
      await loadCoupons();
    }
    setSaving(false);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setEditForm({
      code: coupon.code,
      recipientName: coupon.recipient_name,
      discountPercent: coupon.discount_percent || (coupon as any).discount_value || 10,
      expiresAt: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      usageLimit: coupon.usage_limit ? String(coupon.usage_limit) : '',
    });
    setSelectedCoupon(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon) return;
    setSaving(true);
    setError('');

    const newCode = editForm.code.trim().toUpperCase();
    const { error: updateError } = await supabase
      .from('coupons')
      .update({
        code: newCode,
        recipient_name: editForm.recipientName.trim(),
        discount_value: editForm.discountPercent,
        expires_at: editForm.expiresAt ? new Date(`${editForm.expiresAt}T23:59:59`).toISOString() : null,
        usage_limit: editForm.usageLimit ? Number(editForm.usageLimit) : null,
      })
      .eq('id', editingCoupon.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      logAudit({
        action: AUDIT_ACTIONS.COUPON_RATE_MODIFIED,
        entity: 'coupons',
        entity_id: newCode,
        old_values: editingCoupon,
        new_values: {
          code: newCode,
          recipient_name: editForm.recipientName.trim(),
          discount_value: editForm.discountPercent,
        },
        reason: `Promotional coupon updated from ${editingCoupon.code} to ${newCode}`,
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

  return (
    <AdminLayout activePage="coupons">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Studio Offers & Loyalty"
          title="Coupons & Promotions"
          subtitle="Create transparent, recipient-specific discounts and tracked promo codes for checkout."
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
            onClick: () => setIsCreateDrawerOpen(true),
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
              Create bespoke promo codes for VIP patrons, campaigns, or creator partners.
            </p>
            <button
              onClick={() => setIsCreateDrawerOpen(true)}
              className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs font-medium rounded-sm inline-flex items-center gap-2"
            >
              <Plus size={14} /> Create First Coupon
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCoupons.map((coupon) => {
              const discountVal = coupon.discount_percent || (coupon as any).discount_value || 0;
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
                        {discountVal}% OFF
                      </h4>
                      <p className="text-xs text-ink-light mt-0.5">
                        For: <strong className="text-bark">{coupon.recipient_name}</strong>
                      </p>
                    </div>

                    <div className="bg-canvas/40 p-3 rounded-sm space-y-1 text-xs text-ink-light">
                      <div className="flex justify-between">
                        <span>Redemptions</span>
                        <span className="font-mono font-medium text-bark">
                          {coupon.usage_count}
                          {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ' (Unlimited)'}
                        </span>
                      </div>
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
                    <th className="p-4 text-center">Usage Count</th>
                    <th className="p-4">Expires</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-line bg-parchment/20">
                  {filteredCoupons.map((coupon) => {
                    const discountVal = coupon.discount_percent || (coupon as any).discount_value || 0;
                    return (
                      <tr key={coupon.id} className="hover:bg-canvas/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-bark text-sm">
                          {coupon.code}
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-bark">{coupon.recipient_name}</p>
                        </td>
                        <td className="p-4 text-center font-serif font-bold text-rose text-sm">
                          {discountVal}%
                        </td>
                        <td className="p-4 text-center font-mono text-ink">
                          {coupon.usage_count}
                          {coupon.usage_limit ? ` of ${coupon.usage_limit}` : ' (No limit)'}
                        </td>
                        <td className="p-4 text-ink-light">
                          {coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('en-IN') : 'Never'}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => toggleCoupon(coupon)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                              coupon.active
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {coupon.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(coupon)}
                              className="px-2.5 py-1 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm transition-colors flex items-center gap-1"
                              title="Edit coupon"
                            >
                              <Edit2 size={11} />
                              Edit
                            </button>
                            <button
                              onClick={() => setSelectedCoupon(coupon)}
                              className="px-2.5 py-1 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm transition-colors"
                            >
                              Inspect
                            </button>
                            <button
                              onClick={() => deleteCoupon(coupon.id)}
                              className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-sm transition-colors"
                              title="Delete coupon"
                            >
                              <Trash2 size={14} />
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
          subtitle="Generate bespoke discount code for checkout campaigns"
          widthClass="max-w-xl"
        >
          <form onSubmit={createCoupon} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                Coupon Code
              </label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. BLOOM20"
                className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                Recipient / Promotion Name
              </label>
              <input
                required
                value={form.recipientName}
                onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                placeholder="e.g. VIP Patron Welcome"
                className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Discount Percentage (%)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                  placeholder="10"
                  className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>

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
                  className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>
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

            {error && <p className="text-xs text-rose">{error}</p>}

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
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-light">Discount Percentage</span>
                  <span className="font-serif text-lg font-bold text-rose">
                    {selectedCoupon.discount_percent || (selectedCoupon as any).discount_value || 0}% OFF
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-light">Recipient / Campaign</span>
                  <strong className="text-bark">{selectedCoupon.recipient_name}</strong>
                </div>
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

        {/* Edit Coupon Drawer */}
        <AdminEntityDrawer
          isOpen={!!editingCoupon}
          onClose={() => setEditingCoupon(null)}
          title={`Edit Coupon: ${editingCoupon?.code || ''}`}
          subtitle="Update discount code parameters and rules"
          widthClass="max-w-xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                Coupon Code *
              </label>
              <input
                required
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. FLAT10"
                className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono font-bold tracking-wider text-bark focus:outline-none focus:border-bark"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                Recipient / Promotion Name *
              </label>
              <input
                required
                value={editForm.recipientName}
                onChange={(e) => setEditForm({ ...editForm, recipientName: e.target.value })}
                placeholder="e.g. Welcome promo for new collectors"
                className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-bark">
                  Discount Percentage (%) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={editForm.discountPercent}
                  onChange={(e) => setEditForm({ ...editForm, discountPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                />
              </div>

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
                  className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                />
              </div>
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

            {error && <p className="text-xs text-rose">{error}</p>}

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
      </main>
    </AdminLayout>
  );
}
