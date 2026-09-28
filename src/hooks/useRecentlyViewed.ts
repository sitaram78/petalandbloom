import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'tpb-recently-viewed';
const MAX_ITEMS = 8;

export function useRecentlyViewed() {
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecentCodes(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  const addRecentlyViewed = useCallback((code: string) => {
    setRecentCodes((prev) => {
      const filtered = prev.filter((c) => c !== code);
      const updated = [code, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }, []);

  return { recentCodes, addRecentlyViewed };
}
