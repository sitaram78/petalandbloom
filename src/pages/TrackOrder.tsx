import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Package, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import Reveal from '@/components/Reveal';
import OrderStatus from '@/components/OrderStatus';
import AtelierButton from '@/components/AtelierButton';
import SEO from '@/components/SEO';
import { formatPrice } from '@/data/products';

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('order_id') || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setError('Please enter your order number.');
      return;
    }
    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);
      } else {
        setError(data.message || 'No matching order found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to tracking service.');
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen bg-linen pt-24 pb-20">
      <SEO
        title="Track Your Bloom Order — The Petal & Bloom"
        description="Follow the journey of your handcrafted crochet arrangement from studio to doorstep."
        canonicalPath="/track"
      />

      <div className="container-lux max-w-3xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-[0.3em] text-rose font-semibold mb-2">Studio Dispatch</p>
            <h1 className="heading-serif text-4xl sm:text-5xl text-bark mb-3">Track Your Order</h1>
            <p className="text-sm text-ink-light max-w-md mx-auto">
              Follow your bloom’s journey as our artisans craft and prepare your bespoke arrangement.
            </p>
          </div>
        </Reveal>

        {/* Tracking Form */}
        <Reveal delay={100}>
          <form onSubmit={handleTrack} className="glass-panel p-6 sm:p-8 rounded-atelier-panel shadow-soft space-y-4 mb-8">
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
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-ink font-semibold mb-2">
                  Phone Number
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

        {/* Results */}
        {order && (
          <Reveal delay={150}>
            <div className="space-y-6">
              <OrderStatus
                status={mappedStatus}
                orderCode={order.orderNumber}
                estimatedDelivery={order.shipment?.estimated_delivery_date || '3–6 business days'}
              />

              <div className="glass-panel p-6 rounded-atelier-panel shadow-soft space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-canvas-line">
                  <span className="font-serif text-lg text-bark">Order Summary</span>
                  <span className="text-sm font-medium text-rose">{formatPrice(order.totalInRupees)}</span>
                </div>
                <div className="divide-y divide-canvas-line/40">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="py-3 flex justify-between text-sm">
                      <span className="text-bark">{item.quantity}× {item.product_name}</span>
                      <span className="text-ink-light">{formatPrice((item.unit_price_in_paise * item.quantity) / 100)}</span>
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
