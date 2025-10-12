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
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServiceStatistics } from "@/hooks/use-service-statistics";
import { useDynamicFee } from "@/hooks/use-dynamic-fee";
import { DynamicFloatDisplay } from "@/components/shared/dynamic-float-display";
import { TransactionEditDialog } from "@/components/shared/transaction-edit-dialog";
import { TransactionDeleteDialog } from "@/components/shared/transaction-delete-dialog";
import {
  Building2,
  TrendingUp,
  DollarSign,
  Users,
  RefreshCw,
  Plus,
  Download,
  AlertTriangle,
  Edit,
  Trash2,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { EditAgencyBankingTransactionDialog } from "@/components/transactions/edit-agency-banking-transaction-dialog";
import { TransactionReceipt } from "@/components/shared/transaction-receipt";
import { TransactionActions } from "@/components/transactions/transaction-actions";

export default function AgencyBankingPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const {
    statistics,
    floatAlerts,
    isLoading: statsLoading,
    refreshStatistics,
  } = useServiceStatistics("agency-banking");

  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]); // Store ALL transactions
  const [floatAccounts, setFloatAccounts] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingFloats, setLoadingFloats] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [transactionsPerPage] = useState(20);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBank, setFilterBank] = useState("all");
  const [filteredPage, setFilteredPage] = useState(1);

  // Dialog states for edit and delete
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const [formData, setFormData] = useState({
    type: "",
    amount: "",
    fee: "",
    customer_name: "",
    customer_phone: "",
    account_number: "",
    partner_bank_id: "",
    notes: "",
  });
  const [feeLoading, setFeeLoading] = useState(false);

  // Helper to get selected partner bank object
  const selectedPartnerBank = floatAccounts.find(
    (fa: any) => fa.id === formData.partner_bank_id
  );

  // Use dynamic fee calculation
  const { calculateFee } = useDynamicFee();

  // Track if user has manually modified the fee
  const [userModifiedFee, setUserModifiedFee] = useState(false);

  // Fetch fee when type, amount, or partner bank changes (only if user hasn't manually modified)
  useEffect(() => {
    const fetchFee = async () => {
      if (!formData.type || !formData.amount || !formData.partner_bank_id) {
        setFormData((prev) => ({ ...prev, fee: "" }));
        return;
      }

      // Only auto-calculate if user hasn't manually modified the fee
      if (!userModifiedFee) {
        setFeeLoading(true);
        try {
          const feeResult = await calculateFee(
            "agency_banking",
            formData.type,
            Number(formData.amount)
          );
          setFormData((prev) => ({
            ...prev,
            fee: feeResult.fee.toString(),
          }));
        } catch (err) {
          setFormData((prev) => ({ ...prev, fee: "0" }));
        } finally {
          setFeeLoading(false);
        }
      }
    };
    fetchFee();
  }, [
    formData.type,
    formData.amount,
    formData.partner_bank_id,
    calculateFee,
    userModifiedFee,
  ]);

  // Reset user modification flag when form is reset
  useEffect(() => {
    if (!formData.fee || formData.fee === "") {
      setUserModifiedFee(false);
    }
  }, [formData.fee]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  // Load ALL transactions for client-side filtering
  const loadAllTransactions = async () => {
    if (!user?.branchId) return;

    try {
      setLoadingTransactions(true);
      const params = new URLSearchParams({
        branchId: user.branchId,
        limit: "10000", // Fetch all for client-side filtering
        page: "1",
      });

      const response = await fetch(
        `/api/agency-banking/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.transactions)) {
          setAllTransactions(data.transactions);
          setTotalTransactions(data.total || data.transactions.length);
        } else {
          setAllTransactions([]);
          setTotalTransactions(0);
        }
      } else {
        setAllTransactions([]);
        setTotalTransactions(0);
      }
    } catch (error) {
      console.error("Error loading agency banking transactions:", error);
      setAllTransactions([]);
      setTotalTransactions(0);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Legacy function for compatibility
  const loadTransactions = async (page = 1) => {
    setCurrentPage(page);
  };

  // Handle print receipt
  const handlePrintReceipt = (transaction: any) => {
    console.log(
      "🧾 Opening receipt for Agency Banking transaction:",
      transaction.id
    );
    const receiptData = {
      transactionId: transaction.id,
      sourceModule: "agency_banking" as const,
      transactionType: transaction.type,
      amount: transaction.amount,
      fee: transaction.fee,
      customerName: transaction.customer_name,
      customerPhone: transaction.customer_phone,
      reference: transaction.reference || transaction.id,
      branchName: user?.branchName || "Branch",
      date: transaction.created_at,
      additionalData: {
        partnerBank:
          transaction.partner_bank_name || transaction.partner_bank_id,
        accountNumber: transaction.account_number,
        status: transaction.status,
      },
    };
    setReceiptData(receiptData);
    setReceiptDialogOpen(true);
  };

  // Check if any filters are active
  const hasActiveFilters =
    searchTerm !== "" ||
    filterType !== "all" ||
    filterStatus !== "all" ||
    filterBank !== "all";

  // Filter ALL transactions based on search and filters
  const filteredTransactionsList = allTransactions.filter(
    (transaction: any) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          transaction.customer_name?.toLowerCase().includes(search) ||
          transaction.customer_phone?.toLowerCase().includes(search) ||
          transaction.reference?.toLowerCase().includes(search) ||
          transaction.account_number?.toLowerCase().includes(search) ||
          transaction.partner_bank_name?.toLowerCase().includes(search) ||
          transaction.id?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filterType !== "all" && transaction.type !== filterType) {
        return false;
      }

      // Status filter
      if (filterStatus !== "all" && transaction.status !== filterStatus) {
        return false;
      }

      // Bank filter
      if (filterBank !== "all" && transaction.partner_bank_id !== filterBank) {
        return false;
      }

      return true;
    }
  );

  // Paginate results (either filtered or all)
  const displayTransactionsPerPage = 20;
  const displayList = hasActiveFilters
    ? filteredTransactionsList
    : allTransactions;
  const displayTotalPages = Math.ceil(
    displayList.length / displayTransactionsPerPage
  );
  const displayPage = hasActiveFilters ? filteredPage : currentPage;
  const displayStartIndex = (displayPage - 1) * displayTransactionsPerPage;
  const displayEndIndex = displayStartIndex + displayTransactionsPerPage;
  const displayTransactions = displayList.slice(
    displayStartIndex,
    displayEndIndex
  );

  // Use displayTransactions for rendering
  const filteredTransactions = displayTransactions;
  const filteredStartIndex = displayStartIndex;
  const filteredEndIndex = displayEndIndex;
  const allFilteredTransactions = displayList;
  const filteredTotalPages = displayTotalPages;

  // Reset filtered page when filters change
  useEffect(() => {
    setFilteredPage(1);
  }, [searchTerm, filterType, filterStatus, filterBank]);

  const loadFloatAccounts = async () => {
    if (!user?.branchId) return;

    try {
      setLoadingFloats(true);
      const response = await fetch(
        `/api/float-accounts?branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.accounts)) {
          // Filter for Agency Banking accounts
          const agencyAccounts = data.accounts.filter(
            (account: any) =>
              account.account_type === "agency-banking" ||
              account.provider?.toLowerCase().includes("bank") ||
              account.provider?.toLowerCase().includes("gcb") ||
              account.provider?.toLowerCase().includes("ecobank") ||
              account.provider?.toLowerCase().includes("absa")
          );
          setFloatAccounts(agencyAccounts);
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
      loadAllTransactions();
      loadFloatAccounts();
    }
  }, [user?.branchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.branchId || !user?.id) {
      toast({
        title: "Error",
        description: "Branch ID is required",
        variant: "destructive",
      });
      return;
    }

    if (
      !formData.type ||
      !formData.amount ||
      !formData.customer_name ||
      !formData.customer_phone ||
      !formData.account_number ||
      !formData.partner_bank_id
    ) {
      toast({
        title: "Missing Information",
        description:
          "Please fill in all required fields including customer phone number",
        variant: "destructive",
      });
      return;
    }

    // Validate customer phone number (must be 10 digits for Ghana)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(formData.customer_phone)) {
      toast({
        title: "Invalid Phone Number",
        description:
          "Customer phone number must be exactly 10 digits (e.g., 0241234567)",
        variant: "destructive",
      });
      return;
    }

    // Validate amount (must be positive)
    const amount = Number(formData.amount);
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Validate account number (max 15 characters)
    if (formData.account_number.length > 15) {
      toast({
        title: "Invalid Account Number",
        description: "Account number cannot be more than 15 characters",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/agency-banking/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: formData.type,
          amount: Number(formData.amount),
          fee: Number(formData.fee) || 0,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          account_number: formData.account_number,
          partner_bank_id: formData.partner_bank_id,
          reference: `AGENCY-${Date.now()}`,
          notes: formData.notes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Successful",
          description:
            result.message ||
            "Agency banking transaction processed successfully",
        });

        // Reset form
        setFormData({
          type: "",
          amount: "",
          fee: "",
          customer_name: "",
          customer_phone: "",
          account_number: "",
          partner_bank_id: "",
          notes: "",
        });

        // Refresh data
        loadAllTransactions();
        loadFloatAccounts();
        refreshStatistics();
      } else {
        throw new Error(result.error || "Failed to process transaction");
      }
    } catch (error) {
      toast({
        title: "Transaction Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Type",
      "Customer",
      "Account Number",
      "Partner Bank",
      "Amount",
      "Fee",
      "Status",
    ];
    const csvData = transactions.map((transaction: any) => [
      format(
        new Date(transaction.created_at || new Date()),
        "yyyy-MM-dd HH:mm:ss"
      ),
      transaction.type,
      transaction.customer_name || "",
      transaction.account_number || "",
      transaction.partner_bank || "",
      transaction.amount
        ? Number.parseFloat(transaction.amount).toFixed(2)
        : "0.00",
      transaction.fee ? Number.parseFloat(transaction.fee).toFixed(2) : "0.00",
      transaction.status || "completed",
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `agency-banking-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${transactions.length} transactions to CSV`,
    });
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

  // Handle edit transaction
  const handleEditTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  // Handle delete transaction
  const handleDeleteTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  // Handle print transaction
  const handlePrintTransaction = (transaction: any) => {
    setReceiptData({
      transactionId: transaction.id,
      sourceModule: "agency_banking",
      transactionType: transaction.type,
      amount: Number(transaction.amount),
      fee: Number(transaction.fee),
      customerName: transaction.customer_name,
      reference: transaction.reference,
      branchName: user?.branchName || "",
      date: transaction.created_at,
      additionalData: {
        partnerBank: transaction.partner_bank,
        accountNumber: transaction.account_number,
      },
    });
    setReceiptDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agency Banking Services</h1>
          <p className="text-muted-foreground">
            Manage agency banking transactions and partner bank operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              // This will focus on the transaction form
              const transactionTab = document.querySelector(
                '[data-value="transaction"]'
              ) as HTMLElement;
              if (transactionTab) {
                transactionTab.click();
              }
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Transaction
          </Button>
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              loadAllTransactions();
              loadFloatAccounts();
              refreshStatistics();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Float Alerts */}
      {floatAlerts.length > 0 && (
        <div className="space-y-2">
          {floatAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.severity === "critical"
                  ? "border-l-red-500 bg-red-50"
                  : "border-l-yellow-500 bg-yellow-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    alert.severity === "critical"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                />
                <span className="font-medium">
                  {alert.provider} float balance is {alert.severity}:{" "}
                  {formatCurrency(alert.current_balance)}
                </span>
              </div>
            </div>
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
            <Building2 className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">
              Today's Volume
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.todayVolume)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(statistics.totalVolume)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Commission
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(statistics.todayCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(statistics.totalCommission)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Banks</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.activeProviders}
            </div>
            <p className="text-xs text-muted-foreground">
              Float: {formatCurrency(statistics.floatBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="transaction" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transaction">New Transaction</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="transaction" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Transaction Form - 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Create Agency Banking Transaction
                  </CardTitle>
                  <CardDescription>
                    Process a new agency banking transaction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="type">Transaction Type</Label>
                        <Select
                          value={formData.type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select transaction type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deposit">Deposit</SelectItem>
                            <SelectItem value="withdrawal">
                              Withdrawal
                            </SelectItem>
                            <SelectItem value="interbank_transfer">
                              Inter Bank Transfer
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="partner_bank_id">Partner Bank</Label>
                        <Select
                          value={formData.partner_bank_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, partner_bank_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select partner bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {(floatAccounts as any[]).map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.account_name ||
                                  account.provider ||
                                  account.account_number}
                                {account.current_balance !== undefined &&
                                  ` (Bal: ${formatCurrency(
                                    account.current_balance
                                  )})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {floatAccounts.length === 0 && (
                          <div className="text-xs text-destructive mt-1">
                            No partner banks available for this branch.
                          </div>
                        )}
                        {selectedPartnerBank && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span>
                              Provider: {selectedPartnerBank.provider || "-"}
                            </span>
                            {" | "}
                            <span>
                              Account:{" "}
                              {selectedPartnerBank.account_number ||
                                selectedPartnerBank.account_name}
                            </span>
                            {" | "}
                            <span>
                              Balance:{" "}
                              {formatCurrency(
                                selectedPartnerBank.current_balance
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customer_name">Customer Name</Label>
                        <Input
                          id="customer_name"
                          value={formData.customer_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
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
                          value={formData.customer_phone || ""}
                          onChange={(e) => {
                            // Only allow digits
                            const value = e.target.value.replace(/\D/g, "");
                            // Limit to 10 digits
                            const limitedValue = value.slice(0, 10);
                            setFormData({
                              ...formData,
                              customer_phone: limitedValue,
                            });
                          }}
                          placeholder="0241234567"
                          maxLength={10}
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional: Customer phone number for notifications
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="account_number">Account Number</Label>
                        <Input
                          id="account_number"
                          value={formData.account_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              account_number: e.target.value,
                            })
                          }
                          placeholder="Enter account number"
                          maxLength={15}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum 15 characters
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount (GHS)</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={formData.amount}
                          onChange={(e) =>
                            setFormData({ ...formData, amount: e.target.value })
                          }
                          placeholder="0.00"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Must be greater than 0
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fee">Fee (GHS)</Label>
                        <Input
                          id="fee"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.fee}
                          onChange={(e) => {
                            setFormData({ ...formData, fee: e.target.value });
                            setUserModifiedFee(true);
                          }}
                          placeholder={feeLoading ? "Calculating..." : "0.00"}
                        />
                        <p className="text-xs text-muted-foreground">
                          Auto-calculated fee can be modified as needed
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
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
                          Create Transaction
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
                selectedProvider={selectedPartnerBank?.provider}
                floatAccounts={floatAccounts}
                serviceType="Agency Banking"
                onRefresh={loadFloatAccounts}
                isLoading={loadingFloats}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>
                    All agency banking transactions
                  </CardDescription>
                </div>
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <Input
                      placeholder="Search by customer, phone, account, or bank..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="disbursed">Disbursed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterBank} onValueChange={setFilterBank}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Banks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Banks</SelectItem>
                      {floatAccounts.map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.partner_bank_name || account.provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterType("all");
                      setFilterStatus("all");
                      setFilterBank("all");
                      setFilteredPage(1);
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>

                {/* Results count */}
                <div className="text-sm text-muted-foreground">
                  {hasActiveFilters ? (
                    <>
                      Showing {filteredStartIndex + 1} to{" "}
                      {Math.min(
                        filteredEndIndex,
                        allFilteredTransactions.length
                      )}{" "}
                      of {allFilteredTransactions.length} filtered transactions
                      (from {allTransactions.length} total)
                    </>
                  ) : (
                    <>
                      Showing {displayStartIndex + 1} to{" "}
                      {Math.min(displayEndIndex, allTransactions.length)} of{" "}
                      {allTransactions.length} transactions
                    </>
                  )}
                </div>
              </div>

              {loadingTransactions ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Loading transactions...</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Transactions Found
                  </h3>
                  <p className="text-muted-foreground">
                    {allTransactions.length === 0
                      ? "No agency banking transactions have been processed yet."
                      : "No transactions match your current filters. Try adjusting your search or filters."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Partner Bank</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {format(
                            new Date(transaction.created_at || new Date()),
                            "MMM dd, yyyy HH:mm"
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {transaction.type}
                        </TableCell>
                        <TableCell>
                          {transaction.customer_name || "-"}
                        </TableCell>
                        <TableCell>
                          {transaction.account_number || "-"}
                        </TableCell>
                        <TableCell>{transaction.partner_bank || "-"}</TableCell>
                        <TableCell>
                          {formatCurrency(transaction.amount || 0)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(transaction.fee || 0)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(transaction.status)}
                        </TableCell>
                        <TableCell>
                          <TransactionActions
                            transaction={transaction}
                            userRole={user?.role || "Operation"}
                            sourceModule="agency_banking"
                            onPrint={() => handlePrintReceipt(transaction)}
                            onSuccess={() => {
                              loadAllTransactions();
                              loadFloatAccounts();
                              refreshStatistics();
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination Controls */}
              {hasActiveFilters
                ? // Pagination for filtered results
                  filteredTotalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {filteredPage} of {filteredTotalPages} (filtered
                        results)
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilteredPage(filteredPage - 1);
                          }}
                          disabled={filteredPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>

                        <div className="flex items-center space-x-1">
                          {Array.from(
                            { length: Math.min(5, filteredTotalPages) },
                            (_, i) => {
                              const page = i + 1;
                              return (
                                <Button
                                  key={page}
                                  variant={
                                    filteredPage === page
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() => setFilteredPage(page)}
                                  className="w-8 h-8 p-0"
                                >
                                  {page}
                                </Button>
                              );
                            }
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilteredPage(filteredPage + 1);
                          }}
                          disabled={filteredPage >= filteredTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )
                : // Pagination for all transactions
                  allTransactions.length > 0 &&
                  displayTotalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {displayTotalPages}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>

                        <div className="flex items-center space-x-1">
                          {Array.from(
                            { length: Math.min(5, displayTotalPages) },
                            (_, i) => {
                              const page = i + 1;
                              return (
                                <Button
                                  key={page}
                                  variant={
                                    currentPage === page ? "default" : "outline"
                                  }
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className="w-8 h-8 p-0"
                                >
                                  {page}
                                </Button>
                              );
                            }
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage >= displayTotalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      {editDialogOpen && selectedTransaction && (
        <EditAgencyBankingTransactionDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          transaction={selectedTransaction}
          onSuccess={() => {
            setEditDialogOpen(false);
            setSelectedTransaction(null);
            loadAllTransactions();
            loadFloatAccounts();
            refreshStatistics();
          }}
        />
      )}

      {/* Delete Dialog */}
      {deleteDialogOpen && selectedTransaction && (
        <TransactionDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          transaction={selectedTransaction}
          sourceModule="agency_banking"
          onSuccess={async () => {
            if (!selectedTransaction) return;
            try {
              const response = await fetch(
                `/api/transactions/${selectedTransaction.id}`,
                {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sourceModule: "agency_banking",
                    processedBy: user?.id,
                    branchId: user?.branchId,
                    reason: "User requested deletion",
                  }),
                }
              );
              const result = await response.json();
              if (result.success) {
                toast({
                  title: "Transaction Deleted",
                  description: "Transaction has been deleted successfully.",
                });
                loadAllTransactions();
                loadFloatAccounts();
                refreshStatistics();
              } else {
                toast({
                  title: "Delete Failed",
                  description: result.error || "Failed to delete transaction",
                  variant: "destructive",
                });
              }
            } catch (error) {
              toast({
                title: "Delete Failed",
                description: "Failed to delete transaction",
                variant: "destructive",
              });
            } finally {
              setDeleteDialogOpen(false);
              setSelectedTransaction(null);
            }
          }}
        />
      )}

      {/* Receipt Dialog */}
      {receiptDialogOpen && receiptData && (
        <TransactionReceipt
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          data={receiptData}
        />
      )}
    </div>
  );
}
