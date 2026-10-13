import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../../lib/supabaseServer';
import { requireAuth } from '../../../lib/authMiddleware';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use GET.' });
  }

  const authUser = await requireAuth(req, res, {
    allowedRoles: ['super_admin', 'admin', 'operations', 'marketing'],
  });
  if (!authUser) return;

  try {
    const range = typeof req.query.range === 'string' ? req.query.range : 'all';

    // 1. Fetch Orders (Non-cancelled)
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select('id, order_number, total_in_paise, subtotal_in_paise, discount_in_paise, order_status, payment_status, created_at')
      .neq('order_status', 'CANCELLED');

    // 2. Fetch Material Procurements
    let procurementsQuery = supabaseAdmin
      .from('raw_material_procurements')
      .select('*')
      .order('purchase_date', { ascending: true });

    // Apply date range cutoff if not 'all'
    if (range !== 'all') {
      const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const cutoffDate = cutoff.slice(0, 10);
      ordersQuery = ordersQuery.gte('created_at', cutoff);
      procurementsQuery = procurementsQuery.gte('purchase_date', cutoffDate);
    }

    const [
      { data: ordersData, error: ordersErr },
      { data: procurementsData, error: procurementsErr },
    ] = await Promise.all([ordersQuery, procurementsQuery]);

    if (ordersErr) {
      console.error('[Financial Summary] Orders fetch error:', ordersErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch sales data: ' + ordersErr.message });
    }

    if (procurementsErr) {
      console.error('[Financial Summary] Procurements fetch error:', procurementsErr);
      return res.status(500).json({ success: false, message: 'Failed to fetch procurements: ' + procurementsErr.message });
    }

    const orders = ordersData || [];
    const procurements = procurementsData || [];

    // Calculate Sales Totals
    const totalSalesPaise = orders.reduce((sum, o) => sum + (Number(o.total_in_paise) || 0), 0);
    const totalOrdersCount = orders.length;

    // Calculate Material Procurement Totals
    const totalProcurementPaise = procurements.reduce((sum, p) => sum + (Number(p.price_in_paise) || 0), 0);

    // Calculate Current Net Profit & Margins
    const netProfitPaise = totalSalesPaise - totalProcurementPaise;
    const netMarginPercent = totalSalesPaise > 0
      ? Number(((netProfitPaise / totalSalesPaise) * 100).toFixed(1))
      : 0;
    const capitalMultiplier = totalProcurementPaise > 0
      ? Number((totalSalesPaise / totalProcurementPaise).toFixed(2))
      : 0;

    // Dynamic Trajectory Generator: Based on ACTUAL business activity from September 2026 launch to date
    const now = new Date();

    // Generate accurate milestone periods (store launched September 2026)
    let periods: { label: string; fullDate: string; start: Date; end: Date }[] = [];

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59);
        const label = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        periods.push({ label, fullDate: start.toISOString().slice(0, 10), start, end });
      }
    } else if (range === '30d') {
      const stepDays = 6;
      for (let i = 4; i >= 0; i--) {
        const start = new Date(now.getTime() - (i + 1) * stepDays * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() - i * stepDays * 24 * 60 * 60 * 1000);
        const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        periods.push({ label, fullDate: end.toISOString().slice(0, 10), start, end });
      }
    } else {
      // All time / 90d: From atelier inception (September 1, 2026) to Present
      periods = [
        {
          label: 'Sep W1',
          fullDate: 'Sep 1 – Sep 7, 2026',
          start: new Date('2026-09-01T00:00:00Z'),
          end: new Date('2026-09-07T23:59:59Z'),
        },
        {
          label: 'Sep W2',
          fullDate: 'Sep 8 – Sep 14, 2026',
          start: new Date('2026-09-08T00:00:00Z'),
          end: new Date('2026-09-14T23:59:59Z'),
        },
        {
          label: 'Sep W3',
          fullDate: 'Sep 15 – Sep 21, 2026',
          start: new Date('2026-09-15T00:00:00Z'),
          end: new Date('2026-09-21T23:59:59Z'),
        },
        {
          label: 'Sep W4',
          fullDate: 'Sep 22 – Sep 30, 2026',
          start: new Date('2026-09-22T00:00:00Z'),
          end: new Date('2026-09-30T23:59:59Z'),
        },
        {
          label: 'Oct W1',
          fullDate: 'Oct 1 – Oct 7, 2026',
          start: new Date('2026-10-01T00:00:00Z'),
          end: new Date('2026-10-07T23:59:59Z'),
        },
        {
          label: 'Oct (Live)',
          fullDate: 'Oct 8 – Present, 2026',
          start: new Date('2026-10-08T00:00:00Z'),
          end: new Date(now.getTime() + 86400000),
        },
      ];
    }

    // Calculate incremental and cumulative sums
    let cumSalesPaise = 0;
    let cumSpendPaise = 0;

    const trajectory = periods.map((p) => {
      // Sells in this period
      const periodSalesPaise = orders
        .filter((o) => {
          if (!o.created_at) return false;
          const t = new Date(o.created_at).getTime();
          return t >= p.start.getTime() && t <= p.end.getTime();
        })
        .reduce((sum, o) => sum + (Number(o.total_in_paise) || 0), 0);

      // Material Spend in this period
      const periodSpendPaise = procurements
        .filter((proc) => {
          if (!proc.purchase_date) return false;
          const t = new Date(proc.purchase_date + 'T12:00:00Z').getTime();
          return t >= p.start.getTime() && t <= p.end.getTime();
        })
        .reduce((sum, proc) => sum + (Number(proc.price_in_paise) || 0), 0);

      cumSalesPaise += periodSalesPaise;
      cumSpendPaise += periodSpendPaise;

      return {
        month: p.label,
        fullDate: p.fullDate,
        salesRupees: Math.round(cumSalesPaise / 100),
        spendRupees: Math.round(cumSpendPaise / 100),
        profitRupees: Math.round((cumSalesPaise - cumSpendPaise) / 100),
        periodSalesRupees: Math.round(periodSalesPaise / 100),
        periodSpendRupees: Math.round(periodSpendPaise / 100),
        periodProfitRupees: Math.round((periodSalesPaise - periodSpendPaise) / 100),
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalSalesPaise,
        totalSalesRupees: Math.round(totalSalesPaise / 100),
        totalOrdersCount,
        totalProcurementPaise,
        totalProcurementRupees: Math.round(totalProcurementPaise / 100),
        netProfitPaise,
        netProfitRupees: Math.round(netProfitPaise / 100),
        netMarginPercent,
        capitalMultiplier,
        trajectory,
      },
    });
  } catch (err: any) {
    console.error('[Financial Summary] Unexpected error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
}
