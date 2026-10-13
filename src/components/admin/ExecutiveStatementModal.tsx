import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Calendar,
  Loader2,
  TrendingUp,
  Download,
  CheckCircle2,
  FileText,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/apiClient';
import { useSiteAssets, getDynamicAsset } from '@/context/SiteAssetsContext';
import { SITE_ASSET_KEYS } from '@/utils/siteAssetKeys';
import {
  RawMaterialProcurement,
  MaterialType,
  ColorFamily,
  MATERIAL_TYPE_LABELS,
  COLOR_FAMILY_LABELS,
} from '@/types/procurement';

interface ExecutiveStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  preloadedProcurements?: RawMaterialProcurement[];
}

type TimelinePreset = 'current_month' | 'last_month' | 'ytd' | 'custom';

interface AggregatedProduct {
  name: string;
  code: string;
  unitsSold: number;
  revenueRupees: number;
  unitPriceRupees: number;
  sharePercent: number;
}

export default function ExecutiveStatementModal({
  isOpen,
  onClose,
  preloadedProcurements = [],
}: ExecutiveStatementModalProps) {
  // Official Atelier Brand Logo from Assets
  const { assets } = useSiteAssets();
  const [logoLoadError, setLogoLoadError] = useState(false);
  const uploadedLogoUrl = getDynamicAsset(assets, SITE_ASSET_KEYS.LOGO);
  const activeLogo = !logoLoadError && uploadedLogoUrl ? uploadedLogoUrl : '/logo.jpeg';

  // Timeline State
  const [timelineOption, setTimelineOption] = useState<TimelinePreset>('ytd');
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const firstOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [customStartDate, setCustomStartDate] = useState('2026-09-01');
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Data Loading
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [procurements, setProcurements] = useState<RawMaterialProcurement[]>(preloadedProcurements);
  const [storeSettings, setStoreSettings] = useState<any>({
    legal_business_name: 'The Petal & Bloom Studio',
    studio_address: 'Handmade Floral Craft Studio, India',
    support_email: 'concierge@thepetalandbloom.com',
    whatsapp_number: '+919861615937',
    gstin: 'GSTIN-PENDING-UNREGISTERED',
  });

  // Calculate actual Date Range based on selected preset
  const { dateRangeStart, dateRangeEnd, periodLabel } = useMemo(() => {
    if (timelineOption === 'current_month') {
      return {
        dateRangeStart: firstOfMonthStr,
        dateRangeEnd: todayStr,
        periodLabel: `October 2026 (Month-to-Date)`,
      };
    } else if (timelineOption === 'last_month') {
      return {
        dateRangeStart: '2026-09-01',
        dateRangeEnd: '2026-09-30',
        periodLabel: `September 2026 (Full Month)`,
      };
    } else if (timelineOption === 'ytd') {
      return {
        dateRangeStart: '2026-09-01',
        dateRangeEnd: todayStr,
        periodLabel: `All Time / Inception to Date (01 Sep 2026 – ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`,
      };
    } else {
      return {
        dateRangeStart: customStartDate || '2026-09-01',
        dateRangeEnd: customEndDate || todayStr,
        periodLabel: `${customStartDate} to ${customEndDate}`,
      };
    }
  }, [timelineOption, customStartDate, customEndDate, firstOfMonthStr, todayStr]);

  // Fetch orders with order_items, procurements, and store settings
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadReportData() {
      setLoading(true);
      try {
        // 1. Fetch Orders and nested Order Items
        const { data: ordersData, error: ordersErr } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            guest_name,
            guest_phone,
            guest_email,
            subtotal_in_paise,
            discount_in_paise,
            shipping_fee_in_paise,
            total_in_paise,
            order_status,
            payment_status,
            created_at,
            order_items (
              product_name,
              product_code,
              quantity,
              unit_price_in_paise,
              total_price_in_paise
            )
          `)
          .neq('order_status', 'CANCELLED')
          .gte('created_at', `${dateRangeStart}T00:00:00Z`)
          .lte('created_at', `${dateRangeEnd}T23:59:59Z`)
          .order('created_at', { ascending: false });

        if (ordersErr) console.warn('[Statement] Orders fetch warning:', ordersErr);

        // 2. Fetch Material Procurements (API first for auth bypass, then direct Supabase, then preloaded fallback)
        let loadedProcurements: RawMaterialProcurement[] = [];
        try {
          const matRes = await authFetch('/api/admin/materials?range=all');
          if (matRes.ok) {
            const matJson = await matRes.json();
            if (matJson.success && Array.isArray(matJson.procurements) && matJson.procurements.length > 0) {
              loadedProcurements = matJson.procurements;
            }
          }
        } catch {
          // ignore
        }

        if (loadedProcurements.length === 0) {
          const { data: procData } = await supabase
            .from('raw_material_procurements')
            .select('*')
            .order('purchase_date', { ascending: false });
          if (procData && procData.length > 0) {
            loadedProcurements = procData as RawMaterialProcurement[];
          }
        }

        if (loadedProcurements.length === 0 && preloadedProcurements.length > 0) {
          loadedProcurements = preloadedProcurements;
        }

        const filteredProcurements = loadedProcurements.filter((p) => {
          if (!p.purchase_date) return true;
          return p.purchase_date >= dateRangeStart && p.purchase_date <= dateRangeEnd;
        });

        // 3. Fetch Store Settings
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('*')
          .eq('id', 'primary')
          .maybeSingle();

        if (isMounted) {
          if (ordersData) setOrders(ordersData);
          setProcurements(filteredProcurements);
          if (settingsData) setStoreSettings(settingsData);
        }
      } catch (err) {
        console.error('[Statement] Data load error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReportData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, dateRangeStart, dateRangeEnd]);

  // Financial & Operational Aggregations
  const reportMetrics = useMemo(() => {
    // 1. Sales Realization
    const totalSalesPaise = orders.reduce((sum, o) => sum + (Number(o.total_in_paise) || 0), 0);
    const totalSalesRupees = Math.round(totalSalesPaise / 100);
    const totalOrdersCount = orders.length;
    const aovRupees = totalOrdersCount > 0 ? Math.round(totalSalesRupees / totalOrdersCount) : 0;

    // 2. Material Procurement Spend
    const totalProcurementPaise = procurements.reduce(
      (sum, p) => sum + (Number(p.price_in_paise) || 0),
      0
    );
    const totalProcurementRupees = Math.round(totalProcurementPaise / 100);

    // Category Spend Map
    const spendByType: Record<MaterialType, number> = {
      YARN: 0,
      PIPE_CLEANER: 0,
      FLORAL_WIRE: 0,
      PACKAGING: 0,
      TOOLS: 0,
      OTHER: 0,
    };
    procurements.forEach((p) => {
      const t = p.material_type || 'OTHER';
      spendByType[t] = (spendByType[t] || 0) + (Number(p.price_in_paise) || 0);
    });

    // Color Spend Map
    const spendByColorMap: Record<string, { paise: number; count: number }> = {};
    Object.keys(COLOR_FAMILY_LABELS).forEach((c) => {
      spendByColorMap[c] = { paise: 0, count: 0 };
    });
    procurements.forEach((p) => {
      const c = p.color_family || 'OTHER';
      if (!spendByColorMap[c]) spendByColorMap[c] = { paise: 0, count: 0 };
      spendByColorMap[c].paise += Number(p.price_in_paise) || 0;
      spendByColorMap[c].count += 1;
    });

    const spendByColor = Object.entries(spendByColorMap)
      .map(([key, item]) => ({
        key: key as ColorFamily,
        name: COLOR_FAMILY_LABELS[key as ColorFamily]?.name || key,
        hex: COLOR_FAMILY_LABELS[key as ColorFamily]?.hex || '#8A7D72',
        rupees: Math.round(item.paise / 100),
        count: item.count,
        percent:
          totalProcurementRupees > 0
            ? Math.round((Math.round(item.paise / 100) / totalProcurementRupees) * 100)
            : 0,
      }))
      .sort((a, b) => b.rupees - a.rupees);

    // 3. P&L Net Cash Profit & Margins
    const netProfitRupees = totalSalesRupees - totalProcurementRupees;
    const netMarginPercent =
      totalSalesRupees > 0 ? ((netProfitRupees / totalSalesRupees) * 100).toFixed(1) : '0';
    const materialSpendPercent =
      totalSalesRupees > 0 ? ((totalProcurementRupees / totalSalesRupees) * 100).toFixed(1) : '0';
    const capitalMultiplier =
      totalProcurementRupees > 0 ? (totalSalesRupees / totalProcurementRupees).toFixed(2) : '0';

    // 4. Product-Wise Performance Matrix
    const productAggMap: Record<string, { name: string; code: string; units: number; paise: number }> = {};
    orders.forEach((o) => {
      const items = Array.isArray(o.order_items) ? o.order_items : [];
      items.forEach((item: any) => {
        const key = item.product_code || item.product_name || 'UNKNOWN';
        if (!productAggMap[key]) {
          productAggMap[key] = {
            name: item.product_name || 'Artisan Handcrafted Piece',
            code: item.product_code || 'TPB-BQT',
            units: 0,
            paise: 0,
          };
        }
        const qty = Number(item.quantity) || 1;
        const price =
          Number(item.total_price_in_paise) ||
          qty * (Number(item.unit_price_in_paise) || 0);
        productAggMap[key].units += qty;
        productAggMap[key].paise += price;
      });
    });

    const products: AggregatedProduct[] = Object.values(productAggMap)
      .map((p) => {
        const rupees = Math.round(p.paise / 100);
        const share = totalSalesRupees > 0 ? Number(((rupees / totalSalesRupees) * 100).toFixed(1)) : 0;
        return {
          name: p.name,
          code: p.code,
          unitsSold: p.units,
          revenueRupees: rupees,
          unitPriceRupees: p.units > 0 ? Math.round(rupees / p.units) : 0,
          sharePercent: share,
        };
      })
      .sort((a, b) => b.revenueRupees - a.revenueRupees);

    // 5. Unique Customers Count
    const uniqueCustomers = new Set(
      orders.map((o) => o.guest_phone || o.guest_email || o.customer_id).filter(Boolean)
    ).size;

    return {
      totalSalesRupees,
      totalOrdersCount,
      aovRupees,
      totalProcurementRupees,
      spendByType,
      spendByColor,
      netProfitRupees,
      netMarginPercent,
      materialSpendPercent,
      capitalMultiplier,
      products,
      uniqueCustomers,
    };
  }, [orders, procurements]);

  // Trigger high-resolution browser print to PDF
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="executive-statement-overlay fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:overflow-visible">
      {/* Scoped Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 10mm 10mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          /* Completely remove background app from print layout */
          #root {
            display: none !important;
          }
          .no-print {
            display: none !important;
          }
          .executive-statement-overlay {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
            height: auto !important;
            max-height: none !important;
          }
          .executive-statement-dialog {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            background: transparent !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .executive-statement-scroll {
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          #executive-statement-sheet {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Main Modal Card */}
      <div className="executive-statement-dialog bg-white w-full max-w-5xl rounded-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="bg-stone-900 text-stone-100 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
              {activeLogo ? (
                <img src={activeLogo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <FileText size={15} />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase">
                Executive Atelier Statement Generator
              </h2>
              <p className="text-[11px] text-stone-400">
                Print or Save on-demand PDF report with embedded infographics &amp; P&amp;L audit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={14} />
              Save / Print PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded hover:bg-stone-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Timeline Filter Controls (Hidden on print) */}
        <div className="bg-stone-50 border-b border-stone-200 p-3 sm:p-4 no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1 flex items-center gap-1">
              <Calendar size={13} />
              Timeline:
            </span>

            <button
              onClick={() => setTimelineOption('ytd')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                timelineOption === 'ytd'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              All Time (Since Launch)
            </button>

            <button
              onClick={() => setTimelineOption('current_month')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                timelineOption === 'current_month'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              This Month (Oct 2026)
            </button>

            <button
              onClick={() => setTimelineOption('last_month')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                timelineOption === 'last_month'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Last Month (Sep 2026)
            </button>

            <button
              onClick={() => setTimelineOption('custom')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                timelineOption === 'custom'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
              }`}
            >
              Custom Calendar
            </button>
          </div>

          {/* Custom Date Pickers */}
          {timelineOption === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-stone-300 rounded px-2.5 py-1 text-stone-800 outline-none focus:border-rose-700"
              />
              <span className="text-stone-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-stone-300 rounded px-2.5 py-1 text-stone-800 outline-none focus:border-rose-700"
              />
            </div>
          )}
        </div>

        {/* Scrollable Preview Container */}
        <div className="executive-statement-scroll overflow-y-auto p-4 sm:p-8 bg-stone-100 print:bg-white print:p-0 print:overflow-visible">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-stone-500">
              <Loader2 size={32} className="animate-spin text-rose-700 mb-2" />
              <p className="text-xs font-medium">Aggregating atelier sales &amp; procurement data...</p>
            </div>
          ) : (
            /* ════════════════════════════════════════════════════════════
                 THE A4 DOCUMENT SHEET (Pure Print Ready Layout)
            ═════════════════════════════════════════════════════════════ */
            <div
              id="executive-statement-sheet"
              className="bg-white max-w-4xl mx-auto p-5 sm:p-8 border border-stone-300 shadow-md rounded-xs print:border-none print:shadow-none print:p-0 space-y-4 print:space-y-3.5 text-stone-800 text-xs"
            >
              {/* 1. ATELIER BRAND HEADER */}
              <header className="border-b-2 border-stone-800 pb-3 print:pb-2.5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* Official Atelier Brand Logo from Assets */}
                    {activeLogo ? (
                      <img
                        src={activeLogo}
                        alt={storeSettings.legal_business_name || 'The Petal & Bloom'}
                        onError={() => setLogoLoadError(true)}
                        className="w-12 h-12 rounded-full object-cover border-2 border-rose-800 shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-stone-900 text-stone-100 flex items-center justify-center font-serif text-lg font-bold border-2 border-rose-800 shrink-0">
                        PB
                      </div>
                    )}
                    <div>
                      <h1 className="text-xl sm:text-2xl font-serif tracking-wider font-bold text-stone-900 uppercase">
                        {storeSettings.legal_business_name || 'The Petal & Bloom Studio'}
                      </h1>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-rose-800 font-bold">
                        Artisan Floral Craft Atelier · Performance &amp; P&amp;L Statement
                      </p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        {storeSettings.studio_address || 'Handmade Floral Craft Studio, India'} · {storeSettings.support_email} · {storeSettings.whatsapp_number}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right font-mono text-[11px] bg-stone-50 p-2.5 rounded border border-stone-200">
                    <p className="font-bold text-stone-900 uppercase tracking-widest text-[11px]">
                      STATEMENT # TPB-STMT-{todayStr.replace(/-/g, '').slice(0, 6)}
                    </p>
                    <p className="text-stone-600 mt-0.5">
                      <span className="text-stone-400">Period:</span> <strong>{periodLabel}</strong>
                    </p>
                    <p className="text-stone-500 text-[10px]">
                      Generated: {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </header>

              {/* 2. EXECUTIVE FINANCIAL P&L SNAPSHOT */}
              <section className="avoid-break space-y-2.5 print:space-y-2">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-rose-700 rounded-xs"></span>
                  1. Executive Financial Realization &amp; Operating Margins
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-2">
                  {/* Gross Sales */}
                  <div className="p-2.5 sm:p-3 bg-stone-50 border border-stone-200 rounded print:p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Gross Sales Realized</p>
                    <p className="text-xl sm:text-2xl font-serif font-bold text-stone-900 mt-0.5">
                      ₹{reportMetrics.totalSalesRupees.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-sky-800 font-semibold bg-sky-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {reportMetrics.totalOrdersCount} Customer Orders
                    </span>
                  </div>

                  {/* Material Invested */}
                  <div className="p-2.5 sm:p-3 bg-stone-50 border border-stone-200 rounded print:p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Material Spend (Invested)</p>
                    <p className="text-xl sm:text-2xl font-serif font-bold text-rose-700 mt-0.5">
                      ₹{reportMetrics.totalProcurementRupees.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-rose-800 font-semibold bg-rose-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {procurements.length} Raw Inward Purchases
                    </span>
                  </div>

                  {/* Net Cash Profit */}
                  <div className="p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-200 rounded print:p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Net Operating Profit</p>
                    <p className="text-xl sm:text-2xl font-serif font-bold text-emerald-700 mt-0.5">
                      {reportMetrics.netProfitRupees >= 0 ? '+' : ''}₹{reportMetrics.netProfitRupees.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/70 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {reportMetrics.netMarginPercent}% Profit Margin
                    </span>
                  </div>

                  {/* Capital Return Multiplier */}
                  <div className="p-2.5 sm:p-3 bg-stone-50 border border-stone-200 rounded print:p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Capital Multiplier (ROI)</p>
                    <p className="text-xl sm:text-2xl font-serif font-bold text-purple-800 mt-0.5">
                      {reportMetrics.capitalMultiplier}x
                    </p>
                    <span className="text-[10px] text-purple-800 font-semibold bg-purple-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      ₹{reportMetrics.capitalMultiplier} earned per ₹1 spent
                    </span>
                  </div>
                </div>

                {/* INFOGRAPHIC 1: Cashflow Realization Waterfall Bar */}
                <div className="bg-stone-50 border border-stone-200 rounded p-2.5 sm:p-3 print:p-2.5">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                      Cashflow Realization Spectrum (Where Did the Revenue Go?)
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono">
                      Gross Turnover Realized: ₹{reportMetrics.totalSalesRupees.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Visual Split Bar */}
                  <div className="w-full h-3 bg-stone-200 rounded-sm overflow-hidden flex print:h-2.5">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, Number(reportMetrics.materialSpendPercent)))}%` }}
                      className="h-full bg-rose-600 transition-all"
                      title={`Material Cost: ₹${reportMetrics.totalProcurementRupees}`}
                    />
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, Number(reportMetrics.netMarginPercent)))}%` }}
                      className="h-full bg-emerald-600 transition-all"
                      title={`Net Profit: ₹${reportMetrics.netProfitRupees}`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] mt-2 pt-1 border-t border-stone-200 text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-rose-600"></span>
                      <span>Raw Material Capital Outflow: <strong>₹{reportMetrics.totalProcurementRupees.toLocaleString('en-IN')} ({reportMetrics.materialSpendPercent}%)</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600"></span>
                      <span>Net Cash in Hand (Operating Profit): <strong>+₹{reportMetrics.netProfitRupees.toLocaleString('en-IN')} ({reportMetrics.netMarginPercent}%)</strong></span>
                    </div>
                    <div className="text-stone-400 font-mono text-[10px]">
                      AOV: ₹{reportMetrics.aovRupees} across {reportMetrics.uniqueCustomers} unique buyers
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. PRODUCT-WISE SALES MATRIX & INFOGRAPHIC (Rows paginate cleanly) */}
              <section className="space-y-2 print:space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-rose-700 rounded-xs"></span>
                    2. Product Sales Matrix &amp; Revenue Contribution
                  </h3>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {reportMetrics.products.length} Catalog Items Sold
                  </span>
                </div>

                <div className="border border-stone-200 rounded overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="print:table-header-group">
                      <tr className="bg-stone-100 border-b border-stone-200 text-[10px] uppercase font-bold text-stone-600 print:bg-stone-200">
                        <th className="py-1.5 px-2.5 print:py-1">Bouquet / Creation</th>
                        <th className="py-1.5 px-2.5 text-center print:py-1">Units Sold</th>
                        <th className="py-1.5 px-2.5 text-right print:py-1">Avg Unit Price</th>
                        <th className="py-1.5 px-2.5 text-right print:py-1">Revenue Banked</th>
                        <th className="py-1.5 px-2.5 text-right print:py-1">Catalog Share</th>
                        <th className="py-1.5 px-2.5 text-center w-28 print:py-1">Performance Bar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-stone-700">
                      {reportMetrics.products.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-stone-400 font-medium">
                            No product sales recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        reportMetrics.products.map((p, idx) => (
                          <tr key={idx} className="hover:bg-stone-50 print:break-inside-avoid">
                            <td className="py-1.5 px-2.5 print:py-1 print:px-2">
                              <span className="font-bold text-stone-900 block leading-tight">{p.name}</span>
                              <span className="text-[10px] text-stone-400 font-mono">{p.code}</span>
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-mono font-bold text-stone-800 print:py-1">
                              {p.unitsSold} pcs
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono print:py-1">
                              ₹{p.unitPriceRupees.toLocaleString('en-IN')}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-stone-900 print:py-1">
                              ₹{p.revenueRupees.toLocaleString('en-IN')}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-rose-800 print:py-1">
                              {p.sharePercent}%
                            </td>
                            <td className="py-1.5 px-2.5 print:py-1">
                              <div className="w-full bg-stone-100 rounded h-1.5 overflow-hidden border border-stone-200">
                                <div
                                  className="h-full bg-rose-700 rounded"
                                  style={{ width: `${Math.min(100, p.sharePercent)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-stone-50 font-bold border-t border-stone-300 text-stone-900 print:break-inside-avoid">
                        <td className="py-1.5 px-2.5 print:py-1">Catalog Total Realized</td>
                        <td className="py-1.5 px-2.5 text-center font-mono print:py-1">
                          {reportMetrics.products.reduce((sum, p) => sum + p.unitsSold, 0)} Units
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono print:py-1">—</td>
                        <td className="py-1.5 px-2.5 text-right font-mono text-stone-900 font-bold print:py-1">
                          ₹{reportMetrics.totalSalesRupees.toLocaleString('en-IN')}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono print:py-1">100.0%</td>
                        <td className="py-1.5 px-2.5 print:py-1"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* 4. MATERIAL PROCUREMENT ALLOCATION & COLOR SPECTRUM */}
              <section className="space-y-2.5 print:space-y-2">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-rose-700 rounded-xs"></span>
                  3. Raw Material Allocation &amp; Color Spectrum
                </h3>

                {procurements.length === 0 ? (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded text-center text-stone-500">
                    <p className="font-semibold text-xs text-stone-700">Zero Raw Material Outlay Recorded</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      No material purchases were logged for this statement timeframe ({periodLabel}).
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 print:grid-cols-2 gap-3.5">
                    {/* Category Breakdown */}
                    <div className="border border-stone-200 rounded p-3 bg-stone-50/60 print:p-2.5">
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-stone-200">
                        <span className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                          Spend by Material Craft Category
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">
                          Invested: ₹{reportMetrics.totalProcurementRupees.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {(['YARN', 'PIPE_CLEANER', 'FLORAL_WIRE', 'PACKAGING', 'TOOLS', 'OTHER'] as MaterialType[])
                          .filter((t) => (reportMetrics.spendByType[t] || 0) > 0 || reportMetrics.totalProcurementRupees === 0)
                          .map((type) => {
                            const rupees = Math.round((reportMetrics.spendByType[type] || 0) / 100);
                            const pct =
                              reportMetrics.totalProcurementRupees > 0
                                ? Math.round((rupees / reportMetrics.totalProcurementRupees) * 100)
                                : 0;

                            return (
                              <div key={type}>
                                <div className="flex justify-between text-[11px] mb-0.5">
                                  <span className={rupees > 0 ? 'font-semibold text-stone-900' : 'text-stone-400'}>
                                    {MATERIAL_TYPE_LABELS[type]}
                                  </span>
                                  <span className="font-mono text-stone-800 font-medium">
                                    ₹{rupees.toLocaleString('en-IN')} ({pct}%)
                                  </span>
                                </div>
                                <div className="w-full bg-stone-200 h-1.5 rounded overflow-hidden">
                                  <div
                                    className={`h-full rounded ${
                                      type === 'YARN'
                                        ? 'bg-purple-800'
                                        : type === 'PIPE_CLEANER'
                                        ? 'bg-amber-600'
                                        : 'bg-sky-600'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Color Palette Spectrum */}
                    <div className="border border-stone-200 rounded p-3 bg-stone-50/60 print:p-2.5">
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-stone-200">
                        <span className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                          Color Family Procurement Spectrum
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">Top Pigments</span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {reportMetrics.spendByColor.filter((c) => c.rupees > 0).slice(0, 5).map((color) => (
                          <div key={color.key}>
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              <span className="flex items-center gap-1.5 font-medium text-stone-800">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span className="font-semibold text-stone-900">
                                  {color.name}
                                </span>
                              </span>
                              <span className="font-mono text-stone-800 font-medium">
                                ₹{color.rupees.toLocaleString('en-IN')} ({color.percent}%)
                              </span>
                            </div>
                            <div className="w-full bg-stone-200 h-1.5 rounded overflow-hidden">
                              <div
                                className="h-full rounded"
                                style={{
                                  width: `${color.percent}%`,
                                  backgroundColor: color.hex,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* 5. ITEMISED MATERIAL INWARD AUDIT TABLE */}
              <section className="space-y-2 print:space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-stone-900 flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-rose-700 rounded-xs"></span>
                    4. Material Inward Purchases Log (Audit Sample)
                  </h3>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {procurements.length} Total Batches
                  </span>
                </div>

                {procurements.length === 0 ? (
                  <div className="p-2.5 bg-stone-50 border border-stone-200 rounded text-center text-stone-400 text-xs">
                    No material inward purchases recorded in this timeframe.
                  </div>
                ) : (
                  <div className="border border-stone-200 rounded overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="print:table-header-group">
                        <tr className="bg-stone-100 border-b border-stone-200 text-[10px] uppercase font-bold text-stone-600 print:bg-stone-200">
                          <th className="py-1.5 px-3 print:py-1">Date</th>
                          <th className="py-1.5 px-3 print:py-1">Category</th>
                          <th className="py-1.5 px-3 print:py-1">Description / Color</th>
                          <th className="py-1.5 px-3 print:py-1">Quantity / Weight</th>
                          <th className="py-1.5 px-3 print:py-1">Vendor / Source</th>
                          <th className="py-1.5 px-3 text-right print:py-1">Price Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 text-stone-700">
                        {procurements.map((p) => {
                          const priceRupees = (Number(p.price_in_paise) / 100).toFixed(2);
                          return (
                            <tr key={p.id} className="print:break-inside-avoid">
                              <td className="py-1.5 px-3 font-mono text-[11px] text-stone-500 print:py-1">{p.purchase_date}</td>
                              <td className="py-1.5 px-3 print:py-1">
                                <span className="bg-stone-100 text-stone-800 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-stone-200">
                                  {p.material_type}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 font-medium text-stone-900 print:py-1">{p.description}</td>
                              <td className="py-1.5 px-3 font-mono text-stone-600 print:py-1">{p.quantity_label}</td>
                              <td className="py-1.5 px-3 text-stone-500 print:py-1">{p.vendor_name || '—'}</td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-rose-700 print:py-1">₹{priceRupees}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* 6. DATA INTEGRITY & AUDIT SIGN-OFF */}
              <footer className="avoid-break pt-3 border-t-2 border-stone-800 text-stone-600 print:pt-2">
                <div className="grid grid-cols-3 print:grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="font-bold text-stone-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-700" />
                      Data Integrity &amp; Source
                    </p>
                    <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
                      Generated from live immutable transaction records in Supabase (Orders, Order Items, and Raw Material Procurement Log).
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                      Atelier Management Certification
                    </p>
                    <div className="mt-3 border-b border-stone-400 w-36"></div>
                    <p className="text-[10px] text-stone-400 mt-0.5">Authorized Signatory</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-800 uppercase tracking-wider text-[10px]">
                      {storeSettings.legal_business_name || 'The Petal & Bloom Studio'}
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5 font-mono">
                      Confidential Internal Atelier Document
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      © {now.getFullYear()} The Petal &amp; Bloom Studio. All rights reserved.
                    </p>
                  </div>
                </div>
              </footer>

            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
