"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const formSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  meterNumber: z.string().min(5, "Meter number must be at least 5 characters"),
  customerName: z
    .string()
    .min(3, "Customer name must be at least 3 characters"),
  customerPhone: z
    .string()
    .min(1, "Phone number is required")
    .regex(
      /^\d{10}$/,
      "Phone number must be exactly 10 digits (e.g., 0241234567)"
    ),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  fee: z.coerce.number().min(0, "Fee must be 0 or greater").default(0),
  paymentMethod: z.enum(["cash", "momo", "bank"]).default("cash"),
  paymentAccountId: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EnhancedPowerTransactionFormProps {
  powerFloats: any[];
  onSuccess?: (data: any) => void;
  user: any;
}

export function EnhancedPowerTransactionForm({
  powerFloats,
  onSuccess,
  user,
}: EnhancedPowerTransactionFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPowerAccount, setSelectedPowerAccount] = useState<any>(null);
  const [feeConfig, setFeeConfig] = useState<any>(null);
  const [userModifiedFee, setUserModifiedFee] = useState(false);
  const [floatAccounts, setFloatAccounts] = useState<any[]>([]);
  const [loadingFloatAccounts, setLoadingFloatAccounts] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: "",
      meterNumber: "",
      customerName: "",
      customerPhone: "",
      amount: 0,
      fee: 0,
      paymentMethod: "cash",
      paymentAccountId: undefined,
      description: undefined,
    },
  });

  const watchProvider = form.watch("provider");
  const watchAmount = form.watch("amount");
  const watchPaymentMethod = form.watch("paymentMethod");

  // Fetch float accounts on component mount
  useEffect(() => {
    fetchFloatAccounts();
  }, []);

  // Auto-calculate fee when amount or provider changes (if user hasn't manually modified it)
  useEffect(() => {
    if (!userModifiedFee && watchAmount > 0 && watchProvider) {
      loadFeeConfig(watchAmount, watchProvider);
    }
  }, [watchAmount, watchProvider, userModifiedFee]);

  const fetchFloatAccounts = async () => {
    try {
      setLoadingFloatAccounts(true);
      const isAdmin = user?.role?.toLowerCase() === "admin";
      const url = isAdmin
        ? "/api/float-accounts"
        : `/api/float-accounts?branchId=${user?.branchId}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setFloatAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error fetching float accounts:", error);
    } finally {
      setLoadingFloatAccounts(false);
    }
  };

  // Update selected account when provider changes
  useEffect(() => {
    if (watchProvider) {
      const account = powerFloats.find((acc) => acc.id === watchProvider);
      setSelectedPowerAccount(account);
    } else {
      setSelectedPowerAccount(null);
    }
  }, [watchProvider, powerFloats]);

  // Load fee configuration and calculate fee
  const loadFeeConfig = async (amount: number, provider: string) => {
    try {
      const response = await fetch("/api/power/calculate-fee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          provider,
          transactionType: "sale",
        }),
      });

      if (response.ok) {
        const config = await response.json();
        setFeeConfig(config);

        // New API returns calculated fee directly
        if (config.success && config.fee !== undefined) {
          form.setValue("fee", Number(config.fee));
        } else {
          // Fallback fee calculation
          const fallbackFee = Math.min(amount * 0.02, 10); // 2% max 10 GHS
          form.setValue("fee", fallbackFee);
        }
      } else {
        // Fallback fee calculation
        const fallbackFee = Math.min(amount * 0.02, 10); // 2% max 10 GHS
        form.setValue("fee", fallbackFee);
      }
    } catch (error) {
      console.error("Error loading fee config:", error);
      // Fallback fee calculation
      const fallbackFee = Math.min(amount * 0.02, 10); // 2% max 10 GHS
      form.setValue("fee", fallbackFee);
    }
  };

  const currentFee = form.watch("fee");

  // Auto-calculate fee when amount or provider changes (only if user hasn't manually modified)
  useEffect(() => {
    if (watchAmount && watchAmount > 0 && watchProvider && !userModifiedFee) {
      loadFeeConfig(watchAmount, watchProvider);
    } else if (!watchAmount || !watchProvider) {
      form.setValue("fee", 0);
      setFeeConfig(null);
    }
  }, [watchAmount, watchProvider, form, userModifiedFee]);

  // Reset user modification flag when form is reset
  useEffect(() => {
    if (!currentFee || currentFee === 0) {
      setUserModifiedFee(false);
    }
  }, [currentFee]);

  const onSubmit = async (values: FormValues) => {
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

    // Validate payment account selection for non-cash payments
    if (values.paymentMethod !== "cash" && !values.paymentAccountId) {
      toast({
        title: "Error",
        description: "Please select a payment account for non-cash payments",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const requestBody = {
        provider: selectedPowerAccount.provider,
        meter_number: values.meterNumber,
        customer_name: values.customerName,
        customer_phone: values.customerPhone,
        amount: values.amount,
        fee: values.fee ?? 0,
        payment_method: values.paymentMethod,
        payment_account_id: values.paymentAccountId || null,
        description:
          values.description ||
          `Power purchase for meter ${values.meterNumber}`,
        float_account_id: selectedPowerAccount.id,
        userId: user.id,
        branchId: user.branchId,
        processed_by: user.username || user.email || "Unknown User",
      };

      const response = await fetch("/api/power/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: selectedPowerAccount.provider,
          meter_number: values.meterNumber,
          customer_name: values.customerName,
          customer_phone: values.customerPhone,
          amount: values.amount,
          fee: values.fee ?? 0,
          payment_method: values.paymentMethod,
          payment_account_id: values.paymentAccountId || null,
          description:
            values.description ||
            `Power purchase for meter ${values.meterNumber}`,
          float_account_id: selectedPowerAccount.id,
          userId: user.id,
          branchId: user.branchId,
          processed_by: user.username || user.email || "Unknown User",
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Transaction Successful",
          description: `Power purchase of ${formatCurrency(
            values.amount
          )} processed successfully`,
        });

        // Reset all form states
        form.reset({
          provider: "",
          floatAccountId: "",
          meterNumber: "",
          customerName: "",
          customerPhone: "",
          amount: 0,
          fee: 0,
          paymentMethod: "cash",
          paymentAccountId: "",
          description: "",
        });
        setSelectedPowerAccount(null);
        setUserModifiedFee(false);

        if (onSuccess) {
          onSuccess(result.transaction);
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process power transaction",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error processing power transaction:", error);
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Power Transaction
          </CardTitle>
          <CardDescription>
            Process electricity bill payments for customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Provider Selection */}
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Power Provider</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select power provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {powerFloats.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No power accounts available
                          </SelectItem>
                        ) : (
                          powerFloats.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{account.provider}</span>
                                <Badge variant="outline" className="ml-2">
                                  {formatCurrency(account.current_balance)}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Form Fields in 2 Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
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
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter customer's full name"
                            {...field}
                          />
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
                            min="0.01"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Transaction Fee (GHS)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={field.value || ""}
                            onChange={(e) => {
                              const value =
                                e.target.value === ""
                                  ? 0
                                  : Number(e.target.value);
                              field.onChange(value);
                              setUserModifiedFee(true);
                            }}
                          />
                        </FormControl>
                        {feeConfig && (
                          <FormDescription>
                            {feeConfig.fee_type === "fixed"
                              ? `Fixed fee: ${formatCurrency(
                                  feeConfig.fee_value
                                )}`
                              : `${feeConfig.fee_value}% fee`}
                            {feeConfig.minimum_fee &&
                              ` (Min: ${formatCurrency(
                                feeConfig.minimum_fee
                              )})`}
                            {feeConfig.maximum_fee &&
                              ` (Max: ${formatCurrency(
                                feeConfig.maximum_fee
                              )})`}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0241234567"
                            maxLength={10}
                            {...field}
                            onBlur={async () => {
                              await form.trigger("customerPhone");
                            }}
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

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="momo">Mobile Money</SelectItem>
                            <SelectItem value="bank">Bank Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payment Account Selection */}
                  {watchPaymentMethod !== "cash" && (
                    <FormField
                      control={form.control}
                      name="paymentAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Account *</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                            disabled={loadingFloatAccounts}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {floatAccounts
                                .filter((account) => {
                                  if (watchPaymentMethod === "momo") {
                                    return account.account_type === "momo";
                                  } else if (watchPaymentMethod === "bank") {
                                    return (
                                      account.account_type === "agency-banking"
                                    );
                                  }
                                  return false;
                                })
                                .map((account) => (
                                  <SelectItem
                                    key={account.id}
                                    value={account.id}
                                  >
                                    <span className="flex items-center justify-between w-full">
                                      <div className="flex flex-col">
                                        <span>
                                          {account.provider ||
                                            account.account_name}
                                        </span>
                                        {user?.role?.toLowerCase() ===
                                          "admin" &&
                                          account.branch_name && (
                                            <span className="text-xs text-muted-foreground">
                                              {account.branch_name}
                                            </span>
                                          )}
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        {formatCurrency(
                                          account.current_balance
                                        )}
                                      </span>
                                    </span>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter transaction description or notes"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Additional notes about this power transaction
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Account Balance Preview */}
              {watchPaymentMethod !== "cash" &&
                form.watch("paymentAccountId") && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Selected Account:</strong>{" "}
                      {floatAccounts.find(
                        (acc) => acc.id === form.watch("paymentAccountId")
                      )?.provider ||
                        floatAccounts.find(
                          (acc) => acc.id === form.watch("paymentAccountId")
                        )?.account_name}
                      {user?.role?.toLowerCase() === "admin" &&
                        floatAccounts.find(
                          (acc) => acc.id === form.watch("paymentAccountId")
                        )?.branch_name && (
                          <span className="text-blue-600 ml-2">
                            (
                            {
                              floatAccounts.find(
                                (acc) =>
                                  acc.id === form.watch("paymentAccountId")
                              )?.branch_name
                            }
                            )
                          </span>
                        )}
                    </p>
                    <p className="text-sm text-blue-600">
                      <strong>Current Balance:</strong>{" "}
                      {formatCurrency(
                        floatAccounts.find(
                          (acc) => acc.id === form.watch("paymentAccountId")
                        )?.current_balance || 0
                      )}
                    </p>
                    <p className="text-sm text-blue-600">
                      <strong>After Transaction:</strong>{" "}
                      {formatCurrency(
                        (floatAccounts.find(
                          (acc) => acc.id === form.watch("paymentAccountId")
                        )?.current_balance || 0) - watchAmount
                      )}
                    </p>
                  </div>
                )}

              {/* Transaction Summary */}
              {watchAmount > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">
                    Transaction Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-green-700">Power Amount:</span>
                      <span className="ml-2 font-medium">
                        {formatCurrency(watchAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700">Transaction Fee:</span>
                      <span className="ml-2 font-medium">
                        {formatCurrency(form.watch("fee") ?? 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700">Payment Method:</span>
                      <span className="ml-2 font-medium capitalize">
                        {form.watch("paymentMethod") || "Cash"}
                      </span>
                    </div>
                    {watchPaymentMethod !== "cash" &&
                      form.watch("paymentAccountId") && (
                        <div>
                          <span className="text-green-700">
                            Payment Account:
                          </span>
                          <span className="ml-2 font-medium">
                            {floatAccounts.find(
                              (acc) => acc.id === form.watch("paymentAccountId")
                            )?.provider ||
                              floatAccounts.find(
                                (acc) =>
                                  acc.id === form.watch("paymentAccountId")
                              )?.account_name}
                          </span>
                        </div>
                      )}
                    <div className="col-span-2 pt-2 border-t border-green-300">
                      <span className="text-green-700 font-medium">
                        Total Amount:
                      </span>
                      <span className="ml-2 font-bold text-lg">
                        {formatCurrency(watchAmount + (form.watch("fee") ?? 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={isSubmitting || !selectedPowerAccount}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Transaction...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-5 w-5" />
                    Process Power Transaction
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
