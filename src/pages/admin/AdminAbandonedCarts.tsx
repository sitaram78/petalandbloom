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
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import { formatPrice } from '@/data/products';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

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
    return (
      !q ||
      c.order_number.toLowerCase().includes(q) ||
      (c.guest_name && c.guest_name.toLowerCase().includes(q)) ||
      (c.guest_phone && c.guest_phone.includes(q)) ||
      (c.guest_email && c.guest_email.toLowerCase().includes(q))
    );
  });

  const totalAbandonedCount = carts.length;
  const totalAbandonedValue = carts.reduce((sum, c) => sum + (c.total_in_paise || 0), 0) / 100;
  const avgAbandonedCartValue = totalAbandonedCount > 0 ? Math.round(totalAbandonedValue / totalAbandonedCount) : 0;

  return (
    <AdminLayout activePage="abandoned-carts" as any>
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Conversion &amp; Cart Recovery
            </p>
            <h1 className="heading-serif text-4xl text-bark">Abandoned Checkouts</h1>
            <p className="text-xs text-ink-light mt-1">
              Recover high-intent patrons who initiated checkout but haven't finalized payment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportAbandonedCartsCSV}
              disabled={carts.length === 0}
              className="px-3.5 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Download size={14} className="text-emerald-700" />
              Export Recovery CSV
            </button>

            <button
              onClick={fetchAbandonedCarts}
              disabled={loading}
              className="px-3.5 py-2 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-2 transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        {/* 1. Recovery KPI Stats Bar */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                Pending / Abandoned Carts
              </span>
              <ShoppingBag size={18} className="text-rose" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{totalAbandonedCount}</p>
            <p className="text-[11px] text-ink-light mt-1">Checkouts initiated without captured payment</p>
          </div>

          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                Recoverable Revenue (GMV)
              </span>
              <Sparkles size={18} className="text-rose-deep" />
            </div>
            <p className="font-serif text-3xl text-rose-deep mt-3">{formatPrice(totalAbandonedValue)}</p>
            <p className="text-[11px] text-ink-light mt-1">Total value sitting in unfinished carts</p>
          </div>

          <div className="bg-linen p-5 rounded-sm border border-canvas-line shadow-soft">
            <div className="flex items-center justify-between text-bark">
              <span className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">
                Average Abandoned Value
              </span>
              <Clock size={18} className="text-emerald-700" />
            </div>
            <p className="font-serif text-3xl text-bark mt-3">{formatPrice(avgAbandonedCartValue)}</p>
            <p className="text-[11px] text-ink-light mt-1">Average order value per unfinished checkout</p>
          </div>
        </section>

        {/* 2. Abandoned Carts Table */}
        <section className="bg-linen rounded-sm border border-canvas-line shadow-soft overflow-hidden">
          <div className="p-4 border-b border-canvas-line bg-canvas/30 flex items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by patron name, phone, order #..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <Loader2 size={28} className="animate-spin text-rose" />
              <p className="text-xs text-ink-light">Scanning unfinished atelier checkouts...</p>
            </div>
          ) : filteredCarts.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
              <h3 className="heading-serif text-xl text-bark">No Abandoned Checkouts</h3>
              <p className="text-xs text-ink-light max-w-sm mx-auto">
                All initiated checkouts are either paid or no carts are currently pending.
              </p>
            </div>
          ) : (
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
                            onClick={() => openWhatsAppReminder(cart)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors shadow-soft"
                            title="Send personalized WhatsApp reminder"
                          >
                            <MessageCircle size={13} />
                            Recover via WhatsApp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AdminLayout>
  );
}
