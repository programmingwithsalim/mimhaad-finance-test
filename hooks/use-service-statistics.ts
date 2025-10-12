"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "./use-current-user";

interface ServiceStatistics {
  todayTransactions: number;
  totalTransactions: number;
  todayVolume: number;
  totalVolume: number;
  todayCommission: number;
  totalCommission: number;
  activeProviders: number;
  floatBalance: number;
  lowFloatAlerts: number;
  liabilityAmount?: number;
  float_balance?: number;
}

interface FloatAlert {
  id: string;
  provider: string;
  current_balance: number;
  min_threshold: number;
  severity: "warning" | "critical";
}

export function useServiceStatistics(serviceEndpoint: string) {
  const { user } = useCurrentUser();
  const [statistics, setStatistics] = useState<ServiceStatistics>({
    todayTransactions: 0,
    totalTransactions: 0,
    todayVolume: 0,
    totalVolume: 0,
    todayCommission: 0,
    totalCommission: 0,
    activeProviders: 0,
    floatBalance: 0,
    lowFloatAlerts: 0,
  });
  const [floatAlerts, setFloatAlerts] = useState<FloatAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatistics = async () => {
    if (!user?.branchId) return;

    try {
      setIsLoading(true);

      // Fetch service statistics
      const statsResponse = await fetch(
        `/api/${serviceEndpoint}/statistics?branchId=${user.branchId}`
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success && statsData.data) {
          setStatistics({
            todayTransactions: Number(statsData.data.todayTransactions || 0),
            totalTransactions: Number(statsData.data.totalTransactions || 0),
            todayVolume: Number(statsData.data.todayVolume || 0),
            totalVolume: Number(statsData.data.totalVolume || 0),
            todayCommission: Number(statsData.data.todayCommission || 0),
            totalCommission: Number(statsData.data.totalCommission || 0),
            activeProviders: Number(statsData.data.activeProviders || 0),
            floatBalance: Number(statsData.data.floatBalance || 0),
            lowFloatAlerts: Number(statsData.data.lowFloatAlerts || 0),
            liabilityAmount: Number(statsData.data.liabilityAmount || 0),
            float_balance: Number(statsData.data.float_balance || 0),
          });
        }
      }

      // Fetch float alerts
      const alertsResponse = await fetch(
        `/api/float-accounts?branchId=${user.branchId}&alerts=true`
      );

      if (alertsResponse.ok) {
        const alertsData = await alertsResponse.json();
        if (alertsData.success && Array.isArray(alertsData.accounts)) {
          const alerts = alertsData.accounts
            .filter((account: any) => {
              const balance = Number(account.current_balance || 0);
              const threshold = Number(account.min_threshold || 0);
              return balance <= threshold;
            })
            .map((account: any) => ({
              id: account.id,
              provider: account.provider,
              current_balance: Number(account.current_balance || 0),
              min_threshold: Number(account.min_threshold || 0),
              severity:
                Number(account.current_balance || 0) <
                Number(account.min_threshold || 0) * 0.5
                  ? "critical"
                  : "warning",
            }));

          setFloatAlerts(alerts);
        }
      }
    } catch (error) {
      console.error("Error fetching service statistics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatistics = async () => {
    await fetchStatistics();
  };

  useEffect(() => {
    if (user?.branchId) {
      fetchStatistics();
    }
  }, [user?.branchId, serviceEndpoint]);

  return {
    statistics,
    floatAlerts,
    isLoading,
    refreshStatistics,
  };
}
