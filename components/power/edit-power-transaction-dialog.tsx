"use client";

import React from "react";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  meterNumber: z.string().min(1, "Meter number is required"),
  provider: z.string().min(1, "Provider is required"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(10, "Phone number must be at least 10 digits"),
});

type FormValues = z.infer<typeof formSchema>;

interface PowerTransaction {
  id: string;
  reference: string;
  meterNumber: string;
  provider: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  status: string;
  createdAt: string;
}

interface EditPowerTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: PowerTransaction | null;
  onSuccess: () => void;
}

export function EditPowerTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: EditPowerTransactionDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      meterNumber: transaction?.meterNumber || "",
      provider: transaction?.provider || "",
      amount: transaction?.amount || 0,
      customerName: transaction?.customerName || "",
      customerPhone: transaction?.customerPhone || "",
    },
  });

  // Update form when transaction changes
  React.useEffect(() => {
    if (transaction) {
      form.reset({
        meterNumber: transaction.meterNumber,
        provider: transaction.provider,
        amount: transaction.amount,
        customerName: transaction.customerName || "",
        customerPhone: transaction.customerPhone || "",
      });
    }
  }, [transaction, form]);

  const onSubmit = async (values: FormValues) => {
    if (!transaction) return;

    try {
      setIsSubmitting(true);

      const response = await fetch(
        `/api/power/transactions/${transaction.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update transaction");
      }

      toast({
        title: "Transaction Updated",
        description: "Power transaction has been successfully updated.",
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
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Power Transaction</DialogTitle>
          <DialogDescription>
            Update the power transaction details below.
          </DialogDescription>
        </DialogHeader>
        {transaction ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="meterNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meter Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter meter number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ECG">ECG</SelectItem>
                        <SelectItem value="NEDCo">NEDCo</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
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
              </div>
            </form>
          </Form>
        ) : (
          <div className="flex items-center justify-center min-h-[120px]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading transaction...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
