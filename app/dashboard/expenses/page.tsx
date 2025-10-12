"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Edit,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { ExpenseForm } from "./_components/expense-form";
import { DeleteExpenseDialog } from "./_components/delete-expense-dialog";
import { ExpenseHeadManagement } from "@/components/expenses/expense-head-management";
import { format, isValid, parseISO } from "date-fns";
import { currencyFormatter } from "@/lib/utils";
import { BranchIndicator } from "@/components/branch/branch-indicator";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Expense {
  id: string;
  reference_number: string;
  branch_id: string;
  branch_name?: string;
  expense_head_id: string;
  amount: number;
  description: string;
  expense_date: string;
  payment_source: string;
  status: "pending" | "approved" | "rejected" | "paid";
  created_by: string;
  expense_head_name?: string;
  expense_head_category?: string;
  created_at: string;
}

interface ExpenseStats {
  total_expenses: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  approved_count: number;
  approved_amount: number;
  paid_count: number;
  paid_amount: number;
}

interface ExpenseHead {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
}

// Safe date formatting function
function formatExpenseDate(dateString: string | Date): string {
  try {
    let date: Date;

    if (typeof dateString === "string") {
      date = parseISO(dateString);
      if (!isValid(date)) {
        date = new Date(dateString);
      }
    } else {
      date = dateString;
    }

    if (!isValid(date)) {
      console.warn("Invalid date:", dateString);
      return "Invalid Date";
    }

    return format(date, "MMM dd, yyyy");
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return "Invalid Date";
  }
}

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]); // For client-side filtering
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("expenses");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>(
    []
  );

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPaymentSource, setFilterPaymentSource] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredPage, setFilteredPage] = useState(1);

  const { user } = useCurrentUser();
  const { toast } = useToast();

  const isAdmin = user?.role === "Admin";

  // Fetch all expenses for client-side filtering
  const fetchExpenses = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      // Build query parameters - fetch all for client-side filtering
      const params = new URLSearchParams();
      if (selectedBranch !== "all") {
        params.append("branchId", selectedBranch);
      }
      params.append("limit", "10000"); // Fetch all

      const response = await fetch(`/api/expenses?${params}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch expenses: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAllExpenses(data.expenses || []);
        setExpenses(data.expenses || []);
      } else {
        throw new Error(data.error || "Failed to fetch expenses");
      }
    } catch (err) {
      console.error("Error fetching expenses:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch("/api/branches");
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || []);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchStats = async () => {
    try {
      console.log("Fetching expense statistics...");

      // Build query parameters for statistics
      const params = new URLSearchParams();
      if (selectedBranch !== "all") {
        params.append("branch_id", selectedBranch);
      }

      const response = await fetch(`/api/expenses-statistics?${params}`, {
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Statistics API response:", data);

        if (data.success) {
          setStats(data.statistics);
        } else {
          console.error("Failed to fetch statistics:", data.error);
        }
      } else {
        console.error("Statistics request failed:", response.status);
      }
    } catch (err) {
      console.error("Error fetching expense statistics:", err);
    }
  };

  // Check if any filters are active
  const hasActiveFilters =
    searchTerm !== "" ||
    filterStatus !== "all" ||
    filterCategory !== "all" ||
    filterPaymentSource !== "all";

  // Filter expenses based on search and filters
  const filteredExpenses = allExpenses.filter((expense) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        expense.description?.toLowerCase().includes(search) ||
        expense.reference_number?.toLowerCase().includes(search) ||
        expense.expense_head_name?.toLowerCase().includes(search) ||
        expense.amount?.toString().includes(search) ||
        expense.branch_name?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filterStatus !== "all" && expense.status !== filterStatus) {
      return false;
    }

    // Category filter
    if (
      filterCategory !== "all" &&
      expense.expense_head_category !== filterCategory
    ) {
      return false;
    }

    // Payment source filter
    if (
      filterPaymentSource !== "all" &&
      expense.payment_source !== filterPaymentSource
    ) {
      return false;
    }

    return true;
  });

  // Get unique categories and payment sources for filter options
  const categories = Array.from(
    new Set(allExpenses.map((e) => e.expense_head_category).filter(Boolean))
  );
  const paymentSources = Array.from(
    new Set(allExpenses.map((e) => e.payment_source).filter(Boolean))
  );

  // Paginate results
  const displayTransactionsPerPage = 20;
  const displayList = hasActiveFilters ? filteredExpenses : allExpenses;
  const displayTotalPages = Math.ceil(
    displayList.length / displayTransactionsPerPage
  );
  const displayPage = hasActiveFilters ? filteredPage : currentPage;
  const displayStartIndex = (displayPage - 1) * displayTransactionsPerPage;
  const displayEndIndex = displayStartIndex + displayTransactionsPerPage;
  const displayExpenses = displayList.slice(displayStartIndex, displayEndIndex);

  // Reset filtered page when filters change
  useEffect(() => {
    setFilteredPage(1);
  }, [searchTerm, filterStatus, filterCategory, filterPaymentSource]);

  useEffect(() => {
    fetchExpenses();
    fetchStats();
    if (user?.role === "Admin") {
      fetchBranches();
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (!isAdmin && user?.branchId) {
      setSelectedBranch(user.branchId);
    }
  }, [isAdmin, user?.branchId]);

  const refreshExpenses = async () => {
    console.log("Refreshing expenses and statistics...");
    setError(null);
    await Promise.all([fetchExpenses(false), fetchStats()]);
    console.log("Refresh completed");
  };

  const onEdit = (id: string) => {
    setEditId(id);
    setOpen(true);
  };

  const onDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleExpenseHeadCreated = (expenseHead: ExpenseHead) => {
    toast({
      title: "Success",
      description: `Expense head "${expenseHead.name}" created successfully!`,
    });
    // Refresh expenses to show any new expense heads
    refreshExpenses();
  };

  // Safe stats access with fallbacks
  const safeStats = {
    totalExpenses: stats?.total_expenses || 0,
    totalAmount: stats?.total_amount || 0,
    pendingCount: stats?.pending_count || 0,
    pendingAmount: stats?.pending_amount || 0,
    approvedCount: stats?.approved_count || 0,
    approvedAmount: stats?.approved_amount || 0,
    paidCount: stats?.paid_count || 0,
    paidAmount: stats?.paid_amount || 0,
  };

  const isFiltered = user?.role !== "Admin" && user?.role !== "Finance";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expenses Management</h1>
          <p className="text-muted-foreground">
            {isFiltered
              ? "Track and manage business expenses for your branch"
              : "Track and manage business expenses across all branches"}
          </p>
          {isFiltered && (
            <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700">
              Showing expenses for your branch only
            </Badge>
          )}
        </div>
        <BranchIndicator />
      </div>
      <Separator className="my-4" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : error ? (
                "Error"
              ) : (
                currencyFormatter(safeStats.totalAmount)
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {safeStats.totalExpenses} total expenses
            </p>
            <p className="text-sm text-muted-foreground">
              {isFiltered ? "Your branch only" : "All branches"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Expenses
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : error ? (
                "Error"
              ) : (
                currencyFormatter(safeStats.pendingAmount)
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {safeStats.pendingCount} pending expenses
            </p>
            <p className="text-sm text-muted-foreground">
              {isFiltered ? "Your branch only" : "All branches"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved Expenses
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : error ? (
                "Error"
              ) : (
                currencyFormatter(safeStats.approvedAmount)
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {safeStats.approvedCount} approved expenses
            </p>
            <p className="text-sm text-muted-foreground">
              {isFiltered ? "Your branch only" : "All branches"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : error ? (
                "Error"
              ) : (
                currencyFormatter(safeStats.paidAmount)
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {safeStats.paidCount} paid expenses
            </p>
            <p className="text-sm text-muted-foreground">
              {isFiltered ? "Your branch only" : "All branches"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="expense-heads">Expense Heads</TabsTrigger>
            </TabsList>
            {activeTab === "expenses" && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Expense
              </Button>
            )}
          </div>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Expenses List</h2>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4">
              {/* Branch Filter for Admin Users */}
              {isAdmin && (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="branch-filter">Filter by Branch:</Label>
                    <Select
                      value={selectedBranch}
                      onValueChange={setSelectedBranch}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedBranch !== "all" && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700"
                    >
                      Filtered by branch
                    </Badge>
                  )}
                </div>
              )}

              {/* Search Bar */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by description, reference, category, or amount..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Filter Options */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category || ""}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filterPaymentSource}
                  onValueChange={setFilterPaymentSource}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Payment Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payment Sources</SelectItem>
                    {paymentSources.map((source) => (
                      <SelectItem key={source} value={source || ""}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                    setFilterCategory("all");
                    setFilterPaymentSource("all");
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
                    Showing {displayStartIndex + 1} to{" "}
                    {Math.min(displayEndIndex, displayList.length)} of{" "}
                    {displayList.length} filtered expenses (from{" "}
                    {allExpenses.length} total)
                  </>
                ) : (
                  <>
                    Showing {displayStartIndex + 1} to{" "}
                    {Math.min(displayEndIndex, allExpenses.length)} of{" "}
                    {allExpenses.length} expenses
                  </>
                )}
              </div>
            </div>

            <Separator className="my-2" />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {user?.role === "Admin" && (
                    <TableHead className="text-center">Branch</TableHead>
                  )}
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      {user?.role === "Admin" && (
                        <TableCell className="text-center">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!loading && error && (
                  <TableRow>
                    <TableCell
                      colSpan={user?.role === "Admin" ? 7 : 6}
                      className="text-center py-8"
                    >
                      <div className="text-red-500">
                        Error loading expenses: {error}
                      </div>
                      <Button
                        variant="outline"
                        onClick={refreshExpenses}
                        className="mt-2"
                      >
                        Try Again
                      </Button>
                    </TableCell>
                  </TableRow>
                )}

                {!loading && !error && displayExpenses.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={user?.role === "Admin" ? 7 : 6}
                      className="text-center py-8"
                    >
                      <div className="text-muted-foreground">
                        {allExpenses.length === 0
                          ? 'No expenses found. Click "Add Expense" to create your first expense.'
                          : "No expenses match your current filters. Try adjusting your search or filters."}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!loading &&
                  !error &&
                  displayExpenses.length > 0 &&
                  displayExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {formatExpenseDate(expense.expense_date)}
                      </TableCell>
                      <TableCell>
                        {expense.description || "No description"}
                      </TableCell>
                      <TableCell>
                        {expense.expense_head_category ||
                          expense.expense_head_name ||
                          "Uncategorized"}
                      </TableCell>
                      <TableCell className="text-right">
                        {currencyFormatter(expense.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {expense.status === "pending" ? (
                          <Badge variant="secondary">Pending</Badge>
                        ) : expense.status === "approved" ? (
                          <Badge variant="default">Approved</Badge>
                        ) : expense.status === "rejected" ? (
                          <Badge variant="destructive">Rejected</Badge>
                        ) : expense.status === "paid" ? (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700"
                          >
                            Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unknown</Badge>
                        )}
                      </TableCell>
                      {user?.role === "Admin" && (
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {expense.branch_name || "Unknown Branch"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          {expense.status !== "approved" && (
                            <>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => onEdit(expense.id)}
                                title="Edit expense"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="icon"
                                onClick={() => onDelete(expense.id)}
                                title="Delete expense"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {expense.status === "approved" && (
                            <div className="text-xs text-muted-foreground">
                              No actions available
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            {hasActiveFilters
              ? // Pagination for filtered results
                displayTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {filteredPage} of {displayTotalPages} (filtered
                      results)
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilteredPage(filteredPage - 1)}
                        disabled={filteredPage <= 1}
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
                                  filteredPage === page ? "default" : "outline"
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
                        onClick={() => setFilteredPage(filteredPage + 1)}
                        disabled={filteredPage >= displayTotalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )
              : // Pagination for all expenses
                allExpenses.length > 0 &&
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
          </TabsContent>

          <TabsContent value="expense-heads" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                Expense Heads Management
              </h2>
            </div>
            <Separator className="my-2" />

            <ExpenseHeadManagement
              onExpenseHeadCreated={handleExpenseHeadCreated}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ExpenseForm
        open={open}
        setOpen={setOpen}
        editId={editId}
        setEditId={setEditId}
        refresh={refreshExpenses}
      />
      <DeleteExpenseDialog
        id={deleteId}
        setDeleteId={setDeleteId}
        refresh={refreshExpenses}
      />
    </div>
  );
}
