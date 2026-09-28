import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Upload,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Sparkles,
  Package,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useProducts } from '@/context/ProductContext';
import Reveal from '@/components/Reveal';
import AdminLayout from '@/components/AdminLayout';
import { formatPrice } from '@/data/products';
import { occasions } from '@/data/site';

interface ProductForm {
  name: string;
  code: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  longDescription?: string;
  bestseller: boolean;
  featured: boolean;
  customisable: boolean;
  madeToOrder: boolean;
  images: string[];
  occasions: string[];
  recipients: string[];
  colors: string[];
  whatsIncluded: string[];
  preparationDays?: string;
  bouquetSize?: string;
}

// Internal Live Preview Component
function ProductPreview({ product }: { product: ProductForm }) {
  return (
    <div className="sticky top-10 space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-light mb-2">
        <Sparkles size={14} className="text-rose" /> Live Studio Preview
      </div>
      <div className="bg-parchment-50 rounded-sm border border-silk shadow-soft overflow-hidden transition-all duration-500">
        <div className="aspect-[4/5] bg-silk relative">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink-light/30">
              <ImageIcon size={48} />
            </div>
          )}
          {product.bestseller && (
            <div className="absolute top-3 left-3 bg-ink text-parchment-50 text-[8px] uppercase tracking-widest px-2 py-1 rounded-sm font-medium">
              Studio Choice
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-rose font-medium">{product.code || 'CODE-000'}</p>
          <h3 className="heading-serif text-xl text-ink">{product.name || 'Untitled Piece'}</h3>
          <p className="text-sm text-ink-light line-clamp-2 font-light">{product.description || 'No description provided...'}</p>
          <div className="flex items-center justify-between pt-2 border-t border-silk">
            <div>
              <span className="font-serif text-lg text-ink">{formatPrice(product.price)}</span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="ml-2 text-xs text-ink-light line-through">{formatPrice(product.compareAtPrice)}</span>
              )}
            </div>
            <span className="text-[10px] text-ink-light uppercase tracking-tighter">{product.category}</span>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-center text-ink-light italic opacity-60">
        This is a conceptual preview of the piece as it appears in the gallery.
      </p>
    </div>
  );
}

