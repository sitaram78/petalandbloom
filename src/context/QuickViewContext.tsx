import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Product } from '@/data/products';
import QuickView from '@/components/QuickView';

interface QuickViewContextValue {
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;
}

const QuickViewContext = createContext<QuickViewContextValue | undefined>(undefined);

export function QuickViewProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product | null>(null);

  const openQuickView = useCallback((p: Product) => setProduct(p), []);
  const closeQuickView = useCallback(() => setProduct(null), []);

  return (
    <QuickViewContext.Provider value={{ openQuickView, closeQuickView }}>
      {children}
      <QuickView product={product} onClose={closeQuickView} />
    </QuickViewContext.Provider>
  );
}

export function useQuickView() {
  const ctx = useContext(QuickViewContext);
  if (!ctx) throw new Error('useQuickView must be used within QuickViewProvider');
  return ctx;
}
