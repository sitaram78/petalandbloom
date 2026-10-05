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
  ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { formatPrice } from '@/data/products';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
} from '@/components/admin/view-system';

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
  const [selectedAffiliate, setSelectedAffiliate] = useState<InfluencerAffiliate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    tabParamKey: 'tab',
    viewParamKey: 'view',
  });

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

  // Payout recording state
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [recordingPayout, setRecordingPayout] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    amount: 0,
    reference: '',
    payment_method: 'UPI',
    notes: '',
  });
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [loadingPayoutHistory, setLoadingPayoutHistory] = useState(false);

  const loadPayoutHistory = async (couponId: string) => {
    setLoadingPayoutHistory(true);
    try {
      const { data, error } = await supabase
        .from('influencer_payouts')
        .select('*')
        .eq('coupon_id', couponId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPayoutHistory(data);
      } else {
        setPayoutHistory([]);
      }
    } catch (e) {
      console.warn('Could not load payout history', e);
      setPayoutHistory([]);
    } finally {
      setLoadingPayoutHistory(false);
    }
  };

  useEffect(() => {
    if (selectedAffiliate?.id) {
      loadPayoutHistory(selectedAffiliate.id);
    }
  }, [selectedAffiliate?.id]);

  const loadAffiliatesData = async () => {
    setLoading(true);
    try {
      // 1. Fetch coupons that are strictly marked as creator/influencer affiliates
      const { data: couponsData, error: coupErr } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_influencer', true)
        .order('created_at', { ascending: false });

      // 2. Fetch orders with applied coupon codes (optimized query)
      const { data: ordersData, error: ordErr } = await supabase
        .from('orders')
        .select('order_number, applied_coupon_code, total_in_paise, payment_status, order_status, created_at')
        .not('applied_coupon_code', 'is', null);

      const couponsList = (couponsData || []).filter((coup: any) => coup.is_influencer === true);
      const ordersList = ordersData || [];

      // Include all orders that are verified paid or confirmed in fulfillment pipeline
      const paidOrders = ordersList.filter((o: any) =>
        o.payment_status === 'SUCCESS' ||
        ['PAYMENT_CONFIRMED', 'ORDER_CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.order_status)
      );

      // Aggregate metrics per coupon
      const mappedAffiliates: InfluencerAffiliate[] = couponsList.map((coup: any) => {
        const matchingOrders = paidOrders.filter(
          (o) => o.applied_coupon_code?.trim().toUpperCase() === coup.code?.trim().toUpperCase()
        );

        const totalRevenuePaise = matchingOrders.reduce((sum, o) => sum + (o.total_in_paise || 0), 0);
        const grossRevenueInr = Math.round(totalRevenuePaise / 100);
        const commissionPercent = Number(coup.commission_percent) || 10;
        const commissionEarned = Math.round((grossRevenueInr * commissionPercent) / 100);
        const commissionPaidInr = Number(coup.commission_paid_inr) || 0;

        return {
          id: coup.id,
          name: coup.recipient_name || coup.influencer_name || 'Atelier Partner',
          instagram_handle: coup.recipient_name
            ? `@${coup.recipient_name.toLowerCase().replace(/\s+/g, '')}`
            : '@petalbloom',
          coupon_code: coup.code,
          discount_percent: coup.discount_percent || coup.discount_value || 10,
          commission_percent: commissionPercent,
          payout_upi_or_bank: coup.payout_upi_or_bank || '',
          notes: coup.recipient_name ? `Affiliate partner discount code for ${coup.recipient_name}` : 'General promo coupon',
          active: coup.active ?? true,
          created_at: coup.created_at || new Date().toISOString(),
          redemption_count: Math.max(coup.usage_count || 0, matchingOrders.length),
          gross_revenue_inr: grossRevenueInr,
          commission_earned_inr: commissionEarned,
          commission_paid_inr: commissionPaidInr,
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

  const handleOpenPayout = () => {
    if (!selectedAffiliate) return;
    const due = Math.max(0, selectedAffiliate.commission_earned_inr - selectedAffiliate.commission_paid_inr);
    setPayoutForm({
      amount: due,
      reference: '',
      payment_method: 'UPI',
      notes: '',
    });
    setIsPayoutModalOpen(true);
  };

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAffiliate) return;
    setRecordingPayout(true);
    try {
      const amount = Number(payoutForm.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid payout amount.');
      }

      // 1. Insert into influencer_payouts
      const { error: insertErr } = await supabase.from('influencer_payouts').insert({
        coupon_id: selectedAffiliate.id,
        amount_inr: amount,
        payout_reference: payoutForm.reference.trim() || null,
        payment_method: payoutForm.payment_method,
        notes: payoutForm.notes.trim() || null,
      });

      if (insertErr) throw insertErr;

      // 2. Update coupon commission_paid_inr
      const newPaidTotal = (selectedAffiliate.commission_paid_inr || 0) + amount;
      const { error: updateErr } = await supabase
        .from('coupons')
        .update({ commission_paid_inr: newPaidTotal })
        .eq('id', selectedAffiliate.id);

      if (updateErr) throw updateErr;

      // 3. Central Audit Log
      logAudit({
        action: AUDIT_ACTIONS.INFLUENCER_PAYOUT_RECORDED,
        entity: 'influencer_payouts',
        entity_id: selectedAffiliate.id,
        new_values: {
          creator_name: selectedAffiliate.name,
          coupon_code: selectedAffiliate.coupon_code,
          payout_amount_inr: amount,
          reference: payoutForm.reference,
          method: payoutForm.payment_method,
          new_total_paid_inr: newPaidTotal,
        },
        reason: `Recorded commission payout of ₹${amount} to ${selectedAffiliate.name}`,
      });

      showNotification(`Successfully recorded ₹${amount} payout for ${selectedAffiliate.name}!`, 'success');
      setIsPayoutModalOpen(false);
      setPayoutForm({ amount: 0, reference: '', payment_method: 'UPI', notes: '' });

      // Immediate local state update for drawer
      setSelectedAffiliate({
        ...selectedAffiliate,
        commission_paid_inr: newPaidTotal,
      });

      // Reload lists and history
      await Promise.all([loadAffiliatesData(), loadPayoutHistory(selectedAffiliate.id)]);
    } catch (err: any) {
      showNotification('Failed to record payout: ' + err.message, 'error');
    } finally {
      setRecordingPayout(false);
    }
  };

  const handleSaveAffiliate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const code = form.coupon_code.trim().toUpperCase();
      if (!code) throw new Error('Coupon code is required.');

      // Insert or update coupon with full creator attributes
      const { error: coupError } = await supabase.from('coupons').insert({
        code,
        recipient_name: form.name.trim(),
        influencer_name: form.name.trim(),
        is_influencer: true,
        discount_type: 'PERCENT',
        discount_value: form.discount_percent,
        commission_percent: form.commission_percent,
        payout_upi_or_bank: form.payout_upi_or_bank.trim() || null,
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
          payout_upi_or_bank: form.payout_upi_or_bank.trim() || null,
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
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.coupon_code.toLowerCase().includes(q) ||
      a.instagram_handle.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (activeTab === 'ACTIVE') {
      return a.active;
    }
    if (activeTab === 'COMMISSION_DUE') {
      return (a.commission_earned_inr - a.commission_paid_inr) > 0;
    }
    return true;
  });

  const totalPartners = affiliates.length;
  const totalRedemptions = affiliates.reduce((sum, a) => sum + (a.redemption_count || 0), 0);
  const totalGrossRevenue = affiliates.reduce((sum, a) => sum + (a.gross_revenue_inr || 0), 0);
  const totalCommissionDue = affiliates.reduce((sum, a) => sum + (a.commission_earned_inr - a.commission_paid_inr), 0);

  return (
    <AdminLayout activePage="influencers" as any>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Affiliate Growth & Creator Partnerships"
          title="Ambassadors & Influencers"
          subtitle="Track creator promo codes, gross sales attribution, and affiliate commissions."
          stats={[
            {
              label: 'Active Partners',
              value: totalPartners,
              icon: <Users size={18} />,
              subtext: 'Creators with promo codes',
            },
            {
              label: 'Code Redemptions',
              value: totalRedemptions,
              icon: <Tag size={18} className="text-rose" />,
              subtext: 'Orders driven by partners',
            },
            {
              label: 'Attributed Sales (GMV)',
              value: formatPrice(totalGrossRevenue),
              icon: <TrendingUp size={18} className="text-emerald-700" />,
              subtext: 'Gross merchandise volume',
            },
            {
              label: 'Commission Due',
              value: formatPrice(totalCommissionDue),
              icon: <CreditCard size={18} className="text-rose-deep" />,
              subtext: 'Accrued creator earnings',
            },
          ]}
          primaryAction={{
            label: 'Add Ambassador',
            icon: <Plus size={14} className="text-rose" />,
            onClick: handleOpenAdd,
          }}
          secondaryActions={[
            {
              label: 'Export Performance CSV',
              icon: <Download size={14} className="text-emerald-700" />,
              onClick: exportAffiliateReport,
              disabled: affiliates.length === 0,
            },
          ]}
        />

        {/* Standardized View Toolbar */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search creator name, code, handle..."
          tabs={[
            { id: 'ALL', label: 'All Partners', count: affiliates.length },
            { id: 'ACTIVE', label: 'Active', count: affiliates.filter((a) => a.active).length },
            {
              id: 'COMMISSION_DUE',
              label: 'Payables Due',
              count: affiliates.filter((a) => a.commission_earned_inr - a.commission_paid_inr > 0).length,
            },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table', 'grid']}
          onRefresh={loadAffiliatesData}
          isRefreshing={loading}
        />

        {/* Content View: Table vs Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 bg-linen rounded-sm border border-canvas-line">
            <Loader2 size={28} className="animate-spin text-rose" />
            <p className="text-xs text-ink-light">Calculating partner attribution metrics...</p>
          </div>
        ) : filteredAffiliates.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-linen rounded-sm border border-canvas-line">
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
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAffiliates.map((aff) => (
              <div
                key={aff.id}
                className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft hover:border-canvas-line-hover transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose/10 text-rose font-serif font-bold text-sm flex items-center justify-center">
                        {aff.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-semibold text-bark text-sm">{aff.name}</h4>
                        <p className="text-[11px] text-rose font-medium flex items-center gap-1">
                          <Instagram size={11} /> {aff.instagram_handle}
                        </p>
                      </div>
                    </div>
                    {aff.active ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="bg-canvas/40 p-3 rounded-sm space-y-1.5 text-xs text-ink-light">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-semibold">Promo Code</span>
                      <span className="font-mono font-bold text-bark bg-white px-2 py-0.5 rounded border border-canvas-line">
                        {aff.coupon_code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Customer Discount</span>
                      <span className="font-medium text-bark">{aff.discount_percent}% OFF</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-canvas-line text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-ink-light block">Redemptions</span>
                      <span className="font-serif font-bold text-bark text-sm">
                        {aff.redemption_count} orders
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-ink-light block">Commission Due</span>
                      <span className="font-serif font-bold text-rose-deep text-sm">
                        {formatPrice(aff.commission_earned_inr - aff.commission_paid_inr)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAffiliate(aff)}
                  className="w-full py-2 bg-canvas hover:bg-bark hover:text-linen text-bark text-xs uppercase tracking-wider font-medium rounded-sm border border-canvas-line transition-all flex items-center justify-center gap-1"
                >
                  Inspect Ambassador
                  <ChevronRight size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <section className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
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
                    <th className="p-4 text-right">Action</th>
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

                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedAffiliate(aff)}
                          className="px-3 py-1.5 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Influencer Affiliate Inspector Drawer */}
        <AdminEntityDrawer
          isOpen={!!selectedAffiliate}
          onClose={() => setSelectedAffiliate(null)}
          title={selectedAffiliate ? selectedAffiliate.name : ''}
          subtitle={
            selectedAffiliate
              ? `Affiliate partner since ${new Date(selectedAffiliate.created_at).toLocaleDateString('en-IN')}`
              : ''
          }
          badge={
            selectedAffiliate && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedAffiliate.active
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {selectedAffiliate.active ? 'Active Partner' : 'Paused'}
              </span>
            )
          }
          widthClass="max-w-xl"
        >
          {selectedAffiliate && (
            <div className="space-y-6">
              {/* Creator Overview */}
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Instagram Handle</span>
                  <span className="font-semibold text-rose flex items-center gap-1">
                    <Instagram size={12} /> {selectedAffiliate.instagram_handle}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Exclusive Promo Code</span>
                  <span className="font-mono font-bold text-bark bg-white px-2 py-0.5 rounded border border-canvas-line">
                    {selectedAffiliate.coupon_code}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Discount Rate</span>
                  <span className="text-bark font-semibold">{selectedAffiliate.discount_percent}% OFF</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Commission Agreement</span>
                  <span className="text-bark font-semibold">{selectedAffiliate.commission_percent}% of Net Sales</span>
                </div>
              </div>

              {/* Financial Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-canvas/40 p-4 rounded-sm border border-canvas-line">
                  <span className="text-[10px] uppercase tracking-wider text-ink-light block">Orders Driven</span>
                  <p className="font-serif text-2xl font-bold text-bark mt-1">
                    {selectedAffiliate.redemption_count}
                  </p>
                  <p className="text-[11px] text-ink-light">Coupon redemptions</p>
                </div>

                <div className="bg-canvas/40 p-4 rounded-sm border border-canvas-line">
                  <span className="text-[10px] uppercase tracking-wider text-ink-light block">Attributed GMV</span>
                  <p className="font-serif text-2xl font-bold text-emerald-800 mt-1">
                    {formatPrice(selectedAffiliate.gross_revenue_inr)}
                  </p>
                  <p className="text-[11px] text-ink-light">Gross sales volume</p>
                </div>
              </div>

              {/* Outstanding Commission & Payout Tracking */}
              <div className="p-4 bg-rose/5 border border-rose/20 rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Net Commission Due</p>
                    <p className="font-serif text-2xl font-bold text-rose-deep mt-0.5">
                      {formatPrice(selectedAffiliate.commission_earned_inr - selectedAffiliate.commission_paid_inr)}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenPayout}
                    className="px-3.5 py-1.5 bg-bark hover:bg-ink text-white text-xs font-medium rounded-sm flex items-center gap-1.5 shadow-soft transition-all"
                  >
                    <CreditCard size={13} className="text-rose" />
                    Record Payout
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose/20 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-ink-light">Total Accrued</span>
                    <p className="font-semibold text-bark">{formatPrice(selectedAffiliate.commission_earned_inr)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-ink-light">Already Paid</span>
                    <p className="font-semibold text-emerald-800">{formatPrice(selectedAffiliate.commission_paid_inr)}</p>
                  </div>
                </div>

                {selectedAffiliate.payout_upi_or_bank && (
                  <div className="pt-2 border-t border-rose/20 text-xs flex justify-between items-center">
                    <span className="text-ink-light">Payout Route</span>
                    <span className="font-mono text-bark font-medium">{selectedAffiliate.payout_upi_or_bank}</span>
                  </div>
                )}
              </div>

              {/* Payout History Ledger */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-sm font-semibold text-bark">Disbursement History</h4>
                  <span className="text-[11px] text-ink-light">{payoutHistory.length} recorded payouts</span>
                </div>

                {loadingPayoutHistory ? (
                  <div className="py-4 text-center text-xs text-ink-light">
                    <Loader2 size={16} className="animate-spin text-rose mx-auto mb-1" />
                    Loading payout ledger...
                  </div>
                ) : payoutHistory.length === 0 ? (
                  <p className="text-xs text-ink-light italic bg-canvas/30 p-3 rounded-sm border border-canvas-line text-center">
                    No payouts recorded yet for this creator.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payoutHistory.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white p-3 rounded-sm border border-canvas-line text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-serif font-bold text-emerald-800">{formatPrice(p.amount_inr)}</p>
                          <p className="text-[10px] text-ink-light">
                            {new Date(p.created_at).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            • {p.payment_method || 'UPI'}
                          </p>
                        </div>
                        {p.payout_reference && (
                          <div className="text-right">
                            <span className="font-mono text-[10px] text-bark bg-canvas px-1.5 py-0.5 rounded border border-canvas-line">
                              {p.payout_reference}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedAffiliate.notes && (
                <div className="text-xs text-ink-light space-y-1">
                  <span className="font-semibold text-bark">Partner Notes:</span>
                  <p className="italic bg-canvas/30 p-3 rounded-sm border border-canvas-line">{selectedAffiliate.notes}</p>
                </div>
              )}
            </div>
          )}
        </AdminEntityDrawer>

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

        {/* Record Commission Payout Modal */}
        {isPayoutModalOpen && selectedAffiliate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-linen w-full max-w-md rounded-sm border border-canvas-line shadow-2xl overflow-hidden animate-fadeIn">
              <header className="p-5 border-b border-canvas-line bg-canvas/40 flex items-center justify-between">
                <div>
                  <h3 className="heading-serif text-lg text-bark">Record Commission Payout</h3>
                  <p className="text-xs text-ink-light">Disbursement for {selectedAffiliate.name}</p>
                </div>
                <button
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="text-bark/60 hover:text-ink text-sm p-1"
                >
                  ✕
                </button>
              </header>

              <form onSubmit={handleRecordPayout} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-bark">Payout Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={payoutForm.amount}
                    onChange={(e) => setPayoutForm({ ...payoutForm, amount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-sm font-semibold text-bark focus:outline-none focus:border-bark"
                  />
                  <p className="text-[10px] text-ink-light">
                    Current outstanding due: {formatPrice(selectedAffiliate.commission_earned_inr - selectedAffiliate.commission_paid_inr)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-bark">Payment Method</label>
                  <select
                    value={payoutForm.payment_method}
                    onChange={(e) => setPayoutForm({ ...payoutForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="IMPS_NEFT">Bank Transfer (IMPS / NEFT)</option>
                    <option value="MANUAL">Cash / Other Studio Disbursement</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-bark">UTR / Transaction Reference</label>
                  <input
                    type="text"
                    value={payoutForm.reference}
                    onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })}
                    placeholder="e.g. UTR38491823901 or UPI-Ref"
                    className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs font-mono text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-bark">Notes (Optional)</label>
                  <input
                    type="text"
                    value={payoutForm.notes}
                    onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                    placeholder="e.g. October milestone commission"
                    className="w-full px-3.5 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-canvas-line">
                  <button
                    type="button"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="px-4 py-2 text-xs text-ink-light hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recordingPayout}
                    className="px-6 py-2 bg-bark hover:bg-ink text-white text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-2 shadow-soft disabled:opacity-50"
                  >
                    {recordingPayout ? (
                      <Loader2 size={14} className="animate-spin text-rose" />
                    ) : (
                      <CheckCircle2 size={14} className="text-rose" />
                    )}
                    Confirm Disbursement
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
