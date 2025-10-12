"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Download, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface FloatTransaction {
  transaction_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference: string;
  source_module: string;
  source_transaction_id: string;
  created_by_name: string;
}

interface FloatSummary {
  opening_balance: number;
  closing_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_fees: number;
  transaction_count: number;
  net_change: number;
  module_breakdown: Record<
    string,
    {
      count: number;
      deposits: number;
      withdrawals: number;
      fees: number;
    }
  >;
}

interface ComprehensiveFloatStatementProps {
  floatAccountId: string;
  floatAccountName?: string;
}

export function ComprehensiveFloatStatement({
  floatAccountId,
  floatAccountName = "Float Account",
}: ComprehensiveFloatStatementProps) {
  const [transactions, setTransactions] = useState<FloatTransaction[]>([]);
  const [summary, setSummary] = useState<FloatSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [filteredTransactions, setFilteredTransactions] = useState<
    FloatTransaction[]
  >([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(50);

  const modules = [
    { value: "all", label: "All Modules" },
    { value: "manual", label: "Manual" },
    { value: "agency_banking", label: "Agency Banking" },
    { value: "momo", label: "MoMo" },
    { value: "power", label: "Power" },
    { value: "e_zwich", label: "E-Zwich" },
  ];

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      // Use optimized statement endpoint with pagination
      const params = new URLSearchParams({
        floatAccountId,
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const statementResponse = await fetch(
        `/api/float-accounts/optimized-statement?${params}`
      );

      if (!statementResponse.ok) {
        throw new Error("Failed to fetch float statement");
      }

      const result = await statementResponse.json();

      if (result.success && result.data) {
        // Transform optimized format to expected format
        const transformedTransactions = result.data.entries.map(
          (entry: any) => ({
            transaction_id: entry.id,
            transaction_date: entry.date,
            transaction_type: entry.type,
            amount: entry.debit || entry.credit,
            balance_before: 0, // Not used in optimized version
            balance_after: entry.balance,
            description: entry.description,
            reference: entry.reference,
            source_module: entry.source,
            created_by_name: entry.processedBy,
          })
        );

        setTransactions(transformedTransactions);
        setTotalPages(result.data.summary.totalPages);
        setCurrentPage(page);

        // Set summary
        setSummary({
          opening_balance: result.data.summary.openingBalance,
          closing_balance: result.data.summary.closingBalance,
          total_deposits: result.data.summary.totalDebits,
          total_withdrawals: result.data.summary.totalCredits,
          total_fees: 0,
          transaction_count: result.data.summary.transactionCount,
          net_change:
            result.data.summary.closingBalance -
            result.data.summary.openingBalance,
          module_breakdown: {},
        });
      }
    } catch (error) {
      console.error("Error fetching float data:", error);
      toast.error("Failed to fetch float statement data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (floatAccountId) {
      fetchData(currentPage);
    }
  }, [floatAccountId, startDate, endDate, currentPage]);

  useEffect(() => {
    if (selectedModule === "all") {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(
        transactions.filter((t) => t.source_module === selectedModule)
      );
    }
  }, [transactions, selectedModule]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy HH:mm");
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "deposit":
      case "transfer_in":
        return "bg-green-100 text-green-800";
      case "withdrawal":
      case "transfer_out":
        return "bg-red-100 text-red-800";
      case "fee":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case "agency_banking":
        return "bg-blue-100 text-blue-800";
      case "momo":
        return "bg-purple-100 text-purple-800";
      case "power":
        return "bg-yellow-100 text-yellow-800";
      case "e_zwich":
        return "bg-indigo-100 text-indigo-800";
      case "manual":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Type",
      "Amount",
      "Balance Before",
      "Balance After",
      "Description",
      "Reference",
      "Module",
      "Created By",
    ];

    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((t) =>
        [
          formatDate(t.transaction_date),
          t.transaction_type,
          t.amount,
          t.balance_before,
          t.balance_after,
          `"${t.description}"`,
          t.reference,
          t.source_module,
          t.created_by_name,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `float-statement-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Comprehensive Float Statement
          </h2>
          <p className="text-muted-foreground">
            {floatAccountName} - Complete transaction history across all modules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="module">Module</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((module) => (
                    <SelectItem key={module.value} value={module.value}>
                      {module.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchData} disabled={loading} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Opening Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.opening_balance)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Closing Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.closing_balance)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Change</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  summary.net_change >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {summary.net_change >= 0 ? "+" : ""}
                {formatCurrency(summary.net_change)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.transaction_count}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Module Breakdown */}
      {summary?.module_breakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Module Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary.module_breakdown).map(
                ([module, stats]) => (
                  <div key={module} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getModuleColor(module)}>
                        {module.replace("_", " ").toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {stats.count} transactions
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Deposits:</span>
                        <span className="text-green-600">
                          {formatCurrency(stats.deposits)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Withdrawals:</span>
                        <span className="text-red-600">
                          {formatCurrency(stats.withdrawals)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fees:</span>
                        <span className="text-orange-600">
                          {formatCurrency(stats.fees)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found for the selected criteria
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction, index) => (
                    <TableRow key={`${transaction.transaction_id}-${index}`}>
                      <TableCell className="font-mono text-sm">
                        {formatDate(transaction.transaction_date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getTransactionTypeColor(
                            transaction.transaction_type
                          )}
                        >
                          {transaction.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`font-mono ${
                          transaction.amount >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.amount >= 0 ? "+" : ""}
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div>
                          Before: {formatCurrency(transaction.balance_before)}
                        </div>
                        <div>
                          After: {formatCurrency(transaction.balance_after)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.description}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getModuleColor(transaction.source_module)}
                        >
                          {transaction.source_module.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {transaction.reference}
                      </TableCell>
                      <TableCell>{transaction.created_by_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} (
                {summary?.transaction_count || 0} total transactions)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentPage > 1) {
                      setCurrentPage(currentPage - 1);
                    }
                  }}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage(currentPage + 1);
                    }
                  }}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
