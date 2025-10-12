"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const editTransactionSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  fee: z.number().min(0, "Fee must be non-negative"),
  customerName: z.string().min(1, "Customer name is required"),
  reference: z.string().optional(),
});

type EditTransactionFormData = z.infer<typeof editTransactionSchema>;

interface TransactionEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  sourceModule: "momo" | "agency_banking" | "e_zwich" | "power" | "jumia";
  onSuccess?: () => void;
}

export function TransactionEditDialog({
  open,
  onOpenChange,
  transaction,
  sourceModule,
  onSuccess,
}: TransactionEditDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log("🔧 [EDIT-DIALOG] Props received:", {
    open,
    transaction,
    sourceModule,
  });

  console.log("🔧 [EDIT-DIALOG] Dialog should be open:", open);
  console.log("🔧 [EDIT-DIALOG] Transaction data:", transaction);

  const form = useForm<EditTransactionFormData>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      amount: transaction?.amount || 0,
      fee: transaction?.fee || transaction?.commission || 0,
      customerName: transaction?.customer_name || "",
      reference: transaction?.reference || "",
    },
  });

  console.log("🔧 [EDIT-DIALOG] Form default values:", {
    amount: transaction?.amount || 0,
    fee: transaction?.fee || transaction?.commission || 0,
    customerName: transaction?.customer_name || "",
    reference: transaction?.reference || "",
  });

  const onSubmit = async (data: EditTransactionFormData) => {
    if (!transaction?.id) {
      toast({
        title: "Error",
        description: "Transaction ID not found",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/transactions/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: transaction.id,
          sourceModule,
          amount: data.amount,
          fee: data.fee,
          customerName: data.customerName,
          reference: data.reference,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Transaction updated successfully",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast({
        title: "Error",
        description: "Failed to update transaction",
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

  useEffect(() => {
    if (transaction && open) {
      form.reset({
        amount: transaction.amount || 0,
        fee: transaction.fee || transaction.commission || 0,
        customerName: transaction.customer_name || "",
        reference: transaction.reference || "",
      });
    }
  }, [transaction, open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit {getModuleDisplayName(sourceModule)} Transaction
          </DialogTitle>
          <DialogDescription>
            Update transaction details. Changes will automatically adjust float
            balances and GL entries.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Transaction Info Display */}
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
                <span className="font-medium">Date:</span>{" "}
                {transaction?.created_at
                  ? new Date(transaction.created_at).toLocaleString()
                  : "N/A"}
              </div>
            </div>

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (GHS)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fee */}
            <FormField
              control={form.control}
              name="fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee (GHS)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Name */}
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter reference" {...field} />
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Transaction"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
