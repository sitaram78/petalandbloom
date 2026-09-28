import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Copy,
  Printer,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  MapPin,
  Phone,
  Mail,
  FileText,
  MessageCircle,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import Reveal from '@/components/Reveal';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice } from '@/data/products';
import { useNotification } from '@/context/NotificationContext';
import {
  CarrierType,
  SUPPORTED_CARRIERS,
  generateTrackingUrl,
} from '@/services/shippingService';
import InvoiceModal from '@/components/admin/InvoiceModal';
import PackingSlipModal from '@/components/admin/PackingSlipModal';
import CourierBookingModal from '@/components/admin/CourierBookingModal';

interface AdminOrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price_in_paise: number;
  total_price_in_paise: number;
  custom_options?: {
    color?: string;
    giftWrap?: boolean;
    message?: string;
  };
}

interface AdminOrder {
  id: string;
  order_number: string;
  customer_id?: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  shipping_address_snapshot: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal_in_paise: number;
  discount_in_paise: number;
  shipping_fee_in_paise: number;
  loyalty_points_redeemed: number;
  loyalty_discount_in_paise: number;
  total_in_paise: number;
  order_status: string;
  payment_status: string;
  applied_coupon_code?: string;
  customer_note?: string;
  created_at: string;
  order_items: AdminOrderItem[];
  shipments?: Array<{
    id: string;
    carrier: CarrierType;
    awb_number?: string;
    tracking_url?: string;
    status: string;
  }>;
}

