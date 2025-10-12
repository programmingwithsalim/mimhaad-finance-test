"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Filter, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAllTransactions } from "@/hooks/use-all-transactions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { TransactionsFilters } from "@/components/transactions/transactions-filters";
import { TransactionsSummary } from "@/components/transactions/transactions-summary";
import { TransactionDetailsDialog } from "@/components/transactions/transaction-details-dialog";

export default function TransactionsPage() {
  const {
    transactions,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    updateSearch,
    clearFilters,
    refetch,
    goToPage,
    nextPage,
    prevPage,
    canViewAllBranches,
    isFiltered,
  } = useAllTransactions(true, 30000); // Auto-refresh every 30 seconds

  const { user } = useCurrentUser();

  const [showFilters, setShowFilters] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);

  const handleViewTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetail(true);
  };

  const exportTransactions = () => {
    try {
      const headers = [
        "Date",
        "Service",
        "Customer",
        "Phone",
        "Type",
        "Amount",
        "Fee",
        "Status",
        "Reference",
        "Provider",
        "Branch",
      ];

      const csvContent = [
        headers.join(","),
        ...transactions.map((tx) =>
          [
            new Date(tx.created_at).toLocaleString(),
            tx.service_type,
            `"${tx.customer_name || "N/A"}"`,
            tx.phone_number || "N/A",
            tx.type,
            tx.amount.toLocaleString(),
            tx.fee.toLocaleString(),
            tx.status,
            `"${tx.reference || "N/A"}"`,
            tx.provider || "N/A",
            tx.branch_name || "N/A",
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `transactions-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            {canViewAllBranches
              ? "View and search all transactions across all services and branches"
              : "View and search all transactions for your branch across all services"}
          </p>
          {!canViewAllBranches && (
            <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700">
              Showing transactions for your branch only
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetch} disabled={loading}>
            <RefreshCw
              className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportTransactions}
            disabled={transactions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Badge variant="secondary" className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Auto-refresh: 30s
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <TransactionsFilters
        filters={filters}
        onFilterChange={updateFilters}
        onSearchChange={updateSearch}
        onClearFilters={clearFilters}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        activeFiltersCount={activeFiltersCount}
        canViewAllBranches={canViewAllBranches}
      />

      {/* Results Summary */}
      <TransactionsSummary
        transactions={transactions}
        pagination={pagination}
        loading={loading}
        error={error}
        onRetry={refetch}
      />

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            All transactions across services{" "}
            {!canViewAllBranches && "for your branch"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            transactions={transactions}
            loading={loading}
            pagination={pagination}
            onPageChange={goToPage}
            onNextPage={nextPage}
            onPrevPage={prevPage}
            onViewTransaction={handleViewTransaction}
          />
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        transaction={selectedTransaction}
        open={showTransactionDetail}
        onOpenChange={setShowTransactionDetail}
      />
    </div>
  );
}
