"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const deleteTransactionSchema = z.object({
  reason: z.string().min(1, "Reason is required for audit purposes"),
});

type DeleteTransactionFormData = z.infer<typeof deleteTransactionSchema>;

interface TransactionDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  sourceModule: "momo" | "agency_banking" | "e_zwich" | "power" | "jumia";
  onSuccess?: () => void;
}

export function TransactionDeleteDialog({
  open,
  onOpenChange,
  transaction,
  sourceModule,
  onSuccess,
}: TransactionDeleteDialogProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("🗑️ [DELETE-DIALOG] Props received:", {
    open,
    transaction,
    sourceModule,
  });

  const form = useForm<DeleteTransactionFormData>({
    resolver: zodResolver(deleteTransactionSchema),
    defaultValues: {
      reason: "",
    },
  });

  const onSubmit = async (data: DeleteTransactionFormData) => {
    if (!transaction?.id || !user?.id || !user?.branchId) {
      toast({
        title: "Error",
        description: "Missing required information",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/transactions/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: transaction.id,
          sourceModule,
          processedBy: user.id,
          branchId: user.branchId,
          reason: data.reason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description:
            "Transaction deleted successfully. Float balances and GL entries have been reversed.",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModuleDisplayName = (module: string) => {
    switch (module) {
      case "momo":
        return "Mobile Money";
      case "agency_banking":
        return "Agency Banking";
      case "e_zwich":
        return "E-Zwich";
      case "power":
        return "Power";
      case "jumia":
        return "Jumia";
      default:
        return module;
    }
  };

  const getTransactionTypeDisplay = (transaction: any) => {
    if (transaction?.type) {
      return transaction.type.replace("_", " ").toUpperCase();
    }
    if (transaction?.transaction_type) {
      return transaction.transaction_type.replace("_", " ").toUpperCase();
    }
    return "TRANSACTION";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete {getModuleDisplayName(sourceModule)} Transaction
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete the transaction and reverse all
            float balances and GL entries. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> Deleting this transaction will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Reverse all float account balances</li>
              <li>Reverse all GL journal entries</li>
              <li>Create audit trail entries</li>
              <li>This action cannot be undone</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Transaction Details */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="text-sm">
            <span className="font-medium">Transaction ID:</span>{" "}
            {transaction?.id}
          </div>
          <div className="text-sm">
            <span className="font-medium">Type:</span>{" "}
            {getTransactionTypeDisplay(transaction)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Amount:</span>{" "}
            {formatCurrency(transaction?.amount || 0)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Fee:</span>{" "}
            {formatCurrency(transaction?.fee || transaction?.commission || 0)}
          </div>
          <div className="text-sm">
            <span className="font-medium">Customer:</span>{" "}
            {transaction?.customer_name || "N/A"}
          </div>
          <div className="text-sm">
            <span className="font-medium">Date:</span>{" "}
            {transaction?.created_at
              ? new Date(transaction.created_at).toLocaleString()
              : "N/A"}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Reason */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Deletion *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide a reason for deleting this transaction (required for audit purposes)"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Delete Transaction
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
