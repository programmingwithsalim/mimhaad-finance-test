"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { Zap, Loader2 } from "lucide-react";

const formSchema = z.object({
  provider: z.string().min(2, {
    message: "Provider must be at least 2 characters.",
  }),
  meterNumber: z.string().min(1, {
    message: "Meter number is required.",
  }),
  customerName: z.string().min(2, {
    message: "Customer name must be at least 2 characters.",
  }),
  customerPhone: z.string().min(10, {
    message: "Phone number must be at least 10 digits.",
  }),
  amount: z.string().min(1, {
    message: "Amount must be at least 1 character.",
  }),
  description: z.string().optional(),
});

interface PowerTransactionFormProps {
  powerFloats: any[];
  onSubmit: (values: z.infer<typeof formSchema>) => void;
  onSuccess?: () => void;
}

export function PowerTransactionForm({
  powerFloats,
  onSubmit,
  onSuccess,
}: PowerTransactionFormProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [selectedPowerAccount, setSelectedPowerAccount] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: "",
      meterNumber: "",
      customerName: "",
      customerPhone: "",
      amount: "",
      description: "",
    },
  });

  const handleProviderChange = (providerId: string) => {
    form.setValue("provider", providerId);
    const account = powerFloats.find((acc) => acc.id === providerId);
    setSelectedPowerAccount(account);
  };

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to process power transactions",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPowerAccount) {
      toast({
        title: "Error",
        description: "Please select a power provider",
        variant: "destructive",
      });
      return;
    }

    if (!user.branchId) {
      toast({
        title: "Error",
        description: "Branch ID is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/power/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "sale",
          meterNumber: values.meterNumber,
          provider: selectedPowerAccount.provider,
          amount: Number(values.amount),
          customer_name: values.customerName,
          customer_phone: values.customerPhone,
          description: values.description,
          float_account_id: selectedPowerAccount.id,
          user_id: user.id,
          branchId: user.branchId,
          userId: user.id,
          branch_id: user.branchId,
          processed_by:
            user.email || user.username || user.name || "Unknown User",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ [POWER] API Error:", errorText);
        throw new Error(
          `Transaction failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Power Transaction Successful",
          description: `GHS ${values.amount} power sale processed for meter ${values.meterNumber}`,
        });
        form.reset();
        setSelectedPowerAccount(null);

        // Call the onSubmit prop
        onSubmit(values);

        // Call onSuccess if provided
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result.error || "Failed to process power transaction");
      }
    } catch (error: any) {
      console.error("❌ [POWER] Transaction error:", error);
      toast({
        title: "Error",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Power Transaction
        </CardTitle>
        <CardDescription>
          Process electricity bill payments and prepaid top-ups
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Provider Selection */}
            <FormField
              control={form.control}
              name="provider"
              render={() => (
                <FormItem>
                  <FormLabel>Power Provideeer</FormLabel>
                  <Select onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select power provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {powerFloats
                        .filter(
                          (account) =>
                            account.is_active &&
                            account.account_type === "power-float"
                        )
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{account.provider}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                Balance:{" "}
                                {formatCurrency(account.current_balance)}
                                {account.current_balance <
                                  account.min_threshold && (
                                  <span className="ml-2 text-red-600">
                                    (Low)
                                  </span>
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedPowerAccount && (
              <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
                <p>
                  <strong>Selected Provider:</strong>{" "}
                  {selectedPowerAccount.provider}
                </p>
                <p>
                  <strong>Available Balance:</strong>{" "}
                  {formatCurrency(selectedPowerAccount.current_balance)}
                </p>
                <p>
                  <strong>Account Type:</strong>{" "}
                  {selectedPowerAccount.account_type}
                </p>
              </div>
            )}

            {/* Customer Information - Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
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
                      <Input
                        placeholder="0241234567"
                        maxLength={10}
                        {...field}
                        onChange={(e) => {
                          // Only allow digits
                          const value = e.target.value.replace(/\D/g, "");
                          // Limit to 10 digits
                          const limitedValue = value.slice(0, 10);
                          field.onChange(limitedValue);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the transaction"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the purpose of this transaction.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Power Sale...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Process Power Sale
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
