/**
 * Dashboard Data Caching Hook
 * React hook for fetching dashboard data with caching and deduplication
 */

import { useState, useCallback, useEffect } from "react";
import { cachedFetch, clearCache } from "@/lib/dashboard-cache";

interface UseDashboardCacheOptions {
  ttl?: number;
  skipCache?: boolean;
  autoFetch?: boolean;
}

export function useDashboardCache<T>(
  endpoint: string,
  params?: Record<string, any>,
  options?: UseDashboardCacheOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await cachedFetch<T>(endpoint, params, {
        ttl: options?.ttl,
        skipCache: options?.skipCache,
      });

      setData(result);
      return result;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch data");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, JSON.stringify(params), options?.ttl, options?.skipCache]);

  const invalidateCache = useCallback(() => {
    clearCache(endpoint);
  }, [endpoint]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (options?.autoFetch !== false) {
      fetchData();
    }
  }, [fetchData, options?.autoFetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    invalidateCache,
  };
}

/**
 * Hook for float accounts with caching
 */
export function useFloatAccountsCache(branchId?: string, alerts?: boolean) {
  return useDashboardCache(
    "/api/float-accounts",
    {
      branchId: branchId || "all",
      ...(alerts && { alerts: "true" }),
    },
    { ttl: 30 * 1000 } // 30 seconds cache
  );
}

/**
 * Hook for statistics with caching
 */
export function useStatisticsCache(
  service:
    | "momo"
    | "agency-banking"
    | "e-zwich"
    | "power"
    | "jumia"
    | "dashboard",
  branchId?: string
) {
  const endpoint =
    service === "dashboard"
      ? "/api/dashboard/statistics"
      : `/api/${service}/statistics`;

  const params: Record<string, any> = {};

  if (service === "dashboard") {
    params.userBranchId = branchId || "all";
  } else {
    params.branchId = branchId || "all";
  }

  return useDashboardCache(
    endpoint,
    params,
    { ttl: 60 * 1000 } // 1 minute cache
  );
}



