import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Product } from '@/data/products';
import { trackEvent } from '@/utils/analytics';

interface WishlistContextValue {
  items: string[];
  toggleItem: (code: string) => void;
  isWishlisted: (code: string) => boolean;
  removeItem: (code: string) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);
const STORAGE_KEY = 'tpb-wishlist';

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const toggleItem = useCallback((code: string) => {
    setItems((prev) => {
      if (prev.includes(code)) {
        trackEvent('wishlist_remove', { code });
        return prev.filter((c) => c !== code);
      }
      trackEvent('wishlist_add', { code });
      return [...prev, code];
    });
  }, []);

  const isWishlisted = useCallback((code: string) => items.includes(code), [items]);

  const removeItem = useCallback((code: string) => {
    setItems((prev) => prev.filter((c) => c !== code));
  }, []);

  return (
    <WishlistContext.Provider value={{ items, toggleItem, isWishlisted, removeItem, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
