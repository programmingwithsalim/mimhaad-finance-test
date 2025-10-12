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
  customer_phone: z
    .string()
    .min(10, "Phone number must be exactly 10 digits")
    .max(10, "Phone number must be exactly 10 digits")
    .regex(/^\d{10}$/, "Phone number must contain only digits"),
  transaction_amount: z.string().refine(
    (value) => {
      const num = Number(value);
      return !isNaN(num) && num > 0;
    },
    { message: "Amount must be a valid number greater than zero" }
  ),
  fee_amount: z.string().refine(
    (value) => {
      const num = Number(value);
      return !isNaN(num) && num >= 0;
    },
    { message: "Fee must be a valid number greater than or equal to zero" }
  ),
  notes: z.string().optional(),
});

type EditTransactionFormValues = z.infer<typeof editTransactionSchema>;

interface EditEZwichTransactionDialogProps {
  transaction: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditEZwichTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: EditEZwichTransactionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EditTransactionFormValues>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      customer_name: "",
      customer_phone: "",
      transaction_amount: "",
      fee_amount: "",
      notes: "",
    },
  });

  // Reset form when transaction changes
  useEffect(() => {
    if (transaction) {
      form.reset({
        customer_name: transaction.customer_name || "",
        customer_phone: transaction.customer_phone || "",
        transaction_amount: transaction.transaction_amount?.toString() || "",
        fee_amount: transaction.fee_amount?.toString() || "",
        notes: transaction.notes || "",
      });
    }
  }, [transaction, form]);

  const onSubmit = async (data: EditTransactionFormValues) => {
    if (!transaction) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/e-zwich/transactions/${transaction.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...data,
            transaction_amount: Number(data.transaction_amount),
            fee_amount: Number(data.fee_amount),
            updated_by: "current_user", // You might want to get this from context
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update transaction");
      }

      toast({
        title: "Transaction Updated",
        description: "The E-Zwich transaction has been updated successfully.",
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
          <DialogTitle>Edit E-Zwich Transaction</DialogTitle>
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
              <Label htmlFor="customer_phone">Phone Number</Label>
              <Input
                id="customer_phone"
                {...form.register("customer_phone")}
                placeholder="0241234567"
                onChange={(e) => {
                  // Only allow digits
                  const value = e.target.value.replace(/\D/g, "");
                  // Limit to 10 digits
                  const limitedValue = value.slice(0, 10);
                  form.setValue("customer_phone", limitedValue);
                }}
                maxLength={10}
                pattern="[0-9]{10}"
                title="Phone number must be exactly 10 digits"
              />
              {form.formState.errors.customer_phone && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.customer_phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transaction_amount">Amount (GHS)</Label>
              <Input
                id="transaction_amount"
                type="number"
                step="0.01"
                {...form.register("transaction_amount")}
                placeholder="0.00"
              />
              {form.formState.errors.transaction_amount && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.transaction_amount.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Original: {formatCurrency(transaction.transaction_amount)}
              </p>
            </div>

            <div>
              <Label htmlFor="fee_amount">Fee (GHS)</Label>
              <Input
                id="fee_amount"
                type="number"
                step="0.01"
                {...form.register("fee_amount")}
                placeholder="0.00"
              />
              {form.formState.errors.fee_amount && (
                <p className="text-sm text-red-500 mt-1">
                  {form.formState.errors.fee_amount.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Original: {formatCurrency(transaction.fee_amount)}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              placeholder="Enter transaction notes"
              className="resize-none"
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>

          <div className="bg-muted p-3 rounded-md">
            <h4 className="font-medium text-sm mb-2">Transaction Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 capitalize">
                  {transaction.transaction_type}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Card Number:</span>
                <span className="ml-2">{transaction.card_number || "N/A"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>
                <span className="ml-2">
                  {new Date(
                    transaction.transaction_date || transaction.created_at
                  ).toLocaleDateString()}
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