const ORDER_STATUSES = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'PAYMENT_CONFIRMED', label: 'Confirmed (Paid)' },
  { id: 'PROCESSING', label: 'In Crafting' },
  { id: 'PACKED', label: 'Packed' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'PENDING_PAYMENT', label: 'Pending Payment' },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPackingSlipModal, setShowPackingSlipModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);

  // Status transition form state
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [carrier, setCarrier] = useState<CarrierType>('DELHIVERY');
  const [awbNumber, setAwbNumber] = useState('');
  const [customTrackingUrl, setCustomTrackingUrl] = useState('');

  const { showNotification } = useNotification();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          shipments (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as AdminOrder[]) || []);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      showNotification('Failed to fetch studio orders: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openOrderDetails = (order: AdminOrder) => {
    setSelectedOrder(order);
    setNewStatus(order.order_status);
    setStatusNote('');
    const existingShipment = order.shipments?.[0];
    if (existingShipment) {
      setCarrier(existingShipment.carrier || 'DELHIVERY');
      setAwbNumber(existingShipment.awb_number || '');
      setCustomTrackingUrl(existingShipment.tracking_url || '');
    } else {
      setCarrier('DELHIVERY');
      setAwbNumber('');
      setCustomTrackingUrl('');
    }
  };

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      // 1. Update order status
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          order_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (orderErr) throw orderErr;

      // 2. Audit history
      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        previous_status: selectedOrder.order_status,
        new_status: newStatus,
        note: statusNote.trim() || `Status updated to ${newStatus} by atelier admin`,
        created_by: 'admin',
      });

      // 3. Handle shipment details if marking SHIPPED or modifying carrier
      if (newStatus === 'SHIPPED' || awbNumber.trim()) {
        const finalTrackingUrl = customTrackingUrl.trim() || generateTrackingUrl(carrier, awbNumber.trim());

        const { data: existingShip } = await supabase
          .from('shipments')
          .select('id')
          .eq('order_id', selectedOrder.id)
          .maybeSingle();

        if (existingShip) {
          await supabase
            .from('shipments')
            .update({
              carrier,
              awb_number: awbNumber.trim() || null,
              tracking_url: finalTrackingUrl || null,
              status: newStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingShip.id);
        } else {
          await supabase.from('shipments').insert({
            order_id: selectedOrder.id,
            carrier,
            awb_number: awbNumber.trim() || null,
            tracking_url: finalTrackingUrl || null,
            status: newStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT',
          });
        }

        // Trigger Automated Email Dispatch Notification & generate WhatsApp Concierge link
        try {
          const notifyRes = await fetch('/api/orders/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: selectedOrder.id,
              awbNumber: awbNumber.trim(),
              carrier,
              trackingUrl: finalTrackingUrl,
              estimatedDelivery: '3–5 business days',
            }),
          });
          const notifyData = await notifyRes.json();
          if (notifyData.success && notifyData.whatsappLink && newStatus === 'SHIPPED') {
            // Open WhatsApp concierge tab for instant message
            window.open(notifyData.whatsappLink, '_blank');
          }
        } catch (notifErr) {
          console.warn('[Dispatch Notification Trigger Error]:', notifErr);
        }
      }

      showNotification(`Order ${selectedOrder.order_number} updated to ${newStatus}!`, 'success');
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err: any) {
      console.error('Update order error:', err);
      showNotification('Failed to update order: ' + err.message, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const copyAddressToClipboard = (order: AdminOrder) => {
    const addr = order.shipping_address_snapshot;
    const text = `${addr.recipientName}\nPhone: ${addr.phone}\n${addr.addressLine1}${
      addr.addressLine2 ? ', ' + addr.addressLine2 : ''
    }\n${addr.city}, ${addr.state} - ${addr.pincode}`;
    navigator.clipboard.writeText(text);
    showNotification('Shipping address copied to clipboard!', 'success');
  };

  const openWhatsAppForOrder = (order: AdminOrder) => {
    const cleanPhone = (order.guest_phone || '').replace(/\D/g, '').slice(-10);
    const trackingLink = `https://thepetalandbloom.vercel.app/track?order_id=${order.order_number}`;
    const text = `🌸 *The Petal & Bloom Studio Update*\n\nHello ${order.guest_name},\nRegarding your bespoke floral order *#${order.order_number}* (Current Status: ${order.order_status.replace(/_/g, ' ')}).\nTrack Live: ${trackingLink}\n\nPlease let us know if you have any questions or customization notes! ✨`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleConfirmCourierBooking = async (
    bookingCarrier: CarrierType,
    bookingAwb: string,
    bookingNote: string
  ) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    try {
      const finalTrackingUrl = generateTrackingUrl(bookingCarrier, bookingAwb);
      const existingShip = selectedOrder.shipments?.[0];

      if (existingShip) {
        await supabase
          .from('shipments')
          .update({
            carrier: bookingCarrier,
            awb_number: bookingAwb,
            tracking_url: finalTrackingUrl || null,
            status: 'IN_TRANSIT',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingShip.id);
      } else {
        await supabase.from('shipments').insert({
          order_id: selectedOrder.id,
          carrier: bookingCarrier,
          awb_number: bookingAwb,
          tracking_url: finalTrackingUrl || null,
          status: 'IN_TRANSIT',
        });
      }

      await supabase
        .from('orders')
        .update({ order_status: 'SHIPPED' })
        .eq('id', selectedOrder.id);

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        previous_status: selectedOrder.order_status,
        new_status: 'SHIPPED',
        note: `Courier booked via ${bookingCarrier} (AWB: ${bookingAwb}). ${bookingNote}`,
        created_by: 'admin',
      });

      // Trigger Dispatch Email & Concierge WhatsApp Link
      try {
        const notifyRes = await fetch('/api/orders/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            awbNumber: bookingAwb,
            carrier: bookingCarrier,
            trackingUrl: finalTrackingUrl,
            estimatedDelivery: '3–5 business days',
          }),
        });
        const notifyData = await notifyRes.json();
        if (notifyData.success && notifyData.whatsappLink) {
          window.open(notifyData.whatsappLink, '_blank');
        }
      } catch (e) {
        console.warn('Dispatch notification trigger error:', e);
      }

      showNotification(`Order ${selectedOrder.order_number} booked and marked as Shipped!`, 'success');
      setSelectedOrder(null);
      await fetchOrders();
    } catch (err: any) {
      showNotification('Failed to save courier booking: ' + err.message, 'error');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesFilter =
      activeFilter === 'ALL' ? true : order.order_status === activeFilter;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      order.order_number.toLowerCase().includes(q) ||
      order.guest_name.toLowerCase().includes(q) ||
      order.guest_phone.includes(q) ||
      (order.applied_coupon_code && order.applied_coupon_code.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAYMENT_CONFIRMED':
      case 'ORDER_CONFIRMED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Confirmed (Paid)</span>;
      case 'PROCESSING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">In Crafting</span>;
      case 'PACKED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">Packed</span>;
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">Shipped</span>;
      case 'DELIVERED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-200 text-emerald-900">Delivered</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Cancelled</span>;
      case 'PENDING_PAYMENT':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Pending Payment</span>;
    }
  };

  return (
    <AdminLayout activePage="orders">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Atelier Logistics
            </p>
            <h1 className="heading-serif text-4xl text-ink">Order Fulfillment</h1>
            <p className="text-xs text-ink-light font-light mt-1">
              Manage client orders, studio crafting progress, and courier dispatches.
            </p>
          </div>

          <button
            onClick={fetchOrders}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-2 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Orders
          </button>
        </header>

        {/* Filter Tabs & Search Bar */}
        <div className="bg-linen p-4 rounded-sm border border-canvas-line shadow-soft mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, customer, phone..."
                className="w-full pl-9 pr-4 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
            </div>

            {/* Total Results Count */}
            <span className="text-xs text-ink-light">
              Showing <strong>{filteredOrders.length}</strong> of {orders.length} orders
            </span>
          </div>

          {/* Status Filter Chips */}
          <div className="flex overflow-x-auto gap-2 pt-2 border-t border-canvas-line scrollbar-none">
            {ORDER_STATUSES.map((status) => (
              <button
                key={status.id}
                onClick={() => setActiveFilter(status.id)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === status.id
                    ? 'bg-bark text-linen shadow-xs'
                    : 'bg-canvas/50 text-ink-light hover:text-bark hover:bg-canvas'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="bg-linen p-16 text-center rounded-sm border border-canvas-line">
            <Loader2 size={28} className="animate-spin text-rose mx-auto mb-2" />
            <p className="text-xs text-ink-light">Loading orders from database...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-linen p-16 text-center rounded-sm border border-canvas-line">
            <Package size={36} className="text-ink-light mx-auto mb-3" />
            <h3 className="heading-serif text-xl text-bark mb-1">No Orders Found</h3>
            <p className="text-xs text-ink-light">
              No orders matched the selected filter or search criteria.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const shipment = order.shipments?.[0];
              return (
                <div
                  key={order.id}
                  className="bg-linen rounded-sm border border-canvas-line shadow-soft p-5 sm:p-6 transition-all hover:border-canvas-line-hover"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-canvas-line">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-serif font-bold text-lg text-bark">
                          {order.order_number}
                        </span>
                        {getStatusBadge(order.order_status)}
                        {order.applied_coupon_code && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-800">
                            🏷 {order.applied_coupon_code}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-light flex items-center gap-3">
                        <span>
                          {new Date(order.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        <span>•</span>
                        <strong>{order.guest_name}</strong> (+91 {order.guest_phone})
                      </p>
                    </div>

                    <div className="flex items-center gap-4 self-end lg:self-auto">
                      <div className="text-right">
                        <p className="font-serif text-xl font-bold text-bark">
                          {formatPrice(order.total_in_paise / 100)}
                        </p>
                        <p className="text-[11px] text-ink-light">
                          {order.order_items.length} item{order.order_items.length === 1 ? '' : 's'}
                        </p>
                      </div>

                      <button
                        onClick={() => openOrderDetails(order)}
                        className="px-4 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm transition-all flex items-center gap-1.5"
                      >
                        Manage & Dispatch
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Items snapshot and shipping summary */}
                  <div className="mt-4 flex flex-col md:flex-row justify-between gap-4 text-xs">
                    <div className="space-y-1.5 flex-1">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-ink">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose/60" />
                          <span className="font-medium">{item.product_name}</span>
                          <span className="text-ink-light">× {item.quantity}</span>
                          {item.custom_options?.color && (
                            <span className="text-[10px] bg-canvas px-1.5 py-0.5 rounded text-ink-light">
                              {item.custom_options.color}
                            </span>
                          )}
                          {item.custom_options?.giftWrap && (
                            <span className="text-[10px] text-rose font-medium">🎁 Gift Wrapped</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {shipment?.awb_number && (
                      <div className="bg-canvas/50 px-3 py-2 rounded-sm self-start md:self-auto flex items-center gap-3">
                        <Truck size={16} className="text-rose" />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-medium text-ink-light">
                            {shipment.carrier} AWB
                          </p>
                          <p className="font-mono font-medium text-bark">{shipment.awb_number}</p>
                        </div>
                        {shipment.tracking_url && (
                          <a
                            href={shipment.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-rose hover:underline"
                            title="Open Tracking"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* ORDER DETAILS & DISPATCH MODAL                                           */}
        {/* ========================================================================= */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/50 backdrop-blur-xs overflow-y-auto">
            <div className="bg-linen w-full max-w-3xl rounded-sm border border-canvas-line shadow-2xl p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-canvas-line mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="heading-serif text-2xl text-bark">
                      Order {selectedOrder.order_number}
                    </h3>
                    {getStatusBadge(selectedOrder.order_status)}
                  </div>
                  <p className="text-xs text-ink-light mt-0.5">
                    Placed on{' '}
                    {new Date(selectedOrder.created_at).toLocaleString('en-IN', {
                      dateStyle: 'full',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-ink-light hover:text-bark text-base font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* MTO Cancellation Protection Notice */}
              {['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(selectedOrder.order_status) && (
                <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200 rounded-sm flex items-center gap-2 text-xs text-amber-900">
                  <AlertCircle size={15} className="text-amber-800 shrink-0" />
                  <span>
                    <strong>Made-To-Order Policy Active:</strong> Crafting has commenced in the atelier. This bespoke creation is protected from accidental or customer-initiated cancellation.
                  </span>
                </div>
              )}

              {/* Quick Actions Toolbar */}
              <div className="mb-6 flex flex-wrap items-center gap-2.5 p-3 bg-canvas/30 rounded-sm border border-canvas-line">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  className="px-3.5 py-1.5 bg-white border border-canvas-line hover:border-bark text-bark rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Printer size={13} className="text-rose" />
                  Print Tax Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setShowPackingSlipModal(true)}
                  className="px-3.5 py-1.5 bg-white border border-canvas-line hover:border-bark text-bark rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <FileText size={13} className="text-rose" />
                  Print 4×6 Slip
                </button>
                <button
                  type="button"
                  onClick={() => setShowCourierModal(true)}
                  className="px-3.5 py-1.5 bg-bark text-linen hover:bg-rose-deep rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Truck size={13} />
                  Courier Dispatch Prep
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsAppForOrder(selectedOrder)}
                  className="px-3.5 py-1.5 bg-[#25D366] text-white hover:opacity-90 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors ml-auto shadow-sm"
                >
                  <MessageCircle size={13} />
                  WhatsApp Customer
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Customer & Shipping Address */}
                <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-1.5">
                      <MapPin size={14} className="text-rose" />
                      Delivery Destination
                    </h4>
                    <button
                      onClick={() => copyAddressToClipboard(selectedOrder)}
                      className="text-[11px] text-rose hover:underline flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copy Label
                    </button>
                  </div>

                  <div className="text-xs text-ink space-y-1">
                    <p className="font-semibold text-bark">
                      {selectedOrder.shipping_address_snapshot.recipientName}
                    </p>
                    <p className="flex items-center gap-1.5 text-ink-light">
                      <Phone size={12} />
                      +91 {selectedOrder.shipping_address_snapshot.phone}
                    </p>
                    {selectedOrder.guest_email && (
                      <p className="flex items-center gap-1.5 text-ink-light">
                        <Mail size={12} />
                        {selectedOrder.guest_email}
                      </p>
                    )}
                    <p className="pt-1 leading-relaxed">
                      {selectedOrder.shipping_address_snapshot.addressLine1}
                      {selectedOrder.shipping_address_snapshot.addressLine2 && (
                        <>, {selectedOrder.shipping_address_snapshot.addressLine2}</>
                      )}
                      <br />
                      {selectedOrder.shipping_address_snapshot.city},{' '}
                      {selectedOrder.shipping_address_snapshot.state} —{' '}
                      <strong className="font-mono font-bold">
                        {selectedOrder.shipping_address_snapshot.pincode}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2 text-xs">
                  <h4 className="text-xs uppercase tracking-wider font-bold text-bark mb-3 flex items-center gap-1.5">
                    <FileText size={14} className="text-rose" />
                    Financial Breakdown
                  </h4>
                  <div className="flex justify-between text-ink-light">
                    <span>Subtotal</span>
                    <span>{formatPrice(selectedOrder.subtotal_in_paise / 100)}</span>
                  </div>
                  {selectedOrder.discount_in_paise > 0 && (
                    <div className="flex justify-between text-rose">
                      <span>Coupon Discount ({selectedOrder.applied_coupon_code})</span>
                      <span>-{formatPrice(selectedOrder.discount_in_paise / 100)}</span>
                    </div>
                  )}
                  {selectedOrder.loyalty_discount_in_paise > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Loyalty Points ({selectedOrder.loyalty_points_redeemed} pts)</span>
                      <span>-{formatPrice(selectedOrder.loyalty_discount_in_paise / 100)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-ink-light">
                    <span>Shipping Fee</span>
                    <span>{formatPrice(selectedOrder.shipping_fee_in_paise / 100)}</span>
                  </div>
                  <div className="pt-2 border-t border-canvas-line flex justify-between font-serif font-bold text-base text-bark">
                    <span>Total Paid</span>
                    <span className="text-rose">{formatPrice(selectedOrder.total_in_paise / 100)}</span>
                  </div>
                  <p className="text-[10px] text-ink-light pt-1">
                    Payment Gateway Status:{' '}
                    <strong className="text-emerald-700 font-semibold">
                      {selectedOrder.payment_status}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div className="mb-8">
                <h4 className="text-xs uppercase tracking-wider font-bold text-bark mb-3">
                  Ordered Botanical Arrangements
                </h4>
                <div className="border border-canvas-line rounded-sm divide-y divide-canvas-line">
                  {selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-bark text-sm">{item.product_name}</p>
                        <p className="text-ink-light text-[11px] font-mono mt-0.5">
                          Code: {item.product_code} • Qty: {item.quantity}
                        </p>
                        {item.custom_options?.message && (
                          <p className="text-[11px] italic text-rose mt-1 bg-rose/5 p-1.5 rounded">
                            Gift Note: &ldquo;{item.custom_options.message}&rdquo;
                          </p>
                        )}
                      </div>
                      <span className="font-mono font-medium text-bark">
                        {formatPrice((item.unit_price_in_paise * item.quantity) / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleUpdateOrderStatus} className="bg-linen p-5 rounded-sm border border-canvas-line space-y-4">
                <h4 className="heading-serif text-lg text-bark">Update Order & Dispatch</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                      Order Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    >
                      <option value="PAYMENT_CONFIRMED">Confirmed (Paid)</option>
                      <option value="PROCESSING">PROCESSING (In Crafting)</option>
                      <option value="PACKED">PACKED (Ready to Ship)</option>
                      <option value="SHIPPED">SHIPPED (Handed to Carrier)</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                      Carrier Partner
                    </label>
                    <select
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value as CarrierType)}
                      className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    >
                      {SUPPORTED_CARRIERS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                      AWB / Tracking Number
                    </label>
                    <input
                      type="text"
                      value={awbNumber}
                      onChange={(e) => setAwbNumber(e.target.value)}
                      placeholder="e.g. 142385920194"
                      className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                      Status Change Note (Internal or Customer)
                    </label>
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="e.g. Bouquet packed in atelier archival box"
                      className="w-full px-3 py-2 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-canvas-line">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 border border-canvas-line text-xs uppercase tracking-wider font-medium text-ink hover:bg-canvas/30 rounded-sm"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      'Save & Notify'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tax Invoice Modal */}
        {showInvoiceModal && selectedOrder && (
          <InvoiceModal
            order={selectedOrder as any}
            onClose={() => setShowInvoiceModal(false)}
          />
        )}

        {/* 4x6 Thermal Packing Slip Modal */}
        {showPackingSlipModal && selectedOrder && (
          <PackingSlipModal
            order={selectedOrder as any}
            carrierName={selectedOrder.shipments?.[0]?.carrier || carrier}
            awbNumber={selectedOrder.shipments?.[0]?.awb_number || awbNumber}
            onClose={() => setShowPackingSlipModal(false)}
          />
        )}

        {/* Courier Booking & Dispatch Prep Modal */}
        {showCourierModal && selectedOrder && (
          <CourierBookingModal
            order={selectedOrder as any}
            onClose={() => setShowCourierModal(false)}
            onConfirmBooking={handleConfirmCourierBooking}
          />
        )}
      </main>
    </AdminLayout>
  );
}
