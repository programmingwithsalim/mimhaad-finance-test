"use client";

import { useState } from "react";
import {
  MoreVertical,
  Edit,
  Trash2,
  RotateCcw,
  Eye,
  Printer,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";

interface TransactionActionsProps {
  transaction: any;
  userRole: string;
  onEdit?: (transaction: any) => void;
  onDelete?: (transaction: any) => void;
  onPrint?: () => void;
  onReverse?: () => void;
  onView?: () => void;
  sourceModule: string;
  onSuccess?: () => void;
}

export function TransactionActions({
  transaction,
  userRole,
  onEdit,
  onDelete,
  onPrint,
  onReverse,
  onView,
  sourceModule,
  onSuccess,
}: TransactionActionsProps) {
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useCurrentUser();

  // Permission checks
  const canEdit = userRole === "Admin" || userRole === "Finance";
  const canDelete = userRole === "Admin" || userRole === "Finance";
  const canReverse =
    userRole === "Admin" || userRole === "Manager" || userRole === "Operations";
  const canComplete =
    userRole === "Admin" || userRole === "Manager" || userRole === "Cashier";
  const canDeliver =
    userRole === "Admin" || userRole === "Manager" || userRole === "Cashier";

  // Special handling for Jumia transactions
  const isJumiaPackageReceipt =
    sourceModule === "jumia" &&
    transaction.type?.toLowerCase().includes("package") &&
    transaction.type?.toLowerCase().includes("receipt");

  // Package receipts cannot be reversed, but can be edited/deleted without GL posting
  const canReverseTransaction = canReverse && !isJumiaPackageReceipt;

  // Define action handlers first
  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/transactions/unified", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          transactionId: transaction.id,
          sourceModule: sourceModule,
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
          title: "Transaction Completed",
          description:
            result.message || "Transaction has been completed successfully",
        });
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to complete transaction");
      }
    } catch (error) {
      toast({
        title: "Completion Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeliver = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/transactions/unified", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deliver",
          transactionId: transaction.id,
          sourceModule: sourceModule,
          userId: user?.id,
          branchId: user?.branchId,
          processedBy:
            user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Delivered",
          description: "Transaction has been delivered successfully",
        });
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to deliver transaction");
      }
    } catch (error) {
      toast({
        title: "Delivery Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisburse = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/transactions/unified", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disburse",
          transactionId: transaction.id,
          sourceModule: sourceModule,
          userId: user?.id,
          branchId: user?.branchId,
          processedBy:
            user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Disbursed",
          description: "Transaction has been disbursed successfully",
        });
        onSuccess?.();
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
      setIsProcessing(false);
    }
  };

  // Determine which action button to show based on transaction type and status
  const getActionButton = () => {
    console.log("🔍 Action button check:", {
      sourceModule,
      transactionType: transaction.type,
      status: transaction.status,
      transaction: transaction,
    });
    // Power transactions: Show Complete button when pending
    if (sourceModule === "power" && transaction.status === "pending") {
      return {
        label: "Complete",
        action: handleComplete,
        canShow: canComplete,
      };
    }

    // Jumia transactions: Show Deliver button when completed
    if (sourceModule === "jumia" && transaction.status === "completed") {
      return {
        label: "Deliver",
        action: handleDeliver,
        canShow: canDeliver,
      };
    }

    // MoMo transactions: Show Disburse button when completed
    if (sourceModule === "momo" && transaction.status === "completed") {
      return {
        label: "Disburse",
        action: handleDisburse, // Using existing disburse logic
        canShow: canReverse,
      };
    }

    // Agency Banking transactions: Show Disburse button when completed
    if (
      sourceModule === "agency_banking" &&
      transaction.status === "completed"
    ) {
      return {
        label: "Disburse",
        action: handleDisburse, // Using existing disburse logic
        canShow: canReverse,
      };
    }

    // E-Zwich withdrawal transactions: Show Disburse button when pending
    if (
      sourceModule === "e_zwich" &&
      transaction.type === "withdrawal" &&
      transaction.status === "pending"
    ) {
      return {
        label: "Disburse",
        action: handleDisburse, // Using existing disburse logic
        canShow: canReverse,
      };
    }

    // E-Zwich card issuance transactions: Show Disburse button when completed
    if (
      sourceModule === "e_zwich" &&
      transaction.type === "card_issuance" &&
      transaction.status === "completed"
    ) {
      return {
        label: "Disburse",
        action: handleDisburse, // Using existing disburse logic
        canShow: canReverse,
      };
    }

    return null;
  };

  const actionButton = getActionButton();

  // POD collections and settlements can be edited/deleted with GL posting
  const canEditTransaction = canEdit;
  const canDeleteTransaction = canDelete;

  const handleReverse = async () => {
    if (!reverseReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the reversal",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      // For Jumia package receipts, show error since they can't be reversed
      if (isJumiaPackageReceipt) {
        toast({
          title: "Cannot Reverse Package Receipt",
          description:
            "Package receipts don't affect GL accounts and cannot be reversed",
          variant: "destructive",
        });
        setShowReverseDialog(false);
        setReverseReason("");
        return;
      }

      let response;
      if (sourceModule === "jumia") {
        response = await fetch(
          `/api/jumia/transactions/${transaction.transaction_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reverse",
              reason: reverseReason,
              userId: user?.id,
              branchId: user?.branchId,
              processedBy:
                user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.email,
            }),
          }
        );
      } else {
        response = await fetch("/api/transactions/unified", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reverse",
            transactionId: transaction.id,
            sourceModule: sourceModule,
            reason: reverseReason,
            userId: user?.id,
            branchId: user?.branchId,
            processedBy:
              user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.email,
          }),
        });
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Reversed",
          description: "Transaction has been reversed successfully",
        });
        setShowReverseDialog(false);
        setReverseReason("");
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to reverse transaction");
      }
    } catch (error) {
      toast({
        title: "Reversal Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      let response;
      if (sourceModule === "jumia") {
        response = await fetch(
          `/api/jumia/transactions/${transaction.transaction_id}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user?.id,
              branchId: user?.branchId,
              processedBy:
                user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.email,
            }),
          }
        );
      } else {
        response = await fetch("/api/transactions/unified", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionId: transaction.id,
            sourceModule: sourceModule,
            userId: user?.id,
            branchId: user?.branchId,
            processedBy:
              user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.email,
          }),
        });
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Deleted",
          description: "Transaction has been deleted successfully",
        });
        setShowDeleteDialog(false);
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to delete transaction");
      }
    } catch (error) {
      toast({
        title: "Deletion Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    if (onPrint) {
      onPrint();
    } else {
      toast({
        title: "Print Not Available",
        description: "Receipt printing is not configured for this transaction",
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (updated: any) => {
    setIsProcessing(true);
    try {
      let response;
      if (sourceModule === "jumia") {
        response = await fetch(
          `/api/jumia/transactions/${transaction.transaction_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update",
              updateData: updated,
              userId: user?.id,
              branchId: user?.branchId,
              processedBy:
                user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.email,
            }),
          }
        );
      } else {
        response = await fetch("/api/transactions/unified", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            transactionId: transaction.id,
            sourceModule: sourceModule,
            updateData: updated,
            userId: user?.id,
            branchId: user?.branchId,
            processedBy:
              user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.email,
          }),
        });
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Updated",
          description: "Transaction has been updated successfully",
        });
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to update transaction");
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onView && (
            <DropdownMenuItem onClick={onView}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
          )}

          {/* Dynamic Action Button */}
          {actionButton && actionButton.canShow && (
            <DropdownMenuItem onClick={actionButton.action}>
              <DollarSign className="mr-2 h-4 w-4" />
              {actionButton.label}
            </DropdownMenuItem>
          )}

          {canEditTransaction && onEdit && (
            <DropdownMenuItem onClick={() => onEdit(transaction)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handlePrintReceipt}>
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {canReverseTransaction && (
            <DropdownMenuItem
              onClick={() => setShowReverseDialog(true)}
              className="text-red-600"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reverse
            </DropdownMenuItem>
          )}

          {canDeleteTransaction && onDelete && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reverse Dialog */}
      <Dialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to reverse this transaction? This action
              cannot be undone and will affect the general ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reverse-reason">Reason for Reversal</Label>
              <Textarea
                id="reverse-reason"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Enter the reason for reversing this transaction..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowReverseDialog(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReverse}
                disabled={isProcessing}
                variant="destructive"
              >
                {isProcessing ? "Reversing..." : "Reverse Transaction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? "Deleting..." : "Delete Transaction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
