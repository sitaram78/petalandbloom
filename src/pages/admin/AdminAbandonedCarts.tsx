import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  Phone,
  Mail,
  Send,
  Download,
  Search,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Copy,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { formatPrice } from '@/data/products';
import {
  useAdminView,
  AdminViewHeader,
  AdminViewToolbar,
  AdminEntityDrawer,
} from '@/components/admin/view-system';

interface AbandonedCartItem {
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price_in_paise: number;
}

interface AbandonedCart {
  id: string;
  order_number: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  total_in_paise: number;
  created_at: string;
  order_items: AbandonedCartItem[];
  shipping_address_snapshot?: {
    city?: string;
    state?: string;
  };
}

export default function AdminAbandonedCarts() {
  const { showNotification } = useNotification();
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  // Unified Admin View System hook
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
  } = useAdminView({
    defaultView: 'table',
    defaultTab: 'ALL',
    searchParamKey: 'q',
    tabParamKey: 'tab',
    viewParamKey: 'view',
  });

  const fetchAbandonedCarts = async () => {
    setLoading(true);
    try {
      // Find orders in PENDING_PAYMENT status
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          guest_name,
          guest_phone,
          guest_email,
          total_in_paise,
          created_at,
          shipping_address_snapshot,
          order_items (
            product_name,
            product_code,
            quantity,
            unit_price_in_paise
          )
        `)
        .eq('order_status', 'PENDING_PAYMENT')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCarts((data as any) || []);
    } catch (err: any) {
      console.error('Failed to fetch abandoned carts:', err);
      showNotification('Failed to load abandoned carts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAbandonedCarts();
  }, []);

  const openWhatsAppReminder = (cart: AbandonedCart) => {
    const cleanPhone = (cart.guest_phone || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone) {
      showNotification('No valid phone number for this patron.', 'error');
      return;
    }

    const firstItem = cart.order_items?.[0]?.product_name || 'handcrafted floral piece';
    const otherItemsCount = (cart.order_items?.length || 1) - 1;
    const itemsText = otherItemsCount > 0 ? `${firstItem} (+${otherItemsCount} more)` : firstItem;

    const message = `🌸 *The Petal & Bloom Atelier*\n\nHello ${cart.guest_name || 'there'},\nWe noticed you left your bespoke *${itemsText}* in your cart at our studio.\n\nWould you like any assistance completing your reservation or customizing the yarn colors? We'd love to craft this for you! ✨\n\nCheckout: https://thepetalandbloom.vercel.app/`;

    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');

    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'orders',
      entity_id: cart.order_number,
      new_values: { channel: 'WHATSAPP_REMINDER', phone: cleanPhone },
      reason: 'Admin triggered abandoned cart recovery WhatsApp concierge message',
    });
  };

  const exportAbandonedCartsCSV = () => {
    const headers = [
      'Order #',
      'Date Abandoned',
      'Patron Name',
      'Phone Number',
      'Email',
      'Cart Items Summary',
      'Total Items',
      'Cart Value (INR)',
      'City',
    ];

    const rows = filteredCarts.map((c) => {
      const itemsSummary = (c.order_items || [])
        .map((i) => `${i.quantity}x ${i.product_name}`)
        .join(' | ');
      const totalQty = (c.order_items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);

      return [
        c.order_number,
        new Date(c.created_at).toLocaleString('en-IN'),
        c.guest_name || 'Guest',
        c.guest_phone || '',
        c.guest_email || '',
        itemsSummary,
        totalQty,
        ((c.total_in_paise || 0) / 100).toFixed(2),
        c.shipping_address_snapshot?.city || '',
      ];
    });

    downloadCSV(`tpb_abandoned_carts_${new Date().toISOString().slice(0, 10)}`, headers, rows);

    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'orders',
      entity_id: 'abandoned_carts_export',
      new_values: { exported_rows: filteredCarts.length, format: 'CSV' },
      reason: 'Admin exported abandoned cart recovery dataset',
    });

    showNotification(`Exported ${filteredCarts.length} abandoned cart records to CSV!`, 'success');
  };

  const filteredCarts = carts.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.order_number.toLowerCase().includes(q) ||
      (c.guest_name && c.guest_name.toLowerCase().includes(q)) ||
      (c.guest_phone && c.guest_phone.includes(q)) ||
      (c.guest_email && c.guest_email.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (activeTab === 'HIGH_VALUE') {
      return (c.total_in_paise / 100) >= avgAbandonedCartValue;
    }
    if (activeTab === 'TODAY') {
      const today = new Date().toISOString().slice(0, 10);
      return c.created_at.startsWith(today);
    }
    return true;
  });

  const totalAbandonedCount = carts.length;
  const totalAbandonedValue = carts.reduce((sum, c) => sum + (c.total_in_paise || 0), 0) / 100;
  const avgAbandonedCartValue = totalAbandonedCount > 0 ? Math.round(totalAbandonedValue / totalAbandonedCount) : 0;

  return (
    <AdminLayout activePage="abandoned-carts" as any>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Standardized Admin View Header */}
        <AdminViewHeader
          category="Conversion & Cart Recovery"
          title="Abandoned Checkouts"
          subtitle="Recover high-intent patrons who initiated checkout but haven't finalized payment."
          stats={[
            {
              label: 'Pending Carts',
              value: totalAbandonedCount,
              icon: <ShoppingBag size={18} />,
              subtext: 'Checkouts without captured payment',
            },
            {
              label: 'Recoverable GMV',
              value: formatPrice(totalAbandonedValue),
              icon: <Sparkles size={18} className="text-rose" />,
              subtext: 'Sitting in unfinished carts',
            },
            {
              label: 'Average Cart Value',
              value: formatPrice(avgAbandonedCartValue),
              icon: <Clock size={18} className="text-emerald-700" />,
              subtext: 'Average basket size',
            },
          ]}
          secondaryActions={[
            {
              label: 'Export Recovery CSV',
              icon: <Download size={14} className="text-emerald-700" />,
              onClick: exportAbandonedCartsCSV,
              disabled: carts.length === 0,
            },
          ]}
        />

        {/* Standardized View Toolbar */}
        <AdminViewToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search by patron name, phone, order #, city..."
          tabs={[
            { id: 'ALL', label: 'All Carts', count: carts.length },
            {
              id: 'HIGH_VALUE',
              label: 'High Value',
              count: carts.filter((c) => (c.total_in_paise / 100) >= avgAbandonedCartValue).length,
            },
            {
              id: 'TODAY',
              label: 'Today',
              count: carts.filter((c) => c.created_at.startsWith(new Date().toISOString().slice(0, 10))).length,
            },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          supportedModes={['table', 'grid']}
          onRefresh={fetchAbandonedCarts}
          isRefreshing={loading}
        />

        {/* Content View: Table vs Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 bg-linen rounded-sm border border-canvas-line">
            <Loader2 size={28} className="animate-spin text-rose" />
            <p className="text-xs text-ink-light">Scanning unfinished atelier checkouts...</p>
          </div>
        ) : filteredCarts.length === 0 ? (
          <div className="py-20 text-center bg-linen rounded-sm border border-canvas-line space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
            <h3 className="heading-serif text-xl text-bark">No Abandoned Checkouts</h3>
            <p className="text-xs text-ink-light max-w-sm mx-auto">
              All initiated checkouts are either paid or no carts match the active filter.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCarts.map((cart) => (
              <div
                key={cart.id}
                className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft hover:border-canvas-line-hover transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-bark">{cart.order_number}</span>
                    <span className="font-serif text-base font-bold text-bark">
                      {formatPrice(cart.total_in_paise / 100)}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-bark text-sm">{cart.guest_name || 'Guest Client'}</h4>
                    {cart.shipping_address_snapshot?.city && (
                      <p className="text-[11px] text-ink-light">
                        {cart.shipping_address_snapshot.city}
                        {cart.shipping_address_snapshot.state ? `, ${cart.shipping_address_snapshot.state}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="bg-canvas/40 p-3 rounded-sm space-y-1 text-xs text-ink-light">
                    {cart.guest_phone && (
                      <p className="flex items-center gap-1.5 text-ink font-mono">
                        <Phone size={11} className="text-rose shrink-0" /> {cart.guest_phone}
                      </p>
                    )}
                    {cart.guest_email && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={11} className="shrink-0" /> {cart.guest_email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-light">Reserved Pieces</p>
                    {cart.order_items?.map((item, idx) => (
                      <p key={idx} className="text-xs text-ink truncate flex items-center justify-between">
                        <span>{item.quantity}× {item.product_name}</span>
                        <span className="font-mono text-[11px] text-ink-light">
                          {formatPrice((item.unit_price_in_paise * item.quantity) / 100)}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-canvas-line flex items-center gap-2">
                  <button
                    onClick={() => setSelectedCart(cart)}
                    className="flex-1 py-2 bg-canvas hover:bg-bark hover:text-linen text-bark text-xs uppercase tracking-wider font-medium rounded-sm border border-canvas-line transition-all flex items-center justify-center gap-1"
                  >
                    Inspect
                    <ChevronRight size={13} />
                  </button>

                  <button
                    onClick={() => openWhatsAppReminder(cart)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors shadow-soft"
                    title="Send personalized WhatsApp reminder"
                  >
                    <MessageCircle size={13} />
                    WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <section className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-canvas/60 text-bark font-mono uppercase tracking-wider border-b border-canvas-line">
                  <tr>
                    <th className="p-4">Checkout / Patron</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4">Reserved Pieces</th>
                    <th className="p-4 text-right">Cart Total</th>
                    <th className="p-4">Initiated</th>
                    <th className="p-4 text-right">Recovery Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-line bg-parchment/20">
                  {filteredCarts.map((cart) => (
                    <tr key={cart.id} className="hover:bg-canvas/40 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="font-mono font-bold text-ink text-xs">{cart.order_number}</p>
                          <p className="font-semibold text-bark text-sm mt-0.5">{cart.guest_name || 'Guest Client'}</p>
                          {cart.shipping_address_snapshot?.city && (
                            <p className="text-[10px] text-ink-light">
                              {cart.shipping_address_snapshot.city}
                              {cart.shipping_address_snapshot.state ? `, ${cart.shipping_address_snapshot.state}` : ''}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-1">
                          {cart.guest_phone && (
                            <p className="text-xs text-ink font-mono flex items-center gap-1.5">
                              <Phone size={12} className="text-rose" />
                              {cart.guest_phone}
                            </p>
                          )}
                          {cart.guest_email && (
                            <p className="text-[11px] text-ink-light flex items-center gap-1.5">
                              <Mail size={12} className="text-bark/50" />
                              {cart.guest_email}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="space-y-0.5 max-w-xs">
                          {cart.order_items?.map((item, idx) => (
                            <p key={idx} className="text-xs text-ink truncate">
                              <span className="font-semibold">{item.quantity}x</span> {item.product_name}
                            </p>
                          ))}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <p className="font-serif font-bold text-sm text-bark">
                          {formatPrice(cart.total_in_paise / 100)}
                        </p>
                      </td>

                      <td className="p-4 text-ink-light text-[11px]">
                        {new Date(cart.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedCart(cart)}
                            className="px-2.5 py-1.5 bg-canvas hover:bg-canvas-line text-bark text-xs font-medium rounded-sm transition-colors"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => openWhatsAppReminder(cart)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors shadow-soft"
                            title="Send personalized WhatsApp reminder"
                          >
                            <MessageCircle size={13} />
                            WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Abandoned Cart Inspector Drawer */}
        <AdminEntityDrawer
          isOpen={!!selectedCart}
          onClose={() => setSelectedCart(null)}
          title={selectedCart ? `Cart ${selectedCart.order_number}` : ''}
          subtitle={
            selectedCart
              ? `Abandoned by ${selectedCart.guest_name} on ${new Date(selectedCart.created_at).toLocaleString('en-IN')}`
              : ''
          }
          badge={
            selectedCart && (
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                Pending Checkout
              </span>
            )
          }
          widthClass="max-w-2xl"
          footerActions={
            selectedCart && (
              <div className="flex items-center justify-between w-full">
                <span className="font-serif text-lg font-bold text-bark">
                  Total: {formatPrice(selectedCart.total_in_paise / 100)}
                </span>
                <button
                  type="button"
                  onClick={() => openWhatsAppReminder(selectedCart)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold rounded-sm transition-colors flex items-center gap-2 shadow-sm"
                >
                  <MessageCircle size={15} />
                  Send WhatsApp Recovery
                </button>
              </div>
            )
          }
        >
          {selectedCart && (
            <div className="space-y-6">
              {/* Patron & Destination Card */}
              <div className="bg-canvas/30 p-4 rounded-sm border border-canvas-line space-y-2 text-xs">
                <h4 className="text-xs uppercase tracking-wider font-bold text-bark mb-1">
                  Patron Information
                </h4>
                <div className="flex justify-between">
                  <span className="text-ink-light">Name</span>
                  <strong className="text-bark">{selectedCart.guest_name || 'Guest Patron'}</strong>
                </div>
                {selectedCart.guest_phone && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Phone</span>
                    <span className="font-mono text-bark">+91 {selectedCart.guest_phone}</span>
                  </div>
                )}
                {selectedCart.guest_email && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Email</span>
                    <span className="text-bark">{selectedCart.guest_email}</span>
                  </div>
                )}
                {selectedCart.shipping_address_snapshot?.city && (
                  <div className="flex justify-between">
                    <span className="text-ink-light">Destination</span>
                    <span className="text-bark">
                      {selectedCart.shipping_address_snapshot.city}
                      {selectedCart.shipping_address_snapshot.state ? `, ${selectedCart.shipping_address_snapshot.state}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Reserved Items Breakdown */}
              <div>
                <h4 className="text-xs uppercase tracking-wider font-bold text-bark mb-3">
                  Reserved Botanical Arrangements
                </h4>
                <div className="border border-canvas-line rounded-sm divide-y divide-canvas-line">
                  {selectedCart.order_items?.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-bark">{item.product_name}</p>
                        <p className="text-[11px] font-mono text-ink-light">
                          Code: {item.product_code} • Qty: {item.quantity}
                        </p>
                      </div>
                      <span className="font-mono font-medium text-bark">
                        {formatPrice((item.unit_price_in_paise * item.quantity) / 100)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recovery Suggestion & Template */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-sm space-y-2 text-xs text-amber-950">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-800" /> Concierge Recovery Protocol
                </p>
                <p className="text-[11px] leading-relaxed">
                  Reaching out via WhatsApp within 24 hours of cart abandonment yields a ~35% recovery rate for handmade luxury creations.
                </p>
              </div>
            </div>
          )}
        </AdminEntityDrawer>
      </main>
    </AdminLayout>
  );
}
