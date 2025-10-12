"use client";

import { useState, useEffect } from "react";
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
  CreditCard,
  PiggyBank,
  Receipt,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
  Activity,
  Users,
  Building2,
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
}

interface EnhancedFinanceDashboardProps {
  serviceStats: ServiceStats[];
  totalStats: DashboardStats;
  financialOverview: any;
}

export function EnhancedFinanceDashboard({
  serviceStats,
  totalStats,
  financialOverview,
}: EnhancedFinanceDashboardProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  const formatCurrency = (amount: number | null | undefined) => {
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(safeAmount);
  };

  const getGrowthIcon = (growth: number | null | undefined) => {
    const safeGrowth = Number(growth) || 0;
    if (safeGrowth > 0)
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (safeGrowth < 0)
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <div className="h-4 w-4" />;
  };

  const getGrowthColor = (growth: number | null | undefined) => {
    const safeGrowth = Number(growth) || 0;
    if (safeGrowth > 0) return "text-green-600";
    if (safeGrowth < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getServiceIcon = (service: string | undefined | null) => {
    if (!service || typeof service !== "string")
      return <Activity className="h-4 w-4" />;
    switch (service.toLowerCase()) {
      case "momo":
        return <Activity className="h-4 w-4" />;
      case "power":
        return <Activity className="h-4 w-4" />;
      case "e-zwich":
      case "ezwich":
        return <CreditCard className="h-4 w-4" />;
      case "agency-banking":
      case "agency banking":
        return <Building2 className="h-4 w-4" />;
      case "jumia":
        return <Activity className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  // Fetch expenses
  useEffect(() => {
    const fetchExpenses = async () => {
      if (!user?.branchId) return;

      try {
        const today = new Date().toISOString().split("T")[0];
        const response = await fetch(
          `/api/expenses?branchId=${user.branchId}&status=approved`
        );

        if (response.ok) {
          const expenses = await response.json();

          const todayExp = expenses
            .filter((exp: any) => exp.expense_date?.startsWith(today))
            .reduce(
              (sum: number, exp: any) => sum + (Number(exp.amount) || 0),
              0
            );

          const totalExp = expenses.reduce(
            (sum: number, exp: any) => sum + (Number(exp.amount) || 0),
            0
          );

          setTodayExpenses(todayExp);
          setTotalExpenses(totalExp);
        }
      } catch (error) {
        console.error("Failed to fetch expenses:", error);
      }
    };

    fetchExpenses();
  }, [user?.branchId]);

  const handleRefresh = () => {
    setLoading(true);
    // Simulate refresh
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Dashboard Refreshed",
        description: "Latest financial data has been loaded.",
      });
    }, 1000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Finance Dashboard
          </h2>
          <p className="text-muted-foreground">
            Welcome back, {user?.firstName || "Finance"}! Here's your financial
            overview for {user?.branchName || "your branch"}.
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Float Alerts */}
      {totalStats.floatAlerts && totalStats.floatAlerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Float Alerts</h3>
          {totalStats.floatAlerts.map((alert) => (
            <Alert
              key={alert.id}
              className={`border-l-4 ${
                alert.severity === "critical"
                  ? "border-l-red-500 bg-red-50"
                  : "border-l-yellow-500 bg-yellow-50"
              }`}
            >
              <AlertTriangle
                className={`h-4 w-4 ${
                  alert.severity === "critical"
                    ? "text-red-600"
                    : "text-yellow-600"
                }`}
              />
              <AlertDescription>
                <span className="font-medium">
                  {alert.service} - {alert.provider}
                </span>{" "}
                float balance is {alert.severity}:{" "}
                {formatCurrency(alert.current_balance)}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Financial Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalStats.todayCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalStats.totalCommission)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Expenses
            </CardTitle>
            <Receipt className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(todayExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalExpenses)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Profit (Today)
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                totalStats.todayCommission - todayExpenses >= 0
                  ? "text-blue-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(totalStats.todayCommission - todayExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Transactions
            </CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {totalStats.todayTransactions}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {totalStats.totalTransactions}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalStats.activeUsers}
            </div>
            <p className="text-xs text-muted-foreground">Branch staff</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Performance */}
      {totalStats.serviceBreakdown &&
        totalStats.serviceBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Service Performance</CardTitle>
              <CardDescription>
                Today's performance by service type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {totalStats.serviceBreakdown.map((service) => (
                  <div
                    key={service.service}
                    className="flex items-center space-x-4 rounded-lg border p-4"
                  >
                    <div className="flex-shrink-0">
                      {getServiceIcon(service.service)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {service.service.charAt(0).toUpperCase() +
                          service.service.slice(1)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {service.transactions} transactions
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(service.volume)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(service.commission)} commission
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Recent Activity */}
      {totalStats.recentActivity && totalStats.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Financial Activity</CardTitle>
            <CardDescription>
              Latest transactions and financial activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {totalStats.recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center space-x-4 rounded-lg border p-4"
                >
                  <div className="flex-shrink-0">
                    {getServiceIcon(activity.service)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.type} - {activity.service}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(activity.amount)} by {activity.user}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {(!totalStats.serviceBreakdown ||
        totalStats.serviceBreakdown.length === 0) &&
        (!totalStats.recentActivity ||
          totalStats.recentActivity.length === 0) && (
          <Card>
            <CardContent className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No Financial Data Available
              </h3>
              <p className="text-muted-foreground mb-4">
                No transactions or financial activities found for the current
                period.
              </p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </CardContent>
          </Card>
        )}
    </div>
  );
}

// Export both named and default exports
export default EnhancedFinanceDashboard;
