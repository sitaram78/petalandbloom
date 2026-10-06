import React, { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  Search,
  Filter,
  Eye,
  EyeOff,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useNotification } from '@/context/NotificationContext';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { authFetch } from '@/lib/apiClient';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
  AdminKanbanBoard,
  type KanbanColumn,
} from '@/components/admin/view-system';
import { useRBAC } from '@/hooks/useRBAC';

interface AdminReview {
  id: string;
  product_code: string;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  rating: number;
  review_title?: string;
  review_text: string;
  customer_photo?: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: string;
}

export default function AdminReviews() {
  const { can } = useRBAC();
  const { showNotification } = useNotification();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Unified Admin View System hook
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    activeTab: filterStatus,
    setActiveTab: setFilterStatus,
  } = useAdminView({
    defaultView: 'table',
    defaultTab: 'all',
    searchParamKey: 'q',
    tabParamKey: 'status',
    viewParamKey: 'view',
  });

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviews/list?admin=true');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReviews(data.reviews || []);
        }
      }
    } catch (err: any) {
      showNotification('Failed to fetch reviews: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleModerate = async (reviewId: string, action: 'approve' | 'unapprove' | 'delete') => {
    if (!can('reviews.moderate')) {
      showNotification('Access Denied: You do not have permission to moderate reviews.', 'error');
      return;
    }

    if (action === 'delete' && !window.confirm('Are you sure you want to permanently delete this review?')) {
      return;
    }

    setActionLoadingId(reviewId);
    try {
      const res = await authFetch('/api/reviews/moderate', {
        method: 'POST',
        body: JSON.stringify({ reviewId, action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Action failed.');
      }

      const target = reviews.find((r) => r.id === reviewId);
      logAudit({
        action: AUDIT_ACTIONS.REVIEW_MODERATED,
        entity: 'reviews',
        entity_id: reviewId,
        old_values: target ? { is_approved: target.is_approved } : null,
        new_values: { action, is_approved: action === 'approve' },
        reason: `Admin review moderation: ${action}`,
      });

      showNotification(data.message || 'Review updated.', 'success');
      await fetchReviews();
    } catch (err: any) {
      showNotification(err.message || 'Moderation action failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered reviews
  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.review_title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.review_text.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'approved') return r.is_approved;
    if (filterStatus === 'pending') return !r.is_approved;
    return true;
  });

  const totalCount = reviews.length;
  const approvedCount = reviews.filter((r) => r.is_approved).length;
  const pendingCount = totalCount - approvedCount;
  const avgRating =
    totalCount > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / totalCount).toFixed(1) : '5.0';

  const kanbanColumns: KanbanColumn<AdminReview>[] = [
    {
      id: 'pending',
      title: 'Pending Moderation',
      badgeColor: 'bg-amber-500',
      items: filteredReviews.filter((r) => !r.is_approved),
      emptyMessage: 'No reviews awaiting moderation',
    },
    {
      id: 'approved',
      title: 'Live & Published',
      badgeColor: 'bg-emerald-600',
      items: filteredReviews.filter((r) => r.is_approved),
      emptyMessage: 'No published reviews in this view',
    },
  ];

  const renderKanbanCard = (r: AdminReview) => (
    <div
      onClick={() => setSelectedReview(r)}
      className="bg-linen p-4 rounded-sm border border-canvas-line shadow-xs hover:border-bark hover:shadow-soft transition-all cursor-pointer space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 text-rose">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={12}
              className={s <= r.rating ? 'fill-rose text-rose' : 'text-canvas-line'}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] font-bold text-bark uppercase bg-canvas/60 px-1.5 py-0.5 rounded border border-canvas-line">
          {r.product_code}
        </span>
      </div>

      {r.review_title && (
        <h4 className="font-serif font-semibold text-bark text-xs line-clamp-1">
          {r.review_title}
        </h4>
      )}

      <p className="text-xs text-ink-light line-clamp-3 italic">
        &ldquo;{r.review_text}&rdquo;
      </p>

      {r.customer_photo && (
        <div className="relative w-full h-24 rounded-sm overflow-hidden border border-canvas-line">
          <img
            src={r.customer_photo}
            alt="Review upload"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="pt-2 border-t border-canvas-line flex items-center justify-between text-[10px] text-ink-light">
        <span className="font-medium text-bark truncate">{r.customer_name}</span>
        <span className="text-rose font-medium uppercase tracking-wider flex items-center gap-0.5">
          Moderate <ChevronRight size={11} />
        </span>
      </div>
    </div>
  );

  return (
    <AdminLayout activePage="reviews">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Social Proof & UGC Moderation"
          title="Customer Reviews & Stories"
          subtitle="Moderate and inspect reviews submitted by verified patrons who purchased bespoke blooms."
          stats={[
            {
              label: 'Total Reviews',
              value: totalCount,
              icon: <MessageSquare size={18} />,
              subtext: 'Client feedback submissions',
            },
            {
              label: 'Published & Live',
              value: approvedCount,
              icon: <CheckCircle2 size={18} className="text-emerald-700" />,
              subtext: 'Visible on piece pages',
            },
            {
              label: 'Pending Moderation',
              value: pendingCount,
              icon: <Sparkles size={18} className="text-amber-600" />,
              subtext: 'Awaiting atelier review',
            },
            {
              label: 'Average Score',
              value: `${avgRating} ★`,
              icon: <Star size={18} className="text-rose fill-rose" />,
              subtext: 'Patron satisfaction rating',
            },
          ]}
        />

        {/* Standardized View Toolbar */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by patron, piece code, or text..."
          tabs={[
            { id: 'all', label: 'All Reviews', count: totalCount },
            { id: 'pending', label: 'Pending Moderation', count: pendingCount },
            { id: 'approved', label: 'Live & Published', count: approvedCount },
          ]}
          activeTab={filterStatus}
          onTabChange={(tab) => setFilterStatus(tab as 'all' | 'approved' | 'pending')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table', 'kanban']}
          onRefresh={fetchReviews}
          isRefreshing={loading}
        />

        {/* Reviews Content: Kanban vs Table List */}
        {loading ? (
          <div className="py-16 text-center bg-linen rounded-sm border border-canvas-line shadow-soft">
            <Loader2 size={28} className="animate-spin text-rose mx-auto mb-2" />
            <p className="text-xs text-ink-light">Fetching customer reviews...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-16 text-center bg-linen rounded-sm border border-canvas-line shadow-soft space-y-2">
            <MessageSquare size={32} className="text-ink-light mx-auto mb-2 opacity-50" />
            <h3 className="heading-serif text-xl text-bark">No Reviews Found</h3>
            <p className="text-xs text-ink-light max-w-sm mx-auto">
              No reviews match the active search query or filter selection.
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          <AdminKanbanBoard
            columns={kanbanColumns}
            renderCard={renderKanbanCard}
          />
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((r) => {
              const isActioning = actionLoadingId === r.id;
              return (
                <div
                  key={r.id}
                  className="bg-linen p-5 sm:p-6 rounded-sm border border-canvas-line shadow-soft space-y-4 transition-all hover:border-canvas-line-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-0.5 text-rose">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              className={s <= r.rating ? 'fill-rose text-rose' : 'text-canvas-line'}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-xs font-bold text-bark uppercase bg-canvas/60 px-2 py-0.5 rounded-sm border border-canvas-line">
                          {r.product_code}
                        </span>
                        {r.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            Verified Purchaser
                          </span>
                        )}
                        {r.is_approved ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-900">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900">
                            Pending Review
                          </span>
                        )}
                      </div>

                      {r.review_title && (
                        <h4 className="font-serif font-semibold text-bark text-base mb-1">
                          {r.review_title}
                        </h4>
                      )}

                      <p className="text-xs text-ink-light leading-relaxed whitespace-pre-line max-w-3xl">
                        &ldquo;{r.review_text}&rdquo;
                      </p>

                      {r.customer_photo && (
                        <div className="mt-3">
                          <img
                            src={r.customer_photo}
                            alt="Customer upload"
                            onClick={() => setSelectedReview(r)}
                            className="w-24 h-24 object-cover rounded-sm border border-canvas-line shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                      <button
                        type="button"
                        onClick={() => setSelectedReview(r)}
                        className="px-3 py-1.5 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm flex items-center gap-1.5 transition-colors"
                      >
                        Inspect
                        <ChevronRight size={13} />
                      </button>

                      {can('reviews.moderate') && (
                        <>
                          {r.is_approved ? (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleModerate(r.id, 'unapprove')}
                              className="px-3 py-1.5 border border-canvas-line text-xs font-medium text-ink-light hover:text-bark rounded-sm flex items-center gap-1.5 transition-colors"
                            >
                              <EyeOff size={13} />
                              Unpublish
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isActioning}
                              onClick={() => handleModerate(r.id, 'approve')}
                              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-linen text-xs font-semibold rounded-sm flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <CheckCircle2 size={13} />
                              Approve
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isActioning}
                            onClick={() => handleModerate(r.id, 'delete')}
                            className="p-1.5 text-red-600 hover:text-red-700 border border-red-200 rounded-sm hover:bg-red-50 transition-colors"
                            title="Delete review"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Patron Meta */}
                  <div className="pt-3 border-t border-canvas-line/60 flex items-center justify-between text-[11px] text-ink-light">
                    <div>
                      Patron: <strong className="text-bark font-medium">{r.customer_name}</strong>
                      {r.customer_email && <span className="ml-2">({r.customer_email})</span>}
                    </div>
                    <span>
                      Submitted on{' '}
                      {new Date(r.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review Moderation Inspector Drawer */}
        <AdminEntityDrawer
          isOpen={!!selectedReview}
          onClose={() => setSelectedReview(null)}
          title={selectedReview ? `Review from ${selectedReview.customer_name}` : ''}
          subtitle={
            selectedReview
              ? `Submitted on ${new Date(selectedReview.created_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}`
              : ''
          }
          badge={
            selectedReview && (
              selectedReview.is_approved ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-900">
                  Published & Live
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900">
                  Pending Review
                </span>
              )
            )
          }
          widthClass="max-w-2xl"
          footerActions={
            selectedReview && can('reviews.moderate') && (
              <div className="flex items-center gap-3 w-full justify-between">
                <button
                  type="button"
                  disabled={actionLoadingId === selectedReview.id}
                  onClick={async () => {
                    await handleModerate(selectedReview.id, 'delete');
                    setSelectedReview(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-sm transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Review
                </button>

                <div className="flex items-center gap-2">
                  {selectedReview.is_approved ? (
                    <button
                      type="button"
                      disabled={actionLoadingId === selectedReview.id}
                      onClick={async () => {
                        await handleModerate(selectedReview.id, 'unapprove');
                        setSelectedReview(null);
                      }}
                      className="px-4 py-2 bg-canvas border border-canvas-line text-bark hover:bg-linen text-xs uppercase tracking-wider font-semibold rounded-sm transition-colors flex items-center gap-1.5"
                    >
                      <EyeOff size={14} /> Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoadingId === selectedReview.id}
                      onClick={async () => {
                        await handleModerate(selectedReview.id, 'approve');
                        setSelectedReview(null);
                      }}
                      className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-linen text-xs uppercase tracking-wider font-semibold rounded-sm transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 size={14} /> Approve & Publish
                    </button>
                  )}
                </div>
              </div>
            )
          }
        >
          {selectedReview && (
            <div className="space-y-6">
              {/* Product & Score Snapshot */}
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-light font-bold block mb-1">
                    Piece Reference
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-bark bg-white px-2 py-0.5 rounded border border-canvas-line">
                      {selectedReview.product_code}
                    </span>
                    <a
                      href={`/product/${selectedReview.product_code.toLowerCase()}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-rose hover:underline flex items-center gap-1"
                    >
                      View Piece <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-ink-light font-bold block mb-1">
                    Rating Given
                  </span>
                  <div className="flex items-center gap-1 text-rose justify-end">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={15}
                        className={s <= selectedReview.rating ? 'fill-rose text-rose' : 'text-canvas-line'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Content */}
              <div className="space-y-3">
                {selectedReview.review_title && (
                  <h3 className="heading-serif text-xl text-bark">
                    {selectedReview.review_title}
                  </h3>
                )}
                <div className="p-4 bg-linen rounded-sm border border-canvas-line text-ink text-sm leading-relaxed whitespace-pre-line italic">
                  &ldquo;{selectedReview.review_text}&rdquo;
                </div>
              </div>

              {/* Customer Photo High-Res Preview */}
              {selectedReview.customer_photo && (
                <div className="space-y-2">
                  <h4 className="text-xs uppercase tracking-wider font-bold text-bark">
                    Patron Uploaded Imagery
                  </h4>
                  <div className="rounded-sm overflow-hidden border border-canvas-line bg-canvas/30">
                    <img
                      src={selectedReview.customer_photo}
                      alt="Customer upload"
                      className="w-full max-h-96 object-contain mx-auto"
                    />
                  </div>
                </div>
              )}

              {/* Patron Profile Details */}
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2 text-xs">
                <h4 className="text-xs uppercase tracking-wider font-bold text-bark mb-2">
                  Patron Credentials
                </h4>
                <div className="flex justify-between text-ink-light">
                  <span>Name</span>
                  <strong className="text-bark">{selectedReview.customer_name}</strong>
                </div>
                {selectedReview.customer_email && (
                  <div className="flex justify-between text-ink-light">
                    <span>Email</span>
                    <span className="text-bark">{selectedReview.customer_email}</span>
                  </div>
                )}
                <div className="flex justify-between text-ink-light">
                  <span>Verification Status</span>
                  {selectedReview.is_verified_purchase ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Verified Atelier Purchaser
                    </span>
                  ) : (
                    <span className="text-ink-light">Unverified Guest</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </AdminEntityDrawer>
      </main>
    </AdminLayout>
  );
}
