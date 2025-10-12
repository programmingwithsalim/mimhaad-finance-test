/**
 * Dashboard Data Caching Utility
 * Client-side cache for dashboard statistics and frequently accessed data
 */

import { deduplicatedFetch } from "./request-deduplication";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 60 * 1000; // 1 minute for dashboard data

/**
 * Generate cache key
 */
function getCacheKey(endpoint: string, params?: Record<string, any>): string {
  if (!params) return endpoint;
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return `${endpoint}?${sortedParams}`;
}

/**
 * Check if cache entry is still valid
 */
function isValid(entry: CacheEntry<any>, ttl: number): boolean {
  return Date.now() - entry.timestamp < ttl;
}

/**
 * Get from cache
 */
export function getFromCache<T>(
  endpoint: string,
  params?: Record<string, any>,
  ttl: number = DEFAULT_TTL
): T | null {
  const key = getCacheKey(endpoint, params);
  const entry = cache.get(key);

  if (entry && isValid(entry, ttl)) {
    return entry.data as T;
  }

  // Clean up expired entry
  if (entry) {
    cache.delete(key);
  }

  return null;
}

/**
 * Set in cache
 */
export function setInCache<T>(
  endpoint: string,
  data: T,
  params?: Record<string, any>
): void {
  const key = getCacheKey(endpoint, params);
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear cache (all or specific endpoint)
 */
export function clearCache(endpoint?: string): void {
  if (endpoint) {
    // Clear all entries matching the endpoint
    for (const key of cache.keys()) {
      if (key.startsWith(endpoint)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
}

/**
 * Cached fetch with deduplication
 */
export async function cachedFetch<T>(
  endpoint: string,
  params?: Record<string, any>,
  options?: {
    ttl?: number;
    skipCache?: boolean;
  }
): Promise<T> {
  const ttl = options?.ttl || DEFAULT_TTL;

  // Check cache first (unless skipped)
  if (!options?.skipCache) {
    const cached = getFromCache<T>(endpoint, params, ttl);
    if (cached) {
      return cached;
    }
  }

  // Build URL with params
  let url = endpoint;
  if (params) {
    const queryString = Object.keys(params)
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&");
    url = `${endpoint}?${queryString}`;
  }

  // Fetch with deduplication
  const response = await deduplicatedFetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache the result
  setInCache(endpoint, data, params);

  return data;
}

/**
 * Get cache size (for debugging)
 */
export function getCacheSize(): number {
  return cache.size;
}



