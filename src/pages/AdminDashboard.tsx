import { useState } from 'react';
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
  Truck
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useProducts } from '@/context/ProductContext';
import Reveal from '@/components/Reveal';
import AdminLayout from '@/components/AdminLayout';

export default function AdminDashboard() {
  const { products, loading, refreshProducts } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filteredProducts = products.filter(p => {
    const name = p.name?.toLowerCase() || '';
    const code = p.code?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  const handleDeleteProduct = async (code: string) => {
    if (!confirm(`Are you sure you want to delete product ${code}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(code);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('code', code);

      if (error) throw error;
      await refreshProducts();
    } catch (err: any) {
      alert(`Error deleting product: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
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
      <main className="p-6 lg:p-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <Reveal>
            <div className="space-y-1">
              <h1 className="heading-serif text-5xl text-ink tracking-tight">Studio Inventory</h1>
              <p className="text-sm text-ink-light font-light italic">Curating the botanical essence of the atelier.</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
              <Link
                to="/admin/orders"
                className="btn-secondary w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 text-sm shadow-soft text-bark hover:text-rose"
              >
                <Truck size={18} /> Orders & Logistics
              </Link>
              <Link
                to="/admin/assets"
                className="btn-secondary w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 text-sm shadow-soft"
              >
                <Palette size={18} /> Studio Visuals
              </Link>
              <Link
                to="/admin/navigation"
                className="btn-secondary w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 text-sm shadow-soft"
              >
                <GripVertical size={18} /> Navigation
              </Link>
              <Link
                to="/admin/editor"
                className="btn-primary w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2 text-sm shadow-soft"
              >
                <Plus size={18} /> Create New Piece
              </Link>
            </div>
          </Reveal>
        </header>

        {/* Studio Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
          <Reveal>
            <div className="glass-panel p-8 rounded-sm border border-silk shadow-soft flex items-center gap-6 transition-all duration-500 hover:-translate-y-1 group">
              <div className="p-4 bg-rose/10 rounded-full text-rose transition-colors group-hover:bg-rose group-hover:text-white">
                <Package size={28} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-light font-bold mb-1">Total Pieces</p>
                <p className="heading-serif text-4xl text-ink">{products.length}</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="glass-panel p-8 rounded-sm border border-silk shadow-soft flex items-center gap-6 transition-all duration-500 hover:-translate-y-1 group">
              <div className="p-4 bg-sage/10 rounded-full text-sage-dark transition-colors group-hover:bg-sage group-hover:text-white">
                <Palette size={28} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-light font-bold mb-1">Customisable</p>
                <p className="heading-serif text-4xl text-ink">
                  {products.filter(p => p.customisable).length}
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="glass-panel p-8 rounded-sm border border-silk shadow-soft flex items-center gap-6 transition-all duration-500 hover:-translate-y-1 group">
              <div className="p-4 bg-gold/10 rounded-full text-gold-600 transition-colors group-hover:bg-gold-500 group-hover:text-white">
                <Star size={28} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-light font-bold mb-1">Studio Choices</p>
                <p className="heading-serif text-4xl text-ink">
                  {products.filter(p => p.bestseller).length}
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Product List */}
        <Reveal delay={300}>
          <div className="glass-panel rounded-sm border border-silk shadow-soft overflow-hidden">
            <div className="p-6 border-b border-silk bg-silk/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or code..."
                  className="input-field pl-10 w-full text-sm"
                />
              </div>
              <div className="text-xs text-ink-light font-medium italic">
                Showing {filteredProducts.length} of {products.length} pieces
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-silk/20 text-ink-light uppercase tracking-wider text-[10px] font-bold">
                  <tr className="border-b border-silk">
                    <th className="px-6 py-5">Piece</th>
                    <th className="px-6 py-5">Category</th>
                    <th className="px-6 py-5">Price</th>
                    <th className="px-6 py-5 text-center">Status</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silk">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <tr key={p.code} className="hover:bg-silk/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <img src={p.images[0]} alt={p.name} className="w-12 h-12 rounded-sm object-cover bg-silk shadow-sm" />
                            <div className="truncate max-w-[200px]">
                              <p className="font-medium text-ink truncate group-hover:text-rose transition-colors">{p.name}</p>
                              <p className="text-[10px] text-ink-light uppercase tracking-wider">{p.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-ink-light capitalize font-light">{p.category}</td>
                        <td className="px-6 py-4 font-medium text-ink">₹{p.price}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            {p.bestseller && (
                              <span className="px-2 py-0.5 rounded-full bg-rose/10 text-rose text-[9px] font-bold uppercase border border-rose/20">Choice</span>
                            )}
                            {p.customisable && (
                              <span className="px-2 py-0.5 rounded-full bg-sage/10 text-sage-dark text-[9px] font-bold uppercase border border-sage/20">Custom</span>
                            )}
                            {!p.bestseller && !p.customisable && (
                              <span className="px-2 py-0.5 rounded-full bg-silk/20 text-ink-light text-[9px] font-bold uppercase border border-silk/30">Standard</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              to={`/admin/editor?code=${p.code}`}
                              className="p-2 text-ink-light hover:text-ink transition-colors"
                              title="Edit Piece"
                            >
                              <ArrowRight size={18} />
                            </Link>
                            <button
                              onClick={() => handleDeleteProduct(p.code)}
                              disabled={isDeleting === p.code}
                              className="p-2 text-ink-light hover:text-rose transition-colors disabled:opacity-50"
                              title="Delete Piece"
                            >
                              {isDeleting === p.code ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center text-ink-light">
                          <Package size={40} strokeWidth={1} className="mb-4 opacity-30" />
                          <p className="font-serif text-xl mb-2">No pieces found</p>
                          <p className="text-sm">Adjust your search or create a new piece.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </main>
    </AdminLayout>
  );
}
