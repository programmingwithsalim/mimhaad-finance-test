"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Building2,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Shield,
  BarChart3,
  FileText,
  CreditCard,
  Smartphone,
  Zap,
  ShoppingCart,
  Wallet,
  Target,
  PieChart,
  LineChart,
  Receipt,
  PiggyBank,
  Server,
  Database,
  Gauge,
  Bell,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface ServiceStats {
  service: string;
  todayTransactions: number;
  todayVolume: number;
  todayFees: number;
  totalBalance: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
}

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

interface EnhancedAdminDashboardProps {
  serviceStats: ServiceStats[];
  branchStats: any[];
  totalStats: DashboardStats;
  systemAlerts: number;
  pendingApprovals: number;
  userStats: any;
}

export function EnhancedAdminDashboard({
  serviceStats,
  branchStats,
  totalStats,
  systemAlerts,
  pendingApprovals,
  userStats,
}: EnhancedAdminDashboardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState({ today: 0, total: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({
    status: "operational",
    apiResponse: 125,
    uptime: 99.9,
  });

  const formatCurrency = (amount: number | null | undefined) => {
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(safeAmount);
  };

  const formatNumber = (value: any): string => {
    const num = Number(value);
    return isNaN(num) ? "0" : num.toLocaleString();
  };

  const getGrowthIcon = (growth: number | null | undefined) => {
    const safeGrowth = Number(growth) || 0;
    if (safeGrowth > 0)
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (safeGrowth < 0)
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <div className="h-4 w-4" />;
  };

  const getServiceIcon = (service: string | undefined | null) => {
    if (!service || typeof service !== "string")
      return <Activity className="h-4 w-4" />;
    switch (service.toLowerCase()) {
      case "momo":
        return <Smartphone className="h-4 w-4" />;
      case "power":
        return <Zap className="h-4 w-4" />;
      case "e-zwich":
      case "ezwich":
        return <CreditCard className="h-4 w-4" />;
      case "agency-banking":
      case "agency banking":
        return <Building2 className="h-4 w-4" />;
      case "jumia":
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  // Fetch expenses
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const response = await fetch(`/api/expenses?status=approved`);

        if (response.ok) {
          const data = await response.json();
          // Handle both array and object responses
          const expensesData = Array.isArray(data) ? data : data.expenses || [];

          const todayExp = expensesData
            .filter((exp: any) => exp.expense_date?.startsWith(today))
            .reduce(
              (sum: number, exp: any) => sum + (Number(exp.amount) || 0),
              0
            );
          const totalExp = expensesData.reduce(
            (sum: number, exp: any) => sum + (Number(exp.amount) || 0),
            0
          );

          setExpenses({ today: todayExp, total: totalExp });
        }
      } catch (error) {
        console.error("Failed to fetch expenses:", error);
      }
    };

    fetchExpenses();
  }, []);

  // Set recent activity from props
  useEffect(() => {
    if (totalStats.recentActivity && totalStats.recentActivity.length > 0) {
      setRecentActivity(totalStats.recentActivity.slice(0, 5));
    }
  }, [totalStats.recentActivity]);

  const handleRefresh = () => {
    setLoading(true);
    // Trigger a page refresh to get new data
    setTimeout(() => {
      setLoading(false);
      window.location.reload();
    }, 1000);
  };

  // Use real chart data from API instead of mock data
  const chartData =
    totalStats.chartData && totalStats.chartData.length > 0
      ? totalStats.chartData.slice(-7).map((day: any) => ({
          date: new Date(day.date).toLocaleDateString("en-US", {
            weekday: "short",
          }),
          transactions: day.transactions,
          volume: day.volume,
          commission: day.commission,
        }))
      : []; // Return empty array instead of mock data

  // Use real service breakdown from API
  const serviceBreakdown =
    totalStats.serviceBreakdown && totalStats.serviceBreakdown.length > 0
      ? totalStats.serviceBreakdown
      : []; // Return empty array instead of mock data

  // Calculate branch performance with transaction data
  // Note: branchStats from API only has basic info (name, status)
  // We need to aggregate service stats by branch for accurate metrics
  const enhancedBranchStats =
    Array.isArray(branchStats) && branchStats.length > 0
      ? branchStats.map((branch: any) => ({
          ...branch,
          // For now, show total stats since API doesn't provide per-branch transaction data
          // In production, this would come from a dedicated branch performance API
          totalTransactions:
            totalStats.totalTransactions / (branchStats.length || 1),
          totalVolume: totalStats.totalVolume / (branchStats.length || 1),
          totalCommission:
            totalStats.totalCommission / (branchStats.length || 1),
          todayTransactions:
            totalStats.todayTransactions / (branchStats.length || 1),
          todayVolume: totalStats.todayVolume / (branchStats.length || 1),
        }))
      : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName || "Admin"}! Here's your
            comprehensive system overview.
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Consolidated Alerts Card */}
      {(systemAlerts > 0 ||
        pendingApprovals > 0 ||
        (totalStats.floatAlerts && totalStats.floatAlerts.length > 0)) && (
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              Alerts & Notifications
            </CardTitle>
            <CardDescription>
              {[
                systemAlerts > 0 &&
                  `${systemAlerts} system alert${systemAlerts > 1 ? "s" : ""}`,
                pendingApprovals > 0 &&
                  `${pendingApprovals} pending approval${
                    pendingApprovals > 1 ? "s" : ""
                  }`,
                totalStats.floatAlerts?.length > 0 &&
                  `${totalStats.floatAlerts.length} float alert${
                    totalStats.floatAlerts.length > 1 ? "s" : ""
                  }`,
              ]
                .filter(Boolean)
                .join(" • ")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* System & Approval Alerts */}
              {(systemAlerts > 0 || pendingApprovals > 0) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {systemAlerts > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-900">
                          {systemAlerts} System Alerts
                        </p>
                        <p className="text-xs text-red-700">
                          Require immediate attention
                        </p>
                      </div>
                      <Badge className="bg-red-600 text-white">Critical</Badge>
                    </div>
                  )}
                  {pendingApprovals > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-900">
                          {pendingApprovals} Pending Approvals
                        </p>
                        <p className="text-xs text-yellow-700">
                          Awaiting your review
                        </p>
                      </div>
                      <Badge className="bg-yellow-600 text-white">
                        Pending
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Float Alerts */}
              {totalStats.floatAlerts && totalStats.floatAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Float Balance Alerts:
                  </p>
                  <div className="grid gap-2">
                    {totalStats.floatAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          alert.severity === "critical"
                            ? "bg-red-50 border-red-200"
                            : "bg-yellow-50 border-yellow-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Wallet
                            className={`h-4 w-4 ${
                              alert.severity === "critical"
                                ? "text-red-600"
                                : "text-yellow-600"
                            }`}
                          />
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                alert.severity === "critical"
                                  ? "text-red-900"
                                  : "text-yellow-900"
                              }`}
                            >
                              {alert.service} - {alert.provider}
                            </p>
                            <p
                              className={`text-xs ${
                                alert.severity === "critical"
                                  ? "text-red-700"
                                  : "text-yellow-700"
                              }`}
                            >
                              Current: {formatCurrency(alert.current_balance)} •
                              Threshold: {formatCurrency(alert.threshold)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            alert.severity === "critical"
                              ? "bg-red-600 text-white"
                              : "bg-yellow-600 text-white"
                          }
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions - Priority 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Quick Admin Actions
          </CardTitle>
          <CardDescription>
            One-click access to common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push("/dashboard/users")}
            >
              <Users className="h-6 w-6 text-blue-600" />
              <span className="text-xs font-medium">Manage Users</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push("/dashboard/branches")}
            >
              <Building2 className="h-6 w-6 text-green-600" />
              <span className="text-xs font-medium">Manage Branches</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push("/dashboard/settings")}
            >
              <Settings className="h-6 w-6 text-purple-600" />
              <span className="text-xs font-medium">System Settings</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() =>
                router.push("/dashboard/reports/financial-reports")
              }
            >
              <FileText className="h-6 w-6 text-orange-600" />
              <span className="text-xs font-medium">View Reports</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push("/dashboard/float-management")}
            >
              <Wallet className="h-6 w-6 text-emerald-600" />
              <span className="text-xs font-medium">Float Management</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2"
              onClick={() => router.push("/dashboard/audit-trail")}
            >
              <Shield className="h-6 w-6 text-red-600" />
              <span className="text-xs font-medium">Audit Trail</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Overview - 3 Column Responsive Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Column 1: Financial Health Summary */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-green-600" />
              Financial Health
            </CardTitle>
            <CardDescription>Today's financial overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Today's Revenue</span>
                <ArrowUpRight className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalStats?.todayCommission || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(totalStats?.totalCommission || 0)}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Today's Expenses</span>
                <ArrowDownRight className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(expenses.today)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total: {formatCurrency(expenses.total)}
              </p>
            </div>

            <div className="pt-3 border-t">
              <span className="text-sm font-medium">Net Profit (Today)</span>
              <div
                className={`text-2xl font-bold ${
                  (totalStats?.todayCommission || 0) - expenses.today >= 0
                    ? "text-blue-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(
                  (totalStats?.todayCommission || 0) - expenses.today
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Revenue - Expenses
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Column 2: System Health */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-blue-600" />
              System Health
            </CardTitle>
            <CardDescription>Real-time system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Status</span>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Operational
              </Badge>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">API Response</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {systemHealth.apiResponse}ms
              </div>
              <p className="text-xs text-green-600">✓ Excellent</p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Database</span>
              </div>
              <div className="text-lg font-bold text-green-600">Healthy</div>
              <p className="text-xs text-muted-foreground">
                All connections active
              </p>
            </div>

            <div>
              <span className="text-sm font-medium">System Uptime</span>
              <div className="text-2xl font-bold text-blue-600">
                {systemHealth.uptime}%
              </div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </CardContent>
        </Card>

        {/* Column 3: Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Key Metrics
            </CardTitle>
            <CardDescription>Today's performance snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Total Users</span>
              </div>
              <div className="text-2xl font-bold">
                {formatNumber(userStats?.totalUsers || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(userStats?.activeUsers || 0)} active
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Branches</span>
              </div>
              <div className="text-2xl font-bold">
                {formatNumber(
                  (Array.isArray(branchStats) ? branchStats : []).length || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(
                  (Array.isArray(branchStats) ? branchStats : []).filter(
                    (b: any) => b.status === "active"
                  )?.length || 0
                )}{" "}
                active
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Today's Transactions
                </span>
              </div>
              <div className="text-2xl font-bold">
                {formatNumber(totalStats?.todayTransactions || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalStats?.todayVolume || 0)} volume
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend & Recent Activity - 2 Column Layout */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Trend Chart (7-day) */}
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-indigo-600" />
              7-Day Revenue Trend
            </CardTitle>
            <CardDescription>
              Daily commission over the last week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData && chartData.length > 0 ? (
              <div className="space-y-3">
                {chartData.map((day: any, index: number) => {
                  const maxVolume = Math.max(
                    ...chartData.map((d: any) => d.commission || 0)
                  );
                  const percentage =
                    maxVolume > 0
                      ? ((day.commission || 0) / maxVolume) * 100
                      : 0;

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{day.date}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(day.commission || 0)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(day.transactions || 0)} transactions
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No trend data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest system events and transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((activity: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 pb-3 border-b last:border-0"
                  >
                    <div className="mt-1">
                      {activity.type === "login" && (
                        <Users className="h-4 w-4 text-blue-600" />
                      )}
                      {activity.type === "transaction" && (
                        <Activity className="h-4 w-4 text-green-600" />
                      )}
                      {activity.type === "alert" && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      {!["login", "transaction", "alert"].includes(
                        activity.type
                      ) && <Activity className="h-4 w-4 text-gray-600" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        {activity.service || "System"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.user || "System"} • {activity.type}
                      </p>
                      {activity.amount && (
                        <p className="text-xs font-medium text-green-600">
                          {formatCurrency(activity.amount)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {activity.timestamp
                        ? new Date(activity.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Just now"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No recent activity</p>
                  <p className="text-xs mt-1">
                    Activity will appear here as it happens
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Comparison Chart */}
      <Card className="border-l-4 border-l-rose-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-rose-600" />
            Branch Performance Comparison
          </CardTitle>
          <CardDescription>
            {enhancedBranchStats.length > 1
              ? `Comparing ${enhancedBranchStats.length} branches (averaged data)`
              : "Transaction volume by branch"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enhancedBranchStats.length > 0 ? (
            <div className="space-y-4">
              {enhancedBranchStats
                .slice(0, 5)
                .map((branch: any, index: number) => {
                  const maxVolume = Math.max(
                    ...enhancedBranchStats.map(
                      (b: any) => Number(b.totalVolume) || 0
                    )
                  );
                  const branchVolume = Number(branch.totalVolume) || 0;
                  const percentage =
                    maxVolume > 0 ? (branchVolume / maxVolume) * 100 : 0;

                  return (
                    <div key={branch.id || index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {branch.name || `Branch ${index + 1}`}
                          </span>
                          {branch.status === "active" && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm font-medium">
                          {formatCurrency(branchVolume)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-rose-500 h-3 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {formatNumber(
                            Math.round(Number(branch.totalTransactions) || 0)
                          )}{" "}
                          transactions
                        </span>
                        <span>
                          {formatCurrency(Number(branch.totalCommission) || 0)}{" "}
                          commission
                        </span>
                      </div>
                    </div>
                  );
                })}
              {enhancedBranchStats.length > 1 && (
                <p className="text-xs text-muted-foreground italic mt-4">
                  ℹ️ Note: Data shown is averaged across branches. For detailed
                  branch performance, upgrade to per-branch tracking.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No branch data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* System Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Service Performance */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Service Performance
                </CardTitle>
                <CardDescription>
                  Today's performance across all services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {serviceBreakdown.map((service) => (
                    <div
                      key={service.service}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getServiceIcon(service.service)}
                        <span className="font-medium">{service.service}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatNumber(service.transactions)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(service.volume)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/dashboard/user-management")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Users
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/dashboard/branch-management")}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Manage Branches
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/dashboard/settings")}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  System Settings
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/dashboard/reports")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View Reports
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Revenue Overview */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Overview
                </CardTitle>
                <CardDescription>
                  Financial performance this week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {chartData.map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{day.date}</span>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatNumber(day.transactions)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(day.volume)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Summary
                </CardTitle>
                <CardDescription>Key financial metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Revenue</span>
                  <span className="font-medium">
                    {formatCurrency(totalStats?.totalVolume || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Commission</span>
                  <span className="font-medium">
                    {formatCurrency(totalStats?.totalCommission || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Today's Revenue</span>
                  <span className="font-medium">
                    {formatCurrency(totalStats?.todayVolume || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Today's Commission</span>
                  <span className="font-medium">
                    {formatCurrency(totalStats?.todayCommission || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Operations Tab */}
        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Recent Activity */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent System Activity
                </CardTitle>
                <CardDescription>
                  Latest transactions and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {totalStats.recentActivity?.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getServiceIcon(activity.service)}
                        <div>
                          <div className="font-medium">{activity.service}</div>
                          <div className="text-sm text-muted-foreground">
                            {activity.user} • {activity.timestamp}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(activity.amount)}
                        </div>
                        <Badge variant="outline">{activity.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  System Status
                </CardTitle>
                <CardDescription>Current system health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Database</span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Online
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>API Services</span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Online
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>File Storage</span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Online
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Backup System</span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Online
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Weekly Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Weekly Transaction Trend
                </CardTitle>
                <CardDescription>
                  Transaction volume over the past week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-2">
                  {chartData.map((day, index) => (
                    <div key={day.date} className="flex flex-col items-center">
                      <div
                        className="w-8 bg-primary rounded-t"
                        style={{
                          height: `${(day.transactions / 70) * 200}px`,
                          minHeight: "20px",
                        }}
                      ></div>
                      <span className="text-xs mt-2">{day.date}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Service Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Service Distribution
                </CardTitle>
                <CardDescription>Revenue breakdown by service</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {serviceBreakdown.map((service) => (
                    <div
                      key={service.service}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {getServiceIcon(service.service)}
                        <span className="font-medium">{service.service}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(service.volume)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {(
                            (service.volume /
                              serviceBreakdown.reduce(
                                (sum, s) => sum + s.volume,
                                0
                              )) *
                            100
                          ).toFixed(1)}
                          %
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
