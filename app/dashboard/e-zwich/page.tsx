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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServiceStatistics } from "@/hooks/use-service-statistics";
import { DynamicFloatDisplay } from "@/components/shared/dynamic-float-display";
import EnhancedCardIssuanceForm from "@/components/e-zwich/enhanced-card-issuance-form";
import { TransactionEditDialog } from "@/components/shared/transaction-edit-dialog";
import { TransactionDeleteDialog } from "@/components/shared/transaction-delete-dialog";
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  RefreshCw,
  Plus,
  AlertTriangle,
  Trash2,
  Printer,
  Receipt,
  Edit,
  ArrowRightLeft,
  Eye,
  RotateCcw,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useDynamicFee } from "@/hooks/use-dynamic-fee";
import { TransactionActions } from "@/components/transactions/transaction-actions";
import { CardManagementInterface } from "@/components/e-zwich/card-management-interface";
import { TransactionHistoryInterface } from "@/components/e-zwich/transaction-history-interface";
import {
  TransactionReceipt,
  TransactionReceiptData,
} from "@/components/shared/transaction-receipt";

interface Transaction {
  id: string;
  type: string;
  amount?: number;
  customer_name: string;
  customer_phone?: string;
  card_number?: string;
  partner_bank?: string;
  status: string;
  created_at: string;
  settlement_account_id?: string;
  customer_email?: string;
  id_type?: string;
  id_number?: string;
  city?: string;
  region?: string;
  notes?: string;
}

