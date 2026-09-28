import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { trackEvent } from '@/utils/analytics';

interface WishlistContextValue {
  items: string[];
  toggleItem: (code: string) => void;
  isWishlisted: (code: string) => boolean;
  removeItem: (code: string) => void;
  count: number;
  syncing: boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);
const STORAGE_KEY = 'tpb-wishlist';
const SYNC_CHANNEL = 'tpb_wishlist_sync';

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [syncing, setSyncing] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Broadcast channel for multi-tab synchronization
  useEffect(() => {
    try {
      const bc = new BroadcastChannel(SYNC_CHANNEL);
      channelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data && Array.isArray(event.data.items)) {
          setItems(event.data.items);
        }
      };
      return () => {
        bc.close();
      };
    } catch {
      /* BroadcastChannel not supported in environment */
    }
  }, []);

  // Save to localStorage and broadcast whenever items change
  const broadcastItems = (newItems: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
      channelRef.current?.postMessage({ items: newItems });
    } catch {
      /* ignore */
    }
  };

  // Cloud Sync on Auth Login / User Change
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const syncCloudWishlist = async () => {
      setSyncing(true);
      try {
        // 1. Fetch Cloud Wishlist from Supabase
        const { data: cloudData, error } = await supabase
          .from('customer_wishlists')
          .select('product_code')
          .eq('customer_id', user.id);

        if (error) {
          console.warn('[Wishlist Cloud Sync] Error fetching wishlist:', error.message);
          return;
        }

        const cloudItems: string[] = (cloudData || []).map((row: any) => row.product_code);

        // 2. Read local guest items
        const localStored = localStorage.getItem(STORAGE_KEY);
        const localItems: string[] = localStored ? JSON.parse(localStored) : [];

        // 3. Merge unique items
        const mergedSet = new Set<string>([...cloudItems, ...localItems]);
        const mergedList = Array.from(mergedSet);

        // 4. If there were local items not yet in cloud, upload them
        const missingInCloud = localItems.filter((code) => !cloudItems.includes(code));
        if (missingInCloud.length > 0) {
          const toInsert = missingInCloud.map((code) => ({
            customer_id: user.id,
            product_code: code,
          }));

          await supabase.from('customer_wishlists').upsert(toInsert, {
            onConflict: 'customer_id,product_code',
          });
        }

        if (isMounted) {
          setItems(mergedList);
          broadcastItems(mergedList);
        }
      } catch (err) {
        console.warn('[Wishlist Cloud Sync] Unexpected error:', err);
      } finally {
        if (isMounted) setSyncing(false);
      }
    };

    syncCloudWishlist();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const toggleItem = useCallback(
    async (code: string) => {
      const isAlreadyIn = items.includes(code);
      const nextItems = isAlreadyIn ? items.filter((c) => c !== code) : [...items, code];

      // Optimistic local update
      setItems(nextItems);
      broadcastItems(nextItems);

      if (isAlreadyIn) {
        trackEvent('wishlist_remove', { code });
      } else {
        trackEvent('wishlist_add', { code });
      }

      // Sync to Cloud if authenticated
      if (user) {
        try {
          if (isAlreadyIn) {
            await supabase
              .from('customer_wishlists')
              .delete()
              .eq('customer_id', user.id)
              .eq('product_code', code);
          } else {
            await supabase.from('customer_wishlists').upsert(
              {
                customer_id: user.id,
                product_code: code,
              },
              { onConflict: 'customer_id,product_code' }
            );
          }
        } catch (err) {
          console.warn('[Wishlist Cloud Toggle Error]:', err);
        }
      }
    },
    [items, user]
  );

  const isWishlisted = useCallback((code: string) => items.includes(code), [items]);

  const removeItem = useCallback(
    async (code: string) => {
      const nextItems = items.filter((c) => c !== code);
      setItems(nextItems);
      broadcastItems(nextItems);
      trackEvent('wishlist_remove', { code });

      if (user) {
        try {
          await supabase
            .from('customer_wishlists')
            .delete()
            .eq('customer_id', user.id)
            .eq('product_code', code);
        } catch (err) {
          console.warn('[Wishlist Cloud Remove Error]:', err);
        }
      }
    },
    [items, user]
  );

  return (
    <WishlistContext.Provider
      value={{
        items,
        toggleItem,
        isWishlisted,
        removeItem,
        count: items.length,
        syncing,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
