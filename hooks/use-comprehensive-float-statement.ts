import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface FloatTransaction {
  transaction_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference: string;
  source_module: string;
  source_transaction_id: string;
  created_by_name: string;
}

interface FloatSummary {
  opening_balance: number;
  closing_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_fees: number;
  transaction_count: number;
  net_change: number;
  module_breakdown: Record<
    string,
    {
      count: number;
      deposits: number;
      withdrawals: number;
      fees: number;
    }
  >;
}

interface UseComprehensiveFloatStatementProps {
  floatAccountId: string;
  startDate?: string;
  endDate?: string;
  autoFetch?: boolean;
}

interface UseComprehensiveFloatStatementReturn {
  transactions: FloatTransaction[];
  summary: FloatSummary | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  refetch: () => Promise<void>;
  clearError: () => void;
}

export function useComprehensiveFloatStatement({
  floatAccountId,
  startDate,
  endDate,
  autoFetch = true,
}: UseComprehensiveFloatStatementProps): UseComprehensiveFloatStatementReturn {
  const [transactions, setTransactions] = useState<FloatTransaction[]>([]);
  const [summary, setSummary] = useState<FloatSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!floatAccountId) {
      setError("Float account ID is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        floatAccountId,
      });

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      // Fetch comprehensive statement
      const statementResponse = await fetch(
        `/api/float-accounts/comprehensive-statement?${params.toString()}`
      );

      if (!statementResponse.ok) {
        throw new Error("Failed to fetch float statement");
      }

      const statementData = await statementResponse.json();
      setTransactions(statementData.data || []);

      // Fetch enhanced summary
      const summaryResponse = await fetch(
        `/api/float-accounts/enhanced-summary?${params.toString()}`
      );

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.data);
      } else {
        console.warn("Failed to fetch summary data");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch float data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [floatAccountId, startDate, endDate]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch && floatAccountId) {
      fetchData();
    }
  }, [autoFetch, floatAccountId, startDate, endDate, fetchData]);

  return {
    transactions,
    summary,
    loading,
    error,
    fetchData,
    refetch,
    clearError,
  };
}

// Hook for module-specific float statements
export function useModuleFloatStatement(
  floatAccountId: string,
  module: string,
  startDate?: string,
  endDate?: string
) {
  const [transactions, setTransactions] = useState<FloatTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModuleData = useCallback(async () => {
    if (!floatAccountId || !module) {
      setError("Float account ID and module are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        floatAccountId,
        module,
      });

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(
        `/api/float-accounts/module-statement?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch module float statement");
      }

      const data = await response.json();
      setTransactions(data.data || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch module data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [floatAccountId, module, startDate, endDate]);

  useEffect(() => {
    if (floatAccountId && module) {
      fetchModuleData();
    }
  }, [floatAccountId, module, startDate, endDate, fetchModuleData]);

  return {
    transactions,
    loading,
    error,
    refetch: fetchModuleData,
  };
}

// Utility functions for float statement analysis
export const floatStatementUtils = {
  // Filter transactions by module
  filterByModule: (transactions: FloatTransaction[], module: string) => {
    if (module === "all") return transactions;
    return transactions.filter((t) => t.source_module === module);
  },

  // Filter transactions by date range
  filterByDateRange: (
    transactions: FloatTransaction[],
    startDate: string,
    endDate: string
  ) => {
    return transactions.filter((t) => {
      const transactionDate = new Date(t.transaction_date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && transactionDate < start) return false;
      if (end && transactionDate > end) return false;
      return true;
    });
  },

  // Calculate summary from transactions
  calculateSummary: (transactions: FloatTransaction[]): FloatSummary => {
    const summary: FloatSummary = {
      opening_balance: 0,
      closing_balance: 0,
      total_deposits: 0,
      total_withdrawals: 0,
      total_fees: 0,
      transaction_count: transactions.length,
      net_change: 0,
      module_breakdown: {},
    };

    if (transactions.length === 0) return summary;

    // Sort by date
    const sortedTransactions = [...transactions].sort(
      (a, b) =>
        new Date(a.transaction_date).getTime() -
        new Date(b.transaction_date).getTime()
    );

    summary.opening_balance = sortedTransactions[0]?.balance_before || 0;
    summary.closing_balance =
      sortedTransactions[sortedTransactions.length - 1]?.balance_after || 0;

    // Calculate totals and module breakdown
    transactions.forEach((transaction) => {
      const amount = transaction.amount;
      const type = transaction.transaction_type.toLowerCase();
      const module = transaction.source_module;

      // Update totals
      if (type === "deposit" || type === "transfer_in") {
        summary.total_deposits += amount;
        summary.net_change += amount;
      } else if (type === "withdrawal" || type === "transfer_out") {
        summary.total_withdrawals += amount;
        summary.net_change -= amount;
      } else if (type === "fee") {
        summary.total_fees += amount;
        summary.net_change -= amount;
      }

      // Update module breakdown
      if (!summary.module_breakdown[module]) {
        summary.module_breakdown[module] = {
          count: 0,
          deposits: 0,
          withdrawals: 0,
          fees: 0,
        };
      }

      summary.module_breakdown[module].count++;

      if (type === "deposit" || type === "transfer_in") {
        summary.module_breakdown[module].deposits += amount;
      } else if (type === "withdrawal" || type === "transfer_out") {
        summary.module_breakdown[module].withdrawals += amount;
      } else if (type === "fee") {
        summary.module_breakdown[module].fees += amount;
      }
    });

    return summary;
  },

  // Format currency
  formatCurrency: (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  },

  // Get module display name
  getModuleDisplayName: (module: string) => {
    return module.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  },

  // Get transaction type color
  getTransactionTypeColor: (type: string) => {
    switch (type.toLowerCase()) {
      case "deposit":
      case "transfer_in":
        return "bg-green-100 text-green-800";
      case "withdrawal":
      case "transfer_out":
        return "bg-red-100 text-red-800";
      case "fee":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  },

  // Get module color
  getModuleColor: (module: string) => {
    switch (module) {
      case "agency_banking":
        return "bg-blue-100 text-blue-800";
      case "momo":
        return "bg-purple-100 text-purple-800";
      case "power":
        return "bg-yellow-100 text-yellow-800";
      case "e_zwich":
        return "bg-indigo-100 text-indigo-800";
      case "manual":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  },
};
