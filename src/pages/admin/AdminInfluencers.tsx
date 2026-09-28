import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Search,
  Plus,
  TrendingUp,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Instagram,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  Tag,
  Gift,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { formatPrice } from '@/data/products';

interface InfluencerAffiliate {
  id: string;
  name: string;
  instagram_handle: string;
  coupon_code: string;
  discount_percent: number;
  commission_percent: number;
  payout_upi_or_bank?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  // Computed from orders / coupons
  redemption_count: number;
  gross_revenue_inr: number;
  commission_earned_inr: number;
  commission_paid_inr: number;
}

export default function AdminInfluencers() {
  const { showNotification } = useNotification();
  const [affiliates, setAffiliates] = useState<InfluencerAffiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    instagram_handle: '',
    coupon_code: '',
    discount_percent: 10,
    commission_percent: 10,
    payout_upi_or_bank: '',
    notes: '',
  });

  const loadAffiliatesData = async () => {
    setLoading(true);
    try {
      // 1. Fetch coupons that have recipient names or are marked as affiliates
      const { data: couponsData, error: coupErr } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      // 2. Fetch orders with applied coupon codes
      const { data: ordersData, error: ordErr } = await supabase
        .from('orders')
        .select('order_number, applied_coupon_code, total_in_paise, payment_status, created_at')
        .eq('payment_status', 'SUCCESS');

      const couponsList = couponsData || [];
      const ordersList = ordersData || [];

      // Aggregate metrics per coupon
      const mappedAffiliates: InfluencerAffiliate[] = couponsList.map((coup) => {
        const matchingOrders = ordersList.filter(
          (o) => o.applied_coupon_code?.toUpperCase() === coup.code?.toUpperCase()
        );

        const totalRevenuePaise = matchingOrders.reduce((sum, o) => sum + (o.total_in_paise || 0), 0);
        const grossRevenueInr = Math.round(totalRevenuePaise / 100);
        const commissionPercent = 10; // default 10% commission
        const commissionEarned = Math.round((grossRevenueInr * commissionPercent) / 100);

        return {
          id: coup.id,
          name: coup.recipient_name || 'Atelier Partner',
          instagram_handle: coup.recipient_name ? `@${coup.recipient_name.toLowerCase().replace(/\s+/g, '')}` : '@petalbloom',
          coupon_code: coup.code,
          discount_percent: coup.discount_percent || coup.discount_value || 10,
          commission_percent: commissionPercent,
          notes: coup.recipient_name ? `Affiliate partner discount code for ${coup.recipient_name}` : 'General promo coupon',
          active: coup.active ?? true,
          created_at: coup.created_at || new Date().toISOString(),
          redemption_count: coup.usage_count || matchingOrders.length,
          gross_revenue_inr: grossRevenueInr,
          commission_earned_inr: commissionEarned,
          commission_paid_inr: 0,
        };
      });

      setAffiliates(mappedAffiliates);
    } catch (err: any) {
      console.error('Error loading affiliates:', err);
      showNotification('Failed to load influencer data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAffiliatesData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      name: '',
      instagram_handle: '',
      coupon_code: '',
      discount_percent: 10,
      commission_percent: 10,
      payout_upi_or_bank: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleSaveAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const code = form.coupon_code.trim().toUpperCase();
      if (!code) throw new Error('Coupon code is required.');

      // Insert or update coupon
      const { error: coupError } = await supabase.from('coupons').insert({
        code,
        recipient_name: form.name.trim(),
        discount_type: 'PERCENT',
        discount_value: form.discount_percent,
        discount_percent: form.discount_percent,
        min_order_in_paise: 0,
        active: true,
      });

      if (coupError) throw coupError;

      // Central Audit Log
      logAudit({
        action: AUDIT_ACTIONS.COUPON_CREATED,
        entity: 'coupons',
        entity_id: code,
        new_values: {
          code,
          ambassador_name: form.name.trim(),
          discount_percent: form.discount_percent,
          commission_percent: form.commission_percent,
        },
        reason: `New influencer affiliate partner registered: ${form.name}`,
      });

      showNotification(`Ambassador ${form.name} (${code}) created successfully!`, 'success');
      setIsModalOpen(false);
      await loadAffiliatesData();
    } catch (err: any) {
      showNotification('Failed to save ambassador: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportAffiliateReport = () => {
    const headers = [
      'Ambassador Name',
      'Instagram Handle',
      'Coupon Code',
      'Discount Rate (%)',
      'Commission Rate (%)',
      'Total Redemptions',
      'Gross Revenue (INR)',
      'Commission Due (INR)',
      'Status',
      'Joined Date',
    ];

    const rows = filteredAffiliates.map((a) => [
      a.name,
      a.instagram_handle,
      a.coupon_code,
      a.discount_percent,
      a.commission_percent,
      a.redemption_count,
      a.gross_revenue_inr,
      a.commission_earned_inr - a.commission_paid_inr,
      a.active ? 'ACTIVE' : 'INACTIVE',
      new Date(a.created_at).toLocaleDateString('en-IN'),
    ]);

    downloadCSV(`tpb_influencer_performance_${new Date().toISOString().slice(0, 10)}`, headers, rows);

    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'coupons',
      entity_id: 'influencer_report',
      new_values: { exported_rows: filteredAffiliates.length, format: 'CSV' },
      reason: 'Admin exported influencer commission & performance report',
    });

    showNotification(`Exported ${filteredAffiliates.length} affiliate records to CSV!`, 'success');
  };

  const filteredAffiliates = affiliates.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.coupon_code.toLowerCase().includes(q) ||
      a.instagram_handle.toLowerCase().includes(q)
    );
  });

  const totalPartners = affiliates.length;
  const totalRedemptions = affiliates.reduce((sum, a) => sum + (a.redemption_count || 0), 0);
  const totalGrossRevenue = affiliates.reduce((sum, a) => sum + (a.gross_revenue_inr || 0), 0);
  const totalCommissionDue = affiliates.reduce((sum, a) => sum + (a.commission_earned_inr - a.commission_paid_inr), 0);

  return (
    <AdminLayout activePage="influencers" as any>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Affiliate Growth &amp; Creator Partnerships
            </p>
            <h1 className="heading-serif text-4xl text-bark">Ambassadors &amp; Influencers</h1>
            <p className="text-xs text-ink-light mt-1">
              Track creator promo codes, gross sales attribution, and affiliate commissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportAffiliateReport}
              disabled={affiliates.length === 0}
              className="px-3.5 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Download size={14} className="text-emerald-700" />
              Export Performance CSV
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-all shadow-soft"
            >
              <Plus size={14} className="text-rose" />
              Add Ambassador
            </button>
          </div>
        </header>

        {/* 1. KPI Stats Summary Bar */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Active Partners</span>
              <Users size={18} className="text-rose" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{totalPartners}</p>
            <p className="text-[11px] text-ink-light mt-1">Creators with active discount codes</p>
          </div>

          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Code Redemptions</span>
              <Tag size={18} className="text-rose" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{totalRedemptions}</p>
            <p className="text-[11px] text-ink-light mt-1">Total orders using creator coupons</p>
          </div>

          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Attributed Sales (GMV)</span>
              <TrendingUp size={18} className="text-emerald-700" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{formatPrice(totalGrossRevenue)}</p>
            <p className="text-[11px] text-ink-light mt-1">Gross merchandise volume via creators</p>
          </div>

          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Commission Due</span>
              <CreditCard size={18} className="text-rose-deep" />
            </div>
            <p className="font-serif text-3xl text-rose-deep mt-3">{formatPrice(totalCommissionDue)}</p>
            <p className="text-[11px] text-ink-light mt-1">Accrued creator earnings</p>
          </div>
        </section>

        {/* 2. Search and Table */}
        <section className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
          <div className="p-4 border-b border-canvas-line bg-canvas/30 flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search creator name, code, handle..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-rose" />
              <p className="text-xs text-ink-light">Calculating partner attribution metrics...</p>
            </div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <Sparkles size={36} className="mx-auto text-rose/50" />
              <h3 className="heading-serif text-xl text-bark">No Creator Partners Found</h3>
              <p className="text-xs text-ink-light max-w-sm mx-auto">
                Create bespoke promo codes for influencers and track sales generated in real-time.
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-ink text-white hover:bg-bark text-xs font-medium rounded-sm inline-flex items-center gap-2"
              >
                <Plus size={14} /> Add First Ambassador
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-canvas/60 text-bark font-mono uppercase tracking-wider border-b border-canvas-line">
                  <tr>
                    <th className="p-4">Creator / Partner</th>
                    <th className="p-4">Promo Code</th>
                    <th className="p-4 text-center">Discount</th>
                    <th className="p-4 text-center">Redemptions</th>
                    <th className="p-4 text-right">Attributed Sales</th>
                    <th className="p-4 text-right">Commission Due</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-line bg-parchment/20">
                  {filteredAffiliates.map((aff) => (
                    <tr key={aff.id} className="hover:bg-canvas/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-rose/10 text-rose flex items-center justify-center font-serif font-bold text-sm">
                            {aff.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-ink text-sm">{aff.name}</p>
                            <p className="text-[11px] text-rose font-medium flex items-center gap-1">
                              <Instagram size={11} />
                              {aff.instagram_handle}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded bg-canvas border border-canvas-line font-mono font-bold text-xs text-ink">
                          {aff.coupon_code}
                        </span>
                      </td>

                      <td className="p-4 text-center font-medium text-ink">
                        {aff.discount_percent}% OFF
                      </td>

                      <td className="p-4 text-center font-mono font-bold text-ink">
                        {aff.redemption_count}
                      </td>

                      <td className="p-4 text-right font-serif font-medium text-sm text-bark">
                        {formatPrice(aff.gross_revenue_inr)}
                      </td>

                      <td className="p-4 text-right">
                        <p className="font-serif font-bold text-sm text-rose-deep">
                          {formatPrice(aff.commission_earned_inr - aff.commission_paid_inr)}
                        </p>
                        <p className="text-[10px] text-ink-light">({aff.commission_percent}% commission rate)</p>
                      </td>

                      <td className="p-4 text-center">
                        {aff.active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                            Paused
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Add Ambassador Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-linen w-full max-w-lg rounded-sm border border-canvas-line shadow-2xl overflow-hidden animate-fadeIn">
              <header className="p-5 border-b border-canvas-line bg-canvas/40 flex items-center justify-between">
                <div>
                  <h3 className="heading-serif text-xl text-bark">Register Creator Ambassador</h3>
                  <p className="text-xs text-ink-light">Assign a dedicated discount coupon and commission tracking.</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-bark/60 hover:text-ink text-sm p-1"
                >
                  ✕
                </button>
              </header>

              <form onSubmit={handleSaveAffiliate} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-bark">Creator Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Maya Lin"
                    className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-bark">Instagram Handle</label>
                    <input
                      type="text"
                      value={form.instagram_handle}
                      onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })}
                      placeholder="@mayablooms"
                      className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-bark">Promo Code</label>
                    <input
                      type="text"
                      required
                      value={form.coupon_code}
                      onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                      placeholder="MAYA10"
                      className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-bark">Customer Discount (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={form.discount_percent}
                      onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-bark">Commission Rate (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      required
                      value={form.commission_percent}
                      onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-bark">Payout UPI ID / Bank Notes</label>
                  <input
                    type="text"
                    value={form.payout_upi_or_bank}
                    onChange={(e) => setForm({ ...form, payout_upi_or_bank: e.target.value })}
                    placeholder="e.g. maya@okaxis or GPay"
                    className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-canvas-line">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs text-ink-light hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-2 shadow-soft disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin text-rose" /> : <CheckCircle2 size={14} className="text-rose" />}
                    Save Creator Partner
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
