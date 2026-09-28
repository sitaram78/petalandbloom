import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import {
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  Loader2,
  Save,
  X,
  GripVertical
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import Reveal from '@/components/Reveal';
import { useNavigation } from '@/context/NavigationContext';
import { NavItem } from '@/context/NavigationContext';

export default function AdminNavigation() {
  const { navItems, loading, addNavItem, updateNavItem, deleteNavItem, refreshNavigation } = useNavigation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NavItem | null>(null);
  const [formData, setFormData] = useState<Omit<NavItem, 'id'>>({
    label: '',
    path: '',
    parent_id: null,
    order: 0,
    type: 'link',
  });
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('categories')
        .select('name, slug')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching categories in AdminNavigation:', error);
      } else if (data) {
        setCategories(data);
      }
    }
    fetchCategories();
  }, []);

  const handleOpenModal = (item?: NavItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        label: item.label,
        path: item.path || '',
        parent_id: item.parent_id,
        order: item.order,
        type: item.type,
      });
    } else {
      setEditingItem(null);
      setFormData({
        label: '',
        path: '',
        parent_id: null,
        order: navItems.length,
        type: 'link',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingItem) {
        await updateNavItem(editingItem.id, formData);
      } else {
        await addNavItem(formData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Error saving item: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item? This may affect site navigation.')) {
      return;
    }
    try {
      await deleteNavItem(id);
      await refreshNavigation();
    } catch (err: any) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <AdminLayout activePage="navigation">
        <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-rose" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="navigation">
      <main className="p-6 lg:p-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <Reveal>
            <div className="space-y-1">
              <h1 className="heading-serif text-5xl text-ink tracking-tight">Navigation Manager</h1>
              <p className="text-sm text-ink-light font-light italic">Architecting the journey through the Botanical Atelier.</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <button
              onClick={() => handleOpenModal()}
              className="btn-primary px-6 py-3 flex items-center justify-center gap-2 text-sm shadow-soft"
            >
              <Plus size={18} /> Add Menu Item
            </button>
          </Reveal>
        </header>

        <Reveal delay={200}>
          <div className="glass-panel rounded-sm border border-silk shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-silk/20 text-ink-light uppercase tracking-wider text-[10px] font-bold">
                  <tr className="border-b border-silk">
                    <th className="px-6 py-5 w-10"></th>
                    <th className="px-6 py-5">Label</th>
                    <th className="px-6 py-5">Path</th>
                    <th className="px-6 py-5">Type</th>
                    <th className="px-6 py-5 text-center">Order</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-silk">
                  {navItems.length > 0 ? (
                    navItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-silk/20 transition-colors group ${item.parent_id ? 'bg-canvas/20' : ''}`}
                        style={{ paddingLeft: item.parent_id ? '2rem' : '0' }}
                      >
                        <td className="px-6 py-4 text-center text-ink-light">
                          {item.parent_id && <ChevronRight size={14} />}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {item.parent_id && <span className="text-xs text-rose/50 font-light">↳</span>}
                            <span className="font-medium text-ink">{item.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-ink-light font-mono text-xs">{item.path || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            item.type === 'dropdown'
                              ? 'bg-rose/10 text-rose border-rose/20'
                              : 'bg-silk/20 text-ink-light border-silk/30'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-ink">{item.order}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenModal(item)}
                              className="p-2 text-ink-light hover:text-ink transition-colors"
                              title="Edit Item"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-ink-light hover:text-rose transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center text-ink-light">
                          <p className="font-serif text-xl mb-2">No navigation items found</p>
                          <p className="text-sm">Add your first menu item to get started.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <div className="relative bg-parchment-50 rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-6 py-4 border-b border-silk">
                <h3 className="font-serif text-xl text-ink">
                  {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-ink-light hover:text-ink">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink-light uppercase tracking-wider">Label</label>
                  <input
                    type="text"
                    required
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="input-field"
                    placeholder="e.g., Shop, About Us"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink-light uppercase tracking-wider">Link to Category (Optional)</label>
                  <select
                    onChange={(e) => {
                      const slug = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        path: slug ? `/shop?category=${slug}` : prev.path
                      }));
                    }}
                    className="input-field"
                    defaultValue=""
                  >
                    <option value="">-- Select a Category --</option>
                    {categories.map(cat => (
                      <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink-light uppercase tracking-wider">Path</label>
                  <input
                    type="text"
                    value={formData.path || ''}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    className="input-field"
                    placeholder="/shop or leave empty for dropdowns"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-ink-light uppercase tracking-wider">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'link' | 'dropdown' })}
                      className="input-field"
                    >
                      <option value="link">Link</option>
                      <option value="dropdown">Dropdown</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-ink-light uppercase tracking-wider">Order</label>
                    <input
                      type="number"
                      required
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink-light uppercase tracking-wider">Parent Item</label>
                  <select
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value || null })}
                    className="input-field"
                  >
                    <option value="">None (Top Level)</option>
                    {navItems
                      .filter(item => item.id !== editingItem?.id)
                      .map(item => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-sm text-ink-light hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="btn-primary px-6 py-2 flex items-center gap-2 text-sm"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    <Save size={16} />
                    {editingItem ? 'Update Item' : 'Create Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
