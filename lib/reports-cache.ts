/**
 * Client-side cache for reports data to reduce redundant API calls
 * Cache duration: 2 minutes for fresh data, prevents excessive refetching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
const cache = new Map<string, CacheEntry<any>>();

export function getCacheKey(
  endpoint: string,
  params: Record<string, string | undefined>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return `${endpoint}?${sortedParams}`;
}

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setInCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    key,
  });
}

export function clearCache(): void {
  cache.clear();
}

export function clearCacheForEndpoint(endpoint: string): void {
  for (const [key] of cache) {
    if (key.startsWith(endpoint)) {
      cache.delete(key);
    }
  }
}

// Automatically clear cache when date range or branch changes
export function invalidateCacheOnChange(
  dateRange: { from: Date; to: Date },
  branch: string
): void {
  const cacheKeys = Array.from(cache.keys());
  for (const key of cacheKeys) {
    cache.delete(key);
  }
}
