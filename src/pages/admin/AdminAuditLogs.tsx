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
import { authFetch } from '@/lib/apiClient';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
} from '@/components/admin/view-system';

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
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [stats, setStats] = useState<AuditStats>({
    total_events: 0,
    events_today: 0,
    unique_actors: 0,
    most_common_action: 'N/A'
  });

  // Unified Admin View System hook
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    activeTab: entityFilterTab,
    setActiveTab: setEntityFilterTab,
  } = useAdminView({
    defaultView: 'table',
    defaultTab: 'ALL',
    searchParamKey: 'q',
    tabParamKey: 'entity',
    viewParamKey: 'view',
  });

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionType, setActionType] = useState('');
  
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
      if (entityFilterTab && entityFilterTab !== 'ALL') params.append('entity', entityFilterTab);
      if (searchQuery) params.append('search', searchQuery);

      const res = await authFetch(`/api/audit/list?${params.toString()}`);
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
  }, [fromDate, toDate, actionType, entityFilterTab, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [page, fromDate, toDate, actionType, entityFilterTab, searchQuery]);

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setActionType('');
    setEntityFilterTab('ALL');
    setSearchQuery('');
    setPage(1);
  };

  return (
    <AdminLayout activePage="audit-logs">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 font-karla">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Security & Compliance"
          title="System Audit Logs"
          subtitle="Immutable trail of all administrative and system actions across the boutique platform."
          stats={[
            {
              label: 'Total Events',
              value: stats.total_events.toLocaleString(),
              icon: <Database size={18} />,
              subtext: 'Recorded immutable actions',
            },
            {
              label: 'Events Today',
              value: stats.events_today.toLocaleString(),
              icon: <Clock size={18} className="text-emerald-700" />,
              subtext: 'Today across all modules',
            },
            {
              label: 'Unique Actors',
              value: stats.unique_actors.toLocaleString(),
              icon: <User size={18} className="text-indigo-700" />,
              subtext: 'Staff & system agents',
            },
            {
              label: 'Common Action',
              value: stats.most_common_action === 'ORDER_STATUS_TRANSITION'
                ? 'Status Transition'
                : stats.most_common_action === 'SETTINGS_UPDATED'
                ? 'Settings Update'
                : stats.most_common_action.replace(/_/g, ' '),
              icon: <Activity size={18} className="text-amber-700" />,
              subtext: 'Highest frequency event',
            },
          ]}
          secondaryActions={[
            {
              label: 'Refresh Logs',
              icon: <Activity size={14} />,
              onClick: fetchLogs,
              disabled: loading,
            },
          ]}
        />

        {/* Standardized View Toolbar */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search ID, reason, actor email..."
          tabs={[
            { id: 'ALL', label: 'All Entities' },
            { id: 'orders', label: 'Orders' },
            { id: 'payments', label: 'Payments' },
            { id: 'loyalty_accounts', label: 'Loyalty' },
            { id: 'coupons', label: 'Coupons' },
            { id: 'profiles', label: 'Profiles' },
            { id: 'products', label: 'Products' },
            { id: 'reviews', label: 'Reviews' },
          ]}
          activeTab={entityFilterTab}
          onTabChange={setEntityFilterTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table']}
          onRefresh={fetchLogs}
          isRefreshing={loading}
        />

        {/* Granular Date & Action Filter Bar */}
        <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">From Date</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bark/60" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
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
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-bark tracking-wider">Action Type</label>
              <div className="relative">
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark appearance-none"
                >
                  <option value="">All Action Types</option>
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bark/60 pointer-events-none" />
              </div>
            </div>

            <div>
              <button
                onClick={clearFilters}
                className="w-full py-1.5 bg-canvas hover:bg-canvas-line/50 border border-canvas-line text-xs font-semibold text-bark rounded-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <X size={13} /> Clear Date & Action Filters
              </button>
            </div>
          </div>
        </div>

        {/* Timeline Table */}
        <div className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-parchment border-b border-canvas-line">
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-40">Timestamp</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-48">Actor</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider">Action</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider w-48">Entity</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider">Reason</th>
                  <th className="px-4 py-3 text-[10px] uppercase font-bold text-bark tracking-wider text-right">Inspect</th>
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
                    const link = getEntityLink(log.entity);
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-parchment/50 transition-colors cursor-pointer"
                      >
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
                              <span className="text-xs text-rose font-mono truncate max-w-[150px]" title={log.entity_id}>
                                {log.entity_id.substring(0, 16)}...
                              </span>
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
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="px-2.5 py-1 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm transition-colors inline-flex items-center gap-1"
                          >
                            Inspect Diff
                            <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
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

        {/* Audit Log JSON Diff Inspector Drawer */}
        <AdminEntityDrawer
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={selectedLog ? selectedLog.action.replace(/_/g, ' ') : ''}
          subtitle={
            selectedLog
              ? `Triggered by ${selectedLog.actor_email || 'System'} • ${new Date(selectedLog.created_at).toLocaleString('en-IN')}`
              : ''
          }
          badge={
            selectedLog && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionColor(selectedLog.action)}`}>
                {selectedLog.action.replace(/_/g, ' ')}
              </span>
            )
          }
          widthClass="max-w-2xl sm:max-w-3xl"
        >
          {selectedLog && (
            <div className="space-y-6">
              {/* Event Metadata */}
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-light">Entity Type</span>
                  <span className="font-semibold text-bark uppercase">{selectedLog.entity}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Entity Identifier</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-bark font-bold">{selectedLog.entity_id}</span>
                    {getEntityLink(selectedLog.entity) && (
                      <a
                        href={getEntityLink(selectedLog.entity)!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose hover:underline flex items-center gap-1 font-sans"
                      >
                        Open Resource
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-light">Actor Account</span>
                  <span className="font-medium text-bark">{selectedLog.actor_email || 'System Automated Task'}</span>
                </div>
                {selectedLog.ip_address && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">IP Address</span>
                    <span className="font-mono text-bark">{selectedLog.ip_address}</span>
                  </div>
                )}
                {selectedLog.reason && (
                  <div className="pt-2 border-t border-canvas-line">
                    <span className="text-ink-light block mb-0.5">Audit Reason:</span>
                    <p className="font-medium text-bark">{selectedLog.reason}</p>
                  </div>
                )}
              </div>

              {/* Side by Side JSON State Diff */}
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-wider font-bold text-bark">
                  State Mutation Diff
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                      <FileJson size={14} />
                      <span>Previous State (Before)</span>
                    </div>
                    <JsonViewer data={selectedLog.old_values} isOld={true} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <FileJson size={14} />
                      <span>New State (After)</span>
                    </div>
                    <JsonViewer data={selectedLog.new_values} isOld={false} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </AdminEntityDrawer>
      </main>
    </AdminLayout>
  );
}
