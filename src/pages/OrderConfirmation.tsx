import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, Truck, MapPin, Loader2, MessageCircle, Clock, QrCode, Sparkles } from 'lucide-react';
import Reveal from '@/components/Reveal';
import OrderStatus from '@/components/OrderStatus';
import AtelierButton from '@/components/AtelierButton';
import WhatsAppButton from '@/components/WhatsAppButton';
import SEO from '@/components/SEO';
import { formatPrice } from '@/data/products';
import { buildWhatsAppLink } from '@/utils/whatsapp';

export default function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId') || '';
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided.');
      setLoading(false);
      return;
    }

    async function loadOrder() {
      try {
        // 1. Actively check & sync payment status from Cashfree PG
        try {
          await fetch(`/api/payments/verify?orderId=${encodeURIComponent(orderId)}`);
        } catch (verifyErr) {
          console.warn('Active payment verification warning:', verifyErr);
        }

        // 2. Load latest order tracking details
        const res = await fetch('/api/orders/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNumber: orderId }),
        });

        const data = await res.json();
        if (data.success && data.order) {
          setOrder(data.order);
        } else {
          setError(data.message || 'Order details could not be found.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error while fetching order details.');
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center pt-24 pb-16">
        <div className="text-center space-y-4">
          <Loader2 size={36} className="animate-spin text-rose mx-auto" />
          <p className="font-serif text-xl text-bark">Preparing your studio confirmation...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-linen flex items-center justify-center pt-24 pb-16 px-6">
        <div className="max-w-md w-full glass-panel p-8 rounded-atelier-panel text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-rose/10 text-rose flex items-center justify-center mx-auto">
            <Package size={28} />
          </div>
          <h1 className="heading-serif text-3xl text-bark">Order Reference</h1>
          <p className="text-sm text-ink-light">{error || 'Unable to locate order summary.'}</p>
          <div className="flex flex-col gap-3">
            <Link to="/shop" className="btn-primary w-full">Return to Studio</Link>
            <WhatsAppButton message={`Hi, I'm checking on order reference: ${orderId}`} label="Help via WhatsApp" variant="outline" className="w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Map database order status to OrderStatus component status
  const mappedStatus = (() => {
    switch (order.orderStatus) {
      case 'PENDING_PAYMENT':
        return 'received';
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

  const addr = order.shippingAddress || {};

  return (
    <div className="min-h-screen bg-linen pt-24 pb-20">
      <SEO
        title={`Order Confirmed — ${order.orderNumber}`}
        description="Your handmade blooms order has been confirmed."
      />

      <div className="container-lux max-w-4xl mx-auto px-6">
        <Reveal>
          {/* Header Banner */}
          <div className="text-center mb-12">
            {order.paymentStatus === 'SUCCESS' || order.orderStatus === 'PAYMENT_CONFIRMED' ? (
              <>
                <div className="w-20 h-20 rounded-full bg-moss/20 text-moss flex items-center justify-center mx-auto mb-6 shadow-soft">
                  <CheckCircle2 size={36} strokeWidth={2} />
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-moss font-semibold mb-2">Order Confirmed</p>
                <h1 className="heading-serif text-4xl sm:text-5xl text-bark mb-4">A bloom is being crafted for you.</h1>
                <p className="text-sm sm:text-base text-ink-light max-w-lg mx-auto">
                  Thank you for trusting The Petal &amp; Bloom. We have received your payment and our artisans will begin handcrafting each stitch.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-6 shadow-soft ring-4 ring-amber-50">
                  <Clock size={36} strokeWidth={2} />
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-800 font-semibold mb-2">Order Placed · Awaiting UPI Payment</p>
                <h1 className="heading-serif text-4xl sm:text-5xl text-bark mb-4">Your bloom order is reserved.</h1>
                <p className="text-sm sm:text-base text-ink-light max-w-lg mx-auto">
                  Thank you for ordering with The Petal &amp; Bloom Atelier! Please settle payment via UPI so our artisans can begin crafting your arrangement.
                </p>
              </>
            )}
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Order Summary & Tracking (7/12) */}
          <div className="lg:col-span-7 space-y-8">
            <Reveal>
              <div className="glass-panel p-6 sm:p-8 rounded-atelier-panel shadow-soft space-y-6">
                <div className="flex items-center justify-between pb-6 border-b border-canvas-line">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-light/60 font-semibold">Order Reference</p>
                    <p className="font-serif text-2xl text-bark">{order.orderNumber}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                    order.paymentStatus === 'SUCCESS' || order.orderStatus === 'PAYMENT_CONFIRMED'
                      ? 'bg-moss/10 text-moss border border-moss/20'
                      : 'bg-amber-50 text-amber-800 border border-amber-300/70'
                  }`}>
                    {order.paymentStatus === 'SUCCESS' || order.orderStatus === 'PAYMENT_CONFIRMED' ? (
                      <>
                        <CheckCircle2 size={12} /> Prepaid Verified
                      </>
                    ) : (
                      <>
                        <Clock size={12} className="text-amber-600" /> Awaiting UPI Payment
                      </>
                    )}
                  </span>
                </div>

                {/* Items List */}
                <div className="divide-y divide-canvas-line/50">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="py-4 flex gap-4 items-center">
                      <div className="w-16 h-20 rounded-sm bg-canvas flex-shrink-0 overflow-hidden">
                        {item.item_image ? (
                          <img src={item.item_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-ink-light/40">No photo</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif text-lg text-bark truncate">{item.product_name}</h4>
                        <p className="text-xs text-ink-light mt-0.5">
                          Qty: <span className="font-medium text-bark">{item.quantity}</span>
                          {item.selected_color && ` · Colour: ${item.selected_color}`}
                        </p>
                        {item.gift_wrap && (
                          <span className="text-[10px] text-moss uppercase tracking-wider font-semibold block mt-1">
                            Gift Wrapped Included
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-bark whitespace-nowrap">
                        {formatPrice((item.unit_price_in_paise * item.quantity) / 100)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Cost Breakdown */}
                <div className="pt-6 border-t border-canvas-line space-y-2 text-sm text-ink-light">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-bark">{formatPrice(order.subtotalInRupees)}</span>
                  </div>
                  {order.discountInRupees > 0 && (
                    <div className="flex justify-between text-moss">
                      <span>Discount</span>
                      <span>-{formatPrice(order.discountInRupees)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className={order.shippingFeeInRupees === 0 ? 'text-moss font-medium' : 'text-bark'}>
                      {order.shippingFeeInRupees === 0 ? 'Complimentary' : formatPrice(order.shippingFeeInRupees)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-canvas-line font-serif text-2xl text-bark">
                    <span>
                      {order.paymentStatus === 'SUCCESS' || order.orderStatus === 'PAYMENT_CONFIRMED'
                        ? 'Total Paid'
                        : 'Total Due (via UPI)'}
                    </span>
                    <span className="text-rose">{formatPrice(order.totalInRupees)}</span>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Tracking Steps Card */}
            <Reveal delay={100}>
              <OrderStatus
                status={mappedStatus}
                orderCode={order.orderNumber}
                estimatedDelivery={order.shipment?.estimated_delivery_date || '3–6 business days'}
              />
            </Reveal>
          </div>

          {/* Right Column: Delivery Details & Studio Actions (5/12) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Dedicated UPI Payment Settlement Card */}
            {order.paymentStatus !== 'SUCCESS' && order.orderStatus !== 'PAYMENT_CONFIRMED' && (
              <Reveal delay={100}>
                <div className="glass-panel p-6 sm:p-8 rounded-atelier-panel shadow-soft border-2 border-amber-500/30 bg-amber-50/30 space-y-4">
                  <div className="flex items-center gap-3 text-bark">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl text-bark">UPI Payment Settlement</h3>
                      <p className="text-xs text-ink-light">
                        Amount to Pay: <strong className="text-rose text-base font-semibold">{formatPrice(order.totalInRupees)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-ink-light bg-linen/90 p-4 rounded-sm border border-canvas-line">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-bark text-linen text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">1</span>
                      <p><strong className="text-bark">Send Order Slip:</strong> Click the button below to message our studio concierge with your order reference.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-bark text-linen text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">2</span>
                      <p><strong className="text-bark">Pay via Any UPI App:</strong> Scan our QR code or pay using GPay, PhonePe, Paytm, or BHIM.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-bark text-linen text-[10px] flex items-center justify-center shrink-0 mt-0.5 font-bold">3</span>
                      <p><strong className="text-bark">Start Crafting:</strong> Reply with your payment screenshot to confirm crafting immediately!</p>
                    </div>
                  </div>

                  <a
                    href={buildWhatsAppLink(
                      `🌸 *New Order Slip — The Petal & Bloom*\n\nHello Atelier Concierge!\nI just placed order *#${order.orderNumber}* for *${formatPrice(order.totalInRupees)}*.\n\nRecipient: ${addr.recipientName || 'Valued Patron'}\nPhone: ${addr.phone || ''}\nCity: ${addr.city || ''}, ${addr.state || ''}\n\nPlease share your payment QR code or UPI ID so I can complete payment and you can begin crafting my blooms! ✨`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-whatsapp w-full py-3.5 text-sm flex items-center justify-center gap-2 shadow-soft font-medium text-linen"
                  >
                    <MessageCircle size={18} /> Send Order Slip &amp; Pay via WhatsApp
                  </a>

                  <p className="text-[11px] text-center text-ink-light/70 font-light">
                    Prefer to wait? Our team will also reach out to your phone (+91 {addr.phone}) shortly.
                  </p>
                </div>
              </Reveal>
            )}

            <Reveal delay={150}>
              <div className="glass-panel p-6 sm:p-8 rounded-atelier-panel shadow-soft space-y-6">
                <div className="flex items-center gap-3 text-bark">
                  <MapPin size={20} className="text-rose" />
                  <h3 className="font-serif text-xl">Delivery Address</h3>
                </div>
                <div className="text-sm text-ink-light leading-relaxed">
                  <p className="font-medium text-bark text-base">{addr.recipientName}</p>
                  <p>{addr.addressLine1}</p>
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  <p>{addr.city}, {addr.state} — {addr.pincode}</p>
                  <p className="mt-2 text-xs text-ink-light/70">Contact: {addr.phone}</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="glass-panel p-6 sm:p-8 rounded-atelier-panel shadow-soft space-y-4">
                <h3 className="font-serif text-xl text-bark">Need Assistance?</h3>
                <p className="text-xs text-ink-light leading-relaxed">
                  Our gift concierge is available on WhatsApp to answer questions regarding custom notes or delivery timing.
                </p>
                <WhatsAppButton
                  message={`Hi The Petal & Bloom! I have a question regarding my order ${order.orderNumber}.`}
                  label="Chat with Concierge"
                  className="w-full justify-center py-3 text-sm"
                />
                <Link to="/shop" className="btn-secondary w-full flex items-center justify-center gap-2 py-3 text-sm">
                  Continue Exploring <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
