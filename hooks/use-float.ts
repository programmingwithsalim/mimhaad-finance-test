"use client";

import { useState, useEffect, useCallback } from "react";

interface UseFloatProps {
  branchId: string;
  serviceType: string;
  userId: string;
  provider?: string;
}

interface FloatAccount {
  id: string;
  branchId: string;
  accountType: string;
  provider: string;
  accountNumber: string;
  currentBalance: number;
  minThreshold: number;
  maxThreshold: number;
  isActive: boolean;
  lastUpdated: string;
  createdAt: string;
}

export function useFloat({
  branchId,
  serviceType,
  userId,
  provider,
}: UseFloatProps) {
  const [floatAccount, setFloatAccount] = useState<FloatAccount | null>(null);
  const [floatBalance, setFloatBalance] = useState<number>(0);
  const [isLowFloat, setIsLowFloat] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Fetch float account for the branch and service type
  const fetchFloatAccount = useCallback(async () => {
    // Don't fetch if we don't have a branchId
    if (!branchId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Build the query string with optional provider
      let queryString = `branchId=${branchId}&accountType=${serviceType}`;
      if (provider) {
        queryString += `&provider=${provider}`;
      }

      // Fetch float accounts from the API
      const response = await fetch(`/api/float-accounts?${queryString}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch float account: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch float accounts");
      }

      // Find the active float account for this service type and branch
      const account = data.floatAccounts?.find((acc: any) => {
        const matchesBranch =
          acc.branch_id === branchId || acc.branchId === branchId;
        const matchesType =
          acc.account_type === serviceType || acc.accountType === serviceType;
        const matchesProvider = !provider || acc.provider === provider;
        const isActive = acc.is_active !== false && acc.isActive !== false; // Default to true if not specified

        return matchesBranch && matchesType && matchesProvider && isActive;
      });

      if (account) {
        // Normalize the account object to match our interface
        const normalizedAccount: FloatAccount = {
          id: account.id,
          branchId: account.branch_id || account.branchId,
          accountType: account.account_type || account.accountType,
          provider: account.provider || "default",
          accountNumber: account.account_number || account.accountNumber || "",
          currentBalance: Number(
            account.current_balance || account.currentBalance || 0
          ),
          minThreshold: Number(
            account.min_threshold || account.minThreshold || 0
          ),
          maxThreshold: Number(
            account.max_threshold || account.maxThreshold || 100000
          ),
          isActive: account.is_active !== false && account.isActive !== false,
          lastUpdated:
            account.updated_at ||
            account.lastUpdated ||
            new Date().toISOString(),
          createdAt:
            account.created_at || account.createdAt || new Date().toISOString(),
        };

        setFloatAccount(normalizedAccount);
        setFloatBalance(normalizedAccount.currentBalance);
        setIsLowFloat(
          normalizedAccount.currentBalance <= normalizedAccount.minThreshold
        );

        console.log("Float account loaded successfully:", normalizedAccount);
      } else {
        console.warn(
          `No active ${serviceType} float account found for branch ${branchId}${
            provider ? ` and provider ${provider}` : ""
          }`
        );
        // Set default values if no account is found
        setFloatAccount(null);
        setFloatBalance(0);
        setIsLowFloat(true);
      }
    } catch (err) {
      console.error("Error fetching float account:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch float account";
      setError(errorMessage);

      // Set default values on error but don't show error to user for better UX
      setFloatAccount(null);
      setFloatBalance(0);
      setIsLowFloat(true);
    } finally {
      setIsLoading(false);
    }
  }, [branchId, serviceType, provider]);

  // Add a refetch function to manually trigger a refresh
  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Add a function to update the local balance without making an API call
  const updateLocalBalance = useCallback(
    (newBalance: number) => {
      setFloatBalance(newBalance);
      if (floatAccount) {
        setIsLowFloat(newBalance <= floatAccount.minThreshold);
      }
    },
    [floatAccount]
  );

  useEffect(() => {
    if (branchId && serviceType) {
      fetchFloatAccount();
    }
  }, [branchId, serviceType, provider, fetchFloatAccount, refreshTrigger]);

  // Process a float transaction
  const processFloatTransaction = useCallback(
    async (
      amount: number,
      type: "allocation" | "return" | "transfer" | "adjustment",
      description: string
    ) => {
      if (!floatAccount) {
        throw new Error(
          `No active ${serviceType} float account found for branch ${branchId}${
            provider ? ` and provider ${provider}` : ""
          }`
        );
      }

      try {
        // Call the API to process the float transaction
        const response = await fetch("/api/float-transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            type,
            toAccountId: floatAccount.id,
            reference: `${type}-${Date.now()}`,
            description,
            branchId,
            userId,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to process float transaction: ${response.statusText}`
          );
        }

        const data = await response.json();

        // Update the local state with the new balance
        if (data.success) {
          // Calculate new balance based on transaction type
          const newBalance =
            type === "allocation"
              ? floatBalance + amount
              : type === "return"
              ? floatBalance - amount
              : floatBalance;

          setFloatBalance(newBalance);
          setIsLowFloat(newBalance <= (floatAccount?.minThreshold || 0));

          return data.transaction;
        } else {
          throw new Error(
            data.message || "Failed to process float transaction"
          );
        }
      } catch (err) {
        console.error("Error processing float transaction:", err);
        throw err;
      }
    },
    [branchId, floatAccount, floatBalance, serviceType, userId, provider]
  );

  // Request float allocation
  const requestFloatAllocation = useCallback(
    async (
      amount: number,
      reason: string,
      priority: "low" | "medium" | "high" = "medium",
      serviceType?: string,
      provider?: string
    ) => {
      if (!floatAccount) {
        throw new Error(
          `No active ${serviceType} float account found for branch ${branchId}${
            provider ? ` and provider ${provider}` : ""
          }`
        );
      }

      try {
        // Call the API to request float allocation
        const response = await fetch("/api/float-allocation-requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            reason,
            priority,
            floatAccountId: floatAccount.id,
            branchId,
            requestedBy: userId,
            serviceType: serviceType || floatAccount.accountType,
            provider: provider || floatAccount.provider,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to request float allocation: ${response.statusText}`
          );
        }

        const data = await response.json();

        if (data.success) {
          return data.request;
        } else {
          throw new Error(data.message || "Failed to request float allocation");
        }
      } catch (err) {
        console.error("Error requesting float allocation:", err);
        throw err;
      }
    },
    [branchId, floatAccount, userId]
  );

  return {
    floatAccount,
    floatBalance,
    isLowFloat,
    isLoading,
    error,
    processFloatTransaction,
    requestFloatAllocation,
    refetch,
    updateLocalBalance,
  };
}
