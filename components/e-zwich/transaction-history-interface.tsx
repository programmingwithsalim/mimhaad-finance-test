"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  RotateCcw,
  Printer,
  Receipt,
  CreditCard,
  DollarSign,
  Calendar,
  User,
  Phone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { TransactionActions } from "@/components/transactions/transaction-actions";
import { TransactionEditDialog } from "@/components/shared/transaction-edit-dialog";
import { TransactionDeleteDialog } from "@/components/shared/transaction-delete-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
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
  fee?: number;
  processed_by?: string;
  branch_id?: string;
  notes?: string;
  reference?: string;
  customer_photo?: string;
  id_front_image?: string;
  id_back_image?: string;
  card_type?: string;
  id_type?: string;
  id_number?: string;
  id_expiry_date?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  date_of_birth?: string;
  gender?: string;
  customer_email?: string;
}

interface TransactionHistoryInterfaceProps {
  branchId: string;
}

export function TransactionHistoryInterface({
  branchId,
}: TransactionHistoryInterfaceProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("withdrawals");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [transactionsPerPage] = useState(10);

  // Dialog states
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receiptData, setReceiptData] = useState<TransactionReceiptData | null>(
    null
  );
  const [currentTransaction, setCurrentTransaction] =
    useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showIssuanceDetailsDialog, setShowIssuanceDetailsDialog] =
    useState(false);
  const [issuanceDetails, setIssuanceDetails] = useState<Transaction | null>(
    null
  );

  const loadTransactions = async (page = 1) => {
    if (!branchId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        branchId: branchId,
        limit: "10000", // Fetch all for client-side filtering
        page: "1",
      });

      const response = await fetch(
        `/api/e-zwich/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          setFilteredTransactions(data.transactions);
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
          setFilteredTransactions([]);
          setTotalPages(1);
          setTotalTransactions(0);
        }
      } else {
        setTransactions([]);
        setFilteredTransactions([]);
        setTotalPages(1);
        setTotalTransactions(0);
      }
    } catch (error) {
      console.error("Error loading E-Zwich transactions:", error);
      setTransactions([]);
      setFilteredTransactions([]);
      setTotalPages(1);
      setTotalTransactions(0);
    } finally {
      setLoading(false);
    }
  };

  // Handle print receipt
  const handlePrintReceipt = (transaction: Transaction) => {
    console.log("🧾 Opening receipt for E-Zwich transaction:", transaction.id);
    const receiptData: TransactionReceiptData = {
      transactionId: transaction.id,
      sourceModule: "e_zwich",
      transactionType: transaction.type,
      amount: transaction.amount || 0,
      fee: transaction.fee || 0,
      customerName: transaction.customer_name,
      customerPhone: transaction.customer_phone,
      reference: transaction.reference || transaction.id,
      branchName: user?.branchName || "Branch",
      date: transaction.created_at,
      additionalData: {
        cardNumber: transaction.card_number,
        status: transaction.status,
      },
    };
    setReceiptData(receiptData);
    setShowReceiptDialog(true);
  };

  // Helper to convert base64 to data URI for images
  const getImageDataUri = (base64String: string | undefined): string | null => {
    if (!base64String) return null;

    // If already a data URI or full URL, return as is
    if (base64String.startsWith("data:") || base64String.startsWith("http")) {
      return base64String;
    }

    // Otherwise, assume it's base64 and add the prefix
    return `data:image/jpeg;base64,${base64String}`;
  };

  useEffect(() => {
    if (branchId) {
      loadTransactions();
    }
  }, [branchId]);

  // Filter transactions using useMemo
  const allFilteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by type (withdrawal vs issuance)
    if (activeTab === "withdrawals") {
      filtered = filtered.filter((t) => t.type === "withdrawal");
    } else if (activeTab === "issuances") {
      filtered = filtered.filter((t) => t.type === "card_issuance");
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (t) =>
          t.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.customer_phone?.includes(searchTerm) ||
          t.card_number?.includes(searchTerm) ||
          t.id?.includes(searchTerm)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    // Filter by date
    if (dateFilter !== "all") {
      const today = new Date();

      switch (dateFilter) {
        case "today":
          filtered = filtered.filter((t) => {
            const tDate = new Date(t.created_at);
            return tDate.toDateString() === today.toDateString();
          });
          break;
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((t) => {
            const tDate = new Date(t.created_at);
            return tDate >= weekAgo;
          });
          break;
        case "month":
          const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((t) => {
            const tDate = new Date(t.created_at);
            return tDate >= monthAgo;
          });
          break;
      }
    }

    return filtered;
  }, [
    transactions,
    searchTerm,
    statusFilter,
    typeFilter,
    dateFilter,
    activeTab,
  ]);

  // Pagination for filtered results
  const paginatedFilteredTransactions = useMemo(() => {
    const totalFiltered = allFilteredTransactions.length;
    const totalPgs = Math.ceil(totalFiltered / transactionsPerPage);
    setTotalPages(totalPgs);
    setTotalTransactions(totalFiltered);

    const startIndex = (currentPage - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    return allFilteredTransactions.slice(startIndex, endIndex);
  }, [allFilteredTransactions, currentPage, transactionsPerPage]);

  // Update filteredTransactions for display
  useEffect(() => {
    setFilteredTransactions(paginatedFilteredTransactions);
  }, [paginatedFilteredTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, dateFilter, activeTab]);

  const getStatusBadge = (status: string | undefined | null) => {
    if (!status) {
      return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
    }

    const statusConfig = {
      completed: { color: "bg-green-100 text-green-800", label: "Completed" },
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      failed: { color: "bg-red-100 text-red-800", label: "Failed" },
      reversed: { color: "bg-gray-100 text-gray-800", label: "Reversed" },
      processing: { color: "bg-blue-100 text-blue-800", label: "Processing" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      color: "bg-gray-100 text-gray-800",
      label: status,
    };

    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleDelete = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDeleteDialogOpen(true);
  };

  const handleTransactionSuccess = () => {
    loadTransactions();
    toast({
      title: "Success",
      description: "Transaction updated successfully",
    });
  };

  const getTransactionTypeIcon = (type: string) => {
    return type === "withdrawal" ? (
      <DollarSign className="h-4 w-4" />
    ) : (
      <CreditCard className="h-4 w-4" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            View and manage E-Zwich withdrawal and card issuance history
            {totalTransactions > 0 && (
              <span className="block mt-1 text-sm font-medium">
                Showing {transactions.length} of {totalTransactions}{" "}
                transactions
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by customer name, phone, card number, or transaction ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => loadTransactions()}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Tabs for Withdrawals vs Issuances */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="issuances">Card Issuances</TabsTrigger>
            </TabsList>

            <TabsContent value="withdrawals" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Card Number</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          {loading ? (
                            <div className="flex items-center justify-center">
                              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                              Loading transactions...
                            </div>
                          ) : (
                            "No withdrawal transactions found"
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-mono text-sm">
                            {transaction.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {transaction.customer_name}
                              </div>
                              {transaction.customer_phone && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {transaction.customer_phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {transaction.card_number || "N/A"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {transaction.amount
                              ? formatCurrency(transaction.amount)
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {transaction.fee
                              ? formatCurrency(transaction.fee)
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(transaction.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>
                                {format(
                                  new Date(transaction.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </div>
                              <div className="text-muted-foreground">
                                {format(
                                  new Date(transaction.created_at),
                                  "HH:mm"
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TransactionActions
                                transaction={transaction}
                                userRole={user?.role || "User"}
                                sourceModule="e_zwich"
                                onPrint={() => handlePrintReceipt(transaction)}
                                onSuccess={handleTransactionSuccess}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="issuances" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Card Number</TableHead>
                      <TableHead>Card Type</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          {loading ? (
                            <div className="flex items-center justify-center">
                              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                              Loading transactions...
                            </div>
                          ) : (
                            "No card issuance transactions found"
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-mono text-sm">
                            {transaction.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {transaction.customer_name}
                              </div>
                              {transaction.customer_phone && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {transaction.customer_phone}
                                </div>
                              )}
                              {transaction.customer_email && (
                                <div className="text-sm text-muted-foreground">
                                  {transaction.customer_email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {transaction.card_number || "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {transaction.card_type || "Standard"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {transaction.fee
                              ? formatCurrency(transaction.fee)
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(transaction.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>
                                {format(
                                  new Date(transaction.created_at),
                                  "MMM dd, yyyy"
                                )}
                              </div>
                              <div className="text-muted-foreground">
                                {format(
                                  new Date(transaction.created_at),
                                  "HH:mm"
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  console.log("🖼️ View Issuance Details:", {
                                    id: transaction.id,
                                    hasCustomerPhoto:
                                      !!transaction.customer_photo,
                                    hasIdFront: !!transaction.id_front_image,
                                    hasIdBack: !!transaction.id_back_image,
                                    photoLength:
                                      transaction.customer_photo?.length || 0,
                                  });
                                  setIssuanceDetails(transaction);
                                  setShowIssuanceDetailsDialog(true);
                                }}
                                title="View Issuance Details & Images"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <TransactionActions
                                transaction={transaction}
                                userRole={user?.role || "User"}
                                sourceModule="e_zwich"
                                onPrint={() => handlePrintReceipt(transaction)}
                                onSuccess={handleTransactionSuccess}
                                onEdit={() => handleEdit(transaction)}
                                onDelete={() => handleDelete(transaction)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * transactionsPerPage + 1} to{" "}
                {Math.min(currentPage * transactionsPerPage, totalTransactions)}{" "}
                of {totalTransactions} transactions
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={
                          currentPage === pageNum ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <TransactionReceipt
        data={receiptData}
        open={showReceiptDialog}
        onOpenChange={setShowReceiptDialog}
      />

      {/* Issuance Details Dialog with Images */}
      <Dialog
        open={showIssuanceDetailsDialog}
        onOpenChange={setShowIssuanceDetailsDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Card Issuance Details
            </DialogTitle>
            <DialogDescription>
              Complete card issuance information including customer images
            </DialogDescription>
          </DialogHeader>

          {issuanceDetails && (
            <div className="space-y-6">
              {/* Transaction Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    Transaction ID:
                  </span>
                  <p className="font-mono">{issuanceDetails.id}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Card Number:
                  </span>
                  <p className="font-mono">
                    {issuanceDetails.card_number || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Card Type:
                  </span>
                  <p className="capitalize">
                    {issuanceDetails.card_type || "Standard"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Customer:
                  </span>
                  <p>{issuanceDetails.customer_name}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Phone:
                  </span>
                  <p>{issuanceDetails.customer_phone || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Email:
                  </span>
                  <p className="truncate">
                    {issuanceDetails.customer_email || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Date of Birth:
                  </span>
                  <p>
                    {issuanceDetails.date_of_birth
                      ? format(new Date(issuanceDetails.date_of_birth), "PPP")
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Gender:
                  </span>
                  <p className="capitalize">
                    {issuanceDetails.gender || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Fee:
                  </span>
                  <p className="font-medium">
                    {formatCurrency(issuanceDetails.fee || 0)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    ID Type:
                  </span>
                  <p>{issuanceDetails.id_type || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    ID Number:
                  </span>
                  <p>{issuanceDetails.id_number || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    Status:
                  </span>
                  <div className="mt-1">
                    {getStatusBadge(issuanceDetails.status)}
                  </div>
                </div>
              </div>

              {/* Address */}
              {(issuanceDetails.address_line1 || issuanceDetails.city) && (
                <div>
                  <h4 className="font-semibold mb-2">Address</h4>
                  <p className="text-sm">
                    {issuanceDetails.address_line1}
                    {issuanceDetails.address_line2 && (
                      <>, {issuanceDetails.address_line2}</>
                    )}
                    {issuanceDetails.city && (
                      <>
                        <br />
                        {issuanceDetails.city}
                      </>
                    )}
                    {issuanceDetails.region && <>, {issuanceDetails.region}</>}
                    {issuanceDetails.postal_code && (
                      <> {issuanceDetails.postal_code}</>
                    )}
                  </p>
                </div>
              )}

              {/* Images */}
              <div>
                <h4 className="font-semibold mb-3">Uploaded Images</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Customer Photo */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Customer Photo
                    </p>
                    {getImageDataUri(issuanceDetails.customer_photo) ? (
                      <div className="relative group">
                        <img
                          src={getImageDataUri(issuanceDetails.customer_photo)!}
                          alt="Customer"
                          className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition"
                          onClick={() => {
                            const imgWindow = window.open("", "_blank");
                            if (imgWindow) {
                              imgWindow.document.write(`
                                <html>
                                  <head><title>Customer Photo</title></head>
                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                    <img src="${getImageDataUri(
                                      issuanceDetails.customer_photo
                                    )}" style="max-width:100%;max-height:100vh;" />
                                  </body>
                                </html>
                              `);
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition rounded-lg flex items-center justify-center">
                          <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 rounded-lg border bg-muted flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                          No photo
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ID Front */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      ID Front
                    </p>
                    {getImageDataUri(issuanceDetails.id_front_image) ? (
                      <div className="relative group">
                        <img
                          src={getImageDataUri(issuanceDetails.id_front_image)!}
                          alt="ID Front"
                          className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition"
                          onClick={() => {
                            const imgWindow = window.open("", "_blank");
                            if (imgWindow) {
                              imgWindow.document.write(`
                                <html>
                                  <head><title>ID Front</title></head>
                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                    <img src="${getImageDataUri(
                                      issuanceDetails.id_front_image
                                    )}" style="max-width:100%;max-height:100vh;" />
                                  </body>
                                </html>
                              `);
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition rounded-lg flex items-center justify-center">
                          <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 rounded-lg border bg-muted flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                          No image
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ID Back */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      ID Back
                    </p>
                    {getImageDataUri(issuanceDetails.id_back_image) ? (
                      <div className="relative group">
                        <img
                          src={getImageDataUri(issuanceDetails.id_back_image)!}
                          alt="ID Back"
                          className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition"
                          onClick={() => {
                            const imgWindow = window.open("", "_blank");
                            if (imgWindow) {
                              imgWindow.document.write(`
                                <html>
                                  <head><title>ID Back</title></head>
                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                    <img src="${getImageDataUri(
                                      issuanceDetails.id_back_image
                                    )}" style="max-width:100%;max-height:100vh;" />
                                  </body>
                                </html>
                              `);
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition rounded-lg flex items-center justify-center">
                          <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 rounded-lg border bg-muted flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                          No image
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Click on any image to view full size
                </p>
              </div>

              {/* Notes */}
              {issuanceDetails.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">
                    {issuanceDetails.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handlePrintReceipt(issuanceDetails)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </Button>
                <Button onClick={() => setShowIssuanceDetailsDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <TransactionEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        transaction={selectedTransaction}
        sourceModule="e_zwich"
        onSuccess={() => {
          setEditDialogOpen(false);
          setSelectedTransaction(null);
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
