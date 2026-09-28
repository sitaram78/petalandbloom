import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  User,
  X,
  Loader2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Database,
  Hash,
  AlertCircle,
  FileJson,
  Eye,
  EyeOff,
  ChevronLeft
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string;
  reason: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
}

interface AuditStats {
  total_events: number;
  events_today: number;
  unique_actors: number;
  most_common_action: string;
}

const ACTION_TYPES = [
  'ORDER_STATUS_TRANSITION',
  'ORDER_CANCELLED',
  'PAYMENT_REFUNDED',
  'POINTS_ADJUSTED',
  'PRODUCT_PRICE_CHANGED',
  'PRODUCT_DEACTIVATED',
  'COUPON_CREATED',
  'COUPON_RATE_MODIFIED',
  'CUSTOMER_PII_EXPORTED',
  'STAFF_ROLE_MODIFIED',
  'REVIEW_MODERATED',
  'SETTINGS_UPDATED',
];

const ENTITY_TYPES = [
  'orders',
  'payments',
  'loyalty_accounts',
  'products',
  'coupons',
  'profiles',
  'reviews',
  'settings',
];

const getActionColor = (action: string) => {
  if (action === 'ORDER_STATUS_TRANSITION') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (action === 'ORDER_CANCELLED') return 'bg-red-100 text-red-800 border-red-200';
  if (action === 'PAYMENT_REFUNDED') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (action === 'POINTS_ADJUSTED') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (action.startsWith('PRODUCT_')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (action.startsWith('COUPON_')) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (action === 'CUSTOMER_PII_EXPORTED') return 'bg-rose-100 text-rose-800 border-rose-200';
  if (action === 'STAFF_ROLE_MODIFIED') return 'bg-red-100 text-red-800 border-red-200';
  if (action === 'REVIEW_MODERATED') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (action === 'SETTINGS_UPDATED') return 'bg-gray-100 text-gray-800 border-gray-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

const getEntityLink = (entityType: string) => {
  switch (entityType) {
    case 'orders': return `/admin/orders`;
    case 'profiles':
    case 'loyalty_accounts': return `/admin/customers`;
    case 'products': return `/admin/editor`;
    case 'reviews': return `/admin/reviews`;
    case 'coupons': return `/admin/coupons`;
    case 'settings': return `/admin/settings`;
    default: return null;
  }
};

const JsonViewer = ({ data, isOld }: { data: Record<string, any> | null; isOld: boolean }) => {
  if (!data || Object.keys(data).length === 0) {
    return <span className="text-xs text-bark/50 italic">No data</span>;
  }
  
  return (
    <div className={`p-3 rounded-sm text-xs font-mono overflow-x-auto ${isOld ? 'bg-red-50/50 border border-red-100 text-red-900' : 'bg-emerald-50/50 border border-emerald-100 text-emerald-900'}`}>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AuditStats>({
    total_events: 0,
    events_today: 0,
    unique_actors: 0,
    most_common_action: 'N/A'
  });

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionType, setActionType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Expanded Rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      if (actionType) params.append('action', actionType);
      if (entityType) params.append('entity', entityType);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/audit/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(Math.ceil((data.total || 0) / limit) || 1);
        
        if (data.stats) {
          setStats(data.stats);
        } else {
          // Fallback stats calculation from current page if not provided by API
          const uniqueActors = new Set(data.logs?.map((l: AuditLog) => l.actor_email).filter(Boolean)).size;
          const today = new Date().toISOString().split('T')[0];
          const todayEvents = data.logs?.filter((l: AuditLog) => l.created_at.startsWith(today)).length || 0;
          
          const actionCounts = data.logs?.reduce((acc: Record<string, number>, log: AuditLog) => {
            acc[log.action] = (acc[log.action] || 0) + 1;
            return acc;
          }, {});
          
          let mostCommon = 'N/A';
          let maxCount = 0;
          if (actionCounts) {
            Object.entries(actionCounts).forEach(([action, count]) => {
              if ((count as number) > maxCount) {
                maxCount = count as number;
                mostCommon = action;
              }
            });
          }

          setStats({
            total_events: data.total || data.logs?.length || 0,
            events_today: todayEvents,
            unique_actors: uniqueActors,
            most_common_action: mostCommon
          });
        }
      } else {
        // Handle gracefully, setup empty state if table doesn't exist
        setLogs([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Reset to page 1 when filters change
    setPage(1);
  }, [fromDate, toDate, actionType, entityType, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [page, fromDate, toDate, actionType, entityType, searchQuery]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setActionType('');
    setEntityType('');
    setSearchQuery('');
    setPage(1);
  };

  return (
    <AdminLayout activePage="audit-logs">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 font-karla">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Security &amp; Compliance
            </p>
            <h1 className="heading-serif text-4xl text-ink">System Audit Logs</h1>
            <p className="text-xs text-bark mt-1">
              Immutable trail of all administrative and system actions across the boutique platform.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-linen border border-canvas-line text-xs font-semibold text-ink rounded-sm hover:bg-canvas-line/30 transition-colors self-start md:self-auto flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </header>

        {/* KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-parchment p-4 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center gap-2 text-ink mb-1">
              <Database size={14} className="text-rose" />
              <p className="text-[10px] uppercase font-bold tracking-wider">Total Events</p>
            </div>
            <p className="text-2xl font-serif font-bold text-ink">{stats.total_events.toLocaleString()}</p>
          </div>
          <div className="bg-parchment p-4 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center gap-2 text-ink mb-1">
              <Clock size={14} className="text-emerald-600" />
              <p className="text-[10px] uppercase font-bold tracking-wider">Events Today</p>
            </div>
            <p className="text-2xl font-serif font-bold text-ink">{stats.events_today.toLocaleString()}</p>
          </div>
          <div className="bg-parchment p-4 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center gap-2 text-ink mb-1">
              <User size={14} className="text-indigo-600" />
              <p className="text-[10px] uppercase font-bold tracking-wider">Unique Actors</p>
            </div>
            <p className="text-2xl font-serif font-bold text-ink">{stats.unique_actors.toLocaleString()}</p>
          </div>
          <div className="bg-parchment p-4 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center gap-2 text-ink mb-1">
              <Activity size={14} className="text-amber-600" />
              <p className="text-[10px] uppercase font-bold tracking-wider">Common Action</p>
            </div>
            <p className="text-sm font-semibold text-ink truncate mt-2" title={stats.most_common_action}>
              {stats.most_common_action.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft space-y-4">
          <div className="flex items-center gap-2 mb-2 text-ink font-semibold text-sm">
            <Filter size={16} />
            <h2>Filter Audit Trail</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">From Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bark/60" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-ink"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">To Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bark/60" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-ink"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">Action Type</label>
              <div className="relative">
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-ink appearance-none"
                >
                  <option value="">All Actions</option>
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bark/60 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">Entity Type</label>
              <div className="relative">
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-ink appearance-none"
                >
                  <option value="">All Entities</option>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>{type.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bark/60 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bark/60" />
                <input
                  type="text"
                  placeholder="ID, Reason, Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-ink"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-rose hover:text-rose/80 flex items-center gap-1 transition-colors"
            >
              <X size={14} /> Clear Filters
            </button>
          </div>
        </div>

        {/* Timeline Table */}
        <div className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-parchment border-b border-canvas-line">
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-10"></th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-40">Timestamp</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-48">Actor</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider">Action</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-48">Entity</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-line">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Loader2 size={24} className="animate-spin text-rose mx-auto mb-2" />
                      <p className="text-xs text-bark">Fetching audit trail...</p>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <ShieldAlert size={32} className="text-bark/30 mx-auto mb-3" />
                      <h3 className="heading-serif text-lg text-ink">No Audit Records Found</h3>
                      <p className="text-xs text-bark mt-1">
                        Try adjusting your filters or date range.
                      </p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedRows.has(log.id);
                    const link = getEntityLink(log.entity);
                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-parchment/50 transition-colors">
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleRow(log.id)}
                              className="p-1 rounded-sm text-bark hover:bg-canvas-line/50 transition-colors focus:outline-none"
                              aria-label={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-xs text-ink whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-canvas-line flex items-center justify-center shrink-0">
                                <User size={10} className="text-bark" />
                              </div>
                              <span className="text-xs text-ink font-medium truncate max-w-[150px]" title={log.actor_email || 'System'}>
                                {log.actor_email || 'System'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionColor(log.action)}`}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] uppercase font-bold text-bark tracking-wider">
                                {log.entity.replace(/_/g, ' ')}
                              </span>
                              {link ? (
                                <a href={link} className="text-xs text-rose hover:underline font-mono truncate max-w-[150px]" title={log.entity_id}>
                                  {log.entity_id.substring(0, 16)}...
                                </a>
                              ) : (
                                <span className="text-xs text-ink font-mono truncate max-w-[150px]" title={log.entity_id}>
                                  {log.entity_id.substring(0, 16)}...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-bark line-clamp-2" title={log.reason || 'No reason provided'}>
                              {log.reason || <span className="italic opacity-50">No reason provided</span>}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-parchment/30 border-b border-canvas-line">
                            <td colSpan={6} className="px-10 py-6">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileJson size={14} className="text-red-600" />
                                    <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Previous State</h4>
                                  </div>
                                  <JsonViewer data={log.old_values} isOld={true} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileJson size={14} className="text-emerald-600" />
                                    <h4 className="text-xs font-bold text-ink uppercase tracking-wider">New State</h4>
                                  </div>
                                  <JsonViewer data={log.new_values} isOld={false} />
                                </div>
                              </div>
                              <div className="mt-4 flex items-center gap-4 text-[10px] text-bark">
                                <div>
                                  <strong>Event ID:</strong> <span className="font-mono">{log.id}</span>
                                </div>
                                {log.ip_address && (
                                  <div>
                                    <strong>IP Address:</strong> <span className="font-mono">{log.ip_address}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="px-4 py-3 border-t border-canvas-line flex items-center justify-between bg-white">
              <span className="text-xs text-bark">
                Page <strong className="text-ink">{page}</strong> of <strong className="text-ink">{totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-sm border border-canvas-line text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-linen transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-sm border border-canvas-line text-ink disabled:opacity-50 disabled:cursor-not-allowed hover:bg-linen transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AdminLayout>
  );
}
