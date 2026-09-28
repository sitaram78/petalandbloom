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
  Download
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import Reveal from '@/components/Reveal';
import AdminLayout from '@/components/AdminLayout';
import { formatPrice } from '@/data/products';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [customerLoyaltyHistory, setCustomerLoyaltyHistory] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  return (
    <AdminLayout activePage="customers">
      <main className="p-6 lg:p-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <Reveal>
            <div className="space-y-1">
              <h1 className="heading-serif text-4xl text-bark tracking-tight">Customer CRM & Loyalty</h1>
              <p className="text-sm text-ink-light font-light">Patrons of the atelier, member tiers, and points ledgers.</p>
            </div>
          </Reveal>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCustomersCSV}
              className="px-4 py-2.5 bg-canvas border border-canvas-line text-xs uppercase tracking-wider font-medium text-bark hover:bg-linen rounded-sm flex items-center gap-2 transition-all shadow-sm"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-ink-light">Total Patrons</p>
              <Users size={20} className="text-rose" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{customers.length}</p>
            <p className="text-[11px] text-ink-light/70 mt-1">Registered atelier accounts</p>
          </div>

          <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-ink-light">Points in Circulation</p>
              <Gift size={20} className="text-rose" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{totalPointsInCirculation.toLocaleString('en-IN')}</p>
            <p className="text-[11px] text-rose mt-1">Worth {formatPrice(totalPointsInCirculation)} in discounts</p>
          </div>

          <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-ink-light">Heirloom Members</p>
              <Award size={20} className="text-purple-600" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{heirloomCount}</p>
            <p className="text-[11px] text-ink-light/70 mt-1">Top tier patrons (1500+ pts)</p>
          </div>

          <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-ink-light">Blossom Members</p>
              <Award size={20} className="text-rose" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{blossomCount}</p>
            <p className="text-[11px] text-ink-light/70 mt-1">Mid tier patrons (500–1499 pts)</p>
          </div>
        </div>

        {/* Toolbar: Search and Filter */}
        <div className="bg-linen p-4 rounded-atelier-panel border border-canvas-line mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, email, code..."
              className="w-full pl-10 pr-4 py-2 bg-canvas border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'FLORET', 'BLOSSOM', 'HEIRLOOM'].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-all ${
                  selectedTier === tier
                    ? 'bg-bark text-linen shadow-sm'
                    : 'bg-canvas text-ink-light hover:text-bark border border-canvas-line'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-linen rounded-atelier-panel border border-canvas-line overflow-hidden shadow-soft">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-rose" />
              <p className="text-sm font-serif text-bark">Accessing patron archives...</p>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-20 text-center">
              <Users size={36} className="mx-auto text-ink-light/40 mb-3" />
              <p className="font-serif text-lg text-bark">No matching patrons found.</p>
              <p className="text-xs text-ink-light mt-1">Try refining your search terms or filters.</p>
            </div>
          ) : (
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
          )}
        </div>

        {/* Customer Detail & Points Adjustment Modal */}
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-linen w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-atelier-panel shadow-2xl border border-canvas-line p-6 lg:p-8">
              <div className="flex justify-between items-start border-b border-canvas-line pb-4 mb-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-rose font-semibold">Patron Profile</span>
                  <h2 className="font-serif text-2xl sm:text-3xl text-bark">{selectedCustomer.full_name || 'Anonymous Patron'}</h2>
                  <p className="text-xs text-ink-light mt-1">
                    {selectedCustomer.email} • {selectedCustomer.phone} • Joined {new Date(selectedCustomer.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 text-ink-light hover:text-bark rounded-full hover:bg-canvas transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {loadingDetails ? (
                <div className="py-20 text-center">
                  <Loader2 size={32} className="animate-spin text-rose mx-auto mb-2" />
                  <p className="text-xs font-serif text-bark">Fetching customer ledgers...</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Top Stats Cards in Modal */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-canvas/50 p-4 rounded border border-canvas-line">
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Petal Points Balance</p>
                      <p className="font-serif text-2xl text-bark mt-1">{selectedCustomer.loyalty_account?.points_balance || 0} pts</p>
                      <p className="text-[10px] text-rose">Tier: {selectedCustomer.loyalty_account?.tier || 'FLORET'}</p>
                    </div>

                    <div className="bg-canvas/50 p-4 rounded border border-canvas-line">
                      <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold">Total Orders Placed</p>
                      <p className="font-serif text-2xl text-bark mt-1">{customerOrders.length}</p>
                      <p className="text-[10px] text-ink-light">Lifetime: {formatPrice((selectedCustomer.total_spent_paise || 0) / 100)}</p>
                    </div>

                    <div className="bg-canvas/50 p-4 rounded border border-canvas-line flex flex-col justify-between">
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
                          <MessageCircle size={14} /> Open WhatsApp Chat
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Points Adjustment Form */}
                  <div className="bg-canvas/30 p-5 rounded-atelier-panel border border-canvas-line">
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
                          className="w-full p-2 bg-white border border-canvas-line rounded-sm text-xs"
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
                          className="w-full p-2 bg-white border border-canvas-line rounded-sm text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-bark font-semibold mb-1">Reason / Note</label>
                        <input
                          type="text"
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="e.g. Goodwill credit"
                          className="w-full p-2 bg-white border border-canvas-line rounded-sm text-xs"
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
                      <div className="border border-canvas-line rounded overflow-hidden">
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
                                  <span className="px-2 py-0.5 bg-canvas border border-canvas-line rounded text-[10px] font-semibold text-bark uppercase">
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
                      <div className="max-h-48 overflow-y-auto border border-canvas-line rounded">
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
                        <div key={addr.id} className="p-3 bg-canvas/40 border border-canvas-line rounded text-xs text-ink space-y-1">
                          <p className="font-medium text-bark">{addr.recipient_name} ({addr.phone})</p>
                          <p className="text-ink-light">{addr.address_line1}{addr.address_line2 ? `, ${addr.address_line2}` : ''}</p>
                          <p className="text-ink-light">{addr.city}, {addr.state} - {addr.pincode}</p>
                          {addr.is_default && (
                            <span className="inline-block px-1.5 py-0.5 bg-rose/10 text-rose-deep text-[9px] uppercase font-bold rounded">
                              Default Address
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
