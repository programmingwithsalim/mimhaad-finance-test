"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "./use-current-user";
import { cachedFetch, clearCache } from "@/lib/dashboard-cache";
import { devLog } from "@/lib/dev-logger";

interface FloatAccount {
  id: string;
  provider: string;
  account_type: string;
  account_number?: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  branch_id: string;
  created_at: string;
  last_updated: string;
  isEzwichPartner?: boolean;
}

interface UseBranchFloatAccountsReturn {
  accounts: FloatAccount[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useBranchFloatAccounts(): UseBranchFloatAccountsReturn {
  const [accounts, setAccounts] = useState<FloatAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useCurrentUser();

  const fetchAccounts = useCallback(
    async (skipCache = false) => {
      if (!user?.branchId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        devLog.info(
          "[FLOAT-ACCOUNTS] Fetching accounts for branch:",
          user.branchId
        );

        const data = await cachedFetch(
          "/api/float-accounts",
          { branchId: user.branchId },
          { ttl: 30000, skipCache }
        );

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch float accounts");
        }

        devLog.info(
          `[FLOAT-ACCOUNTS] Loaded ${data.accounts?.length || 0} accounts`
        );

        // Enhanced filtering for MoMo accounts to include ALL providers with null safety
        const processedAccounts = (data.accounts || []).map((account: any) => ({
          ...account,
          // Ensure proper typing and null safety
          provider: account.provider || "Unknown",
          account_type: account.account_type || "unknown",
          current_balance: Number(account.current_balance || 0),
          min_threshold: Number(account.min_threshold || 0),
          max_threshold: Number(account.max_threshold || 0),
          is_active: Boolean(account.is_active),
          isEzwichPartner: Boolean(
            account.isEzwichPartner || account.isezwichpartner
          ),
        }));

        setAccounts(processedAccounts);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred")
        );
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.branchId]
  );

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const refetch = useCallback(() => {
    if (user?.branchId) {
      clearCache("/api/float-accounts");
    }
    fetchAccounts(true);
  }, [fetchAccounts, user?.branchId]);

  return {
    accounts,
    loading,
    error,
    refetch,
  };
}
