import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, MapPin, Loader2, ArrowLeft, RotateCw } from 'lucide-react';
import Reveal from '@/components/Reveal';
import OrderStatus from '@/components/OrderStatus';
import LiveCourierJourney from '@/components/LiveCourierJourney';
import AtelierButton from '@/components/AtelierButton';
import SEO from '@/components/SEO';
import { formatPrice } from '@/data/products';

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const initialOrderCode =
    searchParams.get('order_id') ||
    searchParams.get('order_number') ||
    searchParams.get('order') ||
    '';

  const [orderNumber, setOrderNumber] = useState(initialOrderCode);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSearchForm, setShowSearchForm] = useState(!initialOrderCode);

  const fetchTracking = useCallback(
    async (codeToTrack: string, phoneToTrack: string, isForceRefresh = false) => {
      const cleanCode = codeToTrack.trim().toUpperCase();
      if (!cleanCode) {
        setError('Please enter your order number.');
        return;
      }

      if (isForceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await fetch('/api/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: cleanCode,
            phone: phoneToTrack.trim(),
            forceRefresh: isForceRefresh,
          }),
        });

        const data = await res.json();
        if (data.success && data.order) {
          setOrder(data.order);
          // Hide search form when order tracking is loaded
          setShowSearchForm(false);
        } else {
          setError(data.message || 'No matching order found. Please check your reference.');
          setShowSearchForm(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to connect to tracking service.');
        setShowSearchForm(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Auto-search if order reference is provided in URL
  useEffect(() => {
    if (initialOrderCode && !order && !loading) {
      fetchTracking(initialOrderCode, phone, false);
    }
  }, [initialOrderCode, fetchTracking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(orderNumber, phone, false);
  };

  const handleRefreshTracking = () => {
    if (!orderNumber.trim()) return;
    fetchTracking(orderNumber, phone, true);
  };

  const mappedStatus = (() => {
    if (!order) return 'received';
    switch (order.orderStatus) {
      case 'PENDING_PAYMENT':
      case 'PAYMENT_CONFIRMED':
      case 'ORDER_CONFIRMED':
        return 'received';
      case 'PROCESSING':
        return 'handcrafting';
      case 'PACKED':
        return 'packed';
      case 'SHIPPED':
        return 'shipped';
      case 'OUT_FOR_DELIVERY':
        return 'out_for_delivery';
      case 'DELIVERED':
        return 'delivered';
      default:
        return 'received';
    }
  })();

  const hasLiveCourierTracking = Boolean(
    order?.shipment?.awb_number ||
    order?.shipment?.liveTracking ||
    order?.liveTracking
  );

  return (
    <div className="min-h-screen bg-linen pt-24 pb-20">
      <SEO
        title="Track Your Bloom Order — The Petal & Bloom"
        description="Follow the journey of your handcrafted crochet arrangement from studio to doorstep with live courier tracking."
        canonicalPath="/track"
      />

      <div className="container-lux max-w-3xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-rose font-semibold mb-2">Studio Dispatch</p>
            <h1 className="heading-serif text-4xl sm:text-5xl text-bark mb-3">Track Your Order</h1>
            <p className="text-sm text-ink-light max-w-md mx-auto">
              Follow your bloom’s journey as our artisans craft, pack, and hand over your arrangement to our courier network.
            </p>
          </div>
        </Reveal>

        {/* Top Control Bar when order is loaded */}
        {order && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3.5 bg-canvas/40 border border-canvas-line rounded-atelier-panel shadow-2xs">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-ink-light">Viewing Order:</span>
              <span className="font-mono font-bold text-bark tracking-wide">{order.orderNumber}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSearchForm((prev) => !prev)}
              className="text-xs text-rose hover:text-rose-deep font-medium flex items-center gap-1.5 transition-colors"
            >
              <Search size={13} />
              <span>{showSearchForm ? 'Hide Search Form' : 'Track Another Order'}</span>
            </button>
          </div>
        )}

        {/* Tracking Form (Shown when no order is loaded, or when user clicks 'Track Another Order') */}
        {(showSearchForm || !order) && (
          <Reveal delay={100}>
            <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 rounded-atelier-panel shadow-soft space-y-4 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-2">
                    Order Number
                  </label>
                  <input
                    required
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. TPB-LX72-4912"
                    className="input-field uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-2">
                    Phone Number <span className="text-[10px] text-ink-light font-normal">(Optional for verification)</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="input-field"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-rose mt-2">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-4 text-sm font-medium flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Locating Order...
                  </>
                ) : (
                  <>
                    <Search size={16} /> Track Status
                  </>
                )}
              </button>
            </form>
          </Reveal>
        )}

        {/* Results */}
        {order && (
          <Reveal delay={150}>
            <div className="space-y-6">
              {/* Atelier Progress Stepper: ONLY shown if live courier tracking is NOT yet active */}
              {!hasLiveCourierTracking && (
                <OrderStatus
                  status={mappedStatus}
                  orderCode={order.orderNumber}
                  estimatedDelivery={order.shipment?.estimated_delivery_date || '3–6 business days'}
                />
              )}

              {/* Live Courier Journey Timeline (Delhivery Express Cargo) */}
              {hasLiveCourierTracking && (
                <LiveCourierJourney
                  liveTracking={order.shipment?.liveTracking || order.liveTracking}
                  shipment={order.shipment}
                  orderNumber={order.orderNumber}
                  onRefresh={handleRefreshTracking}
                  isRefreshing={refreshing}
                  variant="card"
                />
              )}

              {/* Order Summary */}
              <div className="glass-panel p-6 rounded-atelier-panel shadow-soft space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-canvas-line">
                  <span className="font-serif text-lg text-bark">Order Summary</span>
                  <span className="text-sm font-medium text-rose">{formatPrice(order.totalInRupees)}</span>
                </div>
                <div className="divide-y divide-canvas-line/40">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="py-3 flex justify-between text-sm">
                      <span className="text-bark">
                        {item.quantity}× {item.product_name}
                        {item.selected_color ? ` (${item.selected_color})` : ''}
                      </span>
                      <span className="text-ink-light">
                        {formatPrice((item.unit_price_in_paise * item.quantity) / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
