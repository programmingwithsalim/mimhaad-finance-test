"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Eye,
  CheckCircle,
  Truck,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PaginationInfo } from "@/hooks/use-all-transactions";
import {
  TransactionReceipt,
  TransactionReceiptData,
} from "@/components/shared/transaction-receipt";

interface Transaction {
  id: string;
  customer_name: string;
  phone_number: string;
  amount: number;
  fee: number;
  type: string;
  status: string;
  reference: string;
  provider: string;
  created_at: string;
  branch_id: string;
  branch_name?: string;
  branchName?: string;
  processed_by: string;
  service_type: string;
}

interface TransactionsTableProps {
  transactions: Transaction[];
  loading: boolean;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onViewTransaction: (transaction: Transaction) => void;
  onTransactionUpdate?: () => void;
}

export function TransactionsTable({
  transactions,
  loading,
  pagination,
  onPageChange,
  onNextPage,
  onPrevPage,
  onViewTransaction,
  onTransactionUpdate,
}: TransactionsTableProps) {
  const [pageSize, setPageSize] = useState(pagination.limit);
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [processingActions, setProcessingActions] = useState<Set<string>>(
    new Set()
  );
  const [receiptData, setReceiptData] = useState<TransactionReceiptData | null>(
    null
  );
  const [showReceipt, setShowReceipt] = useState(false);

  const handleComplete = async (transaction: Transaction) => {
    const actionId = `${transaction.id}-complete`;
    setProcessingActions((prev) => new Set(prev).add(actionId));

    try {
      const response = await fetch("/api/transactions/unified", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          transactionId: transaction.id,
          sourceModule: transaction.service_type,
          userId: user?.id,
          branchId: user?.branchId,
          processedBy:
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Transaction completed successfully");
        onTransactionUpdate?.();
      } else {
        toast.error(result.error || "Failed to complete transaction");
      }
    } catch (error) {
      console.error("Error completing transaction:", error);
      toast.error("Failed to complete transaction");
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  const handleDeliver = async (transaction: Transaction) => {
    const actionId = `${transaction.id}-deliver`;
    setProcessingActions((prev) => new Set(prev).add(actionId));

    try {
      const response = await fetch("/api/transactions/unified", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deliver",
          transactionId: transaction.id,
          sourceModule: transaction.service_type,
          userId: user?.id,
          branchId: user?.branchId,
          processedBy:
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Transaction delivered successfully");
        onTransactionUpdate?.();
      } else {
        toast.error(result.error || "Failed to deliver transaction");
      }
    } catch (error) {
      console.error("Error delivering transaction:", error);
      toast.error("Failed to deliver transaction");
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  const handleDisburse = async (transaction: Transaction) => {
    const actionId = `${transaction.id}-disburse`;
    setProcessingActions((prev) => new Set(prev).add(actionId));

    try {
      const response = await fetch("/api/transactions/unified", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disburse",
          transactionId: transaction.id,
          sourceModule: transaction.service_type,
          userId: user?.id,
          branchId: user?.branchId,
          processedBy:
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Disbursed",
          description:
            result.message || "Transaction has been disbursed successfully",
        });
        onTransactionUpdate?.();
      } else {
        throw new Error(result.error || "Failed to disburse transaction");
      }
    } catch (error) {
      toast({
        title: "Disbursement Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessingActions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  const handlePrintReceipt = (transaction: Transaction) => {
    console.log("🧾 Opening receipt for transaction:", transaction.id);
    const receiptData: TransactionReceiptData = {
      transactionId: transaction.id,
      sourceModule:
        transaction.service_type as TransactionReceiptData["sourceModule"],
      transactionType: transaction.type,
      amount: transaction.amount,
      fee: transaction.fee,
      customerName: transaction.customer_name,
      customerPhone: transaction.phone_number,
      reference: transaction.reference || transaction.id,
      branchName: transaction.branchName || transaction.branch_name || "Branch",
      date: transaction.created_at,
      additionalData: {
        provider: transaction.provider,
        processedBy: transaction.processed_by,
        status: transaction.status,
      },
    };
    setReceiptData(receiptData);
    setShowReceipt(true);
  };

  const getActionButton = (transaction: Transaction) => {
    const { service_type, status, type } = transaction;
    const actionId = `${transaction.id}-${service_type}`;
    const isProcessing = processingActions.has(actionId);

    // Power transactions: Show Complete button when pending
    if (service_type === "power" && status === "pending") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleComplete(transaction)}
          disabled={isProcessing}
          className="h-8 w-8 p-0"
          title="Complete Transaction"
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
      );
    }

    // Jumia transactions: Show Deliver button when completed
    if (service_type === "jumia" && status === "completed") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDeliver(transaction)}
          disabled={isProcessing}
          className="h-8 w-8 p-0"
          title="Deliver Transaction"
        >
          <Truck className="h-4 w-4" />
        </Button>
      );
    }

    // MoMo transactions: Show Disburse button when completed
    if (service_type === "momo" && status === "completed") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDisburse(transaction)}
          disabled={isProcessing}
          className="h-8 w-8 p-0"
          title="Disburse Transaction"
        >
          <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
            &#8373;
          </span>
        </Button>
      );
    }

    // Agency Banking transactions: Show Disburse button when completed
    if (service_type === "agency_banking" && status === "completed") {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDisburse(transaction)}
          disabled={isProcessing}
          className="h-8 w-8 p-0"
          title="Disburse Transaction"
        >
          <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
            &#8373;
          </span>
        </Button>
      );
    }

    // E-Zwich withdrawal transactions: Show Disburse button when pending
    if (
      service_type === "e_zwich" &&
      type === "withdrawal" &&
      status === "pending"
    ) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDisburse(transaction)}
          disabled={isProcessing}
          className="h-8 w-8 p-0"
          title="Disburse Transaction"
        >
          <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
            &#8373;
          </span>
        </Button>
      );
    }

    // E-Zwich card issuance transactions: Show Disburse button when completed
    if (
      service_type === "e_zwich" &&
      type === "card_issuance" &&
      status === "completed"
    ) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDisburse(transaction)}
          disabled={isProcessing}
          className="h-8 w-8 p-0"
          title="Disburse Transaction"
        >
          <span style={{ fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
            &#8373;
          </span>
        </Button>
      );
    }

    // Default: Show View button for all transactions
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onViewTransaction(transaction)}
        className="h-8 w-8 p-0"
        title="View Transaction Details"
      >
        <Eye className="h-4 w-4" />
      </Button>
    );
  };

  const userRole = user?.role || "Unknown";

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "disbursed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
      case "error":
        return "bg-red-100 text-red-800";
      case "reversed":
        return "bg-red-100 text-red-800";
      case "deleted":
        return "bg-gray-200 text-gray-700 line-through";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getServiceColor = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return "bg-blue-100 text-blue-800";
      case "agency_banking":
        return "bg-purple-100 text-purple-800";
      case "e_zwich":
        return "bg-green-100 text-green-800";
      case "power":
        return "bg-yellow-100 text-yellow-800";
      case "jumia":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return (
          <AvatarFallback className="bg-blue-100 text-blue-600">
            M
          </AvatarFallback>
        );
      case "agency_banking":
        return (
          <AvatarFallback className="bg-purple-100 text-purple-600">
            A
          </AvatarFallback>
        );
      case "e_zwich":
        return (
          <AvatarFallback className="bg-green-100 text-green-600">
            E
          </AvatarFallback>
        );
      case "power":
        return (
          <AvatarFallback className="bg-yellow-100 text-yellow-600">
            P
          </AvatarFallback>
        );
      case "jumia":
        return (
          <AvatarFallback className="bg-orange-100 text-orange-600">
            J
          </AvatarFallback>
        );
      default:
        return (
          <AvatarFallback className="bg-gray-100 text-gray-600">
            T
          </AvatarFallback>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No transactions found</h3>
        <p className="mt-2 text-muted-foreground">
          No transactions match your current filters or have been recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] whitespace-nowrap">
                Service & Time
              </TableHead>
              <TableHead className="w-[150px] whitespace-nowrap">
                Customer
              </TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">
                Type
              </TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">
                Amount
              </TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">
                Status
              </TableHead>
              <TableHead className="w-[100px] whitespace-nowrap">
                Branch
              </TableHead>
              <TableHead className="w-[180px] whitespace-nowrap">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow
                key={transaction.id}
                className="hover:bg-muted/50 group"
              >
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {getServiceIcon(transaction.service_type)}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm capitalize truncate">
                        {transaction.service_type.replace("_", " ")}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {format(
                          new Date(transaction.created_at),
                          "MMM dd, yyyy"
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {format(new Date(transaction.created_at), "HH:mm:ss")}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell
                  className="max-w-[150px] truncate"
                  title={transaction.customer_name}
                >
                  {transaction.customer_name}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline" className="capitalize">
                    {transaction.type?.replace(/[_-]/g, " ") || "Unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono whitespace-nowrap">
                  ₵{transaction.amount.toLocaleString()}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge className={getStatusColor(transaction.status)}>
                    {transaction.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className="max-w-[100px] truncate"
                  title={
                    transaction.branchName ||
                    transaction.branch_name ||
                    transaction.branch_id
                  }
                >
                  {transaction.branchName ||
                    transaction.branch_name ||
                    transaction.branch_id ||
                    "N/A"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintReceipt(transaction)}
                      className="gap-1"
                      title="Print Receipt"
                    >
                      <Receipt className="h-4 w-4" />
                      <span className="hidden sm:inline">Receipt</span>
                    </Button>
                    {getActionButton(transaction)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalCount > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Rows per page:
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{" "}
            {Math.min(
              pagination.currentPage * pagination.limit,
              pagination.totalCount
            )}{" "}
            of {pagination.totalCount} entries
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevPage}
              disabled={!pagination.hasPrevPage}
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={!pagination.hasNextPage}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Receipt Dialog */}
      <TransactionReceipt
        data={receiptData}
        open={showReceipt}
        onOpenChange={setShowReceipt}
      />
    </div>
  );
}
