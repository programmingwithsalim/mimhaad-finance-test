"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

export interface MoMoFloatAccount {
  id: string;
  branch_id: string;
  account_type: string;
  provider: string;
  account_number?: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  branch_name?: string;
}

export interface MoMoTransaction {
  id: string;
  type: "cash-in" | "cash-out";
  amount: number;
  fee: number;
  phone_number: string;
  reference?: string;
  status: "completed" | "failed" | "pending";
  date: string;
  branch_id: string;
  user_id: string;
  provider: string;
  customer_name: string;
  float_account_id: string;
  processed_by: string;
  cash_till_affected: number;
  float_affected: number;
  branch_name?: string;
  float_account_name?: string;
}

export interface MoMoStatistics {
  totalTransactions: number;
  totalVolume: number;
  totalFees: number;
  cashInCount: number;
  cashOutCount: number;
  todayTransactions: number;
  todayVolume: number;
}

// Current branch ID as specified
const CURRENT_BRANCH_ID = "635844ab-029a-43f8-8523-d7882915266a";

export function useMoMoDatabase() {
  const [momoAccounts, setMoMoAccounts] = useState<MoMoFloatAccount[]>([]);
  const [cashTillAccount, setCashTillAccount] =
    useState<MoMoFloatAccount | null>(null);
  const [transactions, setTransactions] = useState<MoMoTransaction[]>([]);
  const [statistics, setStatistics] = useState<MoMoStatistics>({
    totalTransactions: 0,
    totalVolume: 0,
    totalFees: 0,
    cashInCount: 0,
    cashOutCount: 0,
    todayTransactions: 0,
    todayVolume: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch MoMo float accounts
  const fetchMoMoAccounts = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/momo/branch/${CURRENT_BRANCH_ID}/accounts`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch MoMo accounts");
      }

      const data = await response.json();
      console.log("Fetched MoMo accounts:", data.accounts); // Debug log

      // Ensure we're not filtering out any providers
      const accounts = data.accounts || [];

      // Make sure we have all 3 expected providers
      const expectedProviders = [
        "MTN Mobile Money",
        "Vodafone Cash",
        "AirtelTigo Money",
      ];
      const fetchedProviders = accounts.map((acc) => acc.provider);

      console.log("Expected providers:", expectedProviders);
      console.log("Fetched providers:", fetchedProviders);

      // If missing providers, create mock accounts for testing
      const missingProviders = expectedProviders.filter(
        (provider) => !fetchedProviders.includes(provider)
      );

      if (missingProviders.length > 0) {
        console.log("Missing providers:", missingProviders);
        // You might want to create these accounts or alert the user
      }

      setMoMoAccounts(accounts);
    } catch (err) {
      console.error("Error fetching MoMo accounts:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch MoMo accounts"
      );

      // Fallback to mock data with all 3 providers
      setMoMoAccounts([
        {
          id: "mock-mtn-id",
          branch_id: CURRENT_BRANCH_ID,
          account_type: "momo",
          provider: "MTN Mobile Money",
          account_number: "MTN001",
          current_balance: 50000,
          min_threshold: 5000,
          max_threshold: 200000,
          is_active: true,
          branch_name: "Main Branch",
        },
        {
          id: "mock-vodafone-id",
          branch_id: CURRENT_BRANCH_ID,
          account_type: "momo",
          provider: "Vodafone Cash",
          account_number: "VODA001",
          current_balance: 35000,
          min_threshold: 3000,
          max_threshold: 150000,
          is_active: true,
          branch_name: "Main Branch",
        },
        {
          id: "mock-airteltigo-id",
          branch_id: CURRENT_BRANCH_ID,
          account_type: "momo",
          provider: "AirtelTigo Money",
          account_number: "AT001",
          current_balance: 25000,
          min_threshold: 2000,
          max_threshold: 100000,
          is_active: true,
          branch_name: "Main Branch",
        },
      ]);
    }
  }, []);

  // Fetch cash till account
  const fetchCashTillAccount = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/momo/branch/${CURRENT_BRANCH_ID}/cash-till`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch cash till account");
      }

      const data = await response.json();
      setCashTillAccount(data.account || null);
    } catch (err) {
      console.error("Error fetching cash till account:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch cash till account"
      );
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(
    async (filters?: {
      status?: string;
      type?: string;
      provider?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }) => {
      try {
        const params = new URLSearchParams();
        if (filters?.status) params.append("status", filters.status);
        if (filters?.type) params.append("type", filters.type);
        if (filters?.provider) params.append("provider", filters.provider);
        if (filters?.startDate) params.append("startDate", filters.startDate);
        if (filters?.endDate) params.append("endDate", filters.endDate);
        if (filters?.limit) params.append("limit", filters.limit.toString());

        const response = await fetch(
          `/api/momo/branch/${CURRENT_BRANCH_ID}/transactions?${params}`
        );
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch transactions");
        }

        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch transactions"
        );
      }
    },
    []
  );

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/momo/branch/${CURRENT_BRANCH_ID}/statistics`
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch statistics");
      }

      const data = await response.json();
      setStatistics(
        data.statistics || {
          totalTransactions: 0,
          totalVolume: 0,
          totalFees: 0,
          cashInCount: 0,
          cashOutCount: 0,
          todayTransactions: 0,
          todayVolume: 0,
        }
      );
    } catch (err) {
      console.error("Error fetching statistics:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch statistics"
      );
    }
  }, []);

  // Create transaction
  const createTransaction = useCallback(
    async (transactionData: {
      type: "cash-in" | "cash-out";
      amount: number;
      fee: number;
      phone_number: string;
      reference?: string;
      customer_name: string;
      float_account_id: string;
      user_id: string;
      processed_by: string;
    }) => {
      try {
        setLoading(true);

        const response = await fetch(
          `/api/momo/branch/${CURRENT_BRANCH_ID}/transactions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transactionData),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              errorData.details ||
              "Failed to create transaction"
          );
        }

        const data = await response.json();
        const newTransaction = data.transaction;

        const floatAccount = momoAccounts.find(
          (acc) => acc.id === transactionData.float_account_id
        );
        const provider = floatAccount?.provider || "Unknown Provider";

        const completeTransaction: MoMoTransaction = {
          ...newTransaction,
          provider: provider,
          branch_name: floatAccount?.branch_name || "Unknown Branch",
          float_account_name: `${provider} - ${
            floatAccount?.branch_name || "Unknown Branch"
          }`,
          amount: Number(transactionData.amount),
          fee: Number(transactionData.fee),
          cash_till_affected:
            transactionData.type === "cash-in"
              ? transactionData.amount
              : -transactionData.amount,
          float_affected:
            transactionData.type === "cash-in"
              ? -transactionData.amount
              : transactionData.amount,
        };

        setTransactions((prevTransactions) => [
          completeTransaction,
          ...prevTransactions,
        ]);

        setMoMoAccounts((prevAccounts) =>
          prevAccounts.map((account) => {
            if (account.id === transactionData.float_account_id) {
              return {
                ...account,
                current_balance:
                  account.current_balance +
                  (transactionData.type === "cash-in"
                    ? -transactionData.amount
                    : transactionData.amount),
              };
            }
            return account;
          })
        );

        if (cashTillAccount) {
          setCashTillAccount({
            ...cashTillAccount,
            current_balance:
              cashTillAccount.current_balance +
              (transactionData.type === "cash-in"
                ? transactionData.amount
                : -transactionData.amount),
          });
        }

        setStatistics((prevStats) => ({
          ...prevStats,
          totalTransactions: prevStats.totalTransactions + 1,
          totalVolume: prevStats.totalVolume + transactionData.amount,
          totalFees: prevStats.totalFees + transactionData.fee,
          cashInCount:
            prevStats.cashInCount +
            (transactionData.type === "cash-in" ? 1 : 0),
          cashOutCount:
            prevStats.cashOutCount +
            (transactionData.type === "cash-out" ? 1 : 0),
          todayTransactions: prevStats.todayTransactions + 1,
          todayVolume: prevStats.todayVolume + transactionData.amount,
        }));

        setTimeout(() => {
          Promise.all([
            fetchMoMoAccounts(),
            fetchCashTillAccount(),
            fetchTransactions(),
            fetchStatistics(),
          ]).catch((err) =>
            console.error("Error refreshing data after transaction:", err)
          );
        }, 1000);

        toast({
          title: "Transaction Successful",
          description: `${
            transactionData.type === "cash-in" ? "Cash-In" : "Cash-Out"
          } transaction processed successfully.`,
        });

        return completeTransaction;
      } catch (err) {
        console.error("Error creating transaction:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create transaction";

        toast({
          title: "Transaction Failed",
          description: errorMessage,
          variant: "destructive",
        });

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      momoAccounts,
      cashTillAccount,
      fetchMoMoAccounts,
      fetchCashTillAccount,
      fetchTransactions,
      fetchStatistics,
      toast,
    ]
  );

  // Refresh all data
  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchMoMoAccounts(),
        fetchCashTillAccount(),
        fetchTransactions(),
        fetchStatistics(),
      ]);
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }, [
    fetchMoMoAccounts,
    fetchCashTillAccount,
    fetchTransactions,
    fetchStatistics,
  ]);

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    // Data
    momoAccounts,
    cashTillAccount,
    cashTillBalance: cashTillAccount?.current_balance || 0,
    transactions,
    statistics,

    // State
    loading,
    error,

    // Actions
    createTransaction,
    fetchTransactions,
    refreshData,

    // Branch context
    currentBranchId: CURRENT_BRANCH_ID,
  };
}
