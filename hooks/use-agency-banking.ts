"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface AgencyBankingStats {
  totalTransactions: number;
  totalVolume: number;
  totalCommission: number;
}

interface AgencyBankingAccount {
  id: string;
  branch_id: string;
  account_type: string;
  provider: string;
  account_number: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useAgencyBanking(branchId: string) {
  const [floatAccount, setFloatAccount] = useState<AgencyBankingAccount | null>(
    null
  );
  const [stats, setStats] = useState<AgencyBankingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchAccount = async () => {
    try {
      // Validate branchId before making API calls
      if (!branchId || branchId === "undefined" || branchId.trim() === "") {
        console.warn("Invalid or missing branchId:", branchId);
        setError(new Error("Branch ID is required"));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch float account
      const accountResponse = await fetch(
        `/api/branches/${branchId}/float-accounts?accountType=agency-banking`
      );
      if (!accountResponse.ok) {
        throw new Error(
          `Failed to fetch agency banking account: ${accountResponse.status}`
        );
      }
      const accountData = await accountResponse.json();

      // Handle different response structures
      let accounts = [];
      if (Array.isArray(accountData)) {
        accounts = accountData;
      } else if (accountData.success && Array.isArray(accountData.data)) {
        accounts = accountData.data;
      } else if (Array.isArray(accountData.accounts)) {
        accounts = accountData.accounts;
      } else {
        console.warn("Unexpected account response structure:", accountData);
        accounts = [];
      }

      // Set the first active agency banking account
      const activeAccount = accounts.find((account: any) => account.is_active);
      setFloatAccount(activeAccount || null);

      // Fetch statistics
      const statsResponse = await fetch(
        `/api/agency-banking/statistics?branchId=${branchId}`
      );
      if (!statsResponse.ok) {
        throw new Error(
          `Failed to fetch agency banking statistics: ${statsResponse.status}`
        );
      }
      const statsData = await statsResponse.json();
      setStats({
        totalTransactions: statsData.totalTransactions || 0,
        totalVolume: statsData.totalVolume || 0,
        totalCommission: statsData.totalCommission || 0,
      });
    } catch (err) {
      console.error("Error fetching agency banking data:", err);
      setError(
        err instanceof Error ? err : new Error("Unknown error occurred")
      );
      toast({
        title: "Error",
        description: "Failed to load agency banking data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchId && branchId !== "undefined" && branchId.trim() !== "") {
      fetchAccount();
    } else {
      setLoading(false);
      setError(new Error("Valid branch ID is required"));
    }
  }, [branchId]);

  const initializeAccount = async () => {
    // Placeholder for initializing account
  };

  return {
    floatAccount,
    stats,
    loading,
    error,
    initializeAccount,
  };
}
