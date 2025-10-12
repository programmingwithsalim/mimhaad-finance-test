"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentUser } from "./use-current-user";

interface CashAccount {
  id: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  account_name: string;
  account_type: string;
  branch_id: string;
  is_active: boolean;
}

export function useCashInTillRobust() {
  const { user } = useCurrentUser();
  const [cashAccount, setCashAccount] = useState<CashAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Determine branch ID to use
  const branchId = user?.branchId || "635844ab-029a-43f8-8523-d7882915266a";

  // Calculate balance status
  const balanceStatus = useCallback(() => {
    if (!cashAccount) return "error";

    const balance = cashAccount.current_balance;
    const minThreshold = cashAccount.min_threshold;

    if (balance >= minThreshold) return "healthy";
    if (balance >= minThreshold * 0.5) return "warning";
    return "critical";
  }, [cashAccount]);

  // Fetch cash account data
  const fetchCashAccount = useCallback(async () => {
    if (!branchId) {
      setError("No branch ID available");
      setIsLoading(false);
      setIsInitialized(true);
      return;
    }

    // Only show loading on initial load or manual refresh, not on subsequent calls
    if (!isInitialized) {
      setIsLoading(true);
    }
    setError(null);

    try {
      let accountFound = false;

      // Try to get the cash-in-till account first
      const response = await fetch(`/api/branches/${branchId}/cash-in-till`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.account) {
          setCashAccount(data.account);
          setError(null); // Clear any previous errors
          accountFound = true;
        }
        // If response is OK but no account, continue to fallback without setting error
      }

      // Only try fallback if we didn't find an account in the first API
      if (!accountFound) {
        const floatResponse = await fetch(
          `/api/float-accounts?branchId=${branchId}&accountType=cash-in-till`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        if (floatResponse.ok) {
          const floatData = await floatResponse.json();
          console.log("Float accounts API response:", floatData);

          // Check different possible response formats
          const accounts =
            floatData.data ||
            floatData.accounts ||
            floatData.floatAccounts ||
            [];

          if (Array.isArray(accounts) && accounts.length > 0) {
            const account = accounts[0];
            console.log("Found cash in till account:", account);

            // Transform the account data to match expected format
            setCashAccount({
              id: account.id,
              current_balance: Number(account.current_balance) || 0,
              min_threshold: Number(account.min_threshold) || 0,
              max_threshold: Number(account.max_threshold) || 0,
              account_name: account.account_name || "Cash in Till",
              account_type: account.account_type || "cash-in-till",
              branch_id: account.branch_id,
              is_active: account.is_active !== false,
            });
            setError(null); // Clear any previous errors
            accountFound = true;
          }
        }
      }

    
    } catch (err) {
      console.error("Error fetching cash account:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch cash account";
      setError(errorMessage);
      setCashAccount(null);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [branchId, isInitialized]);

  // Refresh function
  const refreshCashTill = useCallback(async () => {
    setIsLoading(true); // Always show loading on manual refresh
    setError(null); // Clear previous errors
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch data on mount and when refresh is triggered
  useEffect(() => {
    fetchCashAccount();
  }, [fetchCashAccount, refreshTrigger]);

  return {
    cashAccount,
    isLoading,
    error,
    balanceStatus: balanceStatus(),
    refreshCashTill,
  };
}
