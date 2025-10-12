"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";

export interface MoMoTransaction {
  id: string;
  date: string;
  customerName: string;
  phoneNumber: string;
  amount: number;
  fee: number;
  type: "cash-in" | "cash-out";
  provider: string;
  reference?: string;
  status: "completed" | "failed" | "pending";
  branchId: string;
  branchName: string;
  floatAccountId: string;
  floatAccountName?: string;
  processedBy: string;
  cashTillAffected: number;
  floatAffected: number;
}

interface UseMoMoTransactionsProps {
  branchId?: string;
  provider?: string;
}

export function useMoMoTransactions({
  branchId,
  provider,
}: UseMoMoTransactionsProps = {}) {
  const [transactions, setTransactions] = useState<MoMoTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url = "/api/transactions/unified";
      const params = new URLSearchParams();

      if (branchId) {
        params.append("branchId", branchId);
      }

      if (provider) {
        params.append("provider", provider);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      // Even if response is not ok, try to parse it for error details
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Failed to fetch transactions: ${response.status}`
        );
      }

      // Ensure transactions is always an array
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      } else if (data.transactions) {
        console.warn(
          "Expected transactions to be an array but got:",
          data.transactions
        );
        setTransactions([]);
      } else if (Array.isArray(data)) {
        setTransactions(data);
      } else {
        console.warn("Unexpected data format:", data);
        setTransactions([]);
      }
    } catch (err) {
      console.error("Error fetching MoMo transactions:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch transactions"
      );
      // Set to empty array on error instead of leaving previous state
      setTransactions([]);

      // Show toast for better user feedback
      toast({
        title: "Error fetching transactions",
        description:
          err instanceof Error ? err.message : "Failed to fetch transactions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [branchId, provider, toast]);

  // Refresh transactions when refreshTrigger changes
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const refreshTransactions = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const createTransaction = async (
    transactionData: Omit<
      MoMoTransaction,
      "id" | "date" | "status" | "branchName" | "floatAccountName"
    >
  ) => {
    try {
      const response = await fetch("/api/transactions/unified", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...transactionData,
          serviceType: "momo",
          transactionType: transactionData.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Failed to create transaction: ${response.status}`
        );
      }

      // Update local state with the new transaction
      if (data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
      }

      toast({
        title: "Transaction Successful",
        description: `${
          transactionData.type === "cash-in" ? "Cash-In" : "Cash-Out"
        } transaction for ${
          transactionData.customerName
        } was processed successfully.`,
      });

      // Refresh transactions to ensure we have the latest data
      refreshTransactions();

      return data.transaction;
    } catch (err) {
      console.error("Error creating MoMo transaction:", err);
      toast({
        title: "Transaction Failed",
        description:
          err instanceof Error ? err.message : "Failed to process transaction",
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchTransactions,
    refreshTransactions,
    createTransaction,
  };
}
