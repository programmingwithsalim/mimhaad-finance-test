"use client";

import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DeleteExpenseDialogProps {
  id: string | null;
  setDeleteId: (id: string | null) => void;
  refresh: () => void;
}

export function DeleteExpenseDialog({
  id,
  setDeleteId,
  refresh,
}: DeleteExpenseDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [expenseDetails, setExpenseDetails] = useState<{
    description?: string;
    amount?: number;
    status?: string;
  }>({});

  useEffect(() => {
    if (id) {
      // Fetch expense details to show in confirmation
      fetch(`/api/expenses/${id}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const text = await res.text();
          console.log("Raw expense details response:", text);

          try {
            return JSON.parse(text);
          } catch (parseError) {
            console.error(
              "Failed to parse expense details response as JSON:",
              parseError
            );
            throw new Error("Invalid JSON response from server");
          }
        })
        .then((data) => {
          console.log("Parsed expense details:", data);
          if (data.success && data.expense) {
            setExpenseDetails({
              description: data.expense.description,
              amount: data.expense.amount,
              status: data.expense.status,
            });
          } else if (data && data.description && data.amount) {
            // Handle direct expense object response
            setExpenseDetails({
              description: data.description,
              amount: data.amount,
              status: data.status,
            });
          }
        })
        .catch((error) => {
          console.error("Error fetching expense details:", error);
          toast({
            title: "Warning",
            description: "Could not load expense details for confirmation",
            variant: "destructive",
          });
        });
    }
  }, [id, toast]);

  const handleDelete = async () => {
    if (!id) return;

    // Check if expense is approved
    if (expenseDetails.status === "approved") {
      toast({
        title: "Cannot Delete",
        description:
          "Approved expenses cannot be deleted. Once an expense is approved, it becomes part of the financial records and cannot be removed.",
        variant: "destructive",
      });
      setDeleteId(null);
      return;
    }

    setLoading(true);
    try {
      console.log("Attempting to delete expense:", id);

      const response = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Delete response status:", response.status);

      // Handle different response statuses
      if (response.ok) {
        // Success - expense was deleted
        toast({
          title: "Success",
          description: "Expense deleted successfully",
        });

        // Close dialog immediately
        setDeleteId(null);

        // Refresh the data
        refresh();

        return;
      }

      // Handle error responses
      let errorMessage = "Failed to delete expense";

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        // If we can't parse the error response, use the status text
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }

      console.error("Delete request failed:", errorMessage);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Network error occurred while deleting expense",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog
      open={!!id}
      onOpenChange={(open) => !open && setDeleteId(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this expense?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {expenseDetails.status === "approved" ? (
              <div className="space-y-2">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
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
                        Approved Expense - Cannot Delete
                      </h3>
                      <div className="mt-1 text-sm text-yellow-700">
                        <p>
                          This expense has been approved and cannot be deleted.
                          Once an expense is approved, it becomes part of the
                          financial records and cannot be removed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : expenseDetails.description && expenseDetails.amount ? (
              <>
                You are about to delete the expense "
                {expenseDetails.description}" with amount{" "}
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "GHS",
                }).format(expenseDetails.amount)}
                . This action cannot be undone.
              </>
            ) : (
              "This action cannot be undone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          {expenseDetails.status !== "approved" && (
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
