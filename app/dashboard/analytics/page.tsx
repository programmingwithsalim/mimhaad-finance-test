"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  BarChart,
  Target,
  Zap,
  CreditCard,
  Building2,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { useSession } from "next-auth/react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface AnalyticsData {
  transactionMetrics: {
    totalCount: number;
    totalVolume: number;
    totalFees: number;
    averageTransactionValue: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    commissionRevenue: number;
    feeRevenue: number;
    totalExpenses: number;
    netRevenue: number;
    profitMargin: number;
  };
  servicePerformance: Array<{
    service: string;
    transactionCount: number;
    totalVolume: number;
    totalFees: number;
    avgTransactionValue: number;
  }>;
  branchPerformance: Array<{
    id: string;
    name: string;
    location: string;
    total_transactions: number;
    total_volume: number;
    total_fees: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    transactionCount: number;
    volume: number;
    fees: number;
  }>;
  customerMetrics: {
    uniqueCustomers: number;
    totalCustomers: number;
    repeatCustomers: number;
    repeatCustomerRate: number;
    newCustomers: number;
  };
  floatMetrics: {
    totalAccounts: number;
    totalBalance: number;
    averageBalance: number;
    lowBalanceAccounts: number;
    minBalance: number;
    maxBalance: number;
    utilizationRate: number;
  };
  summary: {
    totalTransactions: number;
    totalRevenue: number;
    averageTransactionValue: number;
    topPerformingService: string;
    growthRate: number;
  };
  transactionStats: {
    totalTransactions: number;
    totalVolume: number;
    averageTransaction: number;
    successRate: number;
    dailyTrends: Array<{
      date: string;
      transactions: number;
      volume: number;
    }>;
  };
  revenueBreakdown: {
    totalRevenue: number;
    byService: Record<string, number>;
    monthlyTrends: Array<{
      month: string;
      revenue: number;
    }>;
  };
  userActivity: {
    activeUsers: number;
    topPerformers: Array<{
      name: string;
      transactions: number;
      volume: number;
    }>;
    branchActivity: Array<{
      branch: string;
      transactions: number;
      volume: number;
    }>;
  };
  lastUpdated: string;
}

interface Branch {
  id: string;
  name: string;
  location?: string;
}

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#ff0000",
  "#00ff00",
  "#0000ff",
  "#ffff00",
  "#ff00ff",
  "#00ffff",
];

