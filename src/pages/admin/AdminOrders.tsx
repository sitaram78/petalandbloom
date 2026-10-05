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
  Download,
  Plus,
  X,
  Gift,
  Sparkles,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import Reveal from '@/components/Reveal';
import { supabase } from '@/lib/supabaseClient';
import { formatPrice } from '@/data/products';
import { useNotification } from '@/context/NotificationContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { authFetch } from '@/lib/apiClient';
import {
  CarrierType,
  SUPPORTED_CARRIERS,
  generateTrackingUrl,
} from '@/services/shippingService';
import InvoiceModal from '@/components/admin/InvoiceModal';
import PackingSlipModal from '@/components/admin/PackingSlipModal';
import CourierBookingModal from '@/components/admin/CourierBookingModal';
import CreateOrderModal from '@/components/admin/CreateOrderModal';
import LiveCourierJourney from '@/components/LiveCourierJourney';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { downloadCSV } from '@/utils/csvExporter';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
  AdminKanbanBoard,
  type KanbanColumn,
} from '@/components/admin/view-system';

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
  { id: 'PENDING_PAYMENT', label: 'Awaiting UPI' },
  { id: 'PAYMENT_CONFIRMED', label: 'Confirmed (Paid)' },
  { id: 'PROCESSING', label: 'In Crafting' },
  { id: 'PACKED', label: 'Packed' },
  { id: 'SHIPPED', label: 'Shipped' },
  { id: 'DELIVERED', label: 'Delivered' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPackingSlipModal, setShowPackingSlipModal] = useState(false);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);

  // Unified Admin View System hook
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    activeTab: activeFilter,
    setActiveTab: setActiveFilter,
    selectedEntity: selectedOrder,
    inspectEntity: setSelectedOrder,
  } = useAdminView<AdminOrder>({
    defaultMode: 'table',
    storageKey: 'orders',
    defaultTab: 'ALL',
  });

  // Status transition form state
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [carrier, setCarrier] = useState<CarrierType>('DELHIVERY');
  const [awbNumber, setAwbNumber] = useState('');
  const [customTrackingUrl, setCustomTrackingUrl] = useState('');

  // Batch Operations State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const { showNotification } = useNotification();
  const { settings } = useStoreSettings();

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
  };

  const [adminLiveTracking, setAdminLiveTracking] = useState<any>(null);
  const [adminTrackingLoading, setAdminTrackingLoading] = useState(false);

  const fetchAdminLiveTracking = async (awbToTrack: string, isForceRefresh = false) => {
    const cleanAwb = (awbToTrack || '').trim();
    if (!cleanAwb) return;
    setAdminTrackingLoading(true);
    try {
      const res = await fetch('/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awbNumber: cleanAwb,
          forceRefresh: isForceRefresh,
        }),
      });
      const data = await res.json();
      if (data.success && data.liveTracking) {
        setAdminLiveTracking(data.liveTracking);
      }
    } catch (err) {
      console.warn('[Admin Live Tracking Warning]:', err);
    } finally {
      setAdminTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrder) {
      setNewStatus(selectedOrder.order_status);
      setStatusNote('');
      const existingShipment = selectedOrder.shipments?.[0];
      if (existingShipment) {
        setCarrier(existingShipment.carrier || 'DELHIVERY');
        setAwbNumber(existingShipment.awb_number || '');
        setCustomTrackingUrl(existingShipment.tracking_url || '');
        if (existingShipment.awb_number) {
          fetchAdminLiveTracking(existingShipment.awb_number, false);
        } else {
          setAdminLiveTracking(null);
        }
      } else {
        setCarrier('DELHIVERY');
        setAwbNumber('');
        setCustomTrackingUrl('');
        setAdminLiveTracking(null);
      }
    } else {
      setAdminLiveTracking(null);
    }
  }, [selectedOrder]);

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsUpdating(true);

    try {
      if (newStatus === 'CANCELLED') {
        // Secure cancellation API with inventory restock & loyalty point reversal
        const cancelRes = await authFetch('/api/orders/cancel', {
          method: 'POST',
          body: JSON.stringify({
            orderId: selectedOrder.id,
            reason: statusNote.trim() || 'Order cancelled by atelier admin',
          }),
        });
        const cancelData = await cancelRes.json();
        if (!cancelRes.ok || !cancelData.success) {
          throw new Error(cancelData.message || 'Failed to cancel order.');
        }
      } else {
        // Authenticated order status transition with server-enforced audit trail
        const updateRes = await authFetch('/api/admin/orders/update-status', {
          method: 'POST',
          body: JSON.stringify({
            orderId: selectedOrder.id,
            newStatus,
            statusNote,
            carrier,
            awbNumber: awbNumber.trim(),
            customTrackingUrl: customTrackingUrl.trim(),
          }),
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok || !updateData.success) {
          throw new Error(updateData.message || updateData.error || 'Failed to update order status.');
        }
      }

      // If marking SHIPPED, generate WhatsApp concierge link
      if (newStatus === 'SHIPPED' || awbNumber.trim()) {
        const finalTrackingUrl = customTrackingUrl.trim() || generateTrackingUrl(carrier, awbNumber.trim());

        // Trigger Automated Email Dispatch Notification & generate WhatsApp Concierge link
        try {
          const notifyRes = await authFetch('/api/orders/notify', {
            method: 'POST',
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

  const openWhatsAppForPaymentRequest = (order: AdminOrder) => {
    const cleanPhone = (order.guest_phone || order.shipping_address_snapshot?.phone || '').replace(/\D/g, '').slice(-10);
    const amount = (order.total_in_paise / 100).toFixed(0);
    const upiId = settings.upiId || '9931657805@ptsbi';
    const upiPhone = settings.upiPhone || '9931657805';
    const text = `🌸 *The Petal & Bloom Studio — Order #${order.order_number}*\n\nHello ${order.guest_name || 'Collector'},\nThank you for placing your order with The Petal & Bloom! Your bespoke crochet floral order is saved.\n\n*Order Summary:*\n• Order Number: #${order.order_number}\n• Amount Due: ₹${amount}\n\n*Payment Details (UPI):*\n• UPI ID: ${upiId}\n• Google Pay / PhonePe / Paytm / BHIM: ${upiPhone}\n\nPlease transfer ₹${amount} and send us a screenshot of the payment confirmation here. Once confirmed, our atelier team will begin handcrafting your flowers! ✨`;
    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleQuickStatusTransition = async (order: AdminOrder, targetStatus: string) => {
    setIsUpdating(true);
    try {
      const res = await authFetch('/api/admin/orders/update-status', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          newStatus: targetStatus,
          statusNote: `Status updated to ${targetStatus} via quick action shortcut`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Status transition failed');
      }

      showNotification(`Order ${order.order_number} moved to ${targetStatus.replace(/_/g, ' ')}!`, 'success');
      await fetchOrders();
    } catch (err: any) {
      showNotification(`Failed to transition status: ${err.message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
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

      // Central Audit Log
      logAudit({
        action: AUDIT_ACTIONS.ORDER_STATUS_TRANSITION,
        entity: 'orders',
        entity_id: selectedOrder.order_number || selectedOrder.id,
        old_values: { order_status: selectedOrder.order_status },
        new_values: { order_status: 'SHIPPED', carrier: bookingCarrier, awb_number: bookingAwb },
        reason: `Courier booked via ${bookingCarrier} (AWB: ${bookingAwb}). ${bookingNote}`,
      });

      // Trigger Dispatch Email & Concierge WhatsApp Link
      try {
        const notifyRes = await authFetch('/api/orders/notify', {
          method: 'POST',
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

  // Batch Selection Computations & Handlers
  const eligibleForPaymentConfirm = orders.filter(
    (o) => selectedOrderIds.includes(o.id) && o.order_status === 'PENDING_PAYMENT'
  );
  const eligibleForCrafting = orders.filter(
    (o) => selectedOrderIds.includes(o.id) && o.order_status === 'PAYMENT_CONFIRMED'
  );
  const eligibleForPacked = orders.filter(
    (o) => selectedOrderIds.includes(o.id) && o.order_status === 'PROCESSING'
  );

  const toggleOrderSelect = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const selectAllFilteredOrders = () => {
    if (filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  };

  const handleBatchStatusTransition = async (targetStatus: string, actionName: string) => {
    const targets = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (targets.length === 0) return;

    setIsUpdating(true);
    let successCount = 0;
    let failCount = 0;

    for (const ord of targets) {
      try {
        const res = await authFetch('/api/admin/orders/update-status', {
          method: 'POST',
          body: JSON.stringify({
            orderId: ord.id,
            newStatus: targetStatus,
            statusNote: `Batch update to ${targetStatus} via bulk operations toolbar`,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsUpdating(false);
    if (successCount > 0) {
      showNotification(`Batch: ${successCount} orders transitioned to ${targetStatus.replace(/_/g, ' ')}!`, 'success');
      setSelectedOrderIds([]);
      await fetchOrders();
    }
    if (failCount > 0) {
      showNotification(`${failCount} orders could not be updated.`, 'error');
    }
  };

  const handleBatchExportCSV = () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
    if (selectedOrders.length === 0) return;

    const headers = [
      'Order #',
      'Date & Time',
      'Order Status',
      'Customer Name',
      'Phone',
      'City',
      'Net Total (INR)',
      'Carrier',
      'AWB',
    ];

    const rows = selectedOrders.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleString('en-IN'),
      o.order_status,
      o.guest_name,
      o.guest_phone,
      o.shipping_address_snapshot?.city || '',
      ((o.total_in_paise || 0) / 100).toFixed(2),
      o.shipments?.[0]?.carrier || 'UNASSIGNED',
      o.shipments?.[0]?.awb_number || '',
    ]);

    downloadCSV(`tpb_batch_orders_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    showNotification(`Exported ${selectedOrders.length} selected orders to CSV!`, 'success');
  };

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
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
            <Clock size={11} className="text-amber-600 animate-pulse" />
            Awaiting UPI
          </span>
        );
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const exportDispatchManifest = () => {
    const headers = [
      'Order #',
      'Order Date',
      'Status',
      'Recipient Name',
      'Phone',
      'Address Line 1',
      'Address Line 2',
      'City',
      'State',
      'PIN Code',
      'Items Summary',
      'Total Items Count',
      'Total Amount (INR)',
      'Carrier',
      'AWB Tracking Number',
    ];

    const rows = filteredOrders.map((o) => {
      const addr = o.shipping_address_snapshot || {};
      const itemsSummary = (o.order_items || [])
        .map((item) => `${item.quantity}x ${item.product_name} (${item.product_code})`)
        .join(' | ');
      const totalQty = (o.order_items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
      const shipment = o.shipments?.[0];

      return [
        o.order_number,
        new Date(o.created_at).toLocaleString('en-IN'),
        o.order_status,
        addr.recipientName || o.guest_name || '',
        addr.phone || o.guest_phone || '',
        addr.addressLine1 || '',
        addr.addressLine2 || '',
        addr.city || '',
        addr.state || '',
        addr.pincode || '',
        itemsSummary,
        totalQty,
        (o.total_in_paise / 100).toFixed(2),
        shipment?.carrier || 'UNASSIGNED',
        shipment?.awb_number || '',
      ];
    });

    downloadCSV(`tpb_dispatch_manifest_${new Date().toISOString().slice(0, 10)}`, headers, rows);

    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'orders',
      entity_id: 'dispatch_manifest',
      new_values: { exported_rows: filteredOrders.length, format: 'CSV', type: 'DISPATCH_MANIFEST' },
      reason: 'Admin exported orders logistics dispatch manifest',
    });
    showNotification(`Exported ${filteredOrders.length} orders to Dispatch Manifest CSV!`, 'success');
  };

  const exportFinancialSummary = () => {
    const headers = [
      'Order #',
      'Date & Time',
      'Order Status',
      'Payment Status',
      'Subtotal (INR)',
      'Coupon Discount (INR)',
      'Coupon Code',
      'Points Redeemed',
      'Loyalty Discount (INR)',
      'Shipping Fee (INR)',
      'Net Total (INR)',
    ];

    const rows = filteredOrders.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleString('en-IN'),
      o.order_status,
      o.payment_status,
      ((o.subtotal_in_paise || 0) / 100).toFixed(2),
      ((o.discount_in_paise || 0) / 100).toFixed(2),
      o.applied_coupon_code || '',
      o.loyalty_points_redeemed || 0,
      ((o.loyalty_discount_in_paise || 0) / 100).toFixed(2),
      ((o.shipping_fee_in_paise || 0) / 100).toFixed(2),
      ((o.total_in_paise || 0) / 100).toFixed(2),
    ]);

    downloadCSV(`tpb_financial_sales_summary_${new Date().toISOString().slice(0, 10)}`, headers, rows);

    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'orders',
      entity_id: 'financial_summary',
      new_values: { exported_rows: filteredOrders.length, format: 'CSV', type: 'FINANCIAL_SUMMARY' },
      reason: 'Admin exported financial sales summary report',
    });
    showNotification(`Exported ${filteredOrders.length} orders to Financial Summary CSV!`, 'success');
  };

  const kanbanColumns: KanbanColumn<AdminOrder>[] = [
    {
      id: 'PENDING_PAYMENT',
      title: 'Awaiting UPI',
      badgeColor: 'bg-amber-500',
      items: filteredOrders.filter((o) => o.order_status === 'PENDING_PAYMENT'),
      emptyMessage: 'No orders awaiting UPI payment',
    },
    {
      id: 'PAYMENT_CONFIRMED',
      title: 'Confirmed',
      badgeColor: 'bg-blue-500',
      items: filteredOrders.filter((o) => o.order_status === 'PAYMENT_CONFIRMED'),
      emptyMessage: 'No orders awaiting crafting',
    },
    {
      id: 'PROCESSING',
      title: 'In Crafting',
      badgeColor: 'bg-amber-500',
      items: filteredOrders.filter((o) => o.order_status === 'PROCESSING'),
      emptyMessage: 'No orders in crafting',
    },
    {
      id: 'PACKED',
      title: 'Packed & Ready',
      badgeColor: 'bg-purple-500',
      items: filteredOrders.filter((o) => o.order_status === 'PACKED'),
      emptyMessage: 'No orders awaiting pickup',
    },
    {
      id: 'SHIPPED',
      title: 'In Transit',
      badgeColor: 'bg-emerald-600',
      items: filteredOrders.filter((o) => o.order_status === 'SHIPPED'),
      emptyMessage: 'No orders currently in transit',
    },
    {
      id: 'DELIVERED',
      title: 'Delivered',
      badgeColor: 'bg-teal-600',
      items: filteredOrders.filter((o) => o.order_status === 'DELIVERED'),
      emptyMessage: 'No delivered orders in this view',
    },
  ];

  const renderKanbanCard = (order: AdminOrder) => {
    const isSelected = selectedOrderIds.includes(order.id);
    return (
      <div
        onClick={() => setSelectedOrder(order)}
        className={`bg-linen p-3.5 rounded-sm border shadow-xs hover:border-bark hover:shadow-soft transition-all cursor-pointer space-y-2.5 ${
          isSelected
            ? 'border-rose/80 ring-2 ring-rose/40 bg-rose/[0.04]'
            : 'border-canvas-line'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label
              className="flex items-center justify-center min-w-[36px] min-h-[36px] -ml-2 -my-2 p-2 cursor-pointer rounded hover:bg-rose/10 active:bg-rose/20 transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Select order"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOrderSelect(order.id)}
                className="w-4 h-4 rounded text-rose accent-rose border-canvas-line cursor-pointer"
              />
            </label>
            <span className="font-mono text-xs font-bold text-bark">{order.order_number}</span>
          </div>
          <span className="font-serif text-sm font-bold text-bark">
            {formatPrice(order.total_in_paise / 100)}
          </span>
        </div>
      <div>
        <p className="text-xs font-medium text-ink truncate">{order.guest_name}</p>
        <p className="text-[11px] text-ink-light flex items-center gap-1">
          <Phone size={10} /> +91 {order.guest_phone}
        </p>
      </div>
      <div className="text-[11px] text-ink-light truncate">
        {order.order_items.map((i) => `${i.product_name} (${i.quantity})`).join(', ')}
      </div>
      <div className="pt-2 border-t border-canvas-line flex items-center justify-between text-[10px] text-ink-light">
        <span>
          {new Date(order.created_at).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <span className="text-rose font-medium uppercase tracking-wider flex items-center gap-0.5">
          Manage <ChevronRight size={11} />
        </span>
      </div>
    </div>
  );
};

  return (
    <AdminLayout activePage="orders">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Standardized Admin View Header with Live KPI Stats & Export Actions */}
        <AdminViewHeader
          category="Atelier Logistics"
          title="Order Fulfillment"
          subtitle="Manage client orders, studio crafting progress, and courier dispatches."
          stats={[
            {
              label: 'Total Orders',
              value: orders.length,
              icon: <Package size={18} />,
              subtext: `${orders.filter((o) => o.payment_status === 'SUCCESS').length} captured payments`,
            },
            {
              label: 'In Crafting',
              value: orders.filter((o) => o.order_status === 'PROCESSING' || o.order_status === 'PACKED').length,
              icon: <Clock size={18} />,
              subtext: 'Bespoke crafting queue',
            },
            {
              label: 'In Transit',
              value: orders.filter((o) => o.order_status === 'SHIPPED' || o.order_status === 'OUT_FOR_DELIVERY').length,
              icon: <Truck size={18} />,
              subtext: 'Courier surface shipments',
            },
            {
              label: 'Delivered',
              value: orders.filter((o) => o.order_status === 'DELIVERED').length,
              icon: <CheckCircle2 size={18} />,
              subtext: 'Completed orders',
            },
          ]}
          primaryAction={{
            label: 'Record New Order',
            icon: <Plus size={15} />,
            onClick: () => setShowCreateOrderModal(true),
            title: 'Record a new or historical offline customer order',
          }}
          secondaryActions={[
            {
              label: 'Dispatch Manifest',
              icon: <Download size={14} className="text-rose" />,
              onClick: exportDispatchManifest,
              disabled: filteredOrders.length === 0,
              title: 'Export logistics manifest for courier dispatch',
            },
            {
              label: 'Financial Summary',
              icon: <Download size={14} className="text-emerald-700" />,
              onClick: exportFinancialSummary,
              disabled: filteredOrders.length === 0,
              title: 'Export financial accounting summary',
            },
          ]}
        />

        {/* Standardized View Toolbar: Search, Segment Tabs & View Mode Switcher */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search order #, customer, phone, city..."
          tabs={ORDER_STATUSES.map((s) => ({
            id: s.id,
            label: s.label,
            count:
              s.id === 'ALL'
                ? orders.length
                : orders.filter((o) => o.order_status === s.id).length,
          }))}
          activeTab={activeFilter}
          onTabChange={setActiveFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table', 'kanban']}
          onRefresh={fetchOrders}
          isRefreshing={loading}
          filterControls={
            filteredOrders.length > 0 ? (
              <button
                type="button"
                onClick={selectAllFilteredOrders}
                className="px-3 py-1.5 rounded-sm bg-white border border-canvas-line text-xs text-bark hover:border-bark flex items-center gap-2 transition-colors font-medium cursor-pointer shadow-2xs whitespace-nowrap"
                title={selectedOrderIds.length === filteredOrders.length ? 'Deselect all visible orders' : 'Select all visible orders'}
              >
                <input
                  type="checkbox"
                  checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                  onChange={selectAllFilteredOrders}
                  className="w-4 h-4 rounded text-rose accent-rose border-canvas-line cursor-pointer"
                />
                <span className="font-mono text-xs">
                  {selectedOrderIds.length === filteredOrders.length
                    ? 'Deselect All'
                    : selectedOrderIds.length > 0
                    ? `Selected (${selectedOrderIds.length})`
                    : `Select All (${filteredOrders.length})`}
                </span>
              </button>
            ) : null
          }
        />

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
        ) : viewMode === 'kanban' ? (
          <div className={selectedOrderIds.length > 0 ? 'pb-36 sm:pb-24' : ''}>
            <AdminKanbanBoard
              columns={kanbanColumns}
              renderCard={renderKanbanCard}
            />
          </div>
        ) : (
          <div className={`space-y-4 ${selectedOrderIds.length > 0 ? 'pb-36 sm:pb-24' : ''}`}>
            {filteredOrders.map((order) => {
              const shipment = order.shipments?.[0];
              const isSelected = selectedOrderIds.includes(order.id);
              return (
                <div
                  key={order.id}
                  className={`bg-linen rounded-sm border shadow-soft p-5 sm:p-6 transition-all hover:border-canvas-line-hover ${
                    isSelected ? 'border-rose/80 ring-2 ring-rose/40 bg-rose/[0.04]' : 'border-canvas-line'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-canvas-line">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <label
                          className="flex items-center justify-center min-w-[40px] min-h-[40px] -ml-2.5 -my-2.5 p-2.5 cursor-pointer rounded-sm hover:bg-rose/10 active:bg-rose/20 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="Select order for batch operations"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelect(order.id)}
                            className="w-4.5 h-4.5 sm:w-4 sm:h-4 rounded text-rose accent-rose border-canvas-line focus:ring-rose/30 cursor-pointer"
                          />
                        </label>
                        <span className="font-mono font-bold text-base sm:text-lg text-bark tracking-tight whitespace-nowrap">
                          {order.order_number}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {getStatusBadge(order.order_status)}
                          {order.applied_coupon_code && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-100 text-purple-800 whitespace-nowrap">
                              🏷 {order.applied_coupon_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-ink-light flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span>
                          {new Date(order.created_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-bark">{order.guest_name}</span>
                        <span>(+91 {order.guest_phone})</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsAppForOrder(order);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
                          title="Open WhatsApp Concierge"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-canvas-line/60">
                      <div className="text-left sm:text-right mr-1">
                        <p className="font-serif text-base sm:text-lg font-bold text-bark leading-tight">
                          {formatPrice(order.total_in_paise / 100)}
                        </p>
                        <p className="text-[10px] text-ink-light">
                          {order.order_items.length} item{order.order_items.length === 1 ? '' : 's'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">

                      {order.order_status === 'PENDING_PAYMENT' && (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openWhatsAppForPaymentRequest(order)}
                            className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            title="Send UPI QR & details to customer on WhatsApp"
                          >
                            <MessageCircle size={12} />
                            <span>Request UPI</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickStatusTransition(order, 'PAYMENT_CONFIRMED')}
                            disabled={isUpdating}
                            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-1 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                            title="Confirm payment received and advance to Confirmed"
                          >
                            <CheckCircle2 size={12} />
                            <span>Confirm Paid</span>
                          </button>
                        </div>
                      )}

                      {order.order_status === 'PAYMENT_CONFIRMED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickStatusTransition(order, 'PROCESSING');
                          }}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                          title="Advance order to In Crafting"
                        >
                          <Clock size={13} />
                          Start Crafting
                        </button>
                      )}

                      {order.order_status === 'PROCESSING' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickStatusTransition(order, 'PACKED');
                          }}
                          disabled={isUpdating}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50"
                          title="Mark piece packed and ready for courier"
                        >
                          <Package size={13} />
                          Mark Packed
                        </button>
                      )}

                      {order.order_status === 'PACKED' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                            setShowCourierModal(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-2xs transition-all"
                          title="Generate shipment waybill"
                        >
                          <Truck size={13} />
                          Book Courier
                        </button>
                      )}

                      <button
                        onClick={() => openOrderDetails(order)}
                        className="px-3.5 py-1.5 bg-bark text-linen hover:bg-rose-deep text-xs uppercase tracking-wider font-medium rounded-sm transition-all flex items-center gap-1"
                      >
                        Details
                        <ChevronRight size={14} />
                      </button>
                    </div>
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
        {/* ORDER DETAILS & DISPATCH DRAWER                                          */}
        {/* ========================================================================= */}
        <AdminEntityDrawer
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={selectedOrder ? `Order ${selectedOrder.order_number}` : ''}
          subtitle={
            selectedOrder
              ? `Placed on ${new Date(selectedOrder.created_at).toLocaleString('en-IN', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}`
              : ''
          }
          badge={selectedOrder ? getStatusBadge(selectedOrder.order_status) : undefined}
          widthClass="max-w-2xl sm:max-w-3xl"
        >
          {selectedOrder && (
            <div className="space-y-6">
              {/* Manual UPI Settlement Panel for PENDING_PAYMENT */}
              {selectedOrder.order_status === 'PENDING_PAYMENT' && (
                <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                      <Clock size={16} className="text-amber-700 animate-pulse shrink-0" />
                      <span>Action Required: Manual UPI Settlement</span>
                    </div>
                    <span className="font-serif font-bold text-base text-amber-950">
                      Due: {formatPrice(selectedOrder.total_in_paise / 100)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/90 leading-relaxed">
                    Customer placed order #{selectedOrder.order_number} without upfront online payment. Connect via WhatsApp to share our studio UPI ID (<strong>{settings.upiId || '9931657805@ptsbi'}</strong>), verify payment confirmation screenshot, and click Confirm Payment below to start crafting.
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => openWhatsAppForPaymentRequest(selectedOrder)}
                      className="px-3.5 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <MessageCircle size={14} />
                      Request Payment on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStatusTransition(selectedOrder, 'PAYMENT_CONFIRMED')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-sm text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 size={14} />
                      Confirm Payment Received ({formatPrice(selectedOrder.total_in_paise / 100)})
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Are you sure you want to cancel order #${selectedOrder.order_number}? Any redeemed loyalty points will be restored.`)) {
                          setIsUpdating(true);
                          try {
                            const res = await authFetch('/api/orders/cancel', {
                              method: 'POST',
                              body: JSON.stringify({
                                orderId: selectedOrder.id,
                                reason: 'Payment not received within settlement window',
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok || !data.success) throw new Error(data.message || 'Failed to cancel order');
                            showNotification(`Order #${selectedOrder.order_number} cancelled`, 'success');
                            setSelectedOrder(null);
                            await fetchOrders();
                          } catch (err: any) {
                            showNotification(err.message, 'error');
                          } finally {
                            setIsUpdating(false);
                          }
                        }
                      }}
                      disabled={isUpdating}
                      className="px-3 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-sm text-xs font-medium transition-all ml-auto disabled:opacity-50 cursor-pointer"
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              )}
              {/* MTO Cancellation Protection Notice */}
              {['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
                selectedOrder.order_status
              ) && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-sm flex items-center gap-2 text-xs text-amber-900">
                  <AlertCircle size={15} className="text-amber-800 shrink-0" />
                  <span>
                    <strong>Made-To-Order Policy Active:</strong> Crafting has commenced in the atelier. This bespoke creation is protected from accidental or customer-initiated cancellation.
                  </span>
                </div>
              )}

              {/* Quick Actions Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 p-3 bg-canvas/30 rounded-sm border border-canvas-line">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer & Shipping Address */}
                {(() => {
                  const isGift = Boolean(
                    (selectedOrder.shipping_address_snapshot?.recipientName &&
                     selectedOrder.guest_name &&
                     selectedOrder.shipping_address_snapshot.recipientName.trim().toLowerCase() !== selectedOrder.guest_name.trim().toLowerCase()) ||
                    selectedOrder.customer_note?.includes('[GIFT')
                  );
                  return (
                    <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-1.5">
                            <MapPin size={14} className="text-rose" />
                            Delivery Destination
                          </h4>
                          {isGift && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose/15 text-rose-deep border border-rose/30 flex items-center gap-1">
                              <Gift size={11} className="text-rose" /> Gift Order
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => copyAddressToClipboard(selectedOrder)}
                          className="text-[11px] text-rose hover:underline flex items-center gap-1"
                        >
                          <Copy size={12} />
                          Copy Label
                        </button>
                      </div>

                      <div className="text-xs text-ink space-y-1.5">
                        {isGift && (
                          <div className="p-2 bg-linen rounded-sm border border-canvas-line text-[11px] space-y-1 mb-2">
                            <p className="text-ink-light">
                              <strong className="text-bark">Buyer / Sender:</strong> {selectedOrder.guest_name} (+91 {selectedOrder.guest_phone})
                            </p>
                            <p className="text-ink-light">
                              <strong className="text-bark">Recipient:</strong> {selectedOrder.shipping_address_snapshot.recipientName} (+91 {selectedOrder.shipping_address_snapshot.phone})
                            </p>
                          </div>
                        )}

                        {!isGift && (
                          <p className="font-semibold text-bark">
                            {selectedOrder.shipping_address_snapshot.recipientName}
                          </p>
                        )}

                        <p className="flex items-center gap-1.5 text-ink-light">
                          <Phone size={12} />
                          +91 {selectedOrder.shipping_address_snapshot.phone}
                          {isGift && <span className="text-[10px] text-rose font-medium">(Courier delivery call)</span>}
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

                        {/* Gift Note Callout for atelier florists */}
                        {selectedOrder.customer_note?.includes('[GIFT CARD MESSAGE]:') && (
                          <div className="mt-2.5 p-2 bg-rose/10 border border-rose/25 rounded-sm text-[11px] text-bark">
                            <span className="font-semibold text-rose flex items-center gap-1 mb-0.5">
                              <Sparkles size={11} className="text-rose" /> Complimentary Handwritten Card Note:
                            </span>
                            <p className="italic text-ink font-serif">
                              &ldquo;{selectedOrder.customer_note.split('[GIFT CARD MESSAGE]:')[1]?.split('|')[0]?.replace(/^[\s":]+|[\s":]+$/g, '')}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

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
              <div>
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

              {/* Live Courier Journey Tracker (Delhivery / Surface Cargo) */}
              {(selectedOrder.shipments?.[0]?.awb_number || adminLiveTracking) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-wider font-bold text-bark flex items-center gap-1.5">
                      <Truck size={14} className="text-[#2D5A27]" />
                      <span>Live Courier Journey (Delhivery)</span>
                    </h4>
                    {adminLiveTracking?.currentLocation && (
                      <span className="text-[11px] text-ink-light flex items-center gap-1">
                        <MapPin size={11} className="text-rose" />
                        <span>Hub: {adminLiveTracking.currentLocation}</span>
                      </span>
                    )}
                  </div>
                  <LiveCourierJourney
                    variant="card"
                    orderNumber={selectedOrder.order_number}
                    liveTracking={adminLiveTracking}
                    shipment={selectedOrder.shipments?.[0]}
                    isRefreshing={adminTrackingLoading}
                    onRefresh={() => {
                      const curAwb = selectedOrder.shipments?.[0]?.awb_number || awbNumber;
                      if (curAwb) fetchAdminLiveTracking(curAwb, true);
                    }}
                  />
                </div>
              )}

              {/* Status Update Form */}
              <form onSubmit={handleUpdateOrderStatus} className="bg-canvas/30 p-5 rounded-sm border border-canvas-line space-y-4">
                <h4 className="heading-serif text-lg text-bark">Update Order & Dispatch</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-bark font-medium mb-1">
                      Order Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    >
                      <option value="PENDING_PAYMENT">Pending Payment (PENDING_PAYMENT)</option>
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
                      className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs uppercase tracking-wider text-bark font-medium">
                        AWB / Tracking Number
                      </label>
                      {awbNumber.trim() && (
                        <button
                          type="button"
                          onClick={() => fetchAdminLiveTracking(awbNumber, true)}
                          className="text-[10px] text-rose hover:text-rose-deep font-medium flex items-center gap-1 cursor-pointer"
                          title="Query live Delhivery tracking"
                        >
                          <RefreshCw size={10} className={adminTrackingLoading ? 'animate-spin' : ''} />
                          Check Live
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={awbNumber}
                      onChange={(e) => setAwbNumber(e.target.value)}
                      placeholder="e.g. 142385920194"
                      className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark font-mono"
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
                      className="w-full px-3 py-2 bg-linen border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
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
          )}
        </AdminEntityDrawer>

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

        {/* Record Offline / Direct Customer Order Modal */}
        <CreateOrderModal
          isOpen={showCreateOrderModal}
          onClose={() => setShowCreateOrderModal(false)}
          onOrderCreated={async () => {
            await fetchOrders();
          }}
        />

        {/* Responsive Batch Action Bar: Mobile Bottom Dock + Desktop Floating Pill */}
        {selectedOrderIds.length > 0 && (
          <>
            {/* Mobile Batch Action Dock (Sticky Bottom Sheet) */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-bark text-linen border-t border-linen/20 px-4 pt-3 pb-safe shadow-2xl sm:hidden flex flex-col gap-2.5 animate-slide-up">
              {/* Header: Selection counter & Clear button */}
              <div className="flex items-center justify-between pb-1 border-b border-linen/10">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose text-white text-[11px] font-bold flex items-center justify-center">
                    {selectedOrderIds.length}
                  </span>
                  <span className="text-xs font-semibold text-linen">
                    {selectedOrderIds.length === 1 ? '1 Order Selected' : `${selectedOrderIds.length} Orders Selected`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="text-xs text-linen/70 hover:text-linen flex items-center gap-1 py-1 px-2.5 rounded-full bg-white/10 active:bg-white/20 transition-colors"
                  title="Clear selection"
                >
                  <X size={12} />
                  <span>Deselect</span>
                </button>
              </div>

              {/* Action Buttons: Full-width touch friendly row */}
              <div className="flex items-center gap-2">
                {eligibleForPaymentConfirm.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchStatusTransition('PAYMENT_CONFIRMED', 'Confirm Paid')}
                    disabled={isUpdating}
                    className="flex-1 py-2.5 px-3 bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-sm active:scale-98"
                    title="Confirm payments for selected UPI orders"
                  >
                    {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>Confirm Paid ({eligibleForPaymentConfirm.length})</span>
                  </button>
                )}

                {eligibleForCrafting.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchStatusTransition('PROCESSING', 'Start Crafting')}
                    disabled={isUpdating}
                    className="flex-1 py-2.5 px-3 bg-amber-600 active:bg-amber-700 text-white rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-sm active:scale-98"
                    title="Move selected paid orders to crafting"
                  >
                    {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
                    <span>Craft ({eligibleForCrafting.length})</span>
                  </button>
                )}

                {eligibleForPacked.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchStatusTransition('PACKED', 'Mark Packed')}
                    disabled={isUpdating}
                    className="flex-1 py-2.5 px-3 bg-blue-600 active:bg-blue-700 text-white rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-sm active:scale-98"
                    title="Mark selected crafting orders as packed"
                  >
                    {isUpdating ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                    <span>Pack ({eligibleForPacked.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleBatchExportCSV}
                  className="py-2.5 px-3.5 bg-white/15 active:bg-white/25 text-linen rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-98 flex-shrink-0"
                  title="Export selected orders to CSV"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Desktop Floating Batch Action Toolbar */}
            <div className="hidden sm:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-bark text-linen px-5 sm:px-6 py-3 rounded-full shadow-2xl border border-canvas-line/40 items-center gap-3 sm:gap-4 animate-fade-up max-w-[95vw]">
              <div className="flex items-center gap-2 pr-3 border-r border-linen/20 flex-shrink-0">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose text-white text-[11px] sm:text-xs font-bold flex items-center justify-center">
                  {selectedOrderIds.length}
                </span>
                <span className="text-xs font-medium whitespace-nowrap">
                  {selectedOrderIds.length === 1 ? 'Order' : 'Orders'} Selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {eligibleForPaymentConfirm.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchStatusTransition('PAYMENT_CONFIRMED', 'Confirm Paid')}
                    disabled={isUpdating}
                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap disabled:opacity-50 shadow-sm hover:scale-102 active:scale-98"
                    title="Confirm payments for selected UPI orders"
                  >
                    {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Confirm Paid ({eligibleForPaymentConfirm.length})
                  </button>
                )}

                {eligibleForCrafting.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchStatusTransition('PROCESSING', 'Start Crafting')}
                    disabled={isUpdating}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap disabled:opacity-50 shadow-sm hover:scale-102 active:scale-98"
                    title="Move selected paid orders to crafting"
                  >
                    {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
                    Start Crafting ({eligibleForCrafting.length})
                  </button>
                )}

                {eligibleForPacked.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleBatchStatusTransition('PACKED', 'Mark Packed')}
                    disabled={isUpdating}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap disabled:opacity-50 shadow-sm hover:scale-102 active:scale-98"
                    title="Mark selected crafting orders as packed"
                  >
                    {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                    Mark Packed ({eligibleForPacked.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleBatchExportCSV}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-linen rounded-full text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap shadow-sm hover:scale-102 active:scale-98"
                  title="Export selected orders to CSV"
                >
                  <Download size={12} />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrderIds([])}
                  className="p-1.5 text-linen/60 hover:text-linen rounded-full hover:bg-white/10 transition-colors ml-1"
                  title="Clear selection"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </AdminLayout>
  );
}
