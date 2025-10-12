"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "./use-current-user";

export interface EZwichAccount {
  id: string;
  branch_id: string;
  account_type: string;
  provider: string;
  account_number: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  isEzwichPartner: boolean;
  created_at: string;
  updated_at: string;
}

export function useEZwichAccounts() {
  const { user } = useCurrentUser();
  const [accounts, setAccounts] = useState<EZwichAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!user?.branchId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/e-zwich/accounts?branchId=${encodeURIComponent(user.branchId)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAccounts(data.accounts || []);
      } else {
        throw new Error(data.error || "Failed to fetch E-Zwich accounts");
      }
    } catch (err) {
      console.error("Error fetching E-Zwich accounts:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch E-Zwich accounts"
      );
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.branchId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = useCallback(
    async (accountData: {
      accountNumber: string;
      currentBalance?: number;
      minThreshold?: number;
      maxThreshold?: number;
      isEzwichPartner?: boolean;
    }) => {
      if (!user?.branchId) {
        throw new Error("Branch ID not available");
      }

      const response = await fetch("/api/e-zwich/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: user.branchId,
          ...accountData,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to create E-Zwich account");
      }

      await fetchAccounts(); // Refresh the list
      return result.account;
    },
    [user?.branchId, fetchAccounts]
  );

  const updateAccount = useCallback(
    async (accountId: string, updates: Partial<EZwichAccount>) => {
      const response = await fetch(`/api/e-zwich/accounts/${accountId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update E-Zwich account");
      }

      await fetchAccounts(); // Refresh the list
      return result.account;
    },
    [fetchAccounts]
  );

  const deleteAccount = useCallback(
    async (accountId: string) => {
      const response = await fetch(`/api/e-zwich/accounts/${accountId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to delete E-Zwich account");
      }

      await fetchAccounts(); // Refresh the list
      return result;
    },
    [fetchAccounts]
  );

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