export default function AnalyticsPage() {
  const { data: session } = useSession();
  const { user } = useCurrentUser();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  // Determine user permissions
  const isAdmin = user?.role === "admin" || user?.role === "Admin";
  const canViewAllBranches = isAdmin;
  const userBranchId = user?.branchId;
  const userBranchName = user?.branchName;

  const fetchBranches = async () => {
    if (!canViewAllBranches) return;

    try {
      const response = await fetch("/api/branches");
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setBranches(result.data);
        } else if (Array.isArray(result)) {
          setBranches(result);
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        timeRange,
        branch: canViewAllBranches ? selectedBranch : userBranchId || "all",
        userRole: user?.role || "",
        userBranchId: userBranchId || "",
      });

      console.log("Fetching analytics data with params:", params.toString());

      const response = await fetch(`/api/analytics/comprehensive?${params}`, {
        credentials: "include",
      });
      
      console.log("Analytics API response status:", response.status);
      
      const result = await response.json();
      console.log("Analytics API result:", result);

      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || "Failed to fetch analytics data");
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedBranch, canViewAllBranches, userBranchId, user?.role]);

  useEffect(() => {
    fetchBranches();
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchAnalyticsData();
      }, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [autoRefresh, fetchAnalyticsData]);

  const handleManualRefresh = () => {
    fetchAnalyticsData();
  };

  const exportData = (format: "csv" | "pdf" | "excel") => {
    // Implementation for data export
    console.log(`Exporting data in ${format} format`);
    // You can implement actual export logic here
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-GH").format(num);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getGrowthIndicator = (current: number, previous: number) => {
    const growth = ((current - previous) / previous) * 100;
    return {
      value: growth,
      isPositive: growth >= 0,
      icon:
        growth >= 0 ? (
          <ArrowUpRight className="h-4 w-4 text-green-600" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-600" />
        ),
    };
  };

  const getPerformanceStatus = (value: number, threshold: number) => {
    if (value >= threshold * 1.2)
      return {
        status: "excellent",
        icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      };
    if (value >= threshold)
      return {
        status: "good",
        icon: <CheckCircle className="h-4 w-4 text-blue-600" />,
      };
    if (value >= threshold * 0.8)
      return {
        status: "warning",
        icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
      };
    return {
      status: "critical",
      icon: <AlertCircle className="h-4 w-4 text-red-600" />,
    };
  };

  const revenueBreakdownData =
    data?.servicePerformance?.map((service, index) => ({
      name: service.service,
      value: service.totalFees,
      color: COLORS[index % COLORS.length],
      volume: service.totalVolume,
      transactions: service.transactionCount,
    })) || [];

  const servicePerformanceData =
    data?.servicePerformance?.map((service, index) => ({
      service: service.service,
      transactions: service.transactionCount,
      volume: service.totalVolume,
      fees: service.totalFees,
      color: COLORS[index % COLORS.length],
    })) || [];

  const branchPerformanceData =
    data?.branchPerformance?.map((branch, index) => ({
      name: branch.name,
      transactions: branch.total_transactions,
      volume: branch.total_volume,
      fees: branch.total_fees,
      color: COLORS[index % COLORS.length],
    })) || [];

  const timeSeriesData = data?.timeSeriesData || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Real-time business intelligence and performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="flex items-center gap-1">
              {canViewAllBranches ? (
                <>
                  <Eye className="h-3 w-3" />
                  All Branches
                </>
              ) : (
                <>
                  <Building2 className="h-3 w-3" />
                  {userBranchName || "Your Branch"}
                </>
              )}
            </Badge>
            {user?.role && (
              <Badge variant="secondary" className="text-xs">
                {user.role}
              </Badge>
            )}
          </div>
        </div>

        {/* Last Updated Indicator */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Last updated: {format(lastUpdated, "MMM d, yyyy 'at' h:mm a")}
            </span>
            {autoRefresh && (
              <Badge variant="outline" className="text-xs">
                Auto-refresh enabled
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div className="flex flex-col space-y-2 md:flex-row md:items-center md:space-x-4 md:space-y-0">
              <div className="space-y-2">
                <label className="text-sm font-medium">Time Range</label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="1y">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Branch Selector - Only show for admin users */}
              {canViewAllBranches && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Branch</label>
                  <Select
                    value={selectedBranch}
                    onValueChange={setSelectedBranch}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-sm">
                  Auto-refresh
                </Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleManualRefresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => exportData("csv")}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branch Info for Non-Admin Users */}
      {!canViewAllBranches && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {userBranchName || "Your Branch"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Showing data for your assigned branch only
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data?.revenueMetrics?.totalRevenue || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>
                Net: {formatCurrency(data?.revenueMetrics?.netRevenue || 0)}
              </span>
            </div>
            <div className="mt-2">
              <Progress
                value={data?.revenueMetrics?.profitMargin || 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Profit Margin:{" "}
                {formatPercentage(data?.revenueMetrics?.profitMargin || 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Transaction Volume
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(data?.transactionMetrics?.totalVolume || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>
                {formatNumber(data?.transactionMetrics?.totalCount || 0)}{" "}
                transactions
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Avg:{" "}
                {formatCurrency(
                  data?.transactionMetrics?.averageTransactionValue || 0
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Customer Activity
            </CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatNumber(data?.customerMetrics?.uniqueCustomers || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>
                {formatPercentage(
                  data?.customerMetrics?.repeatCustomerRate || 0
                )}{" "}
                repeat rate
              </span>
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                +{formatNumber(data?.customerMetrics?.newCustomers || 0)} new
                this period
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Float Balance</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.floatMetrics?.totalBalance || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <Building2 className="h-4 w-4 mr-1" />
              <span>{data?.floatMetrics?.totalAccounts || 0} accounts</span>
            </div>
            <div className="mt-2">
              <Progress
                value={data?.floatMetrics?.utilizationRate || 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Utilization:{" "}
                {formatPercentage(data?.floatMetrics?.utilizationRate || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>
                  Revenue distribution by service type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={revenueBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Trends</CardTitle>
                <CardDescription>
                  Daily transaction volume and revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="transactionCount"
                      fill="#8884d8"
                      name="Transactions"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="fees"
                      stroke="#82ca9d"
                      name="Revenue"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Top Performing Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {data?.summary?.topPerformingService || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Highest revenue generator
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Growth Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-green-600">
                  +{formatPercentage(data?.summary?.growthRate || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Period over period growth
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">
                  {formatPercentage(data?.transactionStats?.successRate || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Transaction success rate
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analysis</CardTitle>
                <CardDescription>Revenue trends and breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="fees"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Service</CardTitle>
                <CardDescription>
                  Revenue breakdown by service type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsBarChart data={servicePerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    <Bar dataKey="fees" fill="#82ca9d" name="Revenue" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Volume Trends</CardTitle>
                <CardDescription>
                  Daily transaction volume over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsLineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="transactionCount"
                      stroke="#8884d8"
                      strokeWidth={2}
                      name="Transactions"
                    />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Volume"
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Distribution</CardTitle>
                <CardDescription>Transaction count by service</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsBarChart data={servicePerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="transactions"
                      fill="#ffc658"
                      name="Transactions"
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servicePerformanceData.map((service) => (
              <Card key={service.service}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: service.color }}
                    />
                    {service.service}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">
                        {formatCurrency(service.fees)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="font-medium">
                        {formatCurrency(service.volume)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Transactions:
                      </span>
                      <span className="font-medium">
                        {formatNumber(service.transactions)}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Avg Transaction:
                        </span>
                        <span className="font-medium">
                          {formatCurrency(
                            service.volume / service.transactions
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          {canViewAllBranches ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Branch Performance</CardTitle>
                  <CardDescription>
                    Transaction volume by branch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <RechartsBarChart data={branchPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Legend />
                      <Bar dataKey="volume" fill="#8884d8" name="Volume" />
                      <Bar dataKey="fees" fill="#82ca9d" name="Fees" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Branch Comparison</CardTitle>
                  <CardDescription>
                    Performance metrics by branch
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {branchPerformanceData.map((branch) => (
                      <div
                        key={branch.name}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{branch.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(branch.transactions)} transactions
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(branch.volume)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(branch.fees)} fees
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Branch comparison is only available for admin users
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Performance Radar</CardTitle>
                <CardDescription>
                  Multi-dimensional performance view
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={servicePerformanceData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="service" />
                    <PolarRadiusAxis />
                    <Radar
                      name="Performance"
                      dataKey="fees"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Revenue Growth</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-green-600">
                        +{formatPercentage(data?.summary?.growthRate || 0)}
                      </span>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Transaction Success Rate
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {formatPercentage(
                          data?.transactionStats?.successRate || 0
                        )}
                      </span>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Customer Retention
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {formatPercentage(
                          data?.customerMetrics?.repeatCustomerRate || 0
                        )}
                      </span>
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Float Utilization
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {formatPercentage(
                          data?.floatMetrics?.utilizationRate || 0
                        )}
                      </span>
                      <Activity className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
