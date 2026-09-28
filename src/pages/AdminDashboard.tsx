import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trash2,
  Plus,
  Search,
  Loader2,
  Palette,
  Star,
  Package,
  ArrowRight,
  GripVertical,
  Truck,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Users,
  ExternalLink,
  Clock,
  Sparkles,
  Ticket,
  Upload,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useProducts } from '@/context/ProductContext';
import Reveal from '@/components/Reveal';
import AdminLayout from '@/components/AdminLayout';
import { formatPrice } from '@/data/products';
import { downloadCSV } from '@/utils/csvExporter';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditClient';
import ProductBulkImportModal from '@/components/admin/ProductBulkImportModal';

interface OrderSummary {
  id: string;
  order_number: string;
  guest_name: string;
  guest_phone: string;
  order_status: string;
  payment_status: string;
  total_in_paise: number;
  created_at: string;
}

export default function AdminDashboard() {
  const { products, loading: productsLoading, refreshProducts } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Business Analytics State
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [totalRevenueRupees, setTotalRevenueRupees] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [confirmedOrdersCount, setConfirmedOrdersCount] = useState(0);
  const [processingOrdersCount, setProcessingOrdersCount] = useState(0);
  const [deliveredOrdersCount, setDeliveredOrdersCount] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([]);
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);

  useEffect(() => {
    async function loadAnalytics() {
      setAnalyticsLoading(true);
      try {
        // 1. Fetch Orders Analytics
        const { data: orders, error: ordersErr } = await supabase
          .from('orders')
          .select('id, order_number, guest_name, guest_phone, order_status, payment_status, total_in_paise, created_at')
          .order('created_at', { ascending: false });

        if (!ordersErr && orders) {
          setTotalOrdersCount(orders.length);
          setRecentOrders(orders.slice(0, 5));

          const confirmed = orders.filter(
            (o) => o.payment_status === 'SUCCESS' || o.order_status !== 'PENDING_PAYMENT'
          );
          setConfirmedOrdersCount(confirmed.length);

          const processing = orders.filter((o) => o.order_status === 'PROCESSING' || o.order_status === 'PACKED');
          setProcessingOrdersCount(processing.length);

          const delivered = orders.filter((o) => o.order_status === 'DELIVERED');
          setDeliveredOrdersCount(delivered.length);

          const rev = confirmed.reduce((acc, curr) => acc + (curr.total_in_paise || 0), 0);
          setTotalRevenueRupees(rev / 100);
        }

        // 2. Fetch Customers Count
        const { count: customersCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true });

        setTotalCustomersCount(customersCount || 0);
      } catch (e) {
        console.error('Failed to load business analytics:', e);
      } finally {
        setAnalyticsLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  const filteredProducts = products.filter((p) => {
    const name = p.name?.toLowerCase() || '';
    const code = p.code?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  const handleDeleteProduct = async (code: string) => {
    if (!confirm(`Are you sure you want to delete product ${code}? This action cannot be undone.`)) {
      return;
    }

    const targetProduct = products.find((p) => p.code === code);
    setIsDeleting(code);
    try {
      const { error } = await supabase.from('products').delete().eq('code', code);

      if (error) throw error;

      // Central Audit Logging
      logAudit({
        action: AUDIT_ACTIONS.PRODUCT_DEACTIVATED,
        entity: 'products',
        entity_id: code,
        old_values: targetProduct ? { name: targetProduct.name, price: targetProduct.price } : null,
        reason: 'Product deleted from atelier catalog',
      });

      await refreshProducts();
    } catch (err: any) {
      alert(`Error deleting product: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const exportCatalogCSV = () => {
    const headers = [
      'code',
      'name',
      'category',
      'price_inr',
      'compare_price_inr',
      'description',
      'preparation_days',
      'made_to_order',
      'bestseller',
      'featured',
      'customisable',
      'image_urls_comma_separated',
    ];

    const rows = products.map((p) => [
      p.code,
      p.name,
      p.category,
      p.price,
      p.compareAtPrice || '',
      p.description || '',
      p.preparationDays || '2–3 days',
      p.madeToOrder ? 'true' : 'false',
      p.bestseller ? 'true' : 'false',
      p.featured ? 'true' : 'false',
      p.customisable ? 'true' : 'false',
      (p.images || []).join(','),
    ]);

    downloadCSV(`tpb_catalog_export_${new Date().toISOString().slice(0, 10)}`, headers, rows);

    logAudit({
      action: AUDIT_ACTIONS.CUSTOMER_PII_EXPORTED,
      entity: 'products',
      entity_id: 'catalog_export',
      new_values: { exported_rows: products.length, format: 'CSV' },
      reason: 'Admin exported complete product catalog dataset',
    });
  };

  const aovRupees = confirmedOrdersCount > 0 ? Math.round(totalRevenueRupees / confirmedOrdersCount) : 0;

  if (productsLoading && analyticsLoading) {
    return (
      <AdminLayout activePage="dashboard">
        <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-rose" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="dashboard">
      <main className="p-6 lg:p-10 space-y-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Reveal>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-rose font-semibold">Executive Control</span>
              <h1 className="heading-serif text-4xl sm:text-5xl text-bark tracking-tight">Atelier Overview</h1>
              <p className="text-sm text-ink-light font-light italic">Business metrics, orders pipeline, and studio collection.</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/admin/orders"
                className="btn-secondary px-5 py-2.5 flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-bark hover:text-rose shadow-soft"
              >
                <Truck size={16} /> Manage Orders
              </Link>
              <Link
                to="/admin/customers"
                className="btn-secondary px-5 py-2.5 flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-bark hover:text-rose shadow-soft"
              >
                <Users size={16} /> Patrons CRM
              </Link>
              <Link
                to="/admin/editor"
                className="btn-primary px-5 py-2.5 flex items-center gap-2 text-xs uppercase tracking-wider font-medium shadow-soft"
              >
                <Plus size={16} /> Create Piece
              </Link>
            </div>
          </Reveal>
        </header>

        {/* 1. Executive Revenue & Order Metrics */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Reveal>
              <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft group hover:border-rose/50 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Gross Revenue</p>
                  <div className="p-2.5 rounded-full bg-rose/10 text-rose">
                    <TrendingUp size={20} />
                  </div>
                </div>
                <p className="font-serif text-3xl sm:text-4xl text-bark mt-4">{formatPrice(totalRevenueRupees)}</p>
                <p className="text-[11px] text-emerald-800 mt-2 font-medium flex items-center gap-1">
                  ✓ Confirmed captured payments
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft group hover:border-rose/50 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Active Orders</p>
                  <div className="p-2.5 rounded-full bg-amber-100 text-amber-800">
                    <ShoppingBag size={20} />
                  </div>
                </div>
                <p className="font-serif text-3xl sm:text-4xl text-bark mt-4">{processingOrdersCount}</p>
                <p className="text-[11px] text-ink-light mt-2">
                  In Handcrafting & Packaging
                </p>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft group hover:border-rose/50 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Average Order Value</p>
                  <div className="p-2.5 rounded-full bg-moss/10 text-moss">
                    <CreditCard size={20} />
                  </div>
                </div>
                <p className="font-serif text-3xl sm:text-4xl text-bark mt-4">{formatPrice(aovRupees)}</p>
                <p className="text-[11px] text-ink-light mt-2">
                  Across {confirmedOrdersCount} confirmed orders
                </p>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="bg-linen p-6 rounded-atelier-panel border border-canvas-line shadow-soft group hover:border-rose/50 transition-all">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-ink-light font-semibold">Registered Patrons</p>
                  <div className="p-2.5 rounded-full bg-purple-100 text-purple-700">
                    <Users size={20} />
                  </div>
                </div>
                <p className="font-serif text-3xl sm:text-4xl text-bark mt-4">{totalCustomersCount}</p>
                <Link to="/admin/customers" className="text-[11px] text-rose hover:underline mt-2 inline-flex items-center gap-1 font-medium">
                  View Patrons CRM <ArrowRight size={12} />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 2. Recent Orders Feed & Studio Highlights */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Recent Orders List */}
          <div className="lg:col-span-8 bg-linen rounded-atelier-panel border border-canvas-line shadow-soft p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-canvas-line">
              <div>
                <h2 className="font-serif text-2xl text-bark">Recent Studio Orders</h2>
                <p className="text-xs text-ink-light mt-0.5">Real-time orders received through online checkout</p>
              </div>
              <Link to="/admin/orders" className="text-xs uppercase tracking-wider font-semibold text-rose hover:underline flex items-center gap-1">
                View All ({totalOrdersCount}) <ArrowRight size={14} />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="py-12 text-center text-ink-light text-xs italic">
                No orders received yet. Test orders will appear here automatically.
              </div>
            ) : (
              <div className="divide-y divide-canvas-line">
                {recentOrders.map((ord) => (
                  <div key={ord.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-canvas/30 transition-colors px-2 rounded">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-bark">{ord.order_number}</span>
                        <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded ${
                          ord.order_status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                          ord.order_status === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
                          ord.order_status === 'PROCESSING' || ord.order_status === 'PACKED' ? 'bg-amber-100 text-amber-800' :
                          'bg-canvas border border-canvas-line text-ink-light'
                        }`}>
                          {ord.order_status}
                        </span>
                      </div>
                      <p className="text-xs text-ink-light">
                        {ord.guest_name} • {new Date(ord.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-serif font-medium text-sm text-bark">{formatPrice(ord.total_in_paise / 100)}</p>
                      <Link to="/admin/orders" className="text-[11px] text-rose hover:underline inline-flex items-center gap-1">
                        Inspect <ExternalLink size={10} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts & Studio Highlights */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-linen rounded-atelier-panel border border-canvas-line shadow-soft p-6 space-y-4">
              <h3 className="font-serif text-lg text-bark">Studio Quick Access</h3>

              <div className="space-y-2.5">
                <Link
                  to="/admin/orders"
                  className="flex items-center justify-between p-3 rounded-sm bg-canvas/40 hover:bg-canvas border border-canvas-line text-xs font-medium text-bark transition-colors"
                >
                  <span className="flex items-center gap-2"><Truck size={16} className="text-rose" /> Orders & AWB Dispatch</span>
                  <ArrowRight size={14} className="text-ink-light" />
                </Link>

                <Link
                  to="/admin/customers"
                  className="flex items-center justify-between p-3 rounded-sm bg-canvas/40 hover:bg-canvas border border-canvas-line text-xs font-medium text-bark transition-colors"
                >
                  <span className="flex items-center gap-2"><Users size={16} className="text-rose" /> Patrons & Petal Points</span>
                  <ArrowRight size={14} className="text-ink-light" />
                </Link>

                <Link
                  to="/admin/coupons"
                  className="flex items-center justify-between p-3 rounded-sm bg-canvas/40 hover:bg-canvas border border-canvas-line text-xs font-medium text-bark transition-colors"
                >
                  <span className="flex items-center gap-2"><Ticket size={16} className="text-rose" /> Promo & Coupon Codes</span>
                  <ArrowRight size={14} className="text-ink-light" />
                </Link>

                <Link
                  to="/admin/assets"
                  className="flex items-center justify-between p-3 rounded-sm bg-canvas/40 hover:bg-canvas border border-canvas-line text-xs font-medium text-bark transition-colors"
                >
                  <span className="flex items-center gap-2"><Palette size={16} className="text-rose" /> Visuals & Photography</span>
                  <ArrowRight size={14} className="text-ink-light" />
                </Link>

                <Link
                  to="/admin/navigation"
                  className="flex items-center justify-between p-3 rounded-sm bg-canvas/40 hover:bg-canvas border border-canvas-line text-xs font-medium text-bark transition-colors"
                >
                  <span className="flex items-center gap-2"><GripVertical size={16} className="text-rose" /> Navigation Menu</span>
                  <ArrowRight size={14} className="text-ink-light" />
                </Link>
              </div>
            </div>

            {/* Inventory Distribution */}
            <div className="bg-linen rounded-atelier-panel border border-canvas-line shadow-soft p-6">
              <h3 className="font-serif text-lg text-bark mb-4">Catalog Essence</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b border-canvas-line">
                  <span className="text-ink-light">Total Cataloged Pieces</span>
                  <span className="font-serif font-medium text-bark text-sm">{products.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-canvas-line">
                  <span className="text-ink-light">Studio Choices (Bestsellers)</span>
                  <span className="font-serif font-medium text-rose text-sm">{products.filter(p => p.bestseller).length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-canvas-line">
                  <span className="text-ink-light">Customisable Floral Pieces</span>
                  <span className="font-serif font-medium text-bark text-sm">{products.filter(p => p.customisable).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-light">Made to Order Creations</span>
                  <span className="font-serif font-medium text-bark text-sm">{products.filter(p => p.madeToOrder).length}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Studio Catalog Management */}
        <section className="bg-linen rounded-atelier-panel border border-canvas-line shadow-soft overflow-hidden">
          <div className="p-6 border-b border-canvas-line bg-canvas/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-bark">Studio Pieces</h2>
              <p className="text-xs text-ink-light mt-0.5">Manage pricing, photographs, and floral descriptions.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-light" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search code/name..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>

              <button
                onClick={exportCatalogCSV}
                className="px-3 py-1.5 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all"
                title="Export catalog dataset to CSV"
              >
                <Download size={13} className="text-emerald-700" />
                Export CSV
              </button>

              <button
                onClick={() => setIsBulkImportOpen(true)}
                className="px-3 py-1.5 bg-linen border border-canvas-line text-xs font-medium text-bark hover:border-bark rounded-sm flex items-center gap-1.5 transition-all"
                title="Bulk import or update catalog from CSV"
              >
                <Upload size={13} className="text-rose" />
                Bulk Import
              </button>

              <Link
                to="/admin/editor"
                className="px-3.5 py-1.5 bg-ink text-white hover:bg-bark text-xs font-medium uppercase tracking-wider rounded-sm flex items-center gap-1.5 transition-all shadow-soft"
              >
                <Plus size={14} className="text-rose" />
                Add Piece
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-canvas/50 text-ink-light uppercase text-[10px] tracking-wider border-b border-canvas-line">
                  <th className="p-4">Piece</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Highlights</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-line">
                {filteredProducts.map((p) => (
                  <tr key={p.code} className="hover:bg-canvas/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-sm overflow-hidden bg-canvas flex-shrink-0">
                          <img
                            src={p.images?.[0] || 'https://images.pexels.com/photos/20269075/pexels-photo-20269075.jpeg'}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-serif font-medium text-bark text-sm">{p.name}</p>
                          <p className="font-mono text-[10px] text-ink-light">{p.code}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 text-ink capitalize">
                      {p.category}
                    </td>

                    <td className="p-4">
                      <span className="font-serif font-medium text-bark text-sm">{formatPrice(p.price)}</span>
                      {p.compareAtPrice && (
                        <span className="line-through text-ink-light text-[11px] ml-1.5">{formatPrice(p.compareAtPrice)}</span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {p.bestseller && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose/10 text-rose-deep font-semibold">Studio Choice</span>
                        )}
                        {p.customisable && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-moss/10 text-moss font-semibold">Custom</span>
                        )}
                        {p.madeToOrder && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-canvas border border-canvas-line text-ink-light">Made to order</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/editor?code=${p.code}`}
                          className="px-3 py-1.5 bg-canvas border border-canvas-line hover:border-bark text-bark rounded-sm transition-colors text-xs font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeleteProduct(p.code)}
                          disabled={isDeleting === p.code}
                          className="p-1.5 text-rose/60 hover:text-rose hover:bg-rose/10 rounded-sm transition-colors disabled:opacity-50"
                          title="Delete piece"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Two-Stage Bulk Catalog Import Modal */}
      <ProductBulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={async () => {
          await refreshProducts();
        }}
        existingProducts={products.map((p) => ({
          code: p.code,
          name: p.name,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          category: p.category,
        }))}
      />
    </AdminLayout>
  );
}
