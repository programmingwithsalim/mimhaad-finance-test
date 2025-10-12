"use client";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRealtimeTransactions } from "@/hooks/use-realtime-transactions";
import {
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Smartphone,
  Banknote,
  CreditCard,
  Zap,
  ShoppingCart,
  Eye,
  MessageSquare,
  Phone,
  Wallet,
  Target,
} from "lucide-react";
import { format } from "date-fns";

interface ServiceStats {
  service: string;
  transactions: number;
  volume: number;
  commission: number;
}

interface TotalStats {
  totalTransactions: number;
  totalVolume: number;
  totalCommission: number;
  todayTransactions: number;
  todayVolume: number;
  todayCommission: number;
}

interface EnhancedCashierDashboardProps {
  serviceStats: ServiceStats[];
  totalStats: TotalStats;
}

export function EnhancedCashierDashboard({
  serviceStats = [],
  totalStats = {
    totalTransactions: 0,
    totalVolume: 0,
    totalCommission: 0,
    todayTransactions: 0,
    todayVolume: 0,
    todayCommission: 0,
  },
}: EnhancedCashierDashboardProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSMSDialogOpen, setIsSMSDialogOpen] = useState(false);
  const [processingTransaction, setProcessingTransaction] = useState<
    string | null
  >(null);
  const [isRefreshingTransactions, setIsRefreshingTransactions] =
    useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [floatBalances, setFloatBalances] = useState<any>({});
  const [myStats, setMyStats] = useState({ transactions: 0, volume: 0 });

  // Use real-time transactions with 10-second refresh interval
  const {
    transactions,
    loading,
    error,
    lastUpdate,
    isRefreshing,
    refresh,
    updateTransactionStatus,
  } = useRealtimeTransactions({
    branchId: user?.branchId,
    limit: 100,
    autoRefresh: true,
    refreshInterval: 10000, // 10 seconds instead of 3 seconds
  });

  // Filter transactions based on active tab
  const filteredTransactions =
    activeTab === "all"
      ? transactions
      : transactions.filter((tx) => tx.service_type === activeTab);

  // Safe statistics with fallbacks for NaN values
  const safeServiceStats = serviceStats.map((stat) => ({
    ...stat,
    transactions: isNaN(stat.transactions) ? 0 : stat.transactions,
    volume: isNaN(stat.volume) ? 0 : stat.volume,
    commission: isNaN(stat.commission) ? 0 : stat.commission,
  }));

  const safeTotalStats = {
    totalTransactions: isNaN(totalStats.totalTransactions)
      ? 0
      : totalStats.totalTransactions,
    totalVolume: isNaN(totalStats.totalVolume) ? 0 : totalStats.totalVolume,
    totalCommission: isNaN(totalStats.totalCommission)
      ? 0
      : totalStats.totalCommission,
    todayTransactions: isNaN(totalStats.todayTransactions)
      ? 0
      : totalStats.todayTransactions,
    todayVolume: isNaN(totalStats.todayVolume) ? 0 : totalStats.todayVolume,
    todayCommission: isNaN(totalStats.todayCommission)
      ? 0
      : totalStats.todayCommission,
  };

  // Fetch float balances
  useEffect(() => {
    const fetchFloatBalances = async () => {
      if (!user?.branchId) return;

      try {
        const response = await fetch(
          `/api/float-accounts?branchId=${user.branchId}`
        );
        if (response.ok) {
          const data = await response.json();
          console.log("📊 Float accounts fetched:", data);

          const balances: any = {};

          // Handle both array and object responses
          const accounts = Array.isArray(data) ? data : data.accounts || [];

          accounts.forEach((account: any) => {
            balances[account.account_type] = {
              balance: Number(account.current_balance) || 0,
              provider: account.provider,
              id: account.id,
            };
          });

          console.log("💰 Processed balances:", balances);
          setFloatBalances(balances);
        } else {
          console.error("Failed to fetch float accounts:", response.status);
        }
      } catch (error) {
        console.error("Failed to fetch float balances:", error);
      }
    };

    fetchFloatBalances();
  }, [user?.branchId]);

  // Calculate personal stats from transactions
  useEffect(() => {
    if (!user?.id || transactions.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const myTransactions = transactions.filter(
      (tx) => tx.user_id === user.id && tx.created_at.startsWith(today)
    );

    const myVolume = myTransactions.reduce(
      (sum, tx) => sum + (Number(tx.amount) || 0),
      0
    );

    setMyStats({
      transactions: myTransactions.length,
      volume: myVolume,
    });
  }, [transactions, user?.id]);

  const handleRefresh = () => {
    setIsRefreshingTransactions(true);
    refresh();
    setTimeout(() => {
      setIsRefreshingTransactions(false);
    }, 1000);
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return <Smartphone className="h-4 w-4" />;
      case "agency_banking":
      case "agency banking":
        return <Banknote className="h-4 w-4" />;
      case "e_zwich":
      case "e-zwich":
        return <CreditCard className="h-4 w-4" />;
      case "power":
        return <Zap className="h-4 w-4" />;
      case "jumia":
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getServiceColor = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return "text-blue-600";
      case "agency_banking":
      case "agency banking":
        return "text-green-600";
      case "e_zwich":
      case "e-zwich":
        return "text-purple-600";
      case "power":
        return "text-yellow-600";
      case "jumia":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleViewTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  };

  const handleMarkDelivered = async (transactionId: string) => {
    setProcessingTransaction(transactionId);
    updateTransactionStatus(transactionId, "processing");

    try {
      const response = await fetch(
        `/api/transactions/${transactionId}/mark-delivered`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user?.id,
          }),
        }
      );

      if (response.ok) {
        updateTransactionStatus(transactionId, "completed");
        toast({
          title: "Transaction Updated",
          description: "Transaction marked as delivered successfully",
        });
      } else {
        updateTransactionStatus(transactionId, "pending");
        throw new Error("Failed to mark as delivered");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark transaction as delivered",
        variant: "destructive",
      });
    } finally {
      setProcessingTransaction(null);
    }
  };

  const handleSendSMS = async (transactionId: string) => {
    if (!smsMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setProcessingTransaction(transactionId);
    updateTransactionStatus(transactionId, "processing");

    try {
      const response = await fetch(
        `/api/transactions/${transactionId}/send-sms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: smsMessage,
            userId: user?.id,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "SMS Sent",
          description: "SMS notification sent successfully",
        });
        setSmsMessage("");
        setIsSMSDialogOpen(false);
      } else {
        throw new Error("Failed to send SMS");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send SMS notification",
        variant: "destructive",
      });
    } finally {
      setProcessingTransaction(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const formatPhoneNumber = (phone: string) => {
    // Add Ghana country code if not present
    if (phone && !phone.startsWith("+233")) {
      return phone.startsWith("0") ? `+233${phone.slice(1)}` : `+233${phone}`;
    }
    return phone;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with refresh indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cashier Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time transaction monitoring and management
            {lastUpdate && (
              <span className="ml-2 text-xs">
                Last updated: {format(lastUpdate, "HH:mm:ss")}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshingTransactions || isRefreshing}
          variant="outline"
          className="gap-2"
        >
          {isRefreshingTransactions || isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Service Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {safeServiceStats.map((stat) => (
          <Card key={stat.service}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.service.replace(/_/g, " ").toUpperCase()}
              </CardTitle>
              <div className={getServiceColor(stat.service)}>
                {getServiceIcon(stat.service)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.transactions}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stat.volume)} volume
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Float Balance & Personal Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Till Balance */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash in Till</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(floatBalances["cash-in-till"]?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Available balance</p>
          </CardContent>
        </Card>

        {/* My Performance Today */}
        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              My Performance
            </CardTitle>
            <Target className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {myStats.transactions}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(myStats.volume)} volume today
            </p>
          </CardContent>
        </Card>

        {/* Branch Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branch Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {safeTotalStats.todayTransactions}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(safeTotalStats.todayVolume)} volume
            </p>
          </CardContent>
        </Card>

        {/* Commission */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(safeTotalStats.totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(safeTotalStats.todayCommission)} today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Live transaction updates - refreshing every 10 seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-center py-4 text-red-600">
              <p>{error}</p>
              <Button onClick={refresh} variant="outline" className="mt-2">
                Retry
              </Button>
            </div>
          )}

          {loading && transactions.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 flex-1 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="momo">MoMo</TabsTrigger>
                <TabsTrigger value="agency_banking">Agency</TabsTrigger>
                <TabsTrigger value="e_zwich">E-Zwich</TabsTrigger>
                <TabsTrigger value="power">Power</TabsTrigger>
                <TabsTrigger value="jumia">Jumia</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-mono text-xs">
                            {format(
                              new Date(transaction.created_at),
                              "HH:mm:ss"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getServiceIcon(transaction.service_type)}
                              <span className="capitalize">
                                {transaction.service_type.replace(/_/g, " ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {transaction.customer_name || "N/A"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatPhoneNumber(
                                  transaction.phone_number || ""
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {formatCurrency(transaction.amount)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Fee: {formatCurrency(transaction.fee)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(transaction.status)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleViewTransaction(transaction)
                                  }
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                {transaction.status === "pending" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleMarkDelivered(transaction.id)
                                    }
                                    disabled={
                                      processingTransaction === transaction.id
                                    }
                                  >
                                    {processingTransaction ===
                                    transaction.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Mark Delivered
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTransaction(transaction);
                                    setIsSMSDialogOpen(true);
                                  }}
                                >
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  Send SMS
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    // Handle call customer
                                    if (transaction.phone_number) {
                                      window.open(
                                        `tel:${formatPhoneNumber(
                                          transaction.phone_number
                                        )}`
                                      );
                                    }
                                  }}
                                >
                                  <Phone className="mr-2 h-4 w-4" />
                                  Call Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Detailed information about the transaction
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Transaction ID</Label>
                  <p className="text-sm font-mono">{selectedTransaction.id}</p>
                </div>
                <div>
                  <Label>Reference</Label>
                  <p className="text-sm">
                    {selectedTransaction.reference || "N/A"}
                  </p>
                </div>
                <div>
                  <Label>Customer Name</Label>
                  <p className="text-sm">
                    {selectedTransaction.customer_name || "N/A"}
                  </p>
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <p className="text-sm">
                    {formatPhoneNumber(selectedTransaction.phone_number || "")}
                  </p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="text-sm font-medium">
                    {formatCurrency(selectedTransaction.amount)}
                  </p>
                </div>
                <div>
                  <Label>Fee</Label>
                  <p className="text-sm">
                    {formatCurrency(selectedTransaction.fee)}
                  </p>
                </div>
                <div>
                  <Label>Service</Label>
                  <p className="text-sm capitalize">
                    {selectedTransaction.service_type.replace(/_/g, " ")}
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedTransaction.status)}
                  </div>
                </div>
                <div>
                  <Label>Created At</Label>
                  <p className="text-sm">
                    {format(new Date(selectedTransaction.created_at), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label>Updated At</Label>
                  <p className="text-sm">
                    {format(new Date(selectedTransaction.updated_at), "PPpp")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send SMS Dialog */}
      <Dialog open={isSMSDialogOpen} onOpenChange={setIsSMSDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS Notification</DialogTitle>
            <DialogDescription>
              Send a custom SMS message to the customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-message">Message</Label>
              <Textarea
                id="sms-message"
                placeholder="Enter your message here..."
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
              />
            </div>
            {selectedTransaction && (
              <div className="text-sm text-muted-foreground">
                <p>
                  To:{" "}
                  {formatPhoneNumber(selectedTransaction.phone_number || "")}
                </p>
                <p>Customer: {selectedTransaction.customer_name || "N/A"}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsSMSDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTransaction && handleSendSMS(selectedTransaction.id)
              }
              disabled={
                !smsMessage.trim() ||
                processingTransaction === selectedTransaction?.id
              }
            >
              {processingTransaction === selectedTransaction?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send SMS"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
