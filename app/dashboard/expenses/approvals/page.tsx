"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  Building,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Expense, ExpenseHead } from "@/lib/expense-types";

export default function ExpenseApprovalsPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseHeads, setExpenseHeads] = useState<ExpenseHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState("");
  const [approving, setApproving] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Fetch expenses
  const fetchExpenses = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      // Only allow branch filtering for admin users
      if (user?.role === "Admin" && branchFilter !== "all") {
        params.append("branchId", branchFilter);
      } else if (user?.role !== "Admin") {
        // Non-admin users are automatically filtered to their branch
        params.append("branchId", user?.branchId || "");
      }

      if (searchTerm) params.append("search", searchTerm);

      console.log("Fetching expenses with params:", params.toString());

      const response = await fetch(`/api/expenses?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch expenses: ${response.status}`);
      }

      const data = await response.json();
      console.log("Expenses API response:", data);

      // Handle different response formats
      const expensesData = Array.isArray(data) ? data : data.expenses || [];

      setExpenses(expensesData);
      console.log(`Loaded ${expensesData.length} expenses`);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses. Please try again.",
        variant: "destructive",
      });

      // Set fallback data for testing
      setExpenses([
        {
          id: "exp-001",
          reference_number: "EXP-2024-001",
          expense_head_id: "head-001",
          amount: 150.0,
          expense_date: new Date().toISOString(),
          description: "Office supplies purchase",
          status: "pending",
          created_by: "user-001",
          created_by_name: "John Doe",
          branch_id: "branch-001",
          branch_name: "Main Branch",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch expense heads
  const fetchExpenseHeads = async () => {
    try {
      const response = await fetch("/api/expense-heads");

      if (response.ok) {
        const data = await response.json();
        const headsData = Array.isArray(data) ? data : data.expense_heads || [];
        setExpenseHeads(headsData);
      } else {
        console.warn("Failed to fetch expense heads, using fallback");
        setExpenseHeads([
          {
            id: "head-001",
            name: "Office Supplies",
            description: "General office supplies",
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: "head-002",
            name: "Travel & Transport",
            description: "Travel and transportation expenses",
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching expense heads:", error);
      setExpenseHeads([]);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchExpenseHeads();
  }, [statusFilter, branchFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== "") {
        fetchExpenses();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleViewDetails = (expense: Expense) => {
    setSelectedExpense(expense);
    setDetailDialogOpen(true);
    setApprovalComments("");
  };

  const handleApprove = async () => {
    if (!selectedExpense) return;

    setApproving(true);
    try {
      const response = await fetch(
        `/api/expenses/${selectedExpense.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approver_id: user?.id,
            comments: approvalComments,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to approve expense");
      }

      toast({
        title: "Success",
        description: "Expense approved successfully",
      });

      setDetailDialogOpen(false);
      setSelectedExpense(null);
      setApprovalComments("");
      fetchExpenses(); // Refresh the list
    } catch (error) {
      console.error("Error approving expense:", error);
      toast({
        title: "Error",
        description: "Failed to approve expense",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedExpense) return;

    setApproving(true);
    try {
      const response = await fetch(`/api/expenses/${selectedExpense.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "rejected",
          comments: approvalComments,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject expense");
      }

      toast({
        title: "Success",
        description: "Expense rejected successfully",
      });

      setDetailDialogOpen(false);
      setSelectedExpense(null);
      setApprovalComments("");
      fetchExpenses(); // Refresh the list
    } catch (error) {
      console.error("Error rejecting expense:", error);
      toast({
        title: "Error",
        description: "Failed to reject expense",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const getExpenseHeadName = (headId: string) => {
    const head = expenseHeads.find((h) => h.id === headId);
    return head ? head.name : "Unknown Category";
  };

  // Filter expenses based on search term
  const filteredExpenses = expenses.filter((expense) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      expense.description?.toLowerCase().includes(searchLower) ||
      expense.reference_number?.toLowerCase().includes(searchLower) ||
      getExpenseHeadName(expense.expense_head_id)
        .toLowerCase()
        .includes(searchLower)
    );
  });

  // Calculate summary stats
  const pendingCount = expenses.filter((e) => e.status === "pending").length;
  const approvedCount = expenses.filter((e) => e.status === "approved").length;
  const rejectedCount = expenses.filter((e) => e.status === "rejected").length;
  const totalPendingAmount = expenses
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Expense Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve pending expense requests
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {pendingCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalPendingAmount)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {approvedCount}
            </div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {rejectedCount}
            </div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses.length}</div>
            <p className="text-xs text-muted-foreground">All statuses</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter expenses by status, branch, or search term
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {user?.role === "Admin" ? (
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <SelectItem value="branch-001">Main Branch</SelectItem>
                  <SelectItem value="branch-002">Secondary Branch</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {user?.branchName || "Your Branch"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  (Branch-specific view)
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Requests</CardTitle>
          <CardDescription>
            {loading
              ? "Loading..."
              : `${filteredExpenses.length} expense${
                  filteredExpenses.length !== 1 ? "s" : ""
                } found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading expenses...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No expenses found matching your criteria</p>
              <Button
                variant="outline"
                onClick={fetchExpenses}
                className="mt-2"
              >
                Refresh
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.expense_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {expense.reference_number}
                      </TableCell>
                      <TableCell>
                        {getExpenseHeadName(expense.expense_head_id)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {expense.description || "No description"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(expense)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-6">
              {/* Expense Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedExpense.reference_number}
                    </h3>
                    <p className="text-muted-foreground">
                      {getExpenseHeadName(selectedExpense.expense_head_id)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(
                          new Date(selectedExpense.expense_date),
                          "MMMM dd, yyyy"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {selectedExpense.created_by_name || "Unknown User"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {selectedExpense.branch_name || "Unknown Branch"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedExpense.description || "No description provided"}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(selectedExpense.amount)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Amount
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Status:
                      </span>
                      <span>{getStatusBadge(selectedExpense.status)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Created:
                      </span>
                      <span className="text-sm">
                        {format(
                          new Date(selectedExpense.created_at),
                          "MMM dd, yyyy 'at' h:mm a"
                        )}
                      </span>
                    </div>
                    {selectedExpense.updated_at && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Last Updated:
                        </span>
                        <span className="text-sm">
                          {format(
                            new Date(selectedExpense.updated_at),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Approval Actions */}
              {selectedExpense.status === "pending" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">
                      Approval Comments (Optional)
                    </h4>
                    <Textarea
                      placeholder="Add any comments about this expense..."
                      value={approvalComments}
                      onChange={(e) => setApprovalComments(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={approving}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approving ? "Approving..." : "Approve"}
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={approving}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {approving ? "Rejecting..." : "Reject"}
                    </Button>
                  </div>
                </div>
              )}

              {selectedExpense.status !== "pending" && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    This expense has already been {selectedExpense.status}.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
