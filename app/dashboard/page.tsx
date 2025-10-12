"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRBAC } from "@/components/rbac/rbac-provider";
import { RefreshCw } from "lucide-react";
import { EnhancedAdminDashboard } from "@/components/dashboard/enhanced-admin-dashboard";
import { EnhancedFinanceDashboard } from "@/components/dashboard/enhanced-finance-dashboard";
import { EnhancedManagerDashboard } from "@/components/dashboard/enhanced-manager-dashboard";
import { EnhancedOperationsDashboard } from "@/components/dashboard/enhanced-operations-dashboard";
import { EnhancedCashierDashboard } from "@/components/dashboard/enhanced-cashier-dashboard";

interface DashboardStats {
  totalTransactions: number;
  totalVolume: number;
  totalCommission: number;
  activeUsers: number;
  todayTransactions: number;
  todayVolume: number;
  todayCommission: number;
  serviceBreakdown: Array<{
    service: string;
    transactions: number;
    volume: number;
    commission: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    service: string;
    amount: number;
    timestamp: string;
    user: string;
  }>;
  floatAlerts: Array<{
    id: string;
    provider: string;
    service: string;
    current_balance: number;
    threshold: number;
    severity: "warning" | "critical";
  }>;
  chartData: Array<{
    date: string;
    transactions: number;
    volume: number;
    commission: number;
  }>;
  financialMetrics: any;
  revenueAnalysis: any[];
  teamPerformance: any[];
  dailyOperations: any[];
  serviceMetrics: any[];
  systemAlerts: number;
  pendingApprovals: number;
  users: any;
  branches: any[];
  branchMetrics: any[];
  expenses: any;
  commissions: any;
  float: any;
}

const defaultStats: DashboardStats = {
  totalTransactions: 0,
  totalVolume: 0,
  totalCommission: 0,
  activeUsers: 0,
  todayTransactions: 0,
  todayVolume: 0,
  todayCommission: 0,
  serviceBreakdown: [],
  recentActivity: [],
  floatAlerts: [],
  chartData: [],
  financialMetrics: {},
  revenueAnalysis: [],
  teamPerformance: [],
  dailyOperations: [],
  serviceMetrics: [],
  systemAlerts: 0,
  pendingApprovals: 0,
  users: {},
  branches: [],
  branchMetrics: [],
  expenses: {},
  commissions: {},
  float: {},
};

export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const router = useRouter();
  const {
    userRole,
    isAdmin,
    isManager,
    isFinance,
    isOperations,
    isSupervisor,
    isCashier,
  } = useRBAC();
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timeout mechanism to prevent getting stuck in loading state
  useEffect(() => {
    if (!userRole && user) {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 1500); // Reduced from 3 seconds to 1.5 seconds

      return () => clearTimeout(timer);
    }
  }, [userRole, user]);

  // Additional timeout to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 2500); // Reduced from 5 seconds to 2.5 seconds

    return () => clearTimeout(timer);
  }, [loading]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-GH").format(num || 0);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/dashboard/statistics?userRole=${encodeURIComponent(
          userRole || ""
        )}&userBranchId=${encodeURIComponent(user?.branchId || "")}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const apiData = await response.json();

      const transformedData = transformApiData(apiData);
      setStats(transformedData);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load dashboard data"
      );
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const transformApiData = (apiData: any): DashboardStats => {
    // Map serviceStats to serviceBreakdown format with today's data
    const serviceBreakdown = Array.isArray(apiData.serviceStats)
      ? apiData.serviceStats.map((s: any) => ({
          service: s.service,
          transactions: s.todayTransactions || 0,
          volume: s.todayVolume || 0,
          commission: s.todayFees || 0,
        }))
      : [];

    return {
      totalTransactions: apiData.totalTransactions || 0,
      totalVolume: apiData.totalVolume || 0,
      totalCommission: apiData.totalCommissions || 0,
      activeUsers: apiData.activeUsers || 0,
      todayTransactions: apiData.todayTransactions || 0,
      todayVolume: apiData.todayVolume || 0,
      todayCommission: apiData.todayCommission || 0,
      serviceBreakdown,
      recentActivity: apiData.recentActivity || [],
      floatAlerts: apiData.floatAlerts || [],
      chartData: apiData.dailyBreakdown || [],
      financialMetrics: apiData.financialMetrics || {},
      revenueAnalysis: [],
      teamPerformance: [],
      dailyOperations: [],
      serviceMetrics: [],
      systemAlerts: apiData.systemAlerts || 0,
      pendingApprovals: apiData.pendingApprovals || 0,
      users: apiData.users || { totalUsers: 0, activeUsers: 0 },
      branches: apiData.branchStats || [],
      branchMetrics: [],
      expenses: {},
      commissions: {},
      float: {},
    };
  };

  useEffect(() => {
    // Load data when user is available (even without branchId for admin users)
    if (user?.id) {
      loadDashboardData();
    } else {
      // If no user, set loading to false after a short delay to allow auth to complete
      const timer = setTimeout(() => {
        if (!user) {
          setLoading(false);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
    // Only depend on user.id to prevent multiple re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Helper to map serviceBreakdown to ServiceStats[] for cashier dashboard
  const mappedServiceStats = Array.isArray(stats.serviceBreakdown)
    ? stats.serviceBreakdown.map((s) => ({
        service: s.service,
        transactions: s.transactions || 0,
        volume: s.volume || 0,
        commission: s.commission || 0,
      }))
    : [];

  // Ensure totalStats has proper fallback values to prevent NaN
  const safeTotalStats = {
    totalTransactions: stats.totalTransactions || 0,
    totalVolume: stats.totalVolume || 0,
    totalCommission: stats.totalCommission || 0,
    todayTransactions: stats.todayTransactions || 0,
    todayVolume: stats.todayVolume || 0,
    todayCommission: stats.todayCommission || 0,
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your branch operations
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading dashboard data...</p>
          <p className="text-sm text-muted-foreground mt-2">
            User: {user?.firstName} {user?.lastName} | Role: {user?.role}
          </p>
        </div>
      </div>
    );
  }

  // Show loading state until user role is properly loaded (only if we have no role at all)
  if (!userRole && user && !user.role) {
    return null; // Show nothing instead of fallback content
  }

  // Fallback: If RBAC role is not loaded but user has a role, use it directly

  // Role-based dashboard rendering with proper case-sensitive role detection
  if (isAdmin) {
    return (
      <EnhancedAdminDashboard
        serviceStats={mappedServiceStats}
        branchStats={stats.branches || []}
        totalStats={stats}
        systemAlerts={stats.systemAlerts || 0}
        pendingApprovals={stats.pendingApprovals || 0}
        userStats={stats.users || {}}
      />
    );
  }

  if (isFinance) {
    return (
      <EnhancedFinanceDashboard
        serviceStats={mappedServiceStats}
        totalStats={stats}
        financialOverview={stats.financialMetrics || {}}
      />
    );
  }

  if (isManager) {
    return (
      <EnhancedManagerDashboard
        serviceStats={mappedServiceStats}
        totalStats={stats}
        recentTransactions={
          Array.isArray(stats.recentActivity) ? stats.recentActivity : []
        }
      />
    );
  }

  if (isOperations) {
    return (
      <EnhancedOperationsDashboard
        serviceStats={mappedServiceStats}
        totalStats={stats}
      />
    );
  }

  if (isCashier) {
    return (
      <EnhancedCashierDashboard
        serviceStats={mappedServiceStats}
        totalStats={safeTotalStats}
      />
    );
  }

  // If no specific role is detected, show nothing
  return null;
}
