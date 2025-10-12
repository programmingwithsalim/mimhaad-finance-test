import { useState, useCallback, useRef } from "react";
import {
  getCacheKey,
  getFromCache,
  setInCache,
  clearCache,
} from "@/lib/reports-cache";
import { format } from "date-fns";

interface UseReportsCacheOptions {
  dateRange: {
    from: Date;
    to: Date;
  };
  branch: string;
}

export function useReportsCache({ dateRange, branch }: UseReportsCacheOptions) {
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const requestQueue = useRef<Map<string, Promise<any>>>(new Map());

  const fetchWithCache = useCallback(
    async <T>(
      endpoint: string,
      additionalParams: Record<string, string> = {}
    ): Promise<T> => {
      const params = {
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
        branch,
        ...additionalParams,
      };

      const cacheKey = getCacheKey(endpoint, params);

      // Check cache first
      const cachedData = getFromCache<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // Check if there's already a pending request for this endpoint
      const pendingRequest = requestQueue.current.get(cacheKey);
      if (pendingRequest) {
        return pendingRequest;
      }

      // Mark as loading
      setLoading((prev) => new Set(prev).add(endpoint));

      // Create new request
      const queryString = new URLSearchParams(params).toString();
      const request = fetch(`${endpoint}?${queryString}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const result = await response.json();

          // Cache the successful response
          setInCache(cacheKey, result);

          return result;
        })
        .finally(() => {
          // Remove from loading and request queue
          setLoading((prev) => {
            const newSet = new Set(prev);
            newSet.delete(endpoint);
            return newSet;
          });
          requestQueue.current.delete(cacheKey);
        });

      // Store the promise so concurrent requests can reuse it
      requestQueue.current.set(cacheKey, request);

      return request;
    },
    [dateRange, branch]
  );

  const isLoading = useCallback(
    (endpoint: string) => {
      return loading.has(endpoint);
    },
    [loading]
  );

  const invalidateCache = useCallback(() => {
    clearCache();
  }, []);

  return {
    fetchWithCache,
    isLoading,
    invalidateCache,
  };
}
