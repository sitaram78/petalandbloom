import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Product } from '@/data/products';

interface ProductContextType {
  products: Product[];
  loading: boolean;
  error: string | null;
  getProductByCode: (code: string) => Product | undefined;
  getBestsellers: () => Product[];
  getFeatured: () => Product[];
  refreshProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error: supabaseError } = await supabase
        .from('products')
        .select('*');

      if (supabaseError) throw supabaseError;

      const mappedProducts = (data || []).map(p => ({
        code: p.code,
        name: p.name || 'Unnamed Piece',
        category: p.category_slug || p.category || 'flowers',
        price: p.price_in_paise !== undefined && p.price_in_paise !== null
          ? Math.round(p.price_in_paise / 100)
          : (p.price || 0),
        compareAtPrice: p.compare_at_price_in_paise !== undefined && p.compare_at_price_in_paise !== null
          ? Math.round(p.compare_at_price_in_paise / 100)
          : (p.compare_at_price || undefined),
        description: p.description || '',
        longDescription: p.long_description || '',
        colors: Array.isArray(p.colors) ? p.colors : [],
        occasions: Array.isArray(p.occasions) ? p.occasions : [],
        recipients: Array.isArray(p.recipients) ? p.recipients : [],
        whatsIncluded: Array.isArray(p.whats_included) ? p.whats_included : [],
        bestseller: !!(p.is_bestseller ?? p.bestseller),
        featured: !!(p.is_featured ?? p.featured),
        madeToOrder: !!(p.is_made_to_order ?? p.made_to_order),
        customisable: !!(p.is_customisable ?? p.customisable),
        images: Array.isArray(p.images) ? p.images : [],
        bouquetSize: p.bouquet_size || '',
      }));

      setProducts(mappedProducts);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const getProductByCode = (code: string) => {
    if (!code) return undefined;
    const normalizedCode = code.trim().toLowerCase();
    return products.find(p => p.code?.trim().toLowerCase() === normalizedCode);
  };
  const getBestsellers = () => products.filter(p => p.bestseller);
  const getFeatured = () => products.filter(p => p.featured);

  const refreshProducts = async () => {
    await fetchProducts();
  };

  return (
    <ProductContext.Provider value={{
      products,
      loading,
      error,
      getProductByCode,
      getBestsellers,
      getFeatured,
      refreshProducts
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
}
