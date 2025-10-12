"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DollarSign,
  TrendingUp,
  Activity,
  Building2,
  AlertTriangle,
  RefreshCw,
  Edit,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useCashInTillRobust } from "@/hooks/use-cash-in-till-robust";
import { useServiceStatistics } from "@/hooks/use-service-statistics";
import { useCurrentUser } from "@/hooks/use-current-user";

interface Transaction {
  id: string;
  customer_name: string;
  phone_number?: string;
  amount: number;
  fee: number;
  type: string;
  provider: string;
  reference?: string;
  status: string;
  created_at: string;
  [key: string]: any;
}

interface UniversalServiceLayoutProps {
  serviceName: string;
  serviceEndpoint: string;
  children: React.ReactNode;
  onTransactionEdit?: (transaction: Transaction) => void;
  onTransactionDelete?: (transactionId: string) => Promise<void>;
  customStatistics?: React.ReactNode;
}

export function UniversalServiceLayout({
  serviceName,
  serviceEndpoint,
  children,
  onTransactionEdit,
  onTransactionDelete,
  customStatistics,
}: UniversalServiceLayoutProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const {
    cashAccount,
    isLoading: cashLoading,
    error: cashError,
    balanceStatus,
    refreshCashTill,
  } = useCashInTillRobust();
  const {
    statistics,
    floatAlerts,
    isLoading: statsLoading,
    refreshStatistics,
  } = useServiceStatistics(serviceEndpoint);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!user?.branchId) return;

    try {
      setTransactionsLoading(true);
      const response = await fetch(
        `/api/${serviceEndpoint}/transactions?branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user?.branchId, serviceEndpoint]);

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshCashTill(),
      refreshStatistics(),
      fetchTransactions(),
    ]);
    toast({
      title: "Refreshed",
      description: "All data has been updated",
    });
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this transaction? This will adjust the float balance and GL entries."
      )
    ) {
      return;
    }

    try {
      if (onTransactionDelete) {
        await onTransactionDelete(transactionId);
      } else {
        const response = await fetch(
          `/api/${serviceEndpoint}/transactions/${transactionId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to delete transaction");
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to delete transaction");
        }
      }

      toast({
        title: "Transaction Deleted",
        description: "Transaction deleted and float balance adjusted",
      });

      // Refresh all data
      await handleRefreshAll();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete transaction",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  const getBalanceStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "success":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
      case "error":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "reversed":
        return <Badge className="bg-red-100 text-red-800">Reversed</Badge>;
      case "deleted":
        return (
          <Badge className="bg-gray-200 text-gray-700 line-through">
            Deleted
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{serviceName}</h1>
          <p className="text-muted-foreground">
            Manage {serviceName.toLowerCase()} transactions and view real-time
            insights
          </p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Float Alerts */}
      {floatAlerts.length > 0 && (
        <div className="space-y-2">
          {floatAlerts.map((alert) => (
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
                <span className="font-medium">{alert.provider}</span> float
                balance is {alert.severity}:
                {formatCurrency(alert.current_balance)} (Min:{" "}
                {formatCurrency(alert.min_threshold)})
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Transactions
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.todayTransactions}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {statistics.totalTransactions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Float Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.floatBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Today's Volume: {formatCurrency(statistics.todayVolume)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Providers
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.activeProviders}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics.lowFloatAlerts} low balance alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash in Till</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getBalanceStatusColor(
                balanceStatus
              )}`}
            >
              {cashAccount
                ? formatCurrency(cashAccount.current_balance)
                : "Loading..."}
            </div>
            <p className="text-xs text-muted-foreground">
              {cashError ? "Error loading" : `Status: ${balanceStatus}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Custom Statistics */}
      {customStatistics}

      {/* Main Content Tabs */}
      <Tabs defaultValue="new-transaction" className="space-y-4">
        <TabsList>
          <TabsTrigger value="new-transaction">New Transaction</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="new-transaction">{children}</TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Recent {serviceName.toLowerCase()} transactions with edit and
                delete options
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(
                            new Date(transaction.created_at),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </TableCell>
                        <TableCell>{transaction.customer_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {transaction.type?.replace(/[_-]/g, " ") ||
                              "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.provider}</TableCell>
                        <TableCell>
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>{formatCurrency(transaction.fee)}</TableCell>
                        <TableCell>
                          {getStatusBadge(transaction.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onTransactionEdit?.(transaction)}
                              title="Edit Transaction"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteTransaction(transaction.id)
                              }
                              title="Delete Transaction"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
