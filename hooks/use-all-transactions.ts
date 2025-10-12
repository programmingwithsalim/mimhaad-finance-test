"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Transaction {
  id: string;
  customer_name: string;
  phone_number: string;
  amount: number;
  fee: number;
  type: string;
  status: string;
  reference: string;
  provider: string;
  created_at: string;
  branch_id: string;
  branch_name?: string;
  processed_by: string;
  service_type: string;
}

interface TransactionFilters {
  search: string;
  service: string;
  status: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  branchId: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

export function useAllTransactions(
  autoRefresh = true,
  refreshInterval = 30000
) {
  const { user } = useCurrentUser();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(50);

  const [filters, setFilters] = useState<TransactionFilters>({
    search: "",
    service: "all",
    status: "all",
    type: "all",
    dateFrom: "",
    dateTo: "",
    branchId: "all",
  });

  // Debounce refs
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);

  // Memoized values
  const canViewAllBranches = useMemo(
    () => user?.role === "admin" || user?.role === "finance",
    [user?.role]
  );

  const isFiltered = useMemo(
    () => !canViewAllBranches && !!user?.branchId,
    [canViewAllBranches, user?.branchId]
  );

  // Client-side filtering function
  const filteredTransactions = useMemo(() => {
    let filtered = [...allTransactions];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.customer_name?.toLowerCase().includes(searchLower) ||
          tx.phone_number?.toLowerCase().includes(searchLower) ||
          tx.reference?.toLowerCase().includes(searchLower) ||
          tx.id?.toLowerCase().includes(searchLower)
      );
    }

    // Apply service filter
    if (filters.service && filters.service !== "all") {
      filtered = filtered.filter((tx) => {
        const serviceType = tx.service_type.toLowerCase().replace(/_/g, "-");
        return serviceType === filters.service.toLowerCase();
      });
    }

    // Apply status filter
    if (filters.status && filters.status !== "all") {
      filtered = filtered.filter(
        (tx) => tx.status?.toLowerCase() === filters.status.toLowerCase()
      );
    }

    // Apply type filter
    if (filters.type && filters.type !== "all") {
      filtered = filtered.filter(
        (tx) => tx.type?.toLowerCase() === filters.type.toLowerCase()
      );
    }

    // Apply date from filter
    if (filters.dateFrom) {
      const dateFrom = new Date(filters.dateFrom);
      dateFrom.setHours(0, 0, 0, 0);
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return txDate >= dateFrom;
      });
    }

    // Apply date to filter
    if (filters.dateTo) {
      const dateTo = new Date(filters.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      filtered = filtered.filter((tx) => {
        const txDate = new Date(tx.created_at);
        return txDate <= dateTo;
      });
    }

    // Apply branch filter (for admins)
    if (filters.branchId && filters.branchId !== "all" && canViewAllBranches) {
      filtered = filtered.filter((tx) => tx.branch_id === filters.branchId);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return filtered;
  }, [allTransactions, filters, canViewAllBranches]);

  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageLimit;
    const endIndex = startIndex + pageLimit;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, pageLimit]);

  // Pagination info
  const pagination = useMemo<PaginationInfo>(() => {
    const totalCount = filteredTransactions.length;
    const totalPages = Math.ceil(totalCount / pageLimit);

    return {
      currentPage,
      totalPages,
      totalCount,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      limit: pageLimit,
    };
  }, [filteredTransactions.length, currentPage, pageLimit]);

  // Fetch all transactions from API (only once or on refresh)
  const fetchTransactions = useCallback(
    async (force = false) => {
      if (!user) return;

      // Prevent too frequent fetches (debounce by 2 seconds)
      const now = Date.now();
      if (!force && now - lastFetchRef.current < 2000) {
        return;
      }
      lastFetchRef.current = now;

      try {
        setLoading(true);
        setError(null);

        // Build query parameters - fetch ALL data
        const params = new URLSearchParams({
          page: "1",
          limit: "10000", // Fetch a large amount to have all data client-side
        });

        // Only apply branch filter if user is not admin
        if (!canViewAllBranches && user?.branchId) {
          params.append("branchId", user.branchId);
        }

        console.log("Fetching all transactions for client-side filtering...");

        const response = await fetch(
          `/api/transactions/all?${params.toString()}`,
          {
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          const transactionData = data.data || [];
          setAllTransactions(transactionData);
          console.log(
            `Loaded ${transactionData.length} transactions for client-side filtering`
          );
        } else {
          throw new Error(data.error || "Failed to fetch transactions");
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
        setAllTransactions([]);
      } finally {
        setLoading(false);
      }
    },
    [user, canViewAllBranches]
  );

  // Update filters - no API call, just update state
  const updateFilters = useCallback(
    (newFilters: Partial<TransactionFilters>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      // Reset to first page when filters change
      setCurrentPage(1);
    },
    []
  );

  // Update search with debouncing
  const updateSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: "",
      service: "all",
      status: "all",
      type: "all",
      dateFrom: "",
      dateTo: "",
      branchId: "all",
    });
    setCurrentPage(1);
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => {
      const totalPages = Math.ceil(filteredTransactions.length / pageLimit);
      return prev < totalPages ? prev + 1 : prev;
    });
  }, [filteredTransactions.length, pageLimit]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
  }, []);

  // Refetch from API
  const refetch = useCallback(() => {
    fetchTransactions(true);
  }, [fetchTransactions]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchTransactions(false);
    }
  }, [user]); // Only run when user changes

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !user) return;

    const interval = setInterval(() => {
      console.log("Auto-refreshing transactions...");
      fetchTransactions(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, user, fetchTransactions]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    transactions: paginatedTransactions,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    updateSearch,
    clearFilters,
    refetch,
    goToPage,
    nextPage,
    prevPage,
    canViewAllBranches,
    isFiltered,
    currentUserBranch: user?.branchId,
  };
}
