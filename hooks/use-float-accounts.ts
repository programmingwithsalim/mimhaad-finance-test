"use client";

import { useState, useEffect } from "react";
import { cachedFetch, clearCache } from "@/lib/dashboard-cache";

export interface FloatAccount {
  id: string;
  branch_id: string;
  branch_name: string;
  account_type: string;
  provider?: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  last_updated: string;
  created_at: string;
  status: string;
}

export function useFloatAccounts() {
  const [accounts, setAccounts] = useState<FloatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = async (skipCache = false) => {
    try {
      setLoading(true);
      setError(null);

      const result = await cachedFetch(
        "/api/float-accounts",
        {},
        { ttl: 30000, skipCache }
      );

      // Handle different response formats
      let accountsData = [];
      if (result.success && result.data && Array.isArray(result.data)) {
        accountsData = result.data;
      } else if (result.accounts && Array.isArray(result.accounts)) {
        accountsData = result.accounts;
      } else if (Array.isArray(result)) {
        accountsData = result;
      } else {
        accountsData = [];
      }

      setAccounts(accountsData);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch float accounts")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const refetch = () => {
    clearCache("/api/float-accounts");
    fetchAccounts(true);
  };

  return {
    accounts,
    loading,
    error,
    refetch,
  };
}

export function useFloatAccountsByBranch(branchId: string) {
  const [accounts, setAccounts] = useState<FloatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = async (skipCache = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await cachedFetch(
        `/api/branches/${encodeURIComponent(branchId)}/float-accounts`,
        {},
        { ttl: 30000, skipCache }
      );

      // Handle different response formats
      let accountsData = [];
      if (data.success && data.accounts && Array.isArray(data.accounts)) {
        accountsData = data.accounts;
      } else if (data.data && Array.isArray(data.data)) {
        accountsData = data.data;
      } else if (Array.isArray(data)) {
        accountsData = data;
      } else {
        accountsData = [];
      }

      setAccounts(accountsData);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch float accounts")
      );
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      fetchAccounts();
    }
  }, [branchId]);

  const refetch = () => {
    if (branchId) {
      clearCache(
        `/api/branches/${encodeURIComponent(branchId)}/float-accounts`
      );
      fetchAccounts(true);
    }
  };

  return {
    accounts,
    loading,
    error,
    refetch,
  };
}
