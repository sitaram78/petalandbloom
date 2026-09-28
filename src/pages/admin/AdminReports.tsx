import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  DollarSign,
  Package,
  Truck,
  Award,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Receipt,
  Gift,
  Users,
  PieChart,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { formatPrice } from '@/data/products';

type ReportTab = 'financial' | 'velocity' | 'loyalty' | 'logistics';
type DateRangeOption = '7d' | '30d' | '90d' | 'all';

interface RawOrder {
  id: string;
  order_number: string;
  subtotal_in_paise: number;
  discount_in_paise: number;
  shipping_fee_in_paise: number;
  loyalty_points_redeemed: number;
  loyalty_discount_in_paise: number;
  total_in_paise: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  order_items: Array<{
    product_name: string;
    product_code: string;
    quantity: number;
    unit_price_in_paise: number;
  }>;
  shipments?: Array<{
    carrier: string;
    status: string;
    awb_number?: string;
  }>;
}

interface RawLoyaltyAccount {
  points_balance: number;
  lifetime_points_earned: number;
  tier: string;
}

export default function AdminReports() {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<ReportTab>('financial');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<RawLoyaltyAccount[]>([]);
  const [refundCount, setRefundCount] = useState(0);
  const [totalRefundPaise, setTotalRefundPaise] = useState(0);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders with Items & Shipments
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          subtotal_in_paise,
          discount_in_paise,
          shipping_fee_in_paise,
          loyalty_points_redeemed,
          loyalty_discount_in_paise,
          total_in_paise,
          order_status,
          payment_status,
          created_at,
          order_items (
            product_name,
            product_code,
            quantity,
            unit_price_in_paise
          ),
          shipments (
            carrier,
            status,
            awb_number
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;
      setOrders((ordersData as any) || []);

      // 2. Fetch Loyalty Accounts for Liability Ledger
      const { data: loyaltyData } = await supabase
        .from('loyalty_accounts')
        .select('points_balance, lifetime_points_earned, tier');

      setLoyaltyAccounts((loyaltyData as any) || []);

      // 3. Count Refunds
      const cancelledOrders = (ordersData || []).filter(
        (o: any) => o.order_status === 'CANCELLED' || o.payment_status === 'REFUNDED'
      );
      setRefundCount(cancelledOrders.length);
      setTotalRefundPaise(
        cancelledOrders.reduce((sum: number, o: any) => sum + (o.total_in_paise || 0), 0)
      );
    } catch (err: any) {
      console.error('Failed to load report metrics:', err);
      showNotification('Failed to load analytics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Filter orders by chosen date range
  const filteredOrders = useMemo(() => {
    if (dateRange === 'all') return orders;

    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return orders.filter((o) => new Date(o.created_at) >= cutoff);
  }, [orders, dateRange]);

  // Financial Metrics Computation
  const financialMetrics = useMemo(() => {
    const paidOrders = filteredOrders.filter(
      (o) => o.payment_status === 'SUCCESS' || (o.order_status !== 'PENDING_PAYMENT' && o.order_status !== 'CANCELLED')
    );

    const gmvPaise = paidOrders.reduce((sum, o) => sum + (o.subtotal_in_paise || 0), 0);
    const discountsPaise = paidOrders.reduce((sum, o) => sum + (o.discount_in_paise || 0), 0);
    const loyaltyDiscountsPaise = paidOrders.reduce((sum, o) => sum + (o.loyalty_discount_in_paise || 0), 0);
    const shippingPaise = paidOrders.reduce((sum, o) => sum + (o.shipping_fee_in_paise || 0), 0);
    const netBankedPaise = paidOrders.reduce((sum, o) => sum + (o.total_in_paise || 0), 0);

    const aovRupees = paidOrders.length > 0 ? Math.round(netBankedPaise / 100 / paidOrders.length) : 0;

    return {
      orderCount: paidOrders.length,
      gmvRupees: gmvPaise / 100,
      discountsRupees: discountsPaise / 100,
      loyaltyDiscountsRupees: loyaltyDiscountsPaise / 100,
      shippingRupees: shippingPaise / 100,
      netBankedRupees: netBankedPaise / 100,
      aovRupees,
    };
  }, [filteredOrders]);

  // Product Velocity Computation
  const productVelocity = useMemo(() => {
    const productMap: Record<
      string,
      { name: string; code: string; unitsSold: number; revenuePaise: number }
    > = {};

    filteredOrders.forEach((o) => {
      if (o.order_status === 'CANCELLED') return;
      (o.order_items || []).forEach((item) => {
        const code = item.product_code || item.product_name;
        if (!productMap[code]) {
          productMap[code] = {
            name: item.product_name,
            code: item.product_code,
            unitsSold: 0,
            revenuePaise: 0,
          };
        }
        productMap[code].unitsSold += item.quantity || 1;
        productMap[code].revenuePaise += (item.unit_price_in_paise || 0) * (item.quantity || 1);
      });
    });

    return Object.values(productMap).sort((a, b) => b.revenuePaise - a.revenuePaise);
  }, [filteredOrders]);

  // Loyalty Program Metrics
  const loyaltyMetrics = useMemo(() => {
    const totalPointsInCirculation = loyaltyAccounts.reduce((sum, a) => sum + (a.points_balance || 0), 0);
    const lifetimeEarned = loyaltyAccounts.reduce((sum, a) => sum + (a.lifetime_points_earned || 0), 0);
    const liabilityRupees = totalPointsInCirculation * 0.5; // 1 Petal Point = 50 paise

    const tierCounts = {
      FLORET: loyaltyAccounts.filter((a) => a.tier === 'FLORET' || !a.tier).length,
      BLOSSOM: loyaltyAccounts.filter((a) => a.tier === 'BLOSSOM').length,
      BLOOM: loyaltyAccounts.filter((a) => a.tier === 'BLOOM').length,
      HEIRLOOM: loyaltyAccounts.filter((a) => a.tier === 'HEIRLOOM').length,
    };

    return {
      totalPatrons: loyaltyAccounts.length,
      totalPointsInCirculation,
      lifetimeEarned,
      liabilityRupees,
      tierCounts,
    };
  }, [loyaltyAccounts]);

  // Logistics & Carrier Breakdown
  const logisticsMetrics = useMemo(() => {
    const carrierMap: Record<string, number> = {
      DELHIVERY: 0,
      SHIPROCKET: 0,
      INDIA_POST: 0,
      UNASSIGNED: 0,
    };

    const statusMap: Record<string, number> = {
      CONFIRMED: 0,
      PROCESSING: 0,
      PACKED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
    };

    filteredOrders.forEach((o) => {
      const carrier = o.shipments?.[0]?.carrier || 'UNASSIGNED';
      carrierMap[carrier] = (carrierMap[carrier] || 0) + 1;

      const st = o.order_status;
      if (st === 'PAYMENT_CONFIRMED' || st === 'ORDER_CONFIRMED') statusMap.CONFIRMED++;
      else if (st === 'PROCESSING') statusMap.PROCESSING++;
      else if (st === 'PACKED') statusMap.PACKED++;
      else if (st === 'SHIPPED') statusMap.SHIPPED++;
      else if (st === 'DELIVERED') statusMap.DELIVERED++;
    });

    const totalShippedOrDelivered = (statusMap.SHIPPED || 0) + (statusMap.DELIVERED || 0);
    const deliveryRate = totalShippedOrDelivered > 0 ? Math.round((statusMap.DELIVERED / totalShippedOrDelivered) * 100) : 0;

    return { carrierMap, statusMap, deliveryRate };
  }, [filteredOrders]);

  // CSV Export Handlers
  const exportFinancialReport = () => {
    const headers = ['Financial Metric', 'Value (INR)', 'Note'];
    const rows = [
      ['Gross Merchandise Value (GMV)', financialMetrics.gmvRupees.toFixed(2), 'Total catalog value ordered'],
      ['Coupon Discounts Given', financialMetrics.discountsRupees.toFixed(2), 'Promotional code deductions'],
      ['Loyalty Points Redeemed', financialMetrics.loyaltyDiscountsRupees.toFixed(2), 'Petal points redeemed at checkout'],
      ['Shipping Fees Collected', financialMetrics.shippingRupees.toFixed(2), 'Courier delivery charges'],
      ['Refunds Issued', (totalRefundPaise / 100).toFixed(2), `${refundCount} cancelled/refunded orders`],
      ['Net Banked Sales', financialMetrics.netBankedRupees.toFixed(2), 'Actual captured revenue in bank account'],
      ['Average Order Value (AOV)', financialMetrics.aovRupees.toFixed(2), 'Net revenue per order'],
    ];

    downloadCSV(`tpb_financial_reconciliation_${dateRange}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'reports',
      entity_id: 'financial_reconciliation',
      new_values: { range: dateRange, netBanked: financialMetrics.netBankedRupees },
      reason: 'Admin exported financial cash reconciliation report',
    });
    showNotification('Exported Financial Reconciliation Report to CSV!', 'success');
  };

  const exportVelocityReport = () => {
    const headers = ['Rank', 'Product Name', 'Product Code', 'Units Sold', 'Total Revenue (INR)'];
    const rows = productVelocity.map((p, idx) => [
      idx + 1,
      p.name,
      p.code,
      p.unitsSold,
      (p.revenuePaise / 100).toFixed(2),
    ]);

    downloadCSV(`tpb_product_velocity_${dateRange}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'reports',
      entity_id: 'product_velocity',
      new_values: { range: dateRange, totalPieces: productVelocity.length },
      reason: 'Admin exported crafting & product velocity report',
    });
    showNotification('Exported Product Velocity Report to CSV!', 'success');
  };

  return (
    <AdminLayout activePage="reports" as any>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Business Intelligence &amp; Auditing
            </p>
            <h1 className="heading-serif text-4xl text-bark">Executive Reports</h1>
            <p className="text-xs text-ink-light mt-1">
              Authoritative cash reconciliation, artisan velocity, loyalty balance sheet liabilities, and carrier SLAs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center bg-linen border border-canvas-line rounded-sm p-1 text-xs font-medium text-bark">
              {(['7d', '30d', '90d', 'all'] as DateRangeOption[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1 rounded-sm transition-all ${
                    dateRange === range
                      ? 'bg-ink text-white shadow-soft'
                      : 'hover:bg-canvas/50 text-ink-light hover:text-ink'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? 'Quarter' : 'All Time'}
                </button>
              ))}
            </div>

            <button
              onClick={fetchReportData}
              disabled={loading}
              className="px-3.5 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-2 transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-2 border-b border-canvas-line pb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'financial'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <Receipt size={16} className={activeTab === 'financial' ? 'text-rose' : ''} />
            1. Cash &amp; Financial Reconciliation
          </button>

          <button
            onClick={() => setActiveTab('velocity')}
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'velocity'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <TrendingUp size={16} className={activeTab === 'velocity' ? 'text-rose' : ''} />
            2. Product Velocity &amp; Crafting
          </button>

          <button
            onClick={() => setActiveTab('loyalty')}
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'loyalty'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <Award size={16} className={activeTab === 'loyalty' ? 'text-rose' : ''} />
            3. Loyalty Liability Ledger
          </button>

          <button
            onClick={() => setActiveTab('logistics')}
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'logistics'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <Truck size={16} className={activeTab === 'logistics' ? 'text-rose' : ''} />
            4. Logistics &amp; Carrier SLA
          </button>
        </nav>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-rose" />
            <p className="text-xs text-ink-light">Aggregating transactional records &amp; ledger balances...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* TAB 1: FINANCIAL & CASH RECONCILIATION */}
            {activeTab === 'financial' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Executive Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Gross Sales (GMV)
                    </span>
                    <p className="font-serif text-3xl text-bark mt-2">
                      {formatPrice(financialMetrics.gmvRupees)}
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Catalog value across {financialMetrics.orderCount} paid orders</p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Promos &amp; Points Deductions
                    </span>
                    <p className="font-serif text-3xl text-rose-deep mt-2">
                      -{formatPrice(financialMetrics.discountsRupees + financialMetrics.loyaltyDiscountsRupees)}
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">
                      ₹{financialMetrics.discountsRupees} coupons + ₹{financialMetrics.loyaltyDiscountsRupees} petal points
                    </p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Shipping Fees Collected
                    </span>
                    <p className="font-serif text-3xl text-bark mt-2">
                      +{formatPrice(financialMetrics.shippingRupees)}
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Customer logistics contributions</p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border-2 border-emerald-700/40 shadow-soft bg-emerald-50/20">
                    <span className="text-[11px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Net Banked Cash
                    </span>
                    <p className="font-serif text-3xl text-emerald-900 font-bold mt-2">
                      {formatPrice(financialMetrics.netBankedRupees)}
                    </p>
                    <p className="text-[11px] text-emerald-800/80 mt-1">Captured in Cashfree / Bank</p>
                  </div>
                </div>

                {/* Accounting Reconciliation Table */}
                <div className="bg-linen rounded-sm border border-canvas-line shadow-soft p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-canvas-line">
                    <div>
                      <h3 className="heading-serif text-xl text-bark">Financial Waterfall Breakdown</h3>
                      <p className="text-xs text-ink-light">Comprehensive accounting breakdown matching bank deposit records.</p>
                    </div>

                    <button
                      onClick={exportFinancialReport}
                      className="px-3.5 py-1.5 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all self-start sm:self-auto"
                    >
                      <Download size={14} className="text-emerald-700" />
                      Export Financial CSV
                    </button>
                  </div>

                  <div className="divide-y divide-canvas-line text-xs">
                    <div className="py-3 flex justify-between items-center">
                      <span className="text-ink font-medium">1. Gross Merchandise Value (GMV)</span>
                      <span className="font-mono font-semibold text-bark text-sm">{formatPrice(financialMetrics.gmvRupees)}</span>
                    </div>
                    <div className="py-3 flex justify-between items-center text-rose-deep">
                      <span>2. Less: Promotional Coupon Discounts</span>
                      <span className="font-mono font-semibold">-{formatPrice(financialMetrics.discountsRupees)}</span>
                    </div>
                    <div className="py-3 flex justify-between items-center text-rose-deep">
                      <span>3. Less: Petal Points Redeemed at Checkout</span>
                      <span className="font-mono font-semibold">-{formatPrice(financialMetrics.loyaltyDiscountsRupees)}</span>
                    </div>
                    <div className="py-3 flex justify-between items-center text-bark">
                      <span>4. Plus: Shipping Fees Collected from Patrons</span>
                      <span className="font-mono font-semibold">+{formatPrice(financialMetrics.shippingRupees)}</span>
                    </div>
                    <div className="py-3 flex justify-between items-center text-red-700">
                      <span>5. Less: Refunds / Cancellations ({refundCount} orders)</span>
                      <span className="font-mono font-semibold">-{formatPrice(totalRefundPaise / 100)}</span>
                    </div>
                    <div className="py-4 flex justify-between items-center bg-canvas/30 px-3 rounded-sm font-bold text-sm">
                      <span className="text-bark uppercase tracking-wider">Authoritative Net Banked Revenue</span>
                      <span className="font-mono text-emerald-800 text-base">
                        {formatPrice(financialMetrics.netBankedRupees)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRODUCT VELOCITY & CRAFTING */}
            {activeTab === 'velocity' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-linen rounded-sm border border-canvas-line shadow-soft p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-canvas-line">
                    <div>
                      <h3 className="heading-serif text-xl text-bark">Studio Crafting &amp; Sales Velocity</h3>
                      <p className="text-xs text-ink-light">Ranking pieces by crafting volume and revenue contribution.</p>
                    </div>

                    <button
                      onClick={exportVelocityReport}
                      disabled={productVelocity.length === 0}
                      className="px-3.5 py-1.5 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all self-start sm:self-auto"
                    >
                      <Download size={14} className="text-rose" />
                      Export Velocity CSV
                    </button>
                  </div>

                  {productVelocity.length === 0 ? (
                    <div className="py-12 text-center text-xs text-ink-light italic">
                      No product sales recorded in this time range.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-canvas/50 text-bark font-mono uppercase tracking-wider border-b border-canvas-line">
                          <tr>
                            <th className="p-3">Rank</th>
                            <th className="p-3">Floral Creation</th>
                            <th className="p-3">Code</th>
                            <th className="p-3 text-center">Units Crafted</th>
                            <th className="p-3 text-right">Revenue Generated</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-canvas-line bg-parchment/20">
                          {productVelocity.map((item, idx) => (
                            <tr key={item.code} className="hover:bg-canvas/30 transition-colors">
                              <td className="p-3 font-mono font-bold text-bark/60">{idx + 1}</td>
                              <td className="p-3 font-semibold text-ink">{item.name}</td>
                              <td className="p-3 font-mono text-bark">{item.code}</td>
                              <td className="p-3 text-center font-bold text-ink">{item.unitsSold} pcs</td>
                              <td className="p-3 text-right font-serif font-medium text-sm text-bark">
                                {formatPrice(item.revenuePaise / 100)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: LOYALTY BALANCE SHEET LIABILITY */}
            {activeTab === 'loyalty' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Points in Circulation
                    </span>
                    <p className="font-serif text-3xl text-bark mt-2">
                      {loyaltyMetrics.totalPointsInCirculation.toLocaleString('en-IN')} pts
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Outstanding active Petal Points</p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Lifetime Points Issued
                    </span>
                    <p className="font-serif text-3xl text-emerald-800 mt-2">
                      {loyaltyMetrics.lifetimeEarned.toLocaleString('en-IN')} pts
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Total points granted across studio lifetime</p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border-2 border-rose/30 shadow-soft bg-rose/5">
                    <span className="text-[11px] uppercase tracking-wider text-rose-deep font-bold">
                      Balance Sheet Liability
                    </span>
                    <p className="font-serif text-3xl text-rose-deep font-bold mt-2">
                      {formatPrice(loyaltyMetrics.liabilityRupees)}
                    </p>
                    <p className="text-[11px] text-rose-deep/80 mt-1">At ₹0.50 per Petal Point redemption value</p>
                  </div>
                </div>

                {/* Tier Distribution Breakdown */}
                <div className="bg-linen rounded-sm border border-canvas-line shadow-soft p-6 space-y-4">
                  <h3 className="heading-serif text-xl text-bark">Patron Tier Distribution</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    <div className="p-4 bg-canvas/40 rounded-sm border border-canvas-line text-center">
                      <p className="text-[10px] uppercase font-bold text-ink-light">Floret (Tier 1)</p>
                      <p className="font-serif text-2xl text-bark mt-1">{loyaltyMetrics.tierCounts.FLORET}</p>
                      <p className="text-[10px] text-ink-light">1 pt / ₹20</p>
                    </div>
                    <div className="p-4 bg-canvas/40 rounded-sm border border-canvas-line text-center">
                      <p className="text-[10px] uppercase font-bold text-emerald-800">Blossom (Tier 2)</p>
                      <p className="font-serif text-2xl text-emerald-900 mt-1">{loyaltyMetrics.tierCounts.BLOSSOM}</p>
                      <p className="text-[10px] text-ink-light">1.25x Earning</p>
                    </div>
                    <div className="p-4 bg-canvas/40 rounded-sm border border-canvas-line text-center">
                      <p className="text-[10px] uppercase font-bold text-rose">Bloom (Tier 3)</p>
                      <p className="font-serif text-2xl text-rose-deep mt-1">{loyaltyMetrics.tierCounts.BLOOM}</p>
                      <p className="text-[10px] text-ink-light">1.5x Earning</p>
                    </div>
                    <div className="p-4 bg-canvas/40 rounded-sm border border-canvas-line text-center">
                      <p className="text-[10px] uppercase font-bold text-purple-700">Heirloom (VIP)</p>
                      <p className="font-serif text-2xl text-purple-900 mt-1">{loyaltyMetrics.tierCounts.HEIRLOOM}</p>
                      <p className="text-[10px] text-ink-light">2x + Atelier Gifts</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: LOGISTICS & CARRIER SLA */}
            {activeTab === 'logistics' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Delivery Completion Rate
                    </span>
                    <p className="font-serif text-3xl text-emerald-800 mt-2">
                      {logisticsMetrics.deliveryRate}%
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Dispatches marked Delivered</p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Shiprocket Volume
                    </span>
                    <p className="font-serif text-3xl text-bark mt-2">
                      {logisticsMetrics.carrierMap.SHIPROCKET || 0} parcels
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Automated API bookings</p>
                  </div>

                  <div className="bg-linen p-6 rounded-sm border border-canvas-line shadow-soft">
                    <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                      Delhivery Direct Volume
                    </span>
                    <p className="font-serif text-3xl text-bark mt-2">
                      {logisticsMetrics.carrierMap.DELHIVERY || 0} parcels
                    </p>
                    <p className="text-[11px] text-ink-light mt-1">Direct surface express</p>
                  </div>
                </div>

                {/* Pipeline Status Breakdown */}
                <div className="bg-linen rounded-sm border border-canvas-line shadow-soft p-6 space-y-4">
                  <h3 className="heading-serif text-xl text-bark">Studio Fulfillment Pipeline</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                    <div className="p-3 bg-canvas/30 rounded border border-canvas-line">
                      <span className="text-[10px] uppercase font-bold text-ink-light">1. Confirmed</span>
                      <p className="font-serif text-2xl text-bark mt-1">{logisticsMetrics.statusMap.CONFIRMED || 0}</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded border border-amber-200">
                      <span className="text-[10px] uppercase font-bold text-amber-800">2. In Crafting</span>
                      <p className="font-serif text-2xl text-amber-900 mt-1">{logisticsMetrics.statusMap.PROCESSING || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <span className="text-[10px] uppercase font-bold text-blue-800">3. Packed</span>
                      <p className="font-serif text-2xl text-blue-900 mt-1">{logisticsMetrics.statusMap.PACKED || 0}</p>
                    </div>
                    <div className="p-3 bg-sky-50 rounded border border-sky-200">
                      <span className="text-[10px] uppercase font-bold text-sky-800">4. Shipped</span>
                      <p className="font-serif text-2xl text-sky-900 mt-1">{logisticsMetrics.statusMap.SHIPPED || 0}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-800">5. Delivered</span>
                      <p className="font-serif text-2xl text-emerald-900 mt-1">{logisticsMetrics.statusMap.DELIVERED || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