export default function EZwichPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const {
    statistics,
    floatAlerts,
    isLoading: statsLoading,
    refreshStatistics,
  } = useServiceStatistics("e-zwich");

  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [floatAccounts, setFloatAccounts] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingFloats, setLoadingFloats] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [transactionsPerPage] = useState(20);
  const [activeTab, setActiveTab] = useState("withdrawal");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showSettleDialog, setShowSettleDialog] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<any>(null);
  const [receiptData, setReceiptData] = useState<TransactionReceiptData | null>(
    null
  );
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Unified dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const [withdrawalForm, setWithdrawalForm] = useState({
    card_number: "",
    amount: "",
    fee: "",
    customer_name: "",
    customer_phone: "",
    settlement_account_id: "",
    notes: "",
  });

  const [settleForm, setSettleForm] = useState({
    amount: "",
    settlement_account_id: "",
    partner_account_id: "",
    notes: "",
    reference: "",
  });

  // Use dynamic fee calculation
  const { calculateFee } = useDynamicFee();

  // Find the provider name for the selected settlement account
  const getSelectedProviderName = () => {
    if (!withdrawalForm.settlement_account_id) return null;
    const selectedAccount = (floatAccounts as any[]).find(
      (account: any) => account.id === withdrawalForm.settlement_account_id
    );
    return selectedAccount?.provider || null;
  };

  const loadTransactions = async (page = 1) => {
    if (!user?.branchId) return;

    try {
      setLoadingTransactions(true);
      const params = new URLSearchParams({
        branchId: user.branchId,
        limit: transactionsPerPage.toString(),
        page: page.toString(),
      });

      const response = await fetch(
        `/api/e-zwich/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log("E-Zwich transactions response:", data);
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          setTotalPages(
            data.pagination?.totalPages ||
              Math.ceil(
                (data.total || data.transactions.length) / transactionsPerPage
              )
          );
          setTotalTransactions(data.total || data.transactions.length);
          setCurrentPage(page);
        } else {
          setTransactions([]);
          setTotalPages(1);
          setTotalTransactions(0);
        }
      } else {
        setTransactions([]);
        setTotalPages(1);
        setTotalTransactions(0);
      }
    } catch (error) {
      console.error("Error loading E-Zwich transactions:", error);
      setTransactions([]);
      setTotalPages(1);
      setTotalTransactions(0);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadFloatAccounts = async () => {
    if (!user?.branchId) return;

    try {
      setLoadingFloats(true);

      // Load all float accounts including E-Zwich partners
      const response = await fetch(
        `/api/float-accounts?branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.accounts)) {
          setFloatAccounts(data.accounts);
        } else {
          setFloatAccounts([]);
        }
      } else {
        setFloatAccounts([]);
      }
    } catch (error) {
      console.error("Error loading float accounts:", error);
      setFloatAccounts([]);
    } finally {
      setLoadingFloats(false);
    }
  };

  useEffect(() => {
    if (user?.branchId) {
      loadTransactions();
      loadFloatAccounts();
    }
  }, [user?.branchId]);

  // Track if user has manually modified the fee
  const [userModifiedFee, setUserModifiedFee] = useState(false);

  useEffect(() => {
    const fetchFee = async () => {
      if (!withdrawalForm.amount) {
        setWithdrawalForm((prev) => ({ ...prev, fee: "" }));
        return;
      }

      // Only auto-calculate if user hasn't manually modified the fee
      if (!userModifiedFee) {
        try {
          const feeResult = await calculateFee(
            "e_zwich",
            "withdrawal",
            Number(withdrawalForm.amount)
          );
          setWithdrawalForm((prev) => ({
            ...prev,
            fee: feeResult.fee.toString(),
          }));
        } catch (error) {
          console.error("Error calculating fee:", error);
          setWithdrawalForm((prev) => ({ ...prev, fee: "0" }));
        }
      }
    };

    fetchFee();
  }, [withdrawalForm.amount, calculateFee, userModifiedFee]);

  // Reset user modification flag when form is reset
  useEffect(() => {
    if (!withdrawalForm.fee || withdrawalForm.fee === "") {
      setUserModifiedFee(false);
    }
  }, [withdrawalForm.fee]);

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !withdrawalForm.card_number ||
      !withdrawalForm.amount ||
      !withdrawalForm.customer_name ||
      !withdrawalForm.settlement_account_id
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount (must be positive)
    const amount = Number(withdrawalForm.amount);
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Validate card number (max 10 digits)
    if (withdrawalForm.card_number.length > 10) {
      toast({
        title: "Invalid Card Number",
        description: "Card number cannot exceed 10 digits",
        variant: "destructive",
      });
      return;
    }

    // Validate card number contains only digits
    if (!/^\d+$/.test(withdrawalForm.card_number)) {
      toast({
        title: "Invalid Card Number",
        description: "Card number must contain only digits",
        variant: "destructive",
      });
      return;
    }

    // Validate customer phone (must be exactly 10 digits)
    if (!withdrawalForm.customer_phone) {
      toast({
        title: "Missing Phone Number",
        description: "Customer phone number is required",
        variant: "destructive",
      });
      return;
    }

    if (
      withdrawalForm.customer_phone.length !== 10 ||
      !/^\d{10}$/.test(withdrawalForm.customer_phone)
    ) {
      toast({
        title: "Invalid Phone Number",
        description:
          "Phone number must be exactly 10 digits (e.g., 0241234567)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/transactions/unified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: "e_zwich",
          transactionType: "withdrawal",
          amount: Number(withdrawalForm.amount),
          fee: Number(withdrawalForm.fee) || 0,
          customerName: withdrawalForm.customer_name,
          phoneNumber: withdrawalForm.customer_phone,
          provider: "E-Zwich",
          reference: `EZWICH-WD-${Date.now()}`,
          notes: withdrawalForm.notes,
          branchId: user?.branchId,
          userId: user?.id,
          processedBy: user?.name || user?.username,
          metadata: {
            card_number: withdrawalForm.card_number,
            settlement_account_id: withdrawalForm.settlement_account_id,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Withdrawal processed successfully",
          description:
            result.message ||
            `GHS ${withdrawalForm.amount} withdrawn from card ${withdrawalForm.card_number}`,
        });

        // Reset form
        setWithdrawalForm({
          card_number: "",
          amount: "",
          fee: "",
          customer_name: "",
          customer_phone: "",
          settlement_account_id: "",
          notes: "",
        });

        // Refresh data
        loadTransactions();
        loadFloatAccounts();
        refreshStatistics();
      } else {
        throw new Error(result.error || "Failed to process withdrawal");
      }
    } catch (error) {
      toast({
        title: "Failed to process withdrawal",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettleBalance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !settleForm.amount ||
      !settleForm.settlement_account_id ||
      !settleForm.partner_account_id
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount (must be positive)
    const amount = Number(settleForm.amount);
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/e-zwich/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(settleForm.amount),
          settlement_account_id: settleForm.settlement_account_id,
          partner_account_id: settleForm.partner_account_id,
          notes: settleForm.notes,
          reference: settleForm.reference,
          branch_id: user?.branchId,
          processed_by: user?.username || "system",
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Settlement processed successfully",
          description: `GHS ${settleForm.amount} settled to partner account`,
        });

        // Reset form
        setSettleForm({
          amount: "",
          settlement_account_id: "",
          partner_account_id: "",
          notes: "",
          reference: "",
        });

        // Close dialog
        setShowSettleDialog(false);

        // Refresh data
        loadFloatAccounts();
        refreshStatistics();
      } else {
        throw new Error(result.error || "Failed to process settlement");
      }
    } catch (error) {
      toast({
        title: "Failed to process settlement",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowEditDialog(true);
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      const response = await fetch(
        `/api/e-zwich/transactions/${transactionId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast({
          title: "Transaction deleted",
          description: "Transaction has been deleted successfully",
        });
        loadTransactions();
      } else {
        throw new Error("Failed to delete transaction");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    }
  };

  const handleTransactionSuccess = () => {
    loadTransactions();
    loadFloatAccounts();
    refreshStatistics();
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            Pending
          </Badge>
        );
      case "failed":
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Failed
          </Badge>
        );
      case "reversed":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Reversed
          </Badge>
        );
      case "deleted":
        return (
          <Badge
            variant="outline"
            className="bg-gray-200 text-gray-700 line-through"
          >
            Deleted
          </Badge>
        );
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  // Custom transaction actions for E-Zwich
  const EZwichTransactionActions = ({ transaction }: { transaction: any }) => {
    const isWithdrawal = transaction.type === "withdrawal";
    const isIssuance = transaction.type === "card_issuance";

    const handleReverse = async () => {
      if (!isWithdrawal) {
        toast({
          title: "Cannot Reverse",
          description: "Only withdrawal transactions can be reversed",
          variant: "destructive",
        });
        return;
      }

      try {
        const response = await fetch("/api/transactions/unified", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reverse",
            transactionId: transaction.id,
            sourceModule: "e_zwich",
            reason: "Customer requested reversal",
            userId: user?.id,
            branchId: user?.branchId,
            processedBy: user?.name,
          }),
        });

        const result = await response.json();

        if (result.success) {
          toast({
            title: "Transaction Reversed",
            description: "The transaction has been successfully reversed",
          });
          loadTransactions();
        } else {
          toast({
            title: "Reversal Failed",
            description: result.error || "Failed to reverse transaction",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error reversing transaction:", error);
        toast({
          title: "Reversal Failed",
          description: "An error occurred while reversing the transaction",
          variant: "destructive",
        });
      }
    };

    const handleEdit = () => {
      setEditingTransaction(transaction);
      setShowEditDialog(true);
    };

    const handleDelete = () => {
      setSelectedTransaction(transaction);
      setDeleteDialogOpen(true);
    };

    const handleViewReceipt = () => {
      // Format transaction data for the shared receipt component
      const formattedReceiptData: TransactionReceiptData = {
        transactionId: transaction.id,
        sourceModule: "e_zwich",
        transactionType: transaction.type,
        amount: transaction.amount || 0,
        fee: 0, // E-Zwich transactions typically don't have fees
        customerName: transaction.customer_name,
        customerPhone: transaction.customer_phone,
        reference: transaction.id,
        branchName: user?.branchName || "Main Branch",
        date: transaction.created_at,
        additionalData: {
          "Card Number": transaction.card_number,
          "Partner Bank": transaction.partner_bank,
          "ID Type": transaction.id_type,
          "ID Number": transaction.id_number,
          City: transaction.city,
          Region: transaction.region,
        },
      };
      setReceiptData(formattedReceiptData);
      setShowReceiptDialog(true);
    };

    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewReceipt}
          title="View Receipt"
        >
          <Receipt className="h-4 w-4" />
        </Button>

        {isIssuance && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            title="Edit Transaction"
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}

        {isWithdrawal && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReverse}
            title="Reverse Transaction"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          title="Delete Transaction"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">E-Zwich Management</h1>
          <p className="text-muted-foreground">
            Process withdrawals, issue cards, and manage transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              loadTransactions();
              loadFloatAccounts();
              refreshStatistics();
            }}
            disabled={loadingTransactions || loadingFloats || statsLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                loadingTransactions || loadingFloats || statsLoading
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {statistics?.totalTransactions?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total transactions
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Volume
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(statistics?.todayVolume || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Transaction volume today
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(statistics?.todayCommission || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Fees collected today
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cards</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-8 w-16 bg-gray-200 animate-pulse rounded" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {statistics?.totalTransactions?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total transactions
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Float Alerts */}
      {floatAlerts && floatAlerts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Low Float Alert:</strong> The following accounts are running
            low on funds:{" "}
            {floatAlerts.map((alert: any) => alert.account_name).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="withdrawal">Withdrawal</TabsTrigger>
          <TabsTrigger value="card-issuance">Card Issuance</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawal" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Withdrawal Form - 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    E-Zwich Withdrawal
                  </CardTitle>
                  <CardDescription>
                    Process an E-Zwich card withdrawal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="card_number">Card Number *</Label>
                        <Input
                          id="card_number"
                          maxLength={11}
                          value={withdrawalForm.card_number}
                          onChange={(e) => {
                            // Allow digits and hyphen
                            let value = e.target.value.replace(/[^\d-]/g, "");
                            
                            // Remove any existing hyphens first
                            const digitsOnly = value.replace(/-/g, "");
                            
                            // Auto-format: Add hyphen after 9th digit (format: 201436783-7)
                            if (digitsOnly.length > 9) {
                              value = digitsOnly.slice(0, 9) + "-" + digitsOnly.slice(9, 10);
                            } else {
                              value = digitsOnly;
                            }
                            
                            setWithdrawalForm({
                              ...withdrawalForm,
                              card_number: value,
                            });
                          }}
                          placeholder="201436783-7"
                          required
                          className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                          Format: 9 digits, hyphen, 1 digit (e.g., 201436783-7)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (GHS) *</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={withdrawalForm.amount}
                          onChange={(e) =>
                            setWithdrawalForm({
                              ...withdrawalForm,
                              amount: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customer_name">Customer Name *</Label>
                        <Input
                          id="customer_name"
                          value={withdrawalForm.customer_name}
                          onChange={(e) =>
                            setWithdrawalForm({
                              ...withdrawalForm,
                              customer_name: e.target.value,
                            })
                          }
                          placeholder="Enter customer name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customer_phone">Customer Phone</Label>
                        <Input
                          id="customer_phone"
                          maxLength={10}
                          value={withdrawalForm.customer_phone}
                          onChange={(e) => {
                            // Only allow digits
                            const value = e.target.value.replace(/\D/g, "");
                            // Limit to 10 digits
                            const limitedValue = value.slice(0, 10);
                            setWithdrawalForm({
                              ...withdrawalForm,
                              customer_phone: limitedValue,
                            });
                          }}
                          placeholder="0241234567"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="settlement_account_id">
                          Settlement Account *
                        </Label>
                        <Select
                          value={withdrawalForm.settlement_account_id}
                          onValueChange={(value) =>
                            setWithdrawalForm({
                              ...withdrawalForm,
                              settlement_account_id: value,
                            })
                          }
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select settlement account" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(floatAccounts) &&
                            floatAccounts.length > 0 ? (
                              floatAccounts
                                .filter(
                                  (account: any) =>
                                    account.account_type === "e-zwich" &&
                                    account.is_active
                                )
                                .map((account: any) => (
                                  <SelectItem
                                    key={account.id}
                                    value={account.id}
                                  >
                                    {account.provider} -{" "}
                                    {formatCurrency(account.current_balance)}
                                    {account.current_balance <
                                      account.min_threshold && (
                                      <span className="ml-2 text-red-600">
                                        (Low)
                                      </span>
                                    )}
                                  </SelectItem>
                                ))
                            ) : (
                              <></>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="withdrawal_fee">Fee (GHS)</Label>
                        <Input
                          id="withdrawal_fee"
                          type="number"
                          value={withdrawalForm.fee || 0}
                          onChange={(e) => {
                            setWithdrawalForm({
                              ...withdrawalForm,
                              fee: e.target.value,
                            });
                            setUserModifiedFee(true);
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={withdrawalForm.notes}
                        onChange={(e) =>
                          setWithdrawalForm({
                            ...withdrawalForm,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Additional notes..."
                        rows={3}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Process Withdrawal
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Float Display - 1 column */}
            <div className="lg:col-span-1">
              <DynamicFloatDisplay
                selectedProvider={getSelectedProviderName()}
                floatAccounts={floatAccounts.filter(
                  (account: any) =>
                    (account.account_type === "e-zwich" ||
                      account.isezwichpartner) &&
                    account.is_active
                )}
                serviceType="e-zwich"
                onRefresh={loadFloatAccounts}
                isLoading={loadingFloats}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="card-issuance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card Issuance Form - 2 columns */}
            <div className="lg:col-span-2">
              <EnhancedCardIssuanceForm
                allFloatAccounts={floatAccounts}
                onSuccess={handleTransactionSuccess}
              />
            </div>

            {/* Float Display - 1 column */}
            <div className="lg:col-span-1">
              <DynamicFloatDisplay
                selectedProvider={undefined}
                floatAccounts={floatAccounts.filter(
                  (account: any) =>
                    (account.account_type === "e-zwich" ||
                      account.isezwichpartner) &&
                    account.is_active
                )}
                serviceType="e-zwich"
                onRefresh={loadFloatAccounts}
                isLoading={loadingFloats}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <TransactionHistoryInterface branchId={user?.branchId || ""} />
        </TabsContent>

        <TabsContent value="settlement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dynamic Float Display - 1 column */}
            <div className="lg:col-span-1">
              <DynamicFloatDisplay
                selectedProvider={undefined}
                floatAccounts={floatAccounts.filter(
                  (account: any) =>
                    account.account_type === "e-zwich" && account.is_active
                )}
                serviceType="e-zwich"
                onRefresh={loadFloatAccounts}
                isLoading={loadingFloats}
              />
            </div>

            {/* Settlement Form - 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5" />
                    Settlement
                  </CardTitle>
                  <CardDescription>
                    Transfer funds from E-Zwich settlement account to partner
                    account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSettleBalance} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="settle_amount">Amount (GHS) *</Label>
                      <Input
                        id="settle_amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={settleForm.amount}
                        onChange={(e) =>
                          setSettleForm({
                            ...settleForm,
                            amount: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settle_settlement_account">
                        Settlement Account *
                      </Label>
                      <Select
                        value={settleForm.settlement_account_id}
                        onValueChange={(value) =>
                          setSettleForm({
                            ...settleForm,
                            settlement_account_id: value,
                          })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select settlement account" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(floatAccounts) &&
                          floatAccounts.length > 0 ? (
                            floatAccounts
                              .filter(
                                (account: any) =>
                                  account.account_type === "e-zwich" &&
                                  account.is_active
                              )
                              .map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.provider} -{" "}
                                  {formatCurrency(account.current_balance)}
                                </SelectItem>
                              ))
                          ) : (
                            <></>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settle_partner_account">
                        Partner Account *
                      </Label>
                      <Select
                        value={settleForm.partner_account_id}
                        onValueChange={(value) =>
                          setSettleForm({
                            ...settleForm,
                            partner_account_id: value,
                          })
                        }
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner account" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(floatAccounts) &&
                          floatAccounts.length > 0 ? (
                            floatAccounts
                              .filter(
                                (account: any) =>
                                  account.account_type === "agency-banking" &&
                                  account.is_active
                              )
                              .map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.provider}
                                  {` (${account.account_number})`} -{" "}
                                  {formatCurrency(account.current_balance)}
                                </SelectItem>
                              ))
                          ) : (
                            <></>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settle_reference">Reference</Label>
                      <Input
                        id="settle_reference"
                        value={settleForm.reference}
                        onChange={(e) =>
                          setSettleForm({
                            ...settleForm,
                            reference: e.target.value,
                          })
                        }
                        placeholder="Transaction reference"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settle_notes">Notes</Label>
                      <Textarea
                        id="settle_notes"
                        value={settleForm.notes}
                        onChange={(e) =>
                          setSettleForm({
                            ...settleForm,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Additional notes..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowSettleDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Process Settlement"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Receipt Dialog */}
      <TransactionReceipt
        data={receiptData}
        open={showReceiptDialog}
        onOpenChange={setShowReceiptDialog}
      />

      {/* Edit Transaction Dialog */}
      <TransactionEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        transaction={editingTransaction}
        sourceModule="e_zwich"
        onSuccess={() => {
          setShowEditDialog(false);
          setEditingTransaction(null);
          handleTransactionSuccess();
        }}
      />

      {/* Delete Transaction Dialog */}
      <TransactionDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        transaction={selectedTransaction}
        sourceModule="e_zwich"
        onSuccess={() => {
          setDeleteDialogOpen(false);
          setSelectedTransaction(null);
          handleTransactionSuccess();
        }}
      />
    </div>
  );
}
