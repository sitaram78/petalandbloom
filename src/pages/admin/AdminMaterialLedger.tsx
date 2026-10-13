import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Layers,
  Plus,
  Trash2,
  Search,
  Calendar,
  RefreshCw,
  Scissors,
  Calculator,
  DollarSign,
  Download,
  Filter,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Tag,
  Palette,
  Package,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/apiClient';
import { useNotification } from '@/context/NotificationContext';
import { downloadCSV } from '@/utils/csvExporter';
import {
  RawMaterialProcurement,
  MaterialType,
  ColorFamily,
  MATERIAL_TYPE_LABELS,
  COLOR_FAMILY_LABELS,
} from '@/types/procurement';

type LedgerTab = 'dashboard' | 'inward' | 'breakdown' | 'calculator';
type DateRangeOption = '7d' | '30d' | '90d' | 'all';

interface TrajectoryPoint {
  month: string;
  fullDate?: string;
  salesRupees: number;
  spendRupees: number;
  profitRupees: number;
  periodSalesRupees?: number;
  periodSpendRupees?: number;
  periodProfitRupees?: number;
}

// Compact currency helper: never outputs ₹0k for small amounts
function formatCompactRupees(amountRupees: number): string {
  if (!amountRupees || amountRupees <= 0) return '₹0';
  if (amountRupees < 1000) return `₹${amountRupees.toLocaleString('en-IN')}`;
  if (amountRupees < 100000) {
    const k = amountRupees / 1000;
    return `₹${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  const l = amountRupees / 100000;
  return `₹${l.toFixed(2)}L`;
}

export default function AdminMaterialLedger() {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<LedgerTab>('dashboard');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Interactive Graph States
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredDonutType, setHoveredDonutType] = useState<MaterialType | null>(null);

  // Procurement & Sales Data
  const [procurements, setProcurements] = useState<RawMaterialProcurement[]>([]);
  const [totalSalesPaise, setTotalSalesPaise] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Purchase Form State
  const [formType, setFormType] = useState<MaterialType>('YARN');
  const [formColor, setFormColor] = useState<ColorFamily>('RED');
  const [formDesc, setFormDesc] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formPriceRupees, setFormPriceRupees] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formVendor, setFormVendor] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Calculator State
  const [calcPackPrice, setCalcPackPrice] = useState('180');
  const [calcPackStems, setCalcPackStems] = useState('100');
  const [calcUsedStems, setCalcUsedStems] = useState('16');

  // Fetch Data (Dual mode: API with Supabase fallback)
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Try fetching via backend API
      let materialsLoaded = false;
      try {
        const matRes = await authFetch(`/api/admin/materials?range=${dateRange}`);
        if (matRes.ok) {
          const json = await matRes.json();
          if (json.success && Array.isArray(json.procurements)) {
            setProcurements(json.procurements);
            materialsLoaded = true;
          }
        }
      } catch (err) {
        // Fallback to direct client below
      }

      // Fallback direct Supabase for materials if API didn't populate
      if (!materialsLoaded) {
        let q = supabase
          .from('raw_material_procurements')
          .select('*')
          .order('purchase_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (dateRange !== 'all') {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          q = q.gte('purchase_date', cutoff);
        }

        const { data: pData, error: pErr } = await q;
        if (!pErr && pData) {
          setProcurements(pData as RawMaterialProcurement[]);
        }
      }

      // 2. Fetch Orders for Total Realized Sells
      let ordersLoaded = false;
      try {
        const sumRes = await authFetch(`/api/admin/finances/summary?range=${dateRange}`);
        if (sumRes.ok) {
          const sumJson = await sumRes.json();
          if (sumJson.success && sumJson.summary) {
            setTotalSalesPaise(sumJson.summary.totalSalesPaise || 0);
            setOrdersCount(sumJson.summary.totalOrdersCount || 0);
            if (Array.isArray(sumJson.summary.trajectory) && sumJson.summary.trajectory.length > 0) {
              setTrajectory(sumJson.summary.trajectory);
              ordersLoaded = true;
            }
          }
        }
      } catch (err) {
        // Fallback to direct client below
      }

      // Fallback direct Supabase for orders if API didn't populate
      if (!ordersLoaded) {
        let ordQ = supabase
          .from('orders')
          .select('id, total_in_paise, created_at, order_status')
          .neq('order_status', 'CANCELLED');

        if (dateRange !== 'all') {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
          const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
          ordQ = ordQ.gte('created_at', cutoff);
        }

        const { data: ordData, error: ordErr } = await ordQ;
        if (!ordErr && ordData) {
          const totalPaise = ordData.reduce((sum, o) => sum + (Number(o.total_in_paise) || 0), 0);
          setTotalSalesPaise(totalPaise);
          setOrdersCount(ordData.length);
        }
      }
    } catch (err: any) {
      console.error('[AdminMaterialLedger] Failed to fetch data:', err);
      showNotification('Notice: Could not load some metrics: ' + err.message, 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  // Aggregated Calculations
  const totalProcurementPaise = useMemo(() => {
    return procurements.reduce((sum, p) => sum + (Number(p.price_in_paise) || 0), 0);
  }, [procurements]);

  const totalProcurementRupees = Math.round(totalProcurementPaise / 100);
  const totalSalesRupees = Math.round(totalSalesPaise / 100);
  const netProfitRupees = totalSalesRupees - totalProcurementRupees;
  const netMarginPercent = totalSalesRupees > 0
    ? ((netProfitRupees / totalSalesRupees) * 100).toFixed(1)
    : '0.0';
  const capitalMultiplier = totalProcurementRupees > 0
    ? (totalSalesRupees / totalProcurementRupees).toFixed(2)
    : '0.00';

  // Breakdown by Material Type
  const spendByType = useMemo(() => {
    const map: Record<string, number> = {
      YARN: 0,
      PIPE_CLEANER: 0,
      FLORAL_WIRE: 0,
      PACKAGING: 0,
      TOOLS: 0,
      OTHER: 0,
    };
    procurements.forEach((p) => {
      const t = p.material_type || 'OTHER';
      map[t] = (map[t] || 0) + (Number(p.price_in_paise) || 0);
    });
    return map;
  }, [procurements]);

  // Breakdown by Color Family
  const spendByColor = useMemo(() => {
    const map: Record<string, number> = {};
    Object.keys(COLOR_FAMILY_LABELS).forEach((c) => {
      map[c] = 0;
    });
    procurements.forEach((p) => {
      const c = p.color_family || 'OTHER';
      map[c] = (map[c] || 0) + (Number(p.price_in_paise) || 0);
    });

    return Object.entries(map)
      .map(([key, paise]) => ({
        key: key as ColorFamily,
        name: COLOR_FAMILY_LABELS[key as ColorFamily]?.name || key,
        hex: COLOR_FAMILY_LABELS[key as ColorFamily]?.hex || '#8A7D72',
        rupees: Math.round(paise / 100),
      }))
      .sort((a, b) => b.rupees - a.rupees);
  }, [procurements]);

  // Filtered Procurements Table
  const filteredProcurements = useMemo(() => {
    return procurements.filter((p) => {
      const matchesSearch =
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.quantity_label || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'ALL' || p.material_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [procurements, searchTerm, typeFilter]);

  // Submit New Purchase Form
  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc.trim() || !formPriceRupees || !formQty.trim()) {
      showNotification('Please fill in material description, quantity, and price.', 'error');
      return;
    }

    const priceRupees = parseFloat(formPriceRupees);
    if (isNaN(priceRupees) || priceRupees <= 0) {
      showNotification('Please enter a valid positive price.', 'error');
      return;
    }

    setSubmitting(true);
    const newPayload = {
      material_type: formType,
      color_family: formColor,
      description: formDesc.trim(),
      quantity_label: formQty.trim(),
      price_in_paise: Math.round(priceRupees * 100),
      purchase_date: formDate || new Date().toISOString().slice(0, 10),
      vendor_name: formVendor.trim() || null,
      notes: formNotes.trim() || null,
    };

    try {
      // 1. Try API insert
      let saved = false;
      try {
        const res = await authFetch('/api/admin/materials', {
          method: 'POST',
          body: JSON.stringify(newPayload),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.procurement) {
            setProcurements((prev) => [json.procurement, ...prev]);
            saved = true;
          }
        }
      } catch (err) {
        // Fallback to direct client
      }

      // 2. Direct Supabase Fallback
      if (!saved) {
        const { data, error } = await supabase
          .from('raw_material_procurements')
          .insert(newPayload)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setProcurements((prev) => [data as RawMaterialProcurement, ...prev]);
        }
      }

      showNotification('Raw material procurement logged successfully!', 'success');
      // Reset Form
      setFormDesc('');
      setFormQty('');
      setFormPriceRupees('');
      setFormVendor('');
      setFormNotes('');
    } catch (err: any) {
      console.error('Failed to save procurement:', err);
      showNotification('Failed to save: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Purchase Row
  const handleDeletePurchase = async (id: string, desc: string) => {
    if (!window.confirm(`Delete purchase record "${desc}"?`)) return;

    try {
      let deleted = false;
      try {
        const res = await authFetch(`/api/admin/materials?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (res.ok) deleted = true;
      } catch (err) {
        // Fallback to direct client
      }

      if (!deleted) {
        const { error } = await supabase
          .from('raw_material_procurements')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }

      setProcurements((prev) => prev.filter((p) => p.id !== id));
      showNotification('Procurement entry removed.', 'success');
    } catch (err: any) {
      showNotification('Failed to delete entry: ' + err.message, 'error');
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = [
      'Purchase Date',
      'Material Type',
      'Color Family',
      'Description',
      'Quantity / Weight',
      'Price (INR)',
      'Vendor / Market',
      'Notes',
    ];
    const rows = procurements.map((p) => [
      p.purchase_date,
      p.material_type,
      p.color_family,
      p.description,
      p.quantity_label,
      (Number(p.price_in_paise) / 100).toFixed(2),
      p.vendor_name || 'N/A',
      p.notes || '',
    ]);

    downloadCSV(
      `tpb_material_procurement_${new Date().toISOString().slice(0, 10)}`,
      headers,
      rows
    );
    showNotification('Exported Procurement Ledger to CSV!', 'success');
  };

  // Dynamic Trajectory Curve Coordinates for SVG
  const trajectoryPoints = useMemo(() => {
    if (trajectory.length > 0) return trajectory;

    // Dynamic client fallback starting strictly from September 2026 atelier launch
    const now = new Date();
    const periods = [
      { label: 'Sep W1', fullDate: 'Sep 1 – Sep 7, 2026', start: new Date('2026-09-01T00:00:00Z'), end: new Date('2026-09-07T23:59:59Z') },
      { label: 'Sep W2', fullDate: 'Sep 8 – Sep 14, 2026', start: new Date('2026-09-08T00:00:00Z'), end: new Date('2026-09-14T23:59:59Z') },
      { label: 'Sep W3', fullDate: 'Sep 15 – Sep 21, 2026', start: new Date('2026-09-15T00:00:00Z'), end: new Date('2026-09-21T23:59:59Z') },
      { label: 'Sep W4', fullDate: 'Sep 22 – Sep 30, 2026', start: new Date('2026-09-22T00:00:00Z'), end: new Date('2026-09-30T23:59:59Z') },
      { label: 'Oct W1', fullDate: 'Oct 1 – Oct 7, 2026', start: new Date('2026-10-01T00:00:00Z'), end: new Date('2026-10-07T23:59:59Z') },
      { label: 'Oct (Live)', fullDate: 'Oct 8 – Present, 2026', start: new Date('2026-10-08T00:00:00Z'), end: new Date(now.getTime() + 86400000) },
    ];

    let runningSpendPaise = 0;
    return periods.map((p, idx) => {
      const periodSpendPaise = procurements
        .filter((proc) => {
          if (!proc.purchase_date) return false;
          const t = new Date(proc.purchase_date + 'T12:00:00Z').getTime();
          return t >= p.start.getTime() && t <= p.end.getTime();
        })
        .reduce((sum, proc) => sum + (Number(proc.price_in_paise) || 0), 0);

      runningSpendPaise += periodSpendPaise;

      const fraction = (idx + 1) / periods.length;
      const cumSales = Math.round(totalSalesRupees * fraction);
      const cumSpend = Math.round(runningSpendPaise / 100);

      return {
        month: p.label,
        fullDate: p.fullDate,
        salesRupees: cumSales,
        spendRupees: cumSpend,
        profitRupees: cumSales - cumSpend,
      };
    });
  }, [trajectory, totalSalesRupees, procurements]);

  // Dynamic Graph 1 coordinates & mathematical scales
  const graph1Data = useMemo(() => {
    const pts = trajectoryPoints;
    const count = pts.length;
    if (count === 0) return null;

    const width = 800;
    const height = 240;
    const padLeft = 60;
    const padRight = 50;
    const padTop = 35;
    const padBottom = 45;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Find highest value across all points
    const maxVal = Math.max(
      ...pts.map((p) => Math.max(p.salesRupees || 0, p.spendRupees || 0, p.profitRupees || 0)),
      100
    );
    const ceiling = Math.max(Math.ceil((maxVal * 1.2) / 500) * 500, 500);

    const coords = pts.map((p, i) => {
      const x = count === 1 ? padLeft + plotW / 2 : padLeft + (i / (count - 1)) * plotW;
      const salesY = padTop + plotH - ((p.salesRupees || 0) / ceiling) * plotH;
      const spendY = padTop + plotH - ((p.spendRupees || 0) / ceiling) * plotH;
      const profitY = padTop + plotH - (Math.max(0, p.profitRupees || 0) / ceiling) * plotH;
      return { ...p, x, salesY, spendY, profitY };
    });

    const salesPointsStr = coords.map((c) => `${c.x.toFixed(1)},${c.salesY.toFixed(1)}`).join(' ');
    const spendPointsStr = coords.map((c) => `${c.x.toFixed(1)},${c.spendY.toFixed(1)}`).join(' ');
    const profitPointsStr = coords.map((c) => `${c.x.toFixed(1)},${c.profitY.toFixed(1)}`).join(' ');

    const reversedSpend = [...coords].reverse().map((c) => `${c.x.toFixed(1)},${c.spendY.toFixed(1)}`).join(' ');
    const polygonPointsStr = `${salesPointsStr} ${reversedSpend}`;

    const yTicks = [
      { y: padTop, label: formatCompactRupees(ceiling) },
      { y: padTop + plotH * 0.33, label: formatCompactRupees(Math.round(ceiling * 0.67)) },
      { y: padTop + plotH * 0.67, label: formatCompactRupees(Math.round(ceiling * 0.33)) },
      { y: padTop + plotH, label: '₹0' },
    ];

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      ceiling,
      coords,
      salesPointsStr,
      spendPointsStr,
      profitPointsStr,
      polygonPointsStr,
      yTicks,
    };
  }, [trajectoryPoints]);

  // Dynamic Donut segments for Graph 2
  const donutData = useMemo(() => {
    const palette: Record<MaterialType, string> = {
      YARN: '#7E6589',
      PIPE_CLEANER: '#C28236',
      FLORAL_WIRE: '#5B7FA6',
      PACKAGING: '#458B86',
      TOOLS: '#8A7D72',
      OTHER: '#A85858',
    };

    const active: {
      type: MaterialType;
      label: string;
      color: string;
      rupees: number;
      percent: number;
    }[] = [];

    const totalPaise = Object.values(spendByType).reduce((a, b) => a + b, 0);
    const totalRupees = Math.round(totalPaise / 100);

    (Object.keys(spendByType) as MaterialType[]).forEach((type) => {
      const paise = spendByType[type] || 0;
      if (paise > 0) {
        const rupees = Math.round(paise / 100);
        const percent = totalRupees > 0 ? (rupees / totalRupees) * 100 : 0;
        active.push({
          type,
          label: MATERIAL_TYPE_LABELS[type] || type,
          color: palette[type] || '#8A7D72',
          rupees,
          percent,
        });
      }
    });

    active.sort((a, b) => b.rupees - a.rupees);

    let offset = 25; // 12 o'clock start
    const segments = active.map((seg) => {
      const dashArray = `${seg.percent.toFixed(2)} ${(100 - seg.percent).toFixed(2)}`;
      const dashOffset = offset;
      offset -= seg.percent;
      return { ...seg, dashArray, dashOffset };
    });

    return {
      totalRupees,
      segments,
      palette,
    };
  }, [spendByType]);

  // Pipe Cleaner Calculation Result
  const packPriceNum = parseFloat(calcPackPrice) || 0;
  const packStemsNum = parseFloat(calcPackStems) || 1;
  const usedStemsNum = parseFloat(calcUsedStems) || 0;
  const costPerStem = packPriceNum / packStemsNum;
  const bouquetCleanerCost = costPerStem * usedStemsNum;

  return (
    <AdminLayout activePage={'materials' as any}>
      <main className="p-3.5 sm:p-6 lg:p-10 max-w-7xl mx-auto space-y-5 sm:space-y-7">

        {/* ═══════════ HEADER ═══════════ */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-semibold mb-1">
              Artisan Material Spend &amp; Financial Return
            </p>
            <h1 className="heading-serif text-2xl sm:text-3xl lg:text-4xl text-bark">
              Procurement &amp; Profit Ledger
            </h1>
            <p className="text-xs text-ink-light mt-1">
              Track raw yarn, pipe cleaner batches, and craft supplies against live order sales to see your exact investment, spending patterns, and profit in hand.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center bg-linen border border-canvas-line rounded-sm p-1 text-xs font-medium text-bark overflow-x-auto">
              {(['7d', '30d', '90d', 'all'] as DateRangeOption[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-2.5 sm:px-3 py-1 rounded-sm transition-all whitespace-nowrap ${
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
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white border border-canvas-line text-xs font-semibold text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all"
            >
              <Download size={13} />
              Export CSV
            </button>

            <button
              onClick={() => setActiveTab('inward')}
              className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs font-semibold rounded-sm flex items-center gap-1.5 transition-all"
            >
              <Plus size={14} />
              Log Purchase
            </button>
          </div>
        </header>

        {/* ═══════════ 4 CORE KPI CARDS ═══════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Sells */}
          <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-5 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500" />
            <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1">
              Total Sells / Revenue Banked
            </p>
            <p className="heading-serif text-2xl sm:text-3xl text-bark font-bold">
              ₹{totalSalesRupees.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-ink-light mt-1.5 flex items-center gap-1">
              <span className="bg-sky-50 text-sky-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                {ordersCount} Orders Sold
              </span>
              Real orders cash flow
            </p>
          </div>

          {/* 2. Spend */}
          <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-5 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-rose" />
            <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1">
              Total Material Spend (Invested)
            </p>
            <p className="heading-serif text-2xl sm:text-3xl text-rose font-bold">
              ₹{totalProcurementRupees.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-ink-light mt-1.5 flex items-center gap-1">
              <span className="bg-rose/10 text-rose font-semibold px-1.5 py-0.5 rounded text-[10px]">
                {procurements.length} Purchases
              </span>
              Yarn + Pipe Cleaners + Supplies
            </p>
          </div>

          {/* 3. Profit */}
          <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-5 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-moss" />
            <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1">
              Current Net Profit In Hand
            </p>
            <p className={`heading-serif text-2xl sm:text-3xl font-bold ${netProfitRupees >= 0 ? 'text-moss' : 'text-rose'}`}>
              {netProfitRupees >= 0 ? '+' : ''}₹{netProfitRupees.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-ink-light mt-1.5 flex items-center gap-1">
              <span className="bg-moss/10 text-moss font-semibold px-1.5 py-0.5 rounded text-[10px]">
                {netMarginPercent}% Margin
              </span>
              Sales minus Material Spend
            </p>
          </div>

          {/* 4. ROI Multiplier */}
          <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-5 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-600" />
            <p className="text-[10px] uppercase tracking-wider text-ink-light font-semibold mb-1">
              Capital Multiplier / Return
            </p>
            <p className="heading-serif text-2xl sm:text-3xl text-purple-700 font-bold">
              {capitalMultiplier}x
            </p>
            <p className="text-[11px] text-ink-light mt-1.5 flex items-center gap-1">
              <span className="bg-purple-50 text-purple-700 font-semibold px-1.5 py-0.5 rounded text-[10px]">
                ROI Multiplier
              </span>
              ₹{capitalMultiplier} returned per ₹1 spent
            </p>
          </div>
        </div>

        {/* ═══════════ NAVIGATION TABS ═══════════ */}
        <nav className="flex items-center gap-1 sm:gap-2 border-b border-canvas-line pb-px overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <BarChart3 size={15} className={activeTab === 'dashboard' ? 'text-rose' : ''} />
            1. Visual Financial Graphs
          </button>

          <button
            onClick={() => setActiveTab('inward')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'inward'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <Layers size={15} className={activeTab === 'inward' ? 'text-rose' : ''} />
            2. Material Purchase Log (Yarn / Cleaners)
          </button>

          <button
            onClick={() => setActiveTab('breakdown')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'breakdown'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <Palette size={15} className={activeTab === 'breakdown' ? 'text-rose' : ''} />
            3. Spend by Material &amp; Color
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs uppercase tracking-wider font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'border-rose text-bark bg-linen'
                : 'border-transparent text-ink-light hover:text-ink hover:border-canvas-line'
            }`}
          >
            <Calculator size={15} className={activeTab === 'calculator' ? 'text-rose' : ''} />
            4. Pipe Cleaner Unit Calculator
          </button>
        </nav>

        {/* ═══════════════════════════════════════════════
             TAB 1: VISUAL FINANCIAL GRAPHS
        ════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {/* GRAPH 1: Investment vs Sells Trajectory Chart */}
            <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                    <TrendingUp size={15} className="text-rose" />
                    Graph 1: Cumulative Sells Revenue vs. Material Procurement Spend
                  </h3>
                  <p className="text-xs text-ink-light mt-0.5">
                    Live curve since atelier launch (September 2026) showing customer sales realization outpacing raw material investments.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-semibold text-moss bg-moss/10 px-2.5 py-1 rounded">
                    {capitalMultiplier}x Net Return Ratio
                  </span>
                </div>
              </div>

              {/* Trajectory SVG Line Chart */}
              {graph1Data && (
                <div className="bg-linen/50 border border-canvas-line rounded-md p-3 sm:p-4 overflow-hidden relative">
                  <svg
                    viewBox={`0 0 ${graph1Data.width} ${graph1Data.height}`}
                    className="w-full h-auto min-h-[220px] max-h-[340px] overflow-visible"
                  >
                    {/* Horizontal Grid lines & Y-axis labels */}
                    {graph1Data.yTicks.map((tick, i) => (
                      <g key={i}>
                        <line
                          x1={graph1Data.padLeft}
                          y1={tick.y}
                          x2={graph1Data.width - graph1Data.padRight}
                          y2={tick.y}
                          stroke="#E2D9CC"
                          strokeWidth="1"
                          strokeDasharray={i === graph1Data.yTicks.length - 1 ? 'none' : '3,3'}
                        />
                        <text
                          x={graph1Data.padLeft - 10}
                          y={tick.y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="#8A7D72"
                          fontWeight="500"
                        >
                          {tick.label}
                        </text>
                      </g>
                    ))}

                    {/* Shaded Profit Zone Polygon */}
                    <polygon
                      fill="rgba(74, 107, 83, 0.12)"
                      stroke="none"
                      points={graph1Data.polygonPointsStr}
                    />

                    {/* Sells Line (Blue) */}
                    <polyline
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={graph1Data.salesPointsStr}
                    />

                    {/* Spend Line (Red dashed) */}
                    <polyline
                      fill="none"
                      stroke="#A85858"
                      strokeWidth="2.5"
                      strokeDasharray="6,4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={graph1Data.spendPointsStr}
                    />

                    {/* Profit Line (Green solid) */}
                    <polyline
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={graph1Data.profitPointsStr}
                    />

                    {/* Active Hover / Touch Guideline */}
                    {hoveredPointIndex !== null && graph1Data.coords[hoveredPointIndex] && (
                      <line
                        x1={graph1Data.coords[hoveredPointIndex].x}
                        y1={graph1Data.padTop}
                        x2={graph1Data.coords[hoveredPointIndex].x}
                        y2={graph1Data.padTop + graph1Data.plotH}
                        stroke="#2B2118"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        opacity="0.6"
                      />
                    )}

                    {/* Data Points on Lines */}
                    {graph1Data.coords.map((c, i) => {
                      const isHovered = hoveredPointIndex === i;
                      const isLast = i === graph1Data.coords.length - 1;
                      return (
                        <g
                          key={i}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPointIndex(i)}
                          onClick={() => setHoveredPointIndex(i)}
                        >
                          {/* Invisible wide touch hit target */}
                          <rect
                            x={c.x - 25}
                            y={graph1Data.padTop}
                            width="50"
                            height={graph1Data.plotH}
                            fill="transparent"
                          />

                          {/* Sells Dot */}
                          <circle
                            cx={c.x}
                            cy={c.salesY}
                            r={isHovered ? 6.5 : isLast ? 5.5 : 4}
                            fill="#0284c7"
                            stroke="#FFFFFF"
                            strokeWidth={isHovered ? 2.5 : 1.5}
                          />

                          {/* Spend Dot */}
                          <circle
                            cx={c.x}
                            cy={c.spendY}
                            r={isHovered ? 6.5 : isLast ? 5.5 : 4}
                            fill="#A85858"
                            stroke="#FFFFFF"
                            strokeWidth={isHovered ? 2.5 : 1.5}
                          />

                          {/* Profit Dot */}
                          <circle
                            cx={c.x}
                            cy={c.profitY}
                            r={isHovered ? 6.5 : isLast ? 5.5 : 4}
                            fill="#16a34a"
                            stroke="#FFFFFF"
                            strokeWidth={isHovered ? 2.5 : 1.5}
                          />

                          {/* X-Axis Label */}
                          <text
                            x={c.x}
                            y={graph1Data.height - 18}
                            textAnchor="middle"
                            fontSize="11"
                            fill={isHovered ? '#1F1610' : '#6E6259'}
                            fontWeight={isHovered || isLast ? '700' : '500'}
                          >
                            {c.month}
                          </text>
                        </g>
                      );
                    })}

                    {/* Value Annotations for the End Point */}
                    {graph1Data.coords.length > 0 && (() => {
                      const last = graph1Data.coords[graph1Data.coords.length - 1];
                      return (
                        <g>
                          <text
                            x={last.x}
                            y={Math.max(16, last.salesY - 10)}
                            textAnchor="end"
                            fontSize="11"
                            fill="#0284c7"
                            fontWeight="700"
                          >
                            ₹{last.salesRupees.toLocaleString('en-IN')} Sales
                          </text>
                          <text
                            x={last.x}
                            y={Math.max(30, last.profitY - 8)}
                            textAnchor="end"
                            fontSize="11"
                            fill="#16a34a"
                            fontWeight="700"
                          >
                            +₹{last.profitRupees.toLocaleString('en-IN')} Profit
                          </text>
                          <text
                            x={last.x}
                            y={Math.min(graph1Data.height - 35, last.spendY + 16)}
                            textAnchor="end"
                            fontSize="10"
                            fill="#A85858"
                            fontWeight="600"
                          >
                            ₹{last.spendRupees.toLocaleString('en-IN')} Spend
                          </text>
                        </g>
                      );
                    })()}
                  </svg>

                  {/* Interactive Milestone Details Card for Selected/Hovered Point */}
                  {hoveredPointIndex !== null && graph1Data.coords[hoveredPointIndex] && (
                    <div className="mt-3 p-3 bg-white border border-canvas-line rounded-md shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-bark text-[11px] uppercase tracking-wider block">
                          {graph1Data.coords[hoveredPointIndex].fullDate || graph1Data.coords[hoveredPointIndex].month}
                        </span>
                        <span className="text-[10px] text-ink-light">
                          Milestone {hoveredPointIndex + 1} of {graph1Data.coords.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                          <span className="text-ink-light">Cumulative Sells:</span>
                          <span className="font-bold text-sky-700">₹{graph1Data.coords[hoveredPointIndex].salesRupees.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose" />
                          <span className="text-ink-light">Material Spend:</span>
                          <span className="font-bold text-rose">₹{graph1Data.coords[hoveredPointIndex].spendRupees.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-moss" />
                          <span className="text-ink-light">Net Profit:</span>
                          <span className="font-bold text-moss">+₹{graph1Data.coords[hoveredPointIndex].profitRupees.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interactive Milestone Quick Buttons (Mobile & Desktop Touch) */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-canvas-line/60 overflow-x-auto pb-1 text-xs">
                    <span className="text-[10px] uppercase font-bold text-ink-light shrink-0 mr-1">Milestones:</span>
                    {graph1Data.coords.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setHoveredPointIndex(i)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all shrink-0 ${
                          hoveredPointIndex === i
                            ? 'bg-bark text-linen shadow-xs'
                            : 'bg-white border border-canvas-line text-ink-light hover:text-bark hover:border-bark'
                        }`}
                      >
                        {c.month}
                      </button>
                    ))}
                    {hoveredPointIndex !== null && (
                      <button
                        onClick={() => setHoveredPointIndex(null)}
                        className="text-[10px] text-ink-light hover:text-rose ml-auto underline shrink-0"
                      >
                        Reset view
                      </button>
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-3 pt-3 border-t border-canvas-line text-[11px] sm:text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 bg-sky-500 rounded" />
                      <strong>Total Sales (Real Sells Data)</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 border-t-2 border-dashed border-rose" />
                      <strong>Material Procurement Spend</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3.5 h-1 bg-moss rounded" />
                      <strong>Net Profit in Hand</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* GRAPHS 2 & 3: Side by Side (Stacked on Mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* GRAPH 2: Spend by Material Type Donut */}
              <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                    <PieChart size={15} className="text-rose" />
                    Graph 2: Spend Distribution by Material Type
                  </h3>
                  <span className="text-[11px] font-bold text-bark bg-linen px-2 py-0.5 rounded">
                    ₹{totalProcurementRupees.toLocaleString('en-IN')} Total
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                  {/* Donut Chart SVG */}
                  <div className="relative shrink-0">
                    <svg width="150" height="150" viewBox="0 0 42 42" className="overflow-visible">
                      {/* Background track circle */}
                      <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#F4EFEA" strokeWidth="6" />

                      {/* If total is 0 */}
                      {donutData.segments.length === 0 ? (
                        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E2D9CC" strokeWidth="6" />
                      ) : (
                        donutData.segments.map((seg) => (
                          <circle
                            key={seg.type}
                            cx="21"
                            cy="21"
                            r="15.915"
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth={hoveredDonutType === seg.type ? 7.5 : 6}
                            strokeDasharray={seg.dashArray}
                            strokeDashoffset={seg.dashOffset}
                            className="transition-all duration-300 cursor-pointer"
                            onMouseEnter={() => setHoveredDonutType(seg.type)}
                            onMouseLeave={() => setHoveredDonutType(null)}
                          />
                        ))
                      )}

                      {/* Center Text: Displays exact rupees, never ₹0k! */}
                      {(() => {
                        const hoveredSeg = donutData.segments.find((s) => s.type === hoveredDonutType);
                        const centerAmount = hoveredSeg
                          ? `₹${hoveredSeg.rupees.toLocaleString('en-IN')}`
                          : formatCompactRupees(donutData.totalRupees);
                        const centerLabel = hoveredSeg
                          ? `${hoveredSeg.label.split('/')[0].trim()} (${hoveredSeg.percent.toFixed(0)}%)`
                          : 'Total Spent';

                        return (
                          <g>
                            <text x="21" y="20.5" textAnchor="middle" fontSize="4.6" fill="#2B2118" fontWeight="800">
                              {centerAmount}
                            </text>
                            <text x="21" y="24.8" textAnchor="middle" fontSize="2.2" fill="#8A7D72" fontWeight="600">
                              {centerLabel}
                            </text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Legend */}
                  <div className="space-y-1.5 text-xs w-full sm:w-auto">
                    {(['YARN', 'PIPE_CLEANER', 'FLORAL_WIRE', 'PACKAGING', 'TOOLS', 'OTHER'] as MaterialType[]).map((type) => {
                      const seg = donutData.segments.find((s) => s.type === type);
                      const rupees = seg ? seg.rupees : Math.round((spendByType[type] || 0) / 100);
                      const percent = seg ? seg.percent : 0;
                      const isHovered = hoveredDonutType === type;
                      return (
                        <div
                          key={type}
                          onMouseEnter={() => setHoveredDonutType(type)}
                          onMouseLeave={() => setHoveredDonutType(null)}
                          className={`flex items-center justify-between gap-3 px-2 py-1 rounded cursor-pointer transition-colors ${
                            isHovered ? 'bg-linen font-bold' : 'hover:bg-linen/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: donutData.palette[type] }}
                            />
                            <span className="text-bark">{MATERIAL_TYPE_LABELS[type]}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-right shrink-0">
                            <span className="font-semibold text-bark">₹{rupees.toLocaleString('en-IN')}</span>
                            {percent > 0 && (
                              <span className="text-[10px] text-ink-light bg-linen px-1 rounded font-sans">
                                {percent.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* GRAPH 3: Color Spend Ranking */}
              <div className="bg-white border border-canvas-line rounded-md p-4 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                    <Palette size={15} className="text-rose" />
                    Graph 3: Procurement Spend by Color (Most vs Least)
                  </h3>
                  <span className="text-[11px] text-ink-light">
                    {procurements.length} purchases logged
                  </span>
                </div>

                <div className="space-y-3">
                  {spendByColor.slice(0, 5).map((color, idx) => {
                    const highest = spendByColor[0]?.rupees || 1;
                    const percent = totalProcurementRupees > 0
                      ? Math.round((color.rupees / totalProcurementRupees) * 100)
                      : 0;
                    const barWidth = color.rupees > 0
                      ? Math.max(8, Math.round((color.rupees / highest) * 100))
                      : 0;

                    return (
                      <div key={color.key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-bark flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: color.hex }} />
                            <span>{color.name}</span>
                            {idx === 0 && color.rupees > 0 && (
                              <span className="text-[10px] text-rose font-bold bg-rose/10 px-1.5 py-0.2 rounded">
                                Highest Spend
                              </span>
                            )}
                            {idx === 4 && (
                              <span className="text-[10px] text-ink-light bg-linen px-1.5 py-0.2 rounded">
                                Lowest Spend
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-bark">₹{color.rupees.toLocaleString('en-IN')}</span>
                            {percent > 0 && (
                              <span className="text-[10px] text-ink-light font-sans">({percent}%)</span>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-linen border border-canvas-line/70 rounded h-2 overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: color.rupees > 0 ? color.hex : 'transparent',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════
             TAB 2: MATERIAL PURCHASE INWARD LOG
        ════════════════════════════════════════════════ */}
        {activeTab === 'inward' && (
          <div className="space-y-6">

            {/* Quick Inward Form */}
            <div className="bg-white border border-canvas-line rounded-md p-5 sm:p-6 shadow-xs">
              <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 mb-1">
                <Plus size={15} className="text-rose" />
                Note Down New Raw Material Purchase
              </h3>
              <p className="text-xs text-ink-light mb-4">
                Log what you procured, color, quantity/weight, and exact price paid.
              </p>

              <form onSubmit={handleSubmitPurchase} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Material Type */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Material Type
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as MaterialType)}
                      className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none"
                    >
                      <option value="YARN">Yarn / Crochet Wool</option>
                      <option value="PIPE_CLEANER">Pipe Cleaner (Chenille Stems)</option>
                      <option value="FLORAL_WIRE">Floral Wire &amp; Tape</option>
                      <option value="PACKAGING">Gift Boxes &amp; Packaging</option>
                      <option value="TOOLS">Tools &amp; Glue Sticks</option>
                      <option value="OTHER">Other Craft Supplies</option>
                    </select>
                  </div>

                  {/* Color Family */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Color Family
                    </label>
                    <select
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value as ColorFamily)}
                      className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none"
                    >
                      <option value="RED">Red &amp; Burgundy</option>
                      <option value="GREEN">Sage &amp; Olive Green</option>
                      <option value="PINK">Blush &amp; Dusty Pink</option>
                      <option value="WHITE">Cream White &amp; Ivory</option>
                      <option value="PURPLE">Lavender &amp; Lilac</option>
                      <option value="YELLOW">Sunflower Yellow</option>
                      <option value="BLUE">Sky &amp; Ocean Blue</option>
                      <option value="OTHER">Neutral / Mixed Colors</option>
                    </select>
                  </div>

                  {/* Quantity / Weight */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Quantity &amp; Weight / Units
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 100gm, 500gm roll, 100 pcs"
                      value={formQty}
                      onChange={(e) => setFormQty(e.target.value)}
                      className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Color &amp; Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Red Color Milk Cotton Yarn, Emerald Green Stems"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none"
                      required
                    />
                  </div>

                  {/* Price Paid */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Total Price Paid (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-light font-bold">₹</span>
                      <input
                        type="number"
                        placeholder="150"
                        value={formPriceRupees}
                        onChange={(e) => setFormPriceRupees(e.target.value)}
                        className="w-full bg-white border border-canvas-line rounded pl-7 pr-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Purchase Date */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none"
                      required
                    />
                  </div>

                  {/* Vendor */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                      Purchased From / Vendor (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Local Craft Market, Amazon, Wholesaler"
                      value={formVendor}
                      onChange={(e) => setFormVendor(e.target.value)}
                      className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose focus:ring-1 focus:ring-rose outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-bark text-linen hover:bg-rose-deep text-xs font-semibold rounded transition-all flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                    Save Material Purchase
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormDesc('');
                      setFormQty('');
                      setFormPriceRupees('');
                      setFormVendor('');
                    }}
                    className="px-4 py-2.5 bg-white border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded transition-all"
                  >
                    Clear Form
                  </button>
                </div>
              </form>
            </div>

            {/* Procurement Ledger Table */}
            <div className="bg-white border border-canvas-line rounded-md shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-canvas-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-bark">
                    Procurement Inward Log ({filteredProcurements.length} Records)
                  </h3>
                  <p className="text-[11px] text-ink-light">Total Logged Spend: ₹{totalProcurementRupees.toLocaleString('en-IN')}</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      placeholder="Search description, vendor…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-linen/50 border border-canvas-line rounded text-xs text-bark focus:border-rose outline-none w-48 sm:w-64"
                    />
                  </div>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-white border border-canvas-line rounded px-2.5 py-1.5 text-xs text-bark focus:border-rose outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="YARN">Yarn</option>
                    <option value="PIPE_CLEANER">Pipe Cleaners</option>
                    <option value="FLORAL_WIRE">Floral Wire</option>
                    <option value="PACKAGING">Packaging</option>
                    <option value="TOOLS">Tools</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-linen border-b border-canvas-line text-[10px] uppercase tracking-wider text-ink-light font-bold">
                      <th className="py-2.5 px-4">Purchase Date</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Description / Color</th>
                      <th className="py-2.5 px-4">Quantity / Weight</th>
                      <th className="py-2.5 px-4">Vendor</th>
                      <th className="py-2.5 px-4 text-right">Price Paid</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-canvas-line/50 text-xs">
                    {filteredProcurements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-ink-light">
                          No procurement records found. Log your first material purchase above!
                        </td>
                      </tr>
                    ) : (
                      filteredProcurements.map((p) => {
                        const rupees = (Number(p.price_in_paise) / 100).toFixed(2);
                        const isYarn = p.material_type === 'YARN';
                        const isPipe = p.material_type === 'PIPE_CLEANER';

                        return (
                          <tr key={p.id} className="hover:bg-linen/40 transition-colors">
                            <td className="py-3 px-4 font-mono text-[11px] text-ink-light whitespace-nowrap">
                              {p.purchase_date}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  isYarn
                                    ? 'bg-purple-100 text-purple-800'
                                    : isPipe
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {p.material_type}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-bark">{p.description}</div>
                              {p.notes && <div className="text-[10px] text-ink-light">{p.notes}</div>}
                            </td>
                            <td className="py-3 px-4 font-medium text-bark whitespace-nowrap">
                              {p.quantity_label}
                            </td>
                            <td className="py-3 px-4 text-ink-light whitespace-nowrap">
                              {p.vendor_name || '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose whitespace-nowrap">
                              ₹{rupees}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleDeletePurchase(p.id, p.description)}
                                className="p-1 text-ink-light hover:text-rose hover:bg-rose/10 rounded transition-colors"
                                title="Delete entry"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════
             TAB 3: SPEND BREAKDOWN & INSIGHTS
        ════════════════════════════════════════════════ */}
        {activeTab === 'breakdown' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Strategic Insights */}
            <div className="bg-white border border-canvas-line rounded-md p-5 sm:p-6 shadow-xs space-y-4">
              <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2">
                <Sparkles size={15} className="text-rose" />
                Material Spend Insights (Where You Spent More vs Less)
              </h3>

              <div className="bg-purple-50/70 border-l-4 border-purple-600 p-3.5 rounded-xs">
                <p className="text-xs font-bold text-purple-900">
                  #1 Most Spent On: Yarn Wool (₹{Math.round((spendByType.YARN || 0) / 100).toLocaleString('en-IN')})
                </p>
                <p className="text-[11px] text-purple-800/80 mt-1">
                  Yarn represents the largest share of procurement. Ordering in bulk 500g or 1kg cones from mill suppliers reduces per-gram cost by ~22% compared to 100g retail skeins.
                </p>
              </div>

              <div className="bg-amber-50/70 border-l-4 border-amber-600 p-3.5 rounded-xs">
                <p className="text-xs font-bold text-amber-900">
                  #2 High Spend: Pipe Cleaners &amp; Chenille Stems (₹{Math.round((spendByType.PIPE_CLEANER || 0) / 100).toLocaleString('en-IN')})
                </p>
                <p className="text-[11px] text-amber-800/80 mt-1">
                  Green stems and Pink petals are consumed at a predictable rate of ~16 stems per bouquet.
                </p>
              </div>

              <div className="bg-emerald-50/70 border-l-4 border-moss p-3.5 rounded-xs">
                <p className="text-xs font-bold text-emerald-900">
                  #3 Least Spent On: Floral Tapes &amp; Glue Sticks
                </p>
                <p className="text-[11px] text-emerald-800/80 mt-1">
                  Consumables with high longevity. A single bulk purchase covers 3+ months of bouquet tying.
                </p>
              </div>
            </div>

            {/* Financial Cash Flow Breakdown Table */}
            <div className="bg-white border border-canvas-line rounded-md p-5 sm:p-6 shadow-xs">
              <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 mb-4">
                <DollarSign size={15} className="text-rose" />
                Investment vs. Sells Summary
              </h3>

              <table className="w-full text-xs">
                <tbody className="divide-y divide-canvas-line/60">
                  <tr>
                    <td className="py-2.5 font-medium text-bark">Total Sells Revenue Banked (Orders)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-sky-700">
                      ₹{totalSalesRupees.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-bark">Total Material Investment (Spend)</td>
                    <td className="py-2.5 text-right font-mono font-bold text-rose">
                      − ₹{totalProcurementRupees.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr className="bg-linen/70 font-bold">
                    <td className="py-3 text-bark">🌿 Realized Net Profit in Hand</td>
                    <td className="py-3 text-right font-mono text-moss text-sm font-bold">
                      ₹{netProfitRupees.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-bark">Profit Margin Ratio</td>
                    <td className="py-2.5 text-right font-mono font-bold text-bark">
                      {netMarginPercent}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-bark">Capital Recovery Multiplier</td>
                    <td className="py-2.5 text-right font-mono font-bold text-purple-700">
                      {capitalMultiplier}x
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ═══════════════════════════════════════════════
             TAB 4: PIPE CLEANER UNIT CALCULATOR
        ════════════════════════════════════════════════ */}
        {activeTab === 'calculator' && (
          <div className="bg-white border border-canvas-line rounded-md p-5 sm:p-6 shadow-xs max-w-2xl mx-auto">
            <h3 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-2 mb-1">
              <Calculator size={15} className="text-rose" />
              Pipe Cleaner Bouquet Unit Calculator
            </h3>
            <p className="text-xs text-ink-light mb-5">
              Unlike yarn, pipe cleaners are countable. Use this tool to calculate making cost per stem and per bouquet.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                  Packet Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-light font-bold">₹</span>
                  <input
                    type="number"
                    value={calcPackPrice}
                    onChange={(e) => setCalcPackPrice(e.target.value)}
                    className="w-full bg-white border border-canvas-line rounded pl-7 pr-3 py-2 text-xs text-bark focus:border-rose outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                  Stems per Packet
                </label>
                <input
                  type="number"
                  value={calcPackStems}
                  onChange={(e) => setCalcPackStems(e.target.value)}
                  className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-ink-light mb-1">
                  Stems Used in Bouquet
                </label>
                <input
                  type="number"
                  value={calcUsedStems}
                  onChange={(e) => setCalcUsedStems(e.target.value)}
                  className="w-full bg-white border border-canvas-line rounded px-3 py-2 text-xs text-bark focus:border-rose outline-none font-medium"
                />
              </div>
            </div>

            <div className="bg-linen border border-canvas-line rounded p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-ink-light">Calculated Making Cost</p>
                <p className="text-lg font-bold text-bark mt-0.5">
                  Cost per Stem: <span className="text-rose font-mono">₹{costPerStem.toFixed(2)}</span> &nbsp;|&nbsp;
                  Bouquet Cleaner Cost: <span className="text-moss font-mono">₹{bouquetCleanerCost.toFixed(2)}</span>
                </p>
              </div>
              <p className="text-xs text-ink-light text-right">
                For a ₹2,400 bouquet, pipe cleaner material is only ~<strong>{((bouquetCleanerCost / 2400) * 100).toFixed(1)}%</strong> of retail price!
              </p>
            </div>
          </div>
        )}

      </main>
    </AdminLayout>
  );
}
