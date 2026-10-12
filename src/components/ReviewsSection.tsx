import React, { useState, useEffect } from 'react';
import { Star, CheckCircle2, ShieldCheck, Camera, Sparkles, Loader2, X, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { useNavigate } from 'react-router-dom';
import Reveal from '@/components/Reveal';

interface ReviewItem {
  id: string;
  product_code: string;
  customer_name: string;
  rating: number;
  review_title: string;
  review_text: string;
  customer_photo?: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

interface ReviewsSectionProps {
  productCode?: string;
  productName?: string;
}

export default function ReviewsSection({ productCode = 'rose-elegance', productName = 'Floral Bouquet' }: ReviewsSectionProps) {
  const { settings } = useStoreSettings();
  if (settings.featureFlags?.enableReviews === false) {
    return null;
  }

  const { user, profile } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(5.0);
  const [ratingBreakdown, setRatingBreakdown] = useState<Record<number, number>>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [loading, setLoading] = useState(true);

  // Eligibility State
  const [isEligible, setIsEligible] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);

  // Review Modal Form State
  const [showModal, setShowModal] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch Reviews
  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews/list?productCode=${encodeURIComponent(productCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReviews(data.reviews || []);
          setTotalReviews(data.totalReviews || 0);
          setAverageRating(data.averageRating || 5.0);
          setRatingBreakdown(data.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
        }
      }
    } catch (err) {
      console.warn('[Reviews Fetch Error]:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check Verified Purchase Eligibility
  const checkEligibility = async () => {
    if (!user) {
      setIsEligible(false);
      setEligibilityChecked(true);
      return;
    }
    try {
      const res = await fetch(
        `/api/reviews/list?eligibility=true&productCode=${encodeURIComponent(productCode)}&userId=${user.id}&userEmail=${encodeURIComponent(user.email || '')}`
      );
      if (res.ok) {
        const data = await res.json();
        setIsEligible(!!data.eligible);
        setAlreadyReviewed(!!data.alreadyReviewed);
      }
    } catch (err) {
      console.warn('[Review Eligibility Error]:', err);
    } finally {
      setEligibilityChecked(true);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productCode]);

  useEffect(() => {
    checkEligibility();
  }, [user, productCode]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!user) {
      setFormError('Please sign in to submit a review.');
      return;
    }
    if (!reviewText.trim()) {
      setFormError('Please enter your review text.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode,
          rating,
          reviewTitle: reviewTitle.trim(),
          reviewText: reviewText.trim(),
          customerPhoto: customerPhoto.trim() || undefined,
          customerId: user.id,
          customerName: profile?.full_name || user.email?.split('@')[0] || 'Verified Patron',
          customerEmail: user.email,
          customerPhone: profile?.phone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit review.');
      }

      showNotification('Thank you! Your verified review has been published.', 'success');
      setShowModal(false);
      setReviewTitle('');
      setReviewText('');
      setCustomerPhoto('');
      setRating(5);
      await fetchReviews();
      await checkEligibility();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="reviews" className="py-16 lg:py-24 bg-linen border-t border-canvas-line/80">
      <div className="container-lux max-w-6xl">
        {/* Header */}
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-10">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-rose font-semibold mb-1">
                The Atelier Guestbook
              </p>
              <h2 className="font-serif text-3xl lg:text-4xl text-bark font-medium">Patron Stories &amp; Reviews</h2>
              <p className="text-xs sm:text-sm text-ink-light mt-1">
                Authentic experiences from verified collectors across India.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 text-xs font-medium">
                <ShieldCheck size={14} className="text-emerald-700" />
                <span>100% Verified Collectors Only</span>
              </span>
            </div>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Atelier Scorecard (4 cols) */}
          <div className="lg:col-span-4 bg-white/80 backdrop-blur-sm rounded-3xl p-5 sm:p-7 border border-canvas-line/80 shadow-xs space-y-4 sm:space-y-6">
            <div className="flex sm:flex-col items-center justify-between sm:justify-center pb-4 sm:pb-5 border-b border-canvas-line/70 gap-3 sm:gap-0">
              <div className="text-center shrink-0 pr-3 sm:pr-0">
                <div className="font-serif text-4xl sm:text-6xl text-bark font-medium leading-none mb-1 sm:mb-2">
                  {averageRating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center gap-1 text-rose text-sm sm:text-base mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className={s <= Math.round(averageRating) ? 'fill-rose text-rose' : 'text-canvas-line'}
                    />
                  ))}
                </div>
                <p className="text-[10px] sm:text-xs text-ink-light font-medium whitespace-nowrap">
                  {totalReviews} verified {totalReviews === 1 ? 'review' : 'reviews'}
                </p>
              </div>

              {/* Mobile compact bars: side-by-side with score */}
              <div className="flex-1 w-full sm:hidden space-y-1 text-xs pl-3 border-l border-canvas-line/60">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingBreakdown[star] || 0;
                  const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : star === 5 ? 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-1.5 text-ink-light">
                      <span className="w-5 font-mono text-bark font-medium text-[10px]">{star}★</span>
                      <div className="flex-1 h-1.5 bg-canvas rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-4 text-right font-mono text-[10px]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop / tablet distribution bars */}
            <div className="hidden sm:block space-y-2 text-xs">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingBreakdown[star] || 0;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : star === 5 ? 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2.5 text-ink-light">
                    <span className="w-10 font-mono text-bark font-medium text-[11px]">{star} ★</span>
                    <div className="flex-1 h-2 bg-canvas rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-[11px]">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Studio Guestbook Pledge */}
            <div className="bg-canvas/50 rounded-2xl p-4 border border-canvas-line/70 text-xs text-ink-light leading-relaxed">
              <span className="font-semibold text-bark block mb-0.5">The Studio Guestbook Pledge</span>
              To preserve uncompromised craft integrity, only patrons who have ordered this piece can submit ratings and stories.
            </div>

            {/* Action / Trigger Button */}
            <div>
              {user ? (
                isEligible ? (
                  !alreadyReviewed ? (
                    <button
                      type="button"
                      onClick={() => setShowModal(true)}
                      className="w-full py-3 bg-bark hover:bg-rose-deep text-linen text-xs uppercase tracking-wider font-semibold rounded-full shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles size={14} className="text-rose" />
                      Write a Verified Review
                    </button>
                  ) : (
                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      You have reviewed this piece
                    </div>
                  )
                ) : (
                  <div className="text-center">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-full bg-canvas/60 text-ink-light border border-canvas-line text-xs font-medium cursor-not-allowed opacity-75"
                    >
                      Verified Purchasers Only
                    </button>
                    <p className="text-[10px] text-ink-light mt-1.5 italic">
                      Purchase this bloom to share your story
                    </p>
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/account', { state: { returnToCheckout: false } })}
                  className="w-full py-3 rounded-full border border-bark text-bark hover:bg-bark hover:text-linen text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer"
                >
                  Sign In to Review
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Editorial Testimonials (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {loading ? (
              <div className="py-16 text-center bg-white/60 rounded-3xl border border-canvas-line/70">
                <Loader2 size={24} className="animate-spin text-rose mx-auto mb-2" />
                <p className="text-xs text-ink-light">Loading verified reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm p-8 sm:p-12 text-center rounded-3xl border border-canvas-line/80 shadow-2xs space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto text-xl">
                  💌
                </div>
                <h3 className="font-serif text-2xl text-bark font-medium">Be the First to Review</h3>
                <p className="text-xs sm:text-sm text-ink-light max-w-md mx-auto leading-relaxed">
                  As each bespoke arrangement is crocheted to order, your personal story and floral photos help future collectors choose their heirloom blooms.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-canvas-line/80 hover:border-rose/30 transition-all space-y-3 shadow-2xs"
                  >
                    <div>
                      {/* Top Row: Stars + Verified Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1 text-rose">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              className={s <= r.rating ? 'fill-rose text-rose' : 'text-canvas-line'}
                            />
                          ))}
                        </div>
                        {r.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            Verified Collector
                          </span>
                        )}
                      </div>

                      {/* Title & Body */}
                      {r.review_title && (
                        <h4 className="font-serif font-semibold text-bark text-base mb-1">
                          {r.review_title}
                        </h4>
                      )}
                      <p className="text-xs sm:text-sm text-ink-light leading-relaxed whitespace-pre-line italic">
                        &ldquo;{r.review_text}&rdquo;
                      </p>

                      {/* Photo if provided */}
                      {r.customer_photo && (
                        <div className="mt-3">
                          <img
                            src={r.customer_photo}
                            alt="Customer bloom photo"
                            className="w-20 h-20 object-cover rounded-xl border border-canvas-line shadow-2xs"
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer: Author & Date */}
                    <div className="pt-3 border-t border-canvas-line/50 flex items-center justify-between text-xs text-ink-light">
                      <span className="font-medium text-bark">{r.customer_name}</span>
                      <span className="font-mono text-[11px]">
                        {new Date(r.created_at).toLocaleDateString('en-IN', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* WRITE REVIEW MODAL                                                        */}
        {/* ========================================================================= */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/70 backdrop-blur-xs">
            <div className="bg-linen w-full max-w-lg rounded-sm border border-canvas-line shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-canvas-line mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-rose font-semibold">Verified Review</p>
                  <h3 className="heading-serif text-2xl text-bark">{productName}</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-ink-light hover:text-bark text-base font-bold p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-5 text-xs">
                {/* Rating Selector */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-bark mb-2">
                    Your Overall Rating *
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(s)}
                        className="p-1 text-rose transition-transform hover:scale-110"
                      >
                        <Star
                          size={28}
                          className={s <= (hoverRating || rating) ? 'fill-rose text-rose' : 'text-canvas-line'}
                        />
                      </button>
                    ))}
                    <span className="text-xs text-ink-light font-medium ml-2">
                      {rating === 5 ? 'Exceptional (5/5)' : `${rating}/5 Stars`}
                    </span>
                  </div>
                </div>

                {/* Review Headline */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-bark mb-1">
                    Review Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="e.g. Stunning craftsmanship, heirloom quality!"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>

                {/* Review Body */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-bark mb-1">
                    Your Review &amp; Experience *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Describe how the flowers look in your space, the texture of the yarn, packaging, and overall feeling..."
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark resize-none"
                  />
                </div>

                {/* Photo URL / Upload */}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-bark mb-1 flex items-center gap-1.5">
                    <Camera size={13} className="text-rose" />
                    Customer Bloom Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={customerPhoto}
                    onChange={(e) => setCustomerPhoto(e.target.value)}
                    placeholder="https://images.unsplash.com/... or hosted image link"
                    className="w-full px-3.5 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-bark focus:outline-none focus:border-bark"
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-rose/10 border border-rose/25 rounded-sm text-xs text-rose flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-canvas-line">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-canvas-line text-xs uppercase tracking-wider font-medium text-ink hover:bg-canvas/30 rounded-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-semibold rounded-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {isSubmitting ? 'Publishing Review...' : 'Publish Verified Review'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
