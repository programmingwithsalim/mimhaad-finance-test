"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Clock,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

interface GLStatistics {
  totalAccounts: number;
  activeAccounts: number;
  totalTransactions: number;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  balanceDifference: number;
  netPosition: number;
  financialPosition: number;
  fixedAssetsNBV?: number;
  floatBalances?: number;
  totalRevenue?: number;
  totalExpenses?: number;
  assets?: number;
  liabilities?: number;
  equity?: number;
  pendingTransactions: number;
  postedTransactions: number;
  accountsByType: {
    Asset: number;
    Liability: number;
    Equity: number;
    Revenue: number;
    Expense: number;
  };
  recentActivity: {
    module: string;
    count: number;
    amount: number;
  }[];
  lastSyncTime: string;
}

export function GLStatistics({ branchId }: { branchId?: string }) {
  const { user } = useCurrentUser();
  const [statistics, setStatistics] = useState<GLStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      let url = "/api/gl/statistics";
      if (branchId) {
        url += `?branchId=${branchId}`;
      }
      const response = await fetch(url, {
        cache: "no-store", // Ensure fresh data
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch statistics: ${response.statusText}`);
      }

      const data = await response.json();
      setStatistics(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching GL statistics:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load statistics"
      );
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStatistics();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatistics]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (isLoading && !statistics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">General Ledger Statistics</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Loading...</span>
            </div>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Refresh
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Loading...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && !statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GL Statistics</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchStatistics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">General Ledger Statistics</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Last updated: {formatTimeAgo(lastRefresh)}</span>
          </div>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button onClick={fetchStatistics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Balance Status - Most Important */}
        <Card
          className={`border-2 ${
            statistics?.isBalanced
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Balance Status
            </CardTitle>
            {statistics?.isBalanced ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                statistics?.isBalanced ? "text-green-600" : "text-red-600"
              }`}
            >
              {statistics?.isBalanced ? "✓ Balanced" : "⚠ Unbalanced"}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.isBalanced
                ? "Debits equal credits"
                : `Difference: ${formatCurrency(
                    statistics?.balanceDifference || 0
                  )}`}
            </p>
          </CardContent>
        </Card>

        {/* Total Accounts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Accounts
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.totalAccounts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.activeAccounts || 0} active accounts
            </p>
          </CardContent>
        </Card>

        {/* Total Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.totalTransactions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.postedTransactions || 0} posted,{" "}
              {statistics?.pendingTransactions || 0} pending
            </p>
          </CardContent>
        </Card>

        {/* Total Debits vs Credits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Debits vs Credits
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm">Debits:</span>
                <span className="text-sm font-medium text-red-600">
                  {formatCurrency(statistics?.totalDebits || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Credits:</span>
                <span className="text-sm font-medium text-green-600">
                  {formatCurrency(statistics?.totalCredits || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Position */}
        <Card
          className={
            statistics?.financialPosition >= 0
              ? "border-green-200"
              : "border-red-200"
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Financial Position
            </CardTitle>
            {statistics?.financialPosition >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                statistics?.financialPosition >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {formatCurrency(statistics?.financialPosition || 0)}
            </div>
            <p className="text-xs text-muted-foreground space-y-1">
              <div>
                Fixed Assets: {formatCurrency(statistics?.fixedAssetsNBV || 0)}
              </div>
              <div>
                Float Balances: {formatCurrency(statistics?.floatBalances || 0)}
              </div>
              <div className="font-semibold">= Total Assets</div>
            </p>
          </CardContent>
        </Card>

        {/* Net Position (Profit/Loss) */}
        <Card
          className={
            statistics?.netPosition >= 0 ? "border-green-200" : "border-red-200"
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Position (Profit/Loss)
            </CardTitle>
            <DollarSign
              className={`h-4 w-4 ${
                statistics?.netPosition >= 0 ? "text-green-600" : "text-red-600"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                statistics?.netPosition >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(statistics?.netPosition || 0)}
            </div>
            <p className="text-xs text-muted-foreground space-y-1">
              <div>
                Revenue: {formatCurrency(statistics?.totalRevenue || 0)}
              </div>
              <div>
                Expenses: {formatCurrency(statistics?.totalExpenses || 0)}
              </div>
              <div className="font-semibold">
                = {statistics?.netPosition >= 0 ? "Profit" : "Loss"}
              </div>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Distribution by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Account Distribution by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(statistics?.accountsByType || {}).map(
              ([type, count]) => (
                <div key={type} className="text-center">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground">{type}</div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity by Module */}
      {statistics?.recentActivity && statistics.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Recent Activity by Module
            </CardTitle>
            <CardDescription>
              Last updated: {formatDate(statistics.lastSyncTime)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statistics.recentActivity.map((activity) => (
                <div
                  key={activity.module}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="capitalize">
                      {activity.module}
                    </Badge>
                    <span className="text-sm font-medium">
                      {activity.count} transactions
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatCurrency(activity.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total amount
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Status Details */}
      {!statistics?.isBalanced && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">
              ⚠️ Balance Discrepancy Detected
            </CardTitle>
            <CardDescription className="text-red-700">
              The general ledger is not balanced. Please review recent
              transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Debits:</span>
                <span className="font-medium">
                  {formatCurrency(statistics?.totalDebits || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Credits:</span>
                <span className="font-medium">
                  {formatCurrency(statistics?.totalCredits || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Difference:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(statistics?.balanceDifference || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
