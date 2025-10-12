"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Printer,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

interface Transaction {
  id: string;
  date: string;
  description: string;
  source_module: string;
  source_transaction_type: string;
  debit: number;
  credit: number;
  balance: number;
  account_name: string;
  transaction_id: string;
  status: string;
  created_by?: string;
  posted_at?: string;
  reference_number?: string;
}

interface TransactionHistoryProps {
  accountId?: string | null;
  title?: string;
  dateRange?: DateRange | null;
  transactionType?: string | null;
}

export function TransactionHistory({
  accountId,
  title = "Transaction History",
  dateRange,
  transactionType,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchTransactions = async (page = 1, size = pageSize) => {
    try {
      setIsLoading(true);
      setError(null);

      const offset = (page - 1) * size;
      const params = new URLSearchParams({
        limit: size.toString(),
        offset: offset.toString(),
      });

      if (accountId && accountId !== "all" && accountId !== "") {
        params.append("accountId", accountId);
      }

      if (dateRange?.from) {
        params.append("dateFrom", dateRange.from.toISOString().split("T")[0]);
      }

      if (dateRange?.to) {
        params.append("dateTo", dateRange.to.toISOString().split("T")[0]);
      }

      if (
        transactionType &&
        transactionType !== "all" &&
        transactionType !== ""
      ) {
        params.append("transactionType", transactionType);
      }

      console.log(
        "Fetching transactions with params:",
        Object.fromEntries(params)
      );

      const response = await fetch(`/api/gl/transaction-history?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Transaction API Response:", data);

      // Ensure transactions is always an array
      const transactionsArray = Array.isArray(data.transactions)
        ? data.transactions
        : [];

      setTransactions(transactionsArray);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);

      if (data.error) {
        setError(data.error);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load transactions"
      );
      setTransactions([]); // Ensure it's always an array
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [accountId, dateRange, transactionType, pageSize]);

  // Fetch data when page or filters change
  useEffect(() => {
    fetchTransactions(currentPage, pageSize);
  }, [currentPage, accountId, dateRange, transactionType, pageSize]);

  const handleRefresh = () => {
    fetchTransactions(currentPage, pageSize);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getSourceModuleBadge = (module: string) => {
    const colors: Record<string, string> = {
      momo: "bg-blue-100 text-blue-800",
      "agency-banking": "bg-green-100 text-green-800",
      commissions: "bg-purple-100 text-purple-800",
      expenses: "bg-orange-100 text-orange-800",
      manual: "bg-gray-100 text-gray-800",
      system: "bg-red-100 text-red-800",
    };

    return colors[module] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      posted: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      reversed: "bg-red-100 text-red-800",
      deleted: "bg-gray-200 text-gray-700 line-through",
      draft: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const handleExport = () => {
    try {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        alert("No data to export");
        return;
      }

      const headers = [
        "Date",
        "Reference",
        "Description",
        "Account",
        "Source",
        "Status",
        "Debit",
        "Credit",
        "Balance",
      ];
      let csvContent = headers.join(",") + "\n";

      transactions.forEach((transaction) => {
        const row = [
          `"${new Date(transaction.date).toLocaleDateString()}"`,
          `"${transaction.reference_number || transaction.transaction_id}"`,
          `"${(transaction.description || "").replace(/"/g, '""')}"`,
          `"${(transaction.account_name || "").replace(/"/g, '""')}"`,
          `"${transaction.source_module || ""}"`,
          `"${transaction.status || ""}"`,
          (transaction.debit || 0).toFixed(2),
          (transaction.credit || 0).toFixed(2),
          (transaction.balance || 0).toFixed(2),
        ];
        csvContent += row.join(",") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `gl-transactions-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    }
  };

  const handlePrint = () => {
    try {
      if (!Array.isArray(transactions) || transactions.length === 0) {
        alert("No data to print");
        return;
      }

      const printWindow = window.open("", "_blank", "width=800,height=600");

      if (!printWindow) {
        alert("Please allow popups for this site to enable printing.");
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>GL Transaction History</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; margin-bottom: 10px; }
              .meta { color: #666; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .text-right { text-align: right; }
              .badge { padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>GL Transaction History</h1>
            <div class="meta">
              <p>Generated on: ${new Date().toLocaleString()}</p>
              <p>Total Transactions: ${transactions.length}</p>
              ${
                dateRange?.from
                  ? `<p>Date Range: ${dateRange.from.toLocaleDateString()} - ${
                      dateRange.to?.toLocaleDateString() || "Present"
                    }</p>`
                  : ""
              }
              ${
                accountId && accountId !== "all"
                  ? `<p>Account Filter: ${accountId}</p>`
                  : ""
              }
              ${
                transactionType && transactionType !== "all"
                  ? `<p>Transaction Type: ${transactionType}</p>`
                  : ""
              }
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th class="text-right">Debit</th>
                  <th class="text-right">Credit</th>
                  <th class="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                ${transactions
                  .map((transaction) => {
                    return `
                    <tr>
                      <td>${new Date(
                        transaction.date
                      ).toLocaleDateString()}</td>
                      <td>${
                        transaction.reference_number ||
                        (transaction.transaction_id || "").substring(0, 8) +
                          "..."
                      }</td>
                      <td>${transaction.description || ""}</td>
                      <td>${transaction.account_name || ""}</td>
                      <td><span class="badge">${
                        transaction.source_module || ""
                      }</span></td>
                      <td><span class="badge">${
                        transaction.status || ""
                      }</span></td>
                      <td class="text-right">${
                        (transaction.debit || 0) > 0
                          ? formatCurrency(transaction.debit)
                          : "-"
                      }</td>
                      <td class="text-right">${
                        (transaction.credit || 0) > 0
                          ? formatCurrency(transaction.credit)
                          : "-"
                      }</td>
                      <td class="text-right">${formatCurrency(
                        transaction.balance || 0
                      )}</td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error("Print failed:", error);
      alert("Print failed. Please try again.");
    }
  };

  if (isLoading && transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Loading transaction history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {total > 0
                ? `Showing ${transactions.length} of ${total} transactions`
                : "No transactions found"}
              {error && (
                <span className="text-red-500 block mt-1">{error}</span>
              )}
              {/* Show active filters */}
              <div className="flex gap-2 mt-2">
                {accountId && accountId !== "all" && (
                  <Badge variant="secondary">Account: {accountId}</Badge>
                )}
                {dateRange?.from && (
                  <Badge variant="secondary">
                    Date: {dateRange.from.toLocaleDateString()} -{" "}
                    {dateRange.to?.toLocaleDateString() || "Present"}
                  </Badge>
                )}
                {transactionType && transactionType !== "all" && (
                  <Badge variant="secondary">Type: {transactionType}</Badge>
                )}
              </div>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              disabled={
                !Array.isArray(transactions) || transactions.length === 0
              }
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              disabled={
                !Array.isArray(transactions) || transactions.length === 0
              }
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!Array.isArray(transactions) || transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {error ? "Error loading transactions" : "No transactions found"}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table id="transaction-history-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow
                      key={`${transaction.id}-${Math.floor(
                        Math.random() * 1000000
                      )}`}
                    >
                      <TableCell>
                        {new Date(transaction.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-sm">
                        {transaction.reference_number ||
                          (transaction.transaction_id || "").substring(0, 8) +
                            "..."}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.description || ""}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.account_name || ""}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getSourceModuleBadge(
                            transaction.source_module || ""
                          )}
                        >
                          {transaction.source_module || ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusBadge(transaction.status || "")}
                        >
                          {transaction.status || ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {(transaction.debit || 0) > 0
                          ? formatCurrency(transaction.debit)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(transaction.credit || 0) > 0
                          ? formatCurrency(transaction.credit)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(transaction.balance || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <div>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} | Total Transactions:{" "}
                  {total}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  Prev
                </Button>
                <span className="text-sm">{currentPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1); // Reset to first page on page size change
                  }}
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
