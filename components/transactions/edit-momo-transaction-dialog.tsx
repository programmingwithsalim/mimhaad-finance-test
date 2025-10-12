"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const editTransactionSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  fee: z.number().min(0, "Fee must be non-negative"),
  reference: z.string().optional(),
});

type EditTransactionFormValues = z.infer<typeof editTransactionSchema>;

interface EditMoMoTransactionDialogProps {
  transaction: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditMoMoTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: EditMoMoTransactionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EditTransactionFormValues>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      customerName: "",
      phoneNumber: "",
      amount: 0,
      fee: 0,
      reference: "",
    },
  });

  useEffect(() => {
    if (transaction && open) {
      form.reset({
        customerName: transaction.customer_name || "",
        phoneNumber: transaction.phone_number || "",
        amount: Number(transaction.amount || 0),
        fee: Number(transaction.fee || 0),
        reference: transaction.reference || "",
      });
    }
  }, [transaction, open, form]);

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
          sourceModule: "momo",
          customerName: data.customerName,
          phoneNumber: data.phoneNumber,
          amount: data.amount,
          fee: data.fee,
          reference: data.reference,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update transaction");
      }

      toast({
        title: "Transaction Updated",
        description:
          "Transaction has been updated successfully and float balances adjusted.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast({
        title: "Update Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update transaction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit MoMo Transaction</DialogTitle>
          <DialogDescription>
            Update transaction details. Float balances will be automatically
            adjusted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                {...form.register("customerName")}
                placeholder="Enter customer name"
              />
              {form.formState.errors.customerName && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.customerName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                {...form.register("phoneNumber")}
                placeholder="Enter phone number"
              />
              {form.formState.errors.phoneNumber && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.phoneNumber.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (GHS)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...form.register("amount", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee">Fee (GHS)</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                {...form.register("fee", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {form.formState.errors.fee && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.fee.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference/Notes</Label>
            <Textarea
              id="reference"
              {...form.register("reference")}
              placeholder="Enter reference or notes"
              className="resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
