export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  const item: CacheItem<T> = {
    data,
    timestamp: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(item));
}

export function getCache<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  const itemStr = localStorage.getItem(key);
  if (!itemStr) return null;

  try {
    const item: CacheItem<T> = JSON.parse(itemStr);
    const isExpired = Date.now() - item.timestamp > ttl;

    if (isExpired) {
      localStorage.removeItem(key);
      return null;
    }

    return item.data;
  } catch (e) {
    console.error(`Error parsing cache for key ${key}:`, e);
    return null;
  }
}

export function removeCache(key: string): void {
  localStorage.removeItem(key);
}

export function clearAllCache(): void {
  // Only clear keys that we manage to avoid breaking other things
  const keysToRemove = ['products_cache', 'site_assets_cache', 'nav_links_cache', 'categories_cache'];
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