export default function AdminEditor() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loading: contextLoading, refreshProducts } = useProducts();

  const codeParam = searchParams.get('code');
  const isEditMode = !!codeParam;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [form, setForm] = useState<ProductForm>({
    name: '',
    code: '',
    category: 'flowers',
    price: 0,
    compareAtPrice: undefined,
    description: '',
    longDescription: '',
    bestseller: false,
    featured: false,
    customisable: false,
    madeToOrder: false,
    images: [''],
    occasions: [''],
    recipients: [''],
    colors: [''],
    whatsIncluded: [''],
    preparationDays: '3-5 days',
    bouquetSize: '',
  });

  useEffect(() => {
    async function fetchCategories() {
      setCategoriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('name, slug')
          .order('display_order', { ascending: true });

        if (!error && data) {
          setCategories(data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setCategoriesLoading(false);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (isEditMode && codeParam) {
      async function loadProduct() {
        try {
          const { data, error: fetchError } = await supabase
            .from('products')
            .select('*')
            .eq('code', codeParam)
            .single();

          if (fetchError) throw fetchError;
          if (data) {
            setForm({
              name: data.name || '',
              code: data.code || '',
              category: data.category || 'flowers',
              price: data.price || 0,
              compareAtPrice: data.compare_at_price || undefined,
              description: data.description || '',
              longDescription: data.long_description || '',
              bestseller: !!data.bestseller,
              featured: !!data.featured,
              customisable: !!data.customisable,
              madeToOrder: !!data.made_to_order,
              images: Array.isArray(data.images) ? data.images : [''],
              occasions: Array.isArray(data.occasions) ? data.occasions : [''],
              recipients: Array.isArray(data.recipients) ? data.recipients : [''],
              colors: Array.isArray(data.colors) ? data.colors : [''],
              whatsIncluded: Array.isArray(data.whats_included) ? data.whats_included : [''],
              preparationDays: data.preparation_days || '3-5 days',
              bouquetSize: data.bouquet_size || '',
            });
          }
        } catch (err: any) {
          setError(`Failed to load product: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
      loadProduct();
    } else {
      setLoading(false);
    }
  }, [codeParam, isEditMode]);

  const handleInputChange = (field: keyof ProductForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayChange = (field: 'images' | 'occasions' | 'recipients' | 'colors' | 'whatsIncluded', index: number, value: string) => {
    const newArray = [...form[field]];
    newArray[index] = value;
    setForm(prev => ({ ...prev, [field]: newArray }));
  };

  const addArrayItem = (field: 'images' | 'occasions' | 'recipients' | 'colors' | 'whatsIncluded') => {
    setForm(prev => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeArrayItem = (field: 'images' | 'occasions' | 'recipients' | 'colors' | 'whatsIncluded', index: number) => {
    const newArray = form[field].filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, [field]: newArray }));
  };

  const uploadImage = async (index: number, file: File) => {
    setUploading(`${index}`);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const newImages = [...form.images];
      newImages[index] = publicUrl;
      setForm(prev => ({ ...prev, images: newImages }));
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setIsSaved(false);

    try {
      if (form.compareAtPrice !== undefined && form.compareAtPrice <= form.price) {
        throw new Error('Compare-at price must be higher than the selling price.');
      }

      const payload = {
        name: form.name,
        code: form.code,
        category: form.category,
        price: form.price,
        compare_at_price: form.compareAtPrice || null,
        description: form.description,
        long_description: form.longDescription,
        bestseller: form.bestseller,
        featured: form.featured,
        customisable: form.customisable,
        made_to_order: form.madeToOrder,
        images: form.images.filter(img => img !== ''),
        occasions: form.occasions.filter(o => o !== ''),
        colors: form.colors.filter(c => c !== ''),
        whats_included: form.whatsIncluded.filter(w => w !== ''),
        preparation_days: form.preparationDays,
        bouquet_size: form.bouquetSize,
      };

      if (isEditMode) {
        const { error: updateError, data: updateData } = await supabase
          .from('products')
          .update(payload)
          .eq('code', codeParam)
          .select();
        if (updateError) {
          console.error('Supabase Update Error:', updateError);
          throw updateError;
        }
        if (!updateData || updateData.length === 0) {
          console.warn('Update request sent, but 0 rows were changed. Check RLS policies.');
          throw new Error('Product was not updated. Check database permissions.');
        }
        await refreshProducts();
      } else {
        const { error: insertError, data: insertData } = await supabase
          .from('products')
          .insert([payload])
          .select();
        if (insertError) {
          console.error('Supabase Insert Error:', insertError);
          throw insertError;
        }
        if (!insertData || insertData.length === 0) {
          console.warn('Insert request sent, but no data returned. Check RLS policies.');
          throw new Error('Product was not saved. Check database permissions.');
        }
        await refreshProducts();
      }

      setIsSaved(true);
      // Give the user a moment to see the "Saved" state before navigating
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout activePage="editor">
        <div className="min-h-screen bg-parchment-50 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-rose" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="editor">
      <main className="p-6 lg:p-10">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2 hover:bg-silk rounded-full transition-colors text-ink-light hover:text-ink"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="heading-serif text-4xl text-ink">
                {isEditMode ? 'Edit Botanical Piece' : 'Create New Piece'}
              </h1>
              <p className="text-sm text-ink-light font-light">
                {isEditMode ? `Refining ${form.code}` : 'Adding a new exhibit to the studio collection.'}
              </p>
            </div>
          </div>
        </header>

        <form onSubmit={saveProduct} className="max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Editor Sections */}
          <div className="lg:col-span-8 space-y-10">
            <Reveal>
              <section className="glass-panel p-8 rounded-sm border border-silk shadow-soft space-y-6">
                <h3 className="heading-serif text-2xl text-ink mb-6 flex items-center gap-2">
                  <ImageIcon size={24} className="text-rose" /> Essential Identity
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Product Name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="input-field"
                      placeholder="e.g. Midnight Rose Bouquet"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Product Code (SKU)</label>
                    <input
                      type="text"
                      required
                      disabled={isEditMode}
                      value={form.code}
                      onChange={(e) => handleInputChange('code', e.target.value)}
                      className="input-field disabled:bg-silk/30"
                      placeholder="e.g. BR-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="input-field appearance-none"
                    >
                      {categoriesLoading ? (
                        <option value="">Loading categories...</option>
                      ) : categories.length > 0 ? (
                        categories.map(cat => (
                          <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                        ))
                      ) : (
                        <option value="">No categories found</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Price (INR)</label>
                    <input
                      type="number"
                      required
                      value={form.price}
                      onChange={(e) => handleInputChange('price', Number(e.target.value))}
                      className="input-field"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Compare-at Price (INR)</label>
                    <input
                      type="number"
                      min={form.price || 0}
                      value={form.compareAtPrice ?? ''}
                      onChange={(e) => handleInputChange('compareAtPrice', e.target.value ? Number(e.target.value) : undefined)}
                      className="input-field"
                      placeholder="Optional legitimate reference price"
                    />
                    {form.compareAtPrice && form.compareAtPrice > form.price && (
                      <p className="text-xs text-rose">
                        {Math.round(((form.compareAtPrice - form.price) / form.compareAtPrice) * 100)}% off
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Short Description</label>
                  <textarea
                    required
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="input-field h-24 resize-none"
                    placeholder="A brief, evocative description..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Detailed Narrative (Optional)</label>
                  <textarea
                    value={form.longDescription}
                    onChange={(e) => handleInputChange('longDescription', e.target.value)}
                    className="input-field h-32 resize-none"
                    placeholder="The story behind the piece, materials used, etc."
                  />
                </div>
              </section>
            </Reveal>

            <Reveal delay={100}>
              <section className="glass-panel p-8 rounded-sm border border-silk shadow-soft space-y-8">
                <h3 className="heading-serif text-2xl text-ink mb-6 flex items-center gap-2">
                  <Package size={24} className="text-rose" /> Gallery & Curation
                </h3>

                {/* Images */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-ink font-medium">Images</label>
                    <button
                      type="button"
                      onClick={() => addArrayItem('images')}
                      className="text-xs text-rose hover:text-rose-dark font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Image
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {form.images.map((img, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-silk/20 rounded-sm border border-silk/50">
                        <div className="w-12 h-12 bg-silk rounded-sm overflow-hidden flex-shrink-0">
                          {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="m-auto h-full w-full p-2 opacity-30" />}
                        </div>
                        <input
                          type="text"
                          value={img}
                          onChange={(e) => handleArrayChange('images', i, e.target.value)}
                          className="input-field flex-1 text-sm py-2"
                          placeholder="Image URL"
                        />
                        <label className="cursor-pointer p-2 text-ink-light hover:text-ink transition-colors">
                          <Upload size={18} />
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && uploadImage(i, e.target.files[0])}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeArrayItem('images', i)}
                          className="p-2 text-ink-light hover:text-rose transition-colors"
                        >
                          <X size={18} />
                        </button>
                        {uploading === `${i}` && <Loader2 size={18} className="animate-spin text-rose" />}
                      </div>
                    ))}\n                  </div>
                </div>

                {/* Occasions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-ink font-medium">Occasions</label>
                    <button
                      type="button"
                      onClick={() => addArrayItem('occasions')}
                      className="text-xs text-rose hover:text-rose-dark font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Occasion
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {form.occasions.map((occ, i) => (
                      <div key={i} className="flex items-center gap-2 bg-silk/20 border border-silk rounded-sm px-2 py-1">
                        <select
                          value={occ}
                          onChange={(e) => handleArrayChange('occasions', i, e.target.value)}
                          className="bg-transparent text-sm py-1 focus:outline-none w-32 appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-parchment-50 text-ink">Select Occasion...</option>
                          {occasions.map((o) => (
                            <option key={o.filter} value={o.filter} className="bg-parchment-50 text-ink">
                              {o.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeArrayItem('occasions', i)}
                          className="text-ink-light hover:text-rose"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}\n                  </div>
                </div>

                {/* Recipients */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-ink font-medium">Ideal For</label>
                    <button
                      type="button"
                      onClick={() => addArrayItem('recipients')}
                      className="text-xs text-rose hover:text-rose-dark font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Recipient
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {form.recipients.map((recipient, i) => (
                      <div key={i} className="flex items-center gap-2 bg-silk/20 border border-silk rounded-sm px-2 py-1">
                        <select
                          value={recipient}
                          onChange={(e) => handleArrayChange('recipients', i, e.target.value)}
                          className="bg-transparent text-sm py-1 focus:outline-none w-32 appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-parchment-50 text-ink">Select Recipient...</option>
                          {['Partner', 'Friend', 'Mother', 'Sibling', 'Colleague', 'Other'].map((option) => (
                            <option key={option} value={option} className="bg-parchment-50 text-ink">
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeArrayItem('recipients', i)}
                          className="text-ink-light hover:text-rose"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-ink font-medium">Available Hues</label>
                    <button
                      type="button"
                      onClick={() => addArrayItem('colors')}
                      className="text-xs text-rose hover:text-rose-dark font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Color
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {form.colors.map((color, i) => (
                      <div key={i} className="flex items-center gap-2 bg-silk/20 border border-silk rounded-sm px-2 py-1">
                        <input
                          type="text"
                          value={color}
                          onChange={(e) => handleArrayChange('colors', i, e.target.value)}
                          className="bg-transparent text-sm py-1 focus:outline-none w-32"
                          placeholder="Color..."
                        />
                        <button
                          type="button"
                          onClick={() => removeArrayItem('colors', i)}
                          className="text-ink-light hover:text-rose"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}\n                  </div>
                </div>

                {/* What's Included */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-wider text-ink font-medium">What's Included</label>
                    <button
                      type="button"
                      onClick={() => addArrayItem('whatsIncluded')}
                      className="text-xs text-rose hover:text-rose-dark font-medium flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {form.whatsIncluded.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 bg-silk/20 border border-silk rounded-sm px-2 py-1">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleArrayChange('whatsIncluded', i, e.target.value)}
                          className="bg-transparent text-sm py-1 focus:outline-none flex-1"
                          placeholder="Included item..."
                        />
                        <button
                          type="button"
                          onClick={() => removeArrayItem('whatsIncluded', i)}
                          className="text-ink-light hover:text-rose"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}\n                  </div>
                </div>
              </section>
            </Reveal>

            <Reveal delay={200}>
              <section className="glass-panel p-8 rounded-sm border border-silk shadow-soft space-y-8">
                <h3 className="heading-serif text-2xl text-ink mb-6 flex items-center gap-2">
                  <Sparkles size={24} className="text-rose" /> Studio Attributes
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.bestseller}
                        onChange={(e) => handleInputChange('bestseller', e.target.checked)}
                        className="w-4 h-4 accent-rose rounded-sm"
                      />
                      <span className="text-sm text-ink group-hover:text-rose transition-colors">Mark as Studio Choice</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => handleInputChange('featured', e.target.checked)}
                        className="w-4 h-4 accent-rose rounded-sm"
                      />
                      <span className="text-sm text-ink group-hover:text-rose transition-colors">Featured in Collection</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.customisable}
                        onChange={(e) => handleInputChange('customisable', e.target.checked)}
                        className="w-4 h-4 accent-rose rounded-sm"
                      />
                      <span className="text-sm text-ink group-hover:text-rose transition-colors">Customisation Available</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={form.madeToOrder}
                        onChange={(e) => handleInputChange('madeToOrder', e.target.checked)}
                        className="w-4 h-4 accent-rose rounded-sm"
                      />
                      <span className="text-sm text-ink group-hover:text-rose transition-colors">Made to Order</span>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Preparation Window</label>
                      <input
                        type="text"
                        value={form.preparationDays}
                        onChange={(e) => handleInputChange('preparationDays', e.target.value)}
                        className="input-field"
                        placeholder="e.g. 3-5 days"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs uppercase tracking-wider text-ink font-medium ml-1">Bouquet Size / Scale</label>
                      <input
                        type="text"
                        value={form.bouquetSize}
                        onChange={(e) => handleInputChange('bouquetSize', e.target.value)}
                        className="input-field"
                        placeholder="e.g. Medium (12-15 stems)"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </Reveal>

            <div className="flex items-center justify-between pt-6 border-t border-silk">
              {error && (
                <div className="flex items-center gap-2 text-rose text-sm font-medium">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div className="flex items-center gap-4 ml-auto">
                <button
                  type="button"
                  onClick={() => navigate('/admin/dashboard')}
                  className="px-6 py-3 text-sm text-ink-light hover:text-ink transition-colors font-medium"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  disabled={saving || isSaved}
                  className={`px-8 py-3 flex items-center gap-2 text-sm shadow-soft transition-all duration-500 ${
                    isSaved
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'btn-primary'
                  } disabled:opacity-50`}
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : isSaved ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Save size={18} />
                  )}
                  {saving ? 'Saving to Atelier...' : isSaved ? 'Saved' : 'Save Piece'}
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-4">
            <ProductPreview product={form} />
          </div>
        </form>
      </main>
    </AdminLayout>
  );
}
