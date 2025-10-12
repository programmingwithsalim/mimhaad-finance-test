"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  manager?: string;
  status: string;
  region?: string;
  staff_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BranchStatistics {
  total: number;
  active: number;
  inactive: number;
  byRegion: Record<string, number>;
}

// Default statistics object
const defaultStatistics: BranchStatistics = {
  total: 0,
  active: 0,
  inactive: 0,
  byRegion: {},
};

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [statistics, setStatistics] =
    useState<BranchStatistics>(defaultStatistics);
  const [loading, setLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/branches");

      if (!response.ok) {
        throw new Error(`Error fetching branches: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle different response formats
      const branchesData = Array.isArray(data)
        ? data
        : data.data || data.branches || [];
      setBranches(branchesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch branches");
      setBranches([]); // Ensure branches is always an array

      // Don't show toast for branches fetch error in user management
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatistics = useCallback(async () => {
    setStatisticsLoading(true);
    try {
      const response = await fetch("/api/branches/statistics");

      if (!response.ok) {
        // Don't throw error, just use defaults
        setStatistics(defaultStatistics);
        return;
      }

      const data = await response.json();

      // Set statistics with defaults for missing properties
      setStatistics({
        total: data.total ?? 0,
        active: data.active ?? 0,
        inactive: data.inactive ?? 0,
        byRegion: data.byRegion ?? {},
      });
    } catch (err) {
      // Set default statistics on error - don't show toast
      setStatistics(defaultStatistics);
    } finally {
      setStatisticsLoading(false);
    }
  }, []);

  const searchBranches = useCallback(
    async (query: string): Promise<Branch[]> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/branches/search?q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          throw new Error(`Error searching branches: ${response.statusText}`);
        }

        const data = await response.json();

        const results = Array.isArray(data) ? data : data.data || [];
        setBranches(results);
        return results;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to search branches"
        );
        setBranches([]);
        toast({
          title: "Error",
          description: "Failed to search branches. Please try again.",
          variant: "destructive",
        });
        return [];
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const createBranch = useCallback(
    async (branchData: Omit<Branch, "id" | "created_at" | "updated_at">) => {
      try {
        const response = await fetch("/api/branches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(branchData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Error creating branch: ${response.statusText}`
          );
        }

        const newBranch = await response.json();

        // Update branches list and statistics
        setBranches((prev) => [...prev, newBranch]);
        await fetchStatistics();

        return newBranch;
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "Failed to create branch. Please try again.",
          variant: "destructive",
        });
        throw err;
      }
    },
    [fetchStatistics, toast]
  );

  const updateBranch = useCallback(
    async (
      id: string,
      branchData: Partial<Omit<Branch, "id" | "created_at" | "updated_at">>
    ) => {
      try {
        const response = await fetch(`/api/branches/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(branchData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Error updating branch: ${response.statusText}`
          );
        }

        const updatedBranch = await response.json();

        // Update branches list and statistics
        setBranches((prev) =>
          prev.map((branch) => (branch.id === id ? updatedBranch : branch))
        );
        await fetchStatistics();

        return updatedBranch;
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "Failed to update branch. Please try again.",
          variant: "destructive",
        });
        throw err;
      }
    },
    [fetchStatistics, toast]
  );

  const deleteBranch = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/branches/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Error deleting branch: ${response.statusText}`
          );
        }

        // Update branches list and statistics
        setBranches((prev) => prev.filter((branch) => branch.id !== id));
        await fetchStatistics();

        return true;
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "Failed to delete branch. Please try again.",
          variant: "destructive",
        });
        throw err;
      }
    },
    [fetchStatistics, toast]
  );

  // Fetch branches and statistics on component mount
  useEffect(() => {
    fetchBranches();
    fetchStatistics();
  }, [fetchBranches, fetchStatistics]);

  return {
    branches,
    statistics,
    loading,
    statisticsLoading,
    error,
    fetchBranches,
    fetchStatistics,
    searchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
  };
}

export type { Branch, BranchStatistics };
