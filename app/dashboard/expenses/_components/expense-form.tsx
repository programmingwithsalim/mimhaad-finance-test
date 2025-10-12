"use client";

import type React from "react";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/hooks/use-branches";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useFloatAccounts } from "@/hooks/use-float-accounts";

interface ExpenseFormProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  refresh: () => void;
}

interface ExpenseHead {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
}

export function ExpenseForm({
  open,
  setOpen,
  editId,
  setEditId,
  refresh,
}: ExpenseFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expenseHeads, setExpenseHeads] = useState<ExpenseHead[]>([]);
  const [loadingExpenseHeads, setLoadingExpenseHeads] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [expenseStatus, setExpenseStatus] = useState<string | null>(null);

  // Get current user and branches
  const { user } = useCurrentUser();
  const { branches } = useBranches();

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expense_head_id: "",
    payment_source: "cash",
    notes: "",
    branch_id: "",
  });

  // Set default branch_id when user is loaded
  useEffect(() => {
    if (user && !editId) {
      setFormData((prev) => ({
        ...prev,
        branch_id: user.branchId || "",
      }));
    }
  }, [user, editId]);

  // Fetch expense heads
  const fetchExpenseHeads = async () => {
    setLoadingExpenseHeads(true);
    try {
      const response = await fetch("/api/expense-heads");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setExpenseHeads(data.expense_heads || []);
    } catch (error) {
      console.error("Error fetching expense heads:", error);
      toast({
        title: "Warning",
        description: "Failed to load expense heads. Using fallback data.",
        variant: "destructive",
      });
    } finally {
      setLoadingExpenseHeads(false);
    }
  };

  useEffect(() => {
    if (open) {
      // Only reset date and branch_id when opening a new form (not on every render)
      if (!editId) {
        setDate(new Date());
        if (user && user.role !== "Admin") {
          setFormData((prev) => ({
            ...prev,
            branch_id: user.branchId || "",
          }));
        }
      }
      fetchExpenseHeads();
    }
  }, [open, user, editId]);

  // Fetch expense details if editing
  useEffect(() => {
    if (editId) {
      setLoading(true);
      fetch(`/api/expenses/${editId}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const data = await res.json();
          if (data.success && data.expense) {
            const expense = data.expense;
            setExpenseStatus(expense.status);
            setFormData({
              description: expense.description || "",
              amount: expense.amount?.toString() || "",
              expense_head_id: expense.expense_head_id || "",
              payment_source: expense.payment_source || "cash",
              notes: expense.notes || "",
              branch_id: expense.branch_id || "",
            });
            if (expense.expense_date) {
              setDate(new Date(expense.expense_date));
            }
          } else {
            throw new Error(data.error || "Failed to load expense details");
          }
        })
        .catch((error) => {
          console.error("Error fetching expense details:", error);
          toast({
            title: "Error",
            description: "Failed to load expense details: " + error.message,
            variant: "destructive",
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // Reset form for new expense
      setExpenseStatus(null);
      setFormData({
        description: "",
        amount: "",
        expense_head_id: "",
        payment_source: "cash",
        notes: "",
        branch_id: user?.branchId || "",
      });
      setDate(new Date());
    }
  }, [editId, toast, user]);

  // Fetch float accounts for payment source
  const { accounts: floatAccounts, loading: loadingFloats } =
    useFloatAccounts();

  // Filter float accounts based on user role and branch
  const filteredFloatAccounts = floatAccounts.filter((acc) => {
    // First, filter out inactive accounts and restricted account types
    if (acc.is_active === false) return false;
    if (
      ["e-zwich", "power", "jumia"].includes(acc.account_type?.toLowerCase?.())
    )
      return false;

    // For non-admin users, only show accounts from their branch
    if (user?.role?.toLowerCase() !== "admin") {
      return acc.branch_id === user?.branchId;
    }

    // For admin users, show all accounts (they can select branch in the form)
    return true;
  });

  // Debug log for payment source
  console.log(
    "Filtered float accounts:",
    filteredFloatAccounts,
    "Branch ID:",
    formData.branch_id
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.expense_head_id) {
      toast({
        title: "Validation Error",
        description: "Please select an expense head",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description || formData.description.trim().length < 5) {
      toast({
        title: "Validation Error",
        description: "Please enter a description (at least 5 characters)",
        variant: "destructive",
      });
      return;
    }

    if (!formData.branch_id) {
      toast({
        title: "Validation Error",
        description: "Please select a branch",
        variant: "destructive",
      });
      return;
    }

    if (
      !formData.payment_source ||
      !filteredFloatAccounts.some((acc) => acc.id === formData.payment_source)
    ) {
      toast({
        title: "Validation Error",
        description: "Please select a valid payment source (float account)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        expense_date: format(date, "yyyy-MM-dd"),
      };

      const url = editId ? `/api/expenses/${editId}` : "/api/expenses";
      const method = editId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save expense");
      }

      const data = await response.json();

      toast({
        title: "Success",
        description: editId
          ? "Expense updated successfully!"
          : "Expense created successfully!",
      });

      setOpen(false);
      setEditId(null);
      refresh();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save expense",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditId(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editId ? "Edit Expense" : "Create New Expense"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Warning message for approved expenses */}
            {editId && expenseStatus === "approved" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Approved Expense - Read Only
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        This expense has been approved and cannot be modified.
                        Once an expense is approved, it becomes part of the
                        financial records and cannot be edited or deleted.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_head_id">Expense Head *</Label>
                <Select
                  value={formData.expense_head_id}
                  onValueChange={(value) =>
                    handleSelectChange("expense_head_id", value)
                  }
                  disabled={expenseStatus === "approved"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select expense head" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingExpenseHeads ? (
                      <SelectItem value="loading" disabled>
                        Loading...
                      </SelectItem>
                    ) : expenseHeads.filter((head) => head.is_active).length ===
                      0 ? (
                      <SelectItem value="no-heads" disabled>
                        No expense heads available
                      </SelectItem>
                    ) : (
                      expenseHeads
                        .filter((head) => head.is_active)
                        .map((head) => (
                          <SelectItem key={head.id} value={head.id}>
                            {head.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                {!loadingExpenseHeads &&
                  expenseHeads.filter((head) => head.is_active).length ===
                    0 && (
                    <div className="text-sm text-muted-foreground">
                      No expense heads available. Please create one in the
                      "Expense Heads" tab first.
                    </div>
                  )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  disabled={expenseStatus === "approved"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe the expense..."
                rows={3}
                required
                disabled={expenseStatus === "approved"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_date">Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                      disabled={expenseStatus === "approved"}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => newDate && setDate(newDate)}
                      initialFocus
                      disabled={expenseStatus === "approved"}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_source">Payment Source</Label>
                <Select
                  value={formData.payment_source}
                  onValueChange={(value) =>
                    handleSelectChange("payment_source", value)
                  }
                  disabled={loadingFloats}
                  required
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingFloats ? "Loading..." : "Select payment source"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFloatAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.provider} ({acc.account_type}) - {acc.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingFloats && filteredFloatAccounts.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    No float accounts available for this branch.
                  </div>
                )}
              </div>
            </div>

            {user?.role === "Admin" ? (
              <div className="space-y-2">
                <Label htmlFor="branch_id">Branch</Label>
                <Select
                  value={formData.branch_id}
                  onValueChange={(value) =>
                    handleSelectChange("branch_id", value)
                  }
                  disabled={expenseStatus === "approved"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="branch_id">Branch</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    value={user?.branchName || "Unknown Branch"}
                    disabled
                    className="bg-gray-50"
                  />
                  <div className="text-xs text-muted-foreground">
                    (Your branch)
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Additional notes..."
                rows={2}
                disabled={expenseStatus === "approved"}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || expenseStatus === "approved"}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : expenseStatus === "approved" ? (
                  "Cannot Update Approved Expense"
                ) : (
                  <>{editId ? "Update" : "Create"} Expense</>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
