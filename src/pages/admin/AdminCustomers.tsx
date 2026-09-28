import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Loader2,
  Gift,
  Award,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  ExternalLink,
  PlusCircle,
  MinusCircle,
  X,
  MessageCircle,
  Download,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Reveal from '@/components/Reveal';
import AdminLayout from '@/components/AdminLayout';
import { formatPrice } from '@/data/products';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
} from '@/components/admin/view-system';

interface CustomerProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  loyalty_account?: {
    points_balance: number;
    lifetime_points_earned: number;
    tier: string;
  };
  orders_count?: number;
  total_spent_paise?: number;
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [customerLoyaltyHistory, setCustomerLoyaltyHistory] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Unified Admin View System hook
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    activeTab: selectedTier,
    setActiveTab: setSelectedTier,
  } = useAdminView({
    defaultView: 'table',
    defaultTab: 'ALL',
    searchParamKey: 'q',
    tabParamKey: 'tier',
    viewParamKey: 'view',
  });

  // Points adjustment modal state
  const [pointsDelta, setPointsDelta] = useState<number>(50);
  const [pointsType, setPointsType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustmentReason, setAdjustmentReason] = useState('Studio goodwill adjustment');
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // 1. Fetch profiles
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone,
          email,
          role,
          referral_code,
          referred_by,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (profErr) throw profErr;

      // 2. Fetch loyalty accounts
      const { data: loyaltyAccounts } = await supabase
        .from('loyalty_accounts')
        .select('customer_id, points_balance, lifetime_points_earned, tier');

      const loyaltyMap = new Map((loyaltyAccounts || []).map((l: any) => [l.customer_id, l]));

      // 3. Fetch order counts
      const { data: orders } = await supabase
        .from('orders')
        .select('customer_id, total_in_paise');

      const orderCountMap = new Map<string, { count: number; totalPaise: number }>();
      (orders || []).forEach((o: any) => {
        if (o.customer_id) {
          const curr = orderCountMap.get(o.customer_id) || { count: 0, totalPaise: 0 };
          curr.count += 1;
          curr.totalPaise += o.total_in_paise || 0;
          orderCountMap.set(o.customer_id, curr);
        }
      });

      const merged: CustomerProfile[] = (profiles || []).map((p: any) => {
        const orderStats = orderCountMap.get(p.id) || { count: 0, totalPaise: 0 };
        return {
          ...p,
          loyalty_account: loyaltyMap.get(p.id) || { points_balance: 0, lifetime_points_earned: 0, tier: 'FLORET' },
          orders_count: orderStats.count,
          total_spent_paise: orderStats.totalPaise,
        };
      });

      setCustomers(merged);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCustomerDetails = async (customer: CustomerProfile) => {
    setSelectedCustomer(customer);
    setLoadingDetails(true);
    try {
      // Fetch orders for customer
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, order_status, total_in_paise, created_at, applied_coupon_code')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      setCustomerOrders(orders || []);

      // Fetch addresses
      const { data: addrs } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customer.id);
      setCustomerAddresses(addrs || []);

      // Fetch loyalty history
      const { data: txs } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      setCustomerLoyaltyHistory(txs || []);
    } catch (e) {
      console.error('Error fetching customer details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAdjustPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const delta = pointsType === 'ADD' ? Math.abs(pointsDelta) : -Math.abs(pointsDelta);
    setIsAdjustingPoints(true);

    try {
      // 1. Insert transaction
      await supabase.from('loyalty_transactions').insert({
        customer_id: selectedCustomer.id,
        type: pointsType === 'ADD' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
        points: delta,
        description: adjustmentReason || 'Atelier administrative points adjustment',
      });

      // 2. Fetch current balance
      const { data: acc } = await supabase
        .from('loyalty_accounts')
        .select('points_balance, lifetime_points_earned')
        .eq('customer_id', selectedCustomer.id)
        .maybeSingle();

      const currentBalance = acc?.points_balance || 0;
      const newBalance = Math.max(0, currentBalance + delta);

      if (acc) {
        await supabase
          .from('loyalty_accounts')
          .update({
            points_balance: newBalance,
            lifetime_points_earned: pointsType === 'ADD'
              ? (acc.lifetime_points_earned || 0) + delta
              : acc.lifetime_points_earned,
          })
          .eq('customer_id', selectedCustomer.id);
      } else {
        await supabase.from('loyalty_accounts').insert({
          customer_id: selectedCustomer.id,
          points_balance: newBalance,
          lifetime_points_earned: Math.max(0, delta),
          tier: 'FLORET',
        });
      }

      // Central Audit Logging
      logAudit({
        action: AUDIT_ACTIONS.POINTS_ADJUSTED,
        entity: 'loyalty_accounts',
        entity_id: selectedCustomer.id,
        old_values: { points_balance: currentBalance },
        new_values: { points_balance: newBalance, delta, type: pointsType },
        reason: adjustmentReason || 'Atelier administrative points adjustment',
      });

      alert(`Petal points updated! New balance: ${newBalance} points.`);
      await fetchCustomers();
      if (selectedCustomer) {
        await openCustomerDetails(selectedCustomer);
      }
    } catch (err: any) {
      alert(`Failed to adjust points: ${err.message}`);
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  const exportCustomersCSV = () => {
    const headers = ['Full Name', 'Phone', 'Email', 'Role', 'Tier', 'Petal Points', 'Lifetime Earned', 'Orders Count', 'Total Spent (INR)', 'Referral Code', 'Joined Date'];
    const rows = filteredCustomers.map(c => [
      `"${c.full_name || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.email || ''}"`,
      c.role,
      c.loyalty_account?.tier || 'FLORET',
      c.loyalty_account?.points_balance || 0,
      c.loyalty_account?.lifetime_points_earned || 0,
      c.orders_count || 0,
      ((c.total_spent_paise || 0) / 100).toFixed(2),
      `"${c.referral_code || ''}"`,
      new Date(c.created_at).toLocaleDateString('en-IN'),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `petal_and_bloom_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Central Audit Logging
    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'profiles',
      entity_id: 'bulk_export',
      new_values: { exported_rows: filteredCustomers.length, format: 'CSV' },
      reason: 'Admin customer CRM data export',
    });
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (c.full_name && c.full_name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.referral_code && c.referral_code.toLowerCase().includes(q));

    const tier = c.loyalty_account?.tier || 'FLORET';
    const matchesTier = selectedTier === 'ALL' || tier === selectedTier;

    return matchesSearch && matchesTier;
  });

  const totalPointsInCirculation = customers.reduce((acc, c) => acc + (c.loyalty_account?.points_balance || 0), 0);
  const heirloomCount = customers.filter(c => c.loyalty_account?.tier === 'HEIRLOOM').length;
  const blossomCount = customers.filter(c => c.loyalty_account?.tier === 'BLOSSOM').length;
  const floretCount = customers.filter(c => !c.loyalty_account?.tier || c.loyalty_account?.tier === 'FLORET').length;

  return (
    <AdminLayout activePage="customers">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Client Relations"
          title="Customer CRM & Loyalty"
          subtitle="Patrons of the atelier, member tiers, and points ledgers."
          stats={[
            {
              label: 'Total Patrons',
              value: customers.length,
              icon: <Users size={18} />,
              subtext: 'Registered atelier accounts',
            },
            {
              label: 'Points in Circulation',
              value: totalPointsInCirculation.toLocaleString('en-IN'),
              icon: <Gift size={18} />,
              subtext: `Worth ${formatPrice(totalPointsInCirculation)} in discounts`,
            },
            {
              label: 'Heirloom Members',
              value: heirloomCount,
              icon: <Award size={18} className="text-purple-600" />,
              subtext: 'Top tier patrons (1500+ pts)',
            },
            {
              label: 'Blossom Members',
              value: blossomCount,
              icon: <Award size={18} className="text-rose" />,
              subtext: 'Mid tier patrons (500–1499 pts)',
            },
          ]}
          secondaryActions={[
            {
              label: 'Export CSV',
              icon: <Download size={14} />,
              onClick: exportCustomersCSV,
              disabled: filteredCustomers.length === 0,
            },
          ]}
        />

        {/* Standardized View Toolbar */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by name, phone, email, code..."
          tabs={[
            { id: 'ALL', label: 'All Patrons', count: customers.length },
            { id: 'FLORET', label: 'Floret', count: floretCount },
            { id: 'BLOSSOM', label: 'Blossom', count: blossomCount },
            { id: 'HEIRLOOM', label: 'Heirloom', count: heirloomCount },
          ]}
          activeTab={selectedTier}
          onTabChange={setSelectedTier}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table', 'grid']}
          onRefresh={fetchCustomers}
          isRefreshing={loading}
        />

        {/* Content View: Table vs Grid */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 bg-linen rounded-sm border border-canvas-line">
            <Loader2 size={32} className="animate-spin text-rose" />
            <p className="text-sm font-serif text-bark">Accessing patron archives...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-20 text-center bg-linen rounded-sm border border-canvas-line">
            <Users size={36} className="mx-auto text-ink-light/40 mb-3" />
            <p className="font-serif text-lg text-bark">No matching patrons found.</p>
            <p className="text-xs text-ink-light mt-1">Try refining your search terms or filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCustomers.map((c) => {
              const tier = c.loyalty_account?.tier || 'FLORET';
              const tierBadgeColor =
                tier === 'HEIRLOOM'
                  ? 'bg-purple-100 text-purple-700 border-purple-200'
                  : tier === 'BLOSSOM'
                  ? 'bg-rose/10 text-rose-deep border-rose/30'
                  : 'bg-canvas text-ink-light border-canvas-line';

              const initials = (c.full_name || 'AP')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={c.id}
                  className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft hover:border-canvas-line-hover transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-bark/10 text-bark font-serif font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {initials}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-bark text-sm truncate">
                            {c.full_name || 'Anonymous Patron'}
                          </h4>
                          {c.role === 'admin' && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] rounded font-semibold uppercase">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-ink-light">
                          Joined {new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${tierBadgeColor} flex-shrink-0`}>
                      {tier}
                    </span>
                  </div>

                  <div className="bg-canvas/40 p-3 rounded-sm space-y-1.5 text-xs text-ink-light">
                    {c.phone && (
                      <p className="flex items-center gap-1.5 text-ink truncate">
                        <Phone size={12} className="text-rose shrink-0" /> +91 {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={12} className="text-ink-light shrink-0" /> {c.email}
                      </p>
                    )}
                    {c.referral_code && (
                      <p className="text-[10px] font-mono text-bark">
                        Ref: {c.referral_code}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-canvas-line text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-ink-light block">Points</span>
                      <span className="font-serif font-bold text-bark text-sm">
                        {c.loyalty_account?.points_balance || 0} pts
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-ink-light block">Orders</span>
                      <span className="font-medium text-bark">
                        {c.orders_count || 0} ({formatPrice((c.total_spent_paise || 0) / 100)})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openCustomerDetails(c)}
                    className="w-full py-2 bg-canvas hover:bg-bark hover:text-linen text-bark text-xs uppercase tracking-wider font-medium rounded-sm border border-canvas-line transition-all flex items-center justify-center gap-1.5"
                  >
                    Inspect Patron Record
                    <ChevronRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-linen rounded-sm border border-canvas-line overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink border-collapse">
                <thead>
                  <tr className="border-b border-canvas-line bg-canvas/60 text-ink-light uppercase tracking-wider text-[10px]">
                    <th className="p-4">Customer</th>
                    <th className="p-4">Tier & Points</th>
                    <th className="p-4">Orders & Value</th>
                    <th className="p-4">Referral Code</th>
                    <th className="p-4">Joined Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-line">
                  {filteredCustomers.map((c) => {
                    const tier = c.loyalty_account?.tier || 'FLORET';
                    const tierBadgeColor =
                      tier === 'HEIRLOOM' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                      tier === 'BLOSSOM' ? 'bg-rose/10 text-rose-deep border-rose/30' :
                      'bg-canvas text-ink-light border-canvas-line';

                    return (
                      <tr key={c.id} className="hover:bg-canvas/40 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-bark text-sm">{c.full_name || 'Anonymous Patron'}</div>
                          <div className="text-[11px] text-ink-light">{c.phone || 'No phone'} • {c.email || 'No email'}</div>
                          {c.role === 'admin' && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded uppercase font-semibold">
                              Admin
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold border ${tierBadgeColor}`}>
                              {tier}
                            </span>
                            <span className="font-serif text-bark font-medium text-sm">
                              {c.loyalty_account?.points_balance || 0} pts
                            </span>
                          </div>
                          <div className="text-[10px] text-ink-light/70 mt-0.5">
                            Lifetime: {c.loyalty_account?.lifetime_points_earned || 0} pts
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="font-medium text-bark">{c.orders_count || 0} orders</div>
                          <div className="text-[11px] text-rose font-medium">
                            {formatPrice((c.total_spent_paise || 0) / 100)}
                          </div>
                        </td>

                        <td className="p-4 font-mono text-[11px] text-ink-light">
                          {c.referral_code || '—'}
                          {c.referred_by && (
                            <div className="text-[10px] text-emerald-700 font-sans">
                              Via: {c.referred_by}
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-ink-light">
                          {new Date(c.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="p-4 text-right">
                          <button
                            onClick={() => openCustomerDetails(c)}
                            className="px-3 py-1.5 bg-bark text-linen hover:bg-rose-deep text-xs font-medium rounded-sm transition-colors shadow-sm"
                          >
                            View Record
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer Detail & Points Adjustment Drawer */}
        <AdminEntityDrawer
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={selectedCustomer?.full_name || 'Anonymous Patron'}
          subtitle={
            selectedCustomer
              ? `${selectedCustomer.email || 'No email registered'} • Joined ${new Date(
                  selectedCustomer.created_at
                ).toLocaleDateString('en-IN')}`
              : ''
          }
          badge={
            selectedCustomer && (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold border bg-canvas text-bark border-canvas-line">
                Tier: {selectedCustomer.loyalty_account?.tier || 'FLORET'}
              </span>
            )
          }
          widthClass="max-w-2xl sm:max-w-3xl"
        >
          {selectedCustomer && (
            <>
              {loadingDetails ? (
                <div className="py-20 text-center">
                  <Loader2 size={32} className="animate-spin text-rose mx-auto mb-2" />
                  <p className="text-xs font-serif text-bark">Fetching customer ledgers...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Top Stats Cards in Drawer */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-canvas/40 p-4 rounded-sm border border-canvas-line">
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Petal Points Balance</p>
                      <p className="font-serif text-2xl text-bark mt-1">{selectedCustomer.loyalty_account?.points_balance || 0} pts</p>
                      <p className="text-[10px] text-rose">Tier: {selectedCustomer.loyalty_account?.tier || 'FLORET'}</p>
                    </div>

                    <div className="bg-canvas/40 p-4 rounded-sm border border-canvas-line">
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Total Orders Placed</p>
                      <p className="font-serif text-2xl text-bark mt-1">{customerOrders.length}</p>
                      <p className="text-[10px] text-ink-light">Lifetime: {formatPrice((selectedCustomer.total_spent_paise || 0) / 100)}</p>
                    </div>

                    <div className="bg-canvas/40 p-4 rounded-sm border border-canvas-line flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Direct Concierge</p>
                        <p className="text-xs text-ink-light mt-1">{selectedCustomer.phone || 'No phone'}</p>
                      </div>
                      {selectedCustomer.phone && (
                        <a
                          href={`https://wa.me/91${selectedCustomer.phone.replace(/\D/g, '').slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 text-xs font-medium text-emerald-800 hover:text-emerald-900 flex items-center gap-1.5"
                        >
                          <MessageCircle size={14} /> Open WhatsApp
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Points Adjustment Form */}
                  <div className="bg-canvas/30 p-5 rounded-sm border border-canvas-line">
                    <h3 className="font-serif text-lg text-bark mb-2 flex items-center gap-2">
                      <Gift size={18} className="text-rose" /> Adjust Loyalty Points (Admin Override)
                    </h3>
                    <p className="text-xs text-ink-light mb-4">
                      Credit points for goodwill or order compensation, or debit points for manual returns.
                    </p>

                    <form onSubmit={handleAdjustPoints} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-bark font-semibold mb-1">Action</label>
                        <select
                          value={pointsType}
                          onChange={(e: any) => setPointsType(e.target.value)}
                          className="w-full p-2 bg-linen border border-canvas-line rounded-sm text-xs"
                        >
                          <option value="ADD">+ Credit Points</option>
                          <option value="DEDUCT">- Deduct Points</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-bark font-semibold mb-1">Points Amount</label>
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          value={pointsDelta}
                          onChange={(e) => setPointsDelta(Number(e.target.value))}
                          className="w-full p-2 bg-linen border border-canvas-line rounded-sm text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-bark font-semibold mb-1">Reason / Note</label>
                        <input
                          type="text"
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="e.g. Goodwill credit"
                          className="w-full p-2 bg-linen border border-canvas-line rounded-sm text-xs"
                        />
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={isAdjustingPoints}
                          className="w-full p-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-semibold rounded-sm transition-all disabled:opacity-50"
                        >
                          {isAdjustingPoints ? 'Updating...' : 'Apply Points'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Customer Orders */}
                  <div>
                    <h3 className="font-serif text-lg text-bark mb-3 flex items-center gap-2">
                      <ShoppingBag size={18} className="text-rose" /> Order History ({customerOrders.length})
                    </h3>
                    {customerOrders.length === 0 ? (
                      <p className="text-xs text-ink-light italic">No orders recorded for this customer yet.</p>
                    ) : (
                      <div className="border border-canvas-line rounded-sm overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-canvas text-ink-light uppercase text-[10px] border-b border-canvas-line">
                              <th className="p-3">Order Number</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Amount</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-canvas-line">
                            {customerOrders.map((ord) => (
                              <tr key={ord.id} className="hover:bg-canvas/30">
                                <td className="p-3 font-mono font-medium text-bark">{ord.order_number}</td>
                                <td className="p-3 text-ink-light">{new Date(ord.created_at).toLocaleDateString('en-IN')}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 bg-canvas border border-canvas-line rounded-sm text-[10px] font-semibold text-bark uppercase">
                                    {ord.order_status}
                                  </span>
                                </td>
                                <td className="p-3 font-serif font-medium text-bark">{formatPrice(ord.total_in_paise / 100)}</td>
                                <td className="p-3 text-right">
                                  <a
                                    href={`/track?order_id=${ord.order_number}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-rose hover:underline inline-flex items-center gap-1"
                                  >
                                    Receipt <ExternalLink size={12} />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Loyalty Ledger */}
                  <div>
                    <h3 className="font-serif text-lg text-bark mb-3 flex items-center gap-2">
                      <Award size={18} className="text-rose" /> Loyalty Transactions ({customerLoyaltyHistory.length})
                    </h3>
                    {customerLoyaltyHistory.length === 0 ? (
                      <p className="text-xs text-ink-light italic">No loyalty transactions recorded.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border border-canvas-line rounded-sm">
                        <table className="w-full text-left text-xs border-collapse">
                          <tbody className="divide-y divide-canvas-line">
                            {customerLoyaltyHistory.map((tx) => (
                              <tr key={tx.id} className="hover:bg-canvas/30">
                                <td className="p-2.5 text-[11px] text-ink-light">
                                  {new Date(tx.created_at).toLocaleDateString('en-IN')}
                                </td>
                                <td className="p-2.5 font-medium text-bark">
                                  {tx.description}
                                </td>
                                <td className="p-2.5 text-right font-serif font-semibold">
                                  <span className={tx.points >= 0 ? 'text-emerald-700' : 'text-rose'}>
                                    {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Saved Addresses */}
                  <div>
                    <h3 className="font-serif text-lg text-bark mb-3 flex items-center gap-2">
                      <MapPin size={18} className="text-rose" /> Saved Delivery Addresses ({customerAddresses.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {customerAddresses.map((addr) => (
                        <div key={addr.id} className="p-3 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink space-y-1">
                          <p className="font-medium text-bark">{addr.recipient_name} ({addr.phone})</p>
                          <p className="text-ink-light">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}</p>
                          <p className="text-ink-light">{addr.city}, {addr.state} - {addr.pincode}</p>
                          {addr.is_default && (
                            <span className="inline-block px-1.5 py-0.5 bg-rose/10 text-rose-deep text-[9px] uppercase font-bold rounded-sm">
                              Default Address
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </AdminEntityDrawer>
      </main>
    </AdminLayout>
  );
}
