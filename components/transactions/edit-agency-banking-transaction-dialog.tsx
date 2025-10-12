"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const editTransactionSchema = z.object({
  customer_name: z
    .string()
    .min(2, "Customer name must be at least 2 characters"),
  account_number: z
    .string()
    .min(5, "Account number must be at least 5 characters"),
  amount: z.string().refine(
    (value) => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    },
    { message: "Amount must be a valid number greater than zero" }
  ),
  fee: z.string().refine(
    (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    },
    { message: "Fee must be a valid number greater than or equal to zero" }
  ),
  reference: z.string().optional(),
});

type EditTransactionFormValues = z.infer<typeof editTransactionSchema>;

interface EditAgencyBankingTransactionDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAgencyBankingTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: EditAgencyBankingTransactionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EditTransactionFormValues>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      customer_name: "",
      account_number: "",
      amount: "",
      fee: "",
      reference: "",
    },
  });

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      form.reset({
        customer_name: transaction.customer_name || "",
        account_number: transaction.account_number || "",
        amount: transaction.amount?.toString() || "",
        fee: transaction.fee?.toString() || "",
        reference: transaction.reference || "",
      });
    }
  }, [transaction, form]);

  const onSubmit = async (data: EditTransactionFormValues) => {
    if (!transaction) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceModule: "agency_banking",
          customer_name: data.customer_name,
          account_number: data.account_number,
          amount: Number(data.amount),
          fee: Number(data.fee),
          reference: data.reference,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update transaction");
      }

      toast({
        title: "Transaction Updated",
        description: "The transaction has been updated successfully.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Update Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update the transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Agency Banking Transaction</DialogTitle>
          <DialogDescription>
            Update the transaction details. Changes will affect float balances
            and GL entries.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                {...form.register("customer_name")}
                placeholder="Enter customer name"
              />
              {form.formState.errors.customer_name && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.customer_name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                {...form.register("account_number")}
                placeholder="Enter account number"
              />
              {form.formState.errors.account_number && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.account_number.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount (GHS)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...form.register("amount")}
                placeholder="0.00"
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.amount.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Original: {formatCurrency(transaction.amount)}
              </p>
            </div>

            <div>
              <Label htmlFor="fee">Fee (GHS)</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                {...form.register("fee")}
                placeholder="0.00"
              />
              {form.formState.errors.fee && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.fee.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Original: {formatCurrency(transaction.fee)}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="reference">Reference/Note</Label>
            <Textarea
              id="reference"
              {...form.register("reference")}
              placeholder="Enter transaction reference or notes"
              className="resize-none"
            />
            {form.formState.errors.reference && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.reference.message}
              </p>
            )}
          </div>

          <div className="bg-muted p-3 rounded-md">
            <h4 className="font-medium text-sm mb-2">Transaction Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 capitalize">{transaction.type}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Partner Bank:</span>
                <span className="ml-2">{transaction.partner_bank}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-2">
                  {new Date(transaction.date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 capitalize">{transaction.status}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
