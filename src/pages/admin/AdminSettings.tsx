import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';
import AdminLayout from '@/components/AdminLayout';
import { removeCache } from '@/utils/cache';
import { CATEGORIES_CACHE } from '@/utils/cacheKeys';

interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

export default function AdminSettings() {
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState({ name: '', slug: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      notify('Error loading categories', { type: 'error' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function addCategory() {
    if (!newCategory.name || !newCategory.slug) {
      notify('Please fill in all fields', { type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          name: newCategory.name,
          slug: newCategory.slug,
          display_order: categories.length
        }])
        .select();

      if (error) {
        console.error('Supabase Insert Error (Detailed):', error);
        throw error;
      }

      if (!data || data.length === 0) {
        notify('Category not saved. Please check database permissions.', { type: 'error' });
        setSaving(false);
        return;
      }
      removeCache(CATEGORIES_CACHE);
      setNewCategory({ name: '', slug: '' });
      await fetchData();
      notify('Category added successfully', { type: 'success' });
    } catch (err: any) {
      console.error('addCategory catch block:', err);
      notify(`Failed to add category: ${err.message}`, { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      removeCache(CATEGORIES_CACHE);
      await fetchData();
      notify('Category removed', { type: 'success' });
    } catch (err: any) {
      console.error('deleteCategory catch:', err);
      notify(`Failed to remove category: ${err.message}`, { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout activePage="settings">
        <div className="flex items-center justify-center min-h-screen bg-parchment-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-rose" />
            <p className="text-sm text-ink-light animate-pulse">Loading Categories...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="settings">
      <div className="p-6 md:p-10 bg-parchment-50 min-h-screen">
        <div className="max-w-3xl mx-auto">
          <header className="mb-12">
            <h1 className="heading-serif text-4xl text-ink mb-2">Category Manager</h1>
            <p className="text-ink-light font-light">Manage your boutique's product groupings and catalog structure.</p>
          </header>

          <section className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-ink flex items-center gap-2">
                <div className="w-1.5 h-6 bg-rose rounded-full" />
                Product Categories
              </h2>
            </div>

            {/* Add Category Form */}
            <div className="bg-white p-6 rounded-sm border border-silk shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-ink-light font-bold">Display Name</label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                    placeholder="e.g. Hair Accessories"
                    className="w-full px-3 py-2 text-sm border border-silk focus:border-rose outline-none transition-colors rounded-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-ink-light font-bold">Slug (URL)</label>
                  <input
                    type="text"
                    value={newCategory.slug}
                    onChange={e => setNewCategory({...newCategory, slug: e.target.value})}
                    placeholder="e.g. hair-accessories"
                    className="w-full px-3 py-2 text-sm border border-silk focus:border-rose outline-none transition-colors rounded-sm"
                  />
                </div>
              </div>
              <button
                onClick={addCategory}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2 bg-ink text-parchment-50 hover:bg-ink/90 transition-colors text-sm font-medium disabled:opacity-50 rounded-sm"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Add Category
              </button>
            </div>

            {/* Category List */}
            <div className="space-y-3">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-4 bg-white border border-silk rounded-sm hover:border-rose/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <GripVertical size={16} className="text-silk group-hover:text-ink-light cursor-grab" />
                    <div>
                      <p className="text-sm font-medium text-ink">{cat.name}</p>
                      <p className="text-xs text-ink-light opacity-60">/{cat.slug}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="p-2 text-ink-light hover:text-rose transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-silk rounded-sm">
                  <AlertCircle className="mx-auto text-silk mb-2" size={24} />
                  <p className="text-sm text-ink-light">No categories found.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
