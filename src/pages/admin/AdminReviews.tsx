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
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useNotification } from '@/context/NotificationContext';

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
  const { showNotification } = useNotification();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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
    if (action === 'delete' && !window.confirm('Are you sure you want to permanently delete this review?')) {
      return;
    }

    setActionLoadingId(reviewId);
    try {
      const res = await fetch('/api/reviews/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Action failed.');
      }

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

  return (
    <AdminLayout activePage="reviews">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Social Proof &amp; UGC Moderation
            </p>
            <h1 className="heading-serif text-4xl text-bark">Customer Reviews &amp; Stories</h1>
            <p className="text-xs text-ink-light mt-1">
              Moderate and inspect reviews submitted by verified patrons who purchased bespoke blooms.
            </p>
          </div>

          <button
            onClick={fetchReviews}
            disabled={loading}
            className="px-4 py-2 bg-white border border-canvas-line text-xs font-semibold text-bark rounded-sm hover:bg-canvas/30 transition-colors self-start md:self-auto"
          >
            {loading ? 'Refreshing...' : 'Refresh Reviews'}
          </button>
        </header>

        {/* KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft">
            <p className="text-[10px] uppercase font-bold text-ink-light tracking-wider mb-1">
              Total Reviews
            </p>
            <p className="text-2xl font-serif font-bold text-bark">{totalCount}</p>
          </div>
          <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft">
            <p className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider mb-1">
              Published &amp; Live
            </p>
            <p className="text-2xl font-serif font-bold text-emerald-900">{approvedCount}</p>
          </div>
          <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft">
            <p className="text-[10px] uppercase font-bold text-amber-800 tracking-wider mb-1">
              Pending Moderation
            </p>
            <p className="text-2xl font-serif font-bold text-amber-900">{pendingCount}</p>
          </div>
          <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft">
            <p className="text-[10px] uppercase font-bold text-rose-deep tracking-wider mb-1">
              Average Score
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-serif font-bold text-bark">{avgRating}</span>
              <Star size={16} className="fill-rose text-rose" />
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-linen p-4 rounded-sm border border-canvas-line shadow-soft">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
            <input
              type="text"
              placeholder="Search by patron, piece code, or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={14} className="text-ink-light" />
            <div className="inline-flex rounded-sm border border-canvas-line bg-canvas/30 p-0.5">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-sm text-xs font-medium transition-all ${
                  filterStatus === 'all' ? 'bg-bark text-linen shadow-sm' : 'text-ink-light hover:text-ink'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('approved')}
                className={`px-3 py-1 rounded-sm text-xs font-medium transition-all ${
                  filterStatus === 'approved' ? 'bg-bark text-linen shadow-sm' : 'text-ink-light hover:text-ink'
                }`}
              >
                Live ({approvedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('pending')}
                className={`px-3 py-1 rounded-sm text-xs font-medium transition-all ${
                  filterStatus === 'pending' ? 'bg-bark text-linen shadow-sm' : 'text-ink-light hover:text-ink'
                }`}
              >
                Pending ({pendingCount})
              </button>
            </div>
          </div>
        </div>

        {/* Reviews Moderation Table / Cards */}
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
                            className="w-24 h-24 object-cover rounded-sm border border-canvas-line shadow-xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
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
                          Approve &amp; Publish
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
      </main>
    </AdminLayout>
  );
}
