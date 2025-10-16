"use client";

import { useState, useEffect } from "react";
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
import { Loader2, ArrowDownLeft, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  cardNumber: z
    .string()
    .min(1, "Card number is required")
    .min(10, "Card number must be at least 10 digits")
    .max(20, "Card number cannot exceed 20 digits")
    .regex(/^\d+$/, "Card number must contain only digits"),
  settlementAccount: z.string().min(1, "Settlement account is required"),
  customerName: z
    .string()
    .min(3, "Customer name must be at least 3 characters"),
  customerPhone: z
    .string()
    .min(10, "Phone number must be at least 10 characters")
    .max(10, "Phone number must be exactly 10 digits")
    .regex(/^\d{10}$/, "Phone number must contain only digits"),
  withdrawalAmount: z.coerce.number().min(1, "Amount must be greater than 0"),
  fee: z.coerce.number().min(0, "Fee must be 0 or greater"),
});

type FormValues = z.infer<typeof formSchema>;

interface WithdrawalFormProps {
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
}

export function WithdrawalForm({ onSuccess, onCancel }: WithdrawalFormProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ezwichSettlementAccounts, setEzwichSettlementAccounts] = useState<
    any[]
  >([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [feeConfig, setFeeConfig] = useState<any>(null);
  const [selectedSettlementAccount, setSelectedSettlementAccount] =
    useState<any>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cardNumber: "",
      settlementAccount: "",
      customerName: "",
      customerPhone: "",
      withdrawalAmount: 0,
      fee: 0,
    },
  });

  const watchAmount = form.watch("withdrawalAmount");

  // Load fee configuration
  useEffect(() => {
    const loadFeeConfig = async () => {
      try {
        const response = await fetch(
          "/api/settings/fee-config/e-zwich?transactionType=withdrawal"
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.config) {
            setFeeConfig(data.config);
          }
        }
      } catch (error) {
        console.error("Error loading fee config:", error);
      }
    };

    loadFeeConfig();
  }, []);

  // Track if user has manually modified the fee
  const [userModifiedFee, setUserModifiedFee] = useState(false);
  const currentFee = form.watch("fee");

  // Calculate fee when amount changes (only if user hasn't manually modified)
  useEffect(() => {
    if (!userModifiedFee) {
      if (feeConfig && watchAmount > 0) {
        let calculatedFee = 0;

        if (feeConfig.fee_type === "percentage") {
          calculatedFee = watchAmount * (Number(feeConfig.fee_value) / 100);
        } else if (feeConfig.fee_type === "fixed") {
          calculatedFee = Number(feeConfig.fee_value);
        } else if (feeConfig.fee_type === "tiered") {
          const tiers = feeConfig.tier_config || [];
          for (const tier of tiers) {
            if (
              watchAmount >= tier.min_amount &&
              watchAmount <= tier.max_amount
            ) {
              calculatedFee = Number(tier.fee_value);
              break;
            }
          }
        }

        // Apply min/max limits
        if (
          feeConfig.minimum_fee &&
          calculatedFee < Number(feeConfig.minimum_fee)
        ) {
          calculatedFee = Number(feeConfig.minimum_fee);
        }
        if (
          feeConfig.maximum_fee &&
          calculatedFee > Number(feeConfig.maximum_fee)
        ) {
          calculatedFee = Number(feeConfig.maximum_fee);
        }

        form.setValue("fee", Number(calculatedFee.toFixed(2)));
      } else if (watchAmount > 0) {
        // Fallback fee calculation
        const fallbackFee = Math.max(5, watchAmount * 0.01); // 1% with minimum 5 GHS
        form.setValue("fee", Number(fallbackFee.toFixed(2)));
      }
    }
  }, [watchAmount, feeConfig, form, userModifiedFee]);

  // Reset user modification flag when form is reset
  useEffect(() => {
    if (!currentFee || currentFee === 0) {
      setUserModifiedFee(false);
    }
  }, [currentFee]);

  // Load E-Zwich settlement accounts with proper null safety
  const loadEzwichSettlementAccounts = async () => {
    if (!user?.branchId) return;

    setLoadingAccounts(true);
    try {
      console.log(
        "[E-ZWICH] Loading settlement accounts for branch:",
        user.branchId
      );

      const response = await fetch(
        `/api/float-accounts?branchId=${user.branchId}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[E-ZWICH] API Error:", errorText);
        throw new Error(
          `Failed to load accounts: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.accounts)) {
        // Strictly filter for E-Zwich settlement accounts with isezwichpartner === true and account_type === 'e-zwich'
        const ezwichAccounts = data.accounts.filter((account: any) => {
          return (
            account &&
            account.isezwichpartner === true &&
            account.account_type === "e-zwich" &&
            account.is_active
          );
        });
        setEzwichSettlementAccounts(ezwichAccounts || []);
      } else {
        throw new Error(
          data.error || "Failed to load E-Zwich settlement accounts"
        );
      }
    } catch (error) {
      console.error("[E-ZWICH] Error loading settlement accounts:", error);
      setEzwichSettlementAccounts([]);
      toast({
        title: "Error",
        description: "Failed to load E-Zwich settlement accounts",
        variant: "destructive",
      });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadEzwichSettlementAccounts();
  }, [user?.branchId]);

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to process withdrawals",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/e-zwich/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "withdrawal",
          card_number: values.cardNumber,
          settlement_account_id: values.settlementAccount,
          customer_name: values.customerName,
          customer_phone: values.customerPhone,
          amount: values.withdrawalAmount,
          fee: values.fee,
          user_id: user.id,
          branch_id: user.branchId,
          processed_by:
            user.email || user.username || user.name || "Unknown User",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[E-ZWICH] API Error:", errorText);
        throw new Error(
          `Transaction failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Withdrawal Processed",
          description: `GHS ${values.withdrawalAmount} withdrawal processed for card ${values.cardNumber}`,
        });
        form.reset();
        if (onSuccess) {
          onSuccess(result.transaction);
        }
      } else {
        throw new Error(result.error || "Failed to process withdrawal");
      }
    } catch (error: any) {
      console.error("[E-ZWICH] Withdrawal error:", error);
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
          <ArrowDownLeft className="h-5 w-5" />
          E-Zwich Withdrawal
        </CardTitle>
        <CardDescription>
          Process a cash withdrawal from E-Zwich card
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Card Number and Settlement Account - Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cardNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-Zwich Card Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter card number"
                        {...field}
                        maxLength={20}
                        className="font-mono"
                        onChange={(e) => {
                          const value = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 20);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="settlementAccount"
                render={({ field }) => {
                  // Find selected account
                  const selectedAccount =
                    ezwichSettlementAccounts.find(
                      (a) => a.id === field.value
                    ) || null;
                  useEffect(() => {
                    setSelectedSettlementAccount(selectedAccount);
                  }, [field.value, ezwichSettlementAccounts]);
                  return (
                    <FormItem>
                      <FormLabel>Settlement Account</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={loadingAccounts}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                loadingAccounts
                                  ? "Loading..."
                                  : "Select settlement account"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ezwichSettlementAccounts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No E-Zwich settlement accounts found
                            </SelectItem>
                          ) : (
                            ezwichSettlementAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  <span>
                                    {account.provider || "Unknown Provider"} -{" "}
                                    {account.account_number ||
                                      "Settlement Account"}
                                    (GHS{" "}
                                    {Number(
                                      account.current_balance || 0
                                    ).toFixed(2)}
                                    )
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {/* Dynamic balance display */}
                      {selectedSettlementAccount && (
                        <Alert className="mt-2 border-blue-200 bg-blue-50">
                          <AlertDescription>
                            <span className="font-medium">Balance:</span> GHS{" "}
                            {Number(
                              selectedSettlementAccount.current_balance || 0
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* Customer Information - Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., +233 24 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Amount and Fee - Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="withdrawalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Withdrawal Amount (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
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
                    <FormLabel>Fee (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => {
                          field.onChange(Number(e.target.value));
                          setUserModifiedFee(true);
                        }}
                      />
                    </FormControl>
                    {feeConfig && (
                      <FormDescription>
                        {feeConfig.fee_type === "fixed"
                          ? "Fixed fee"
                          : feeConfig.fee_type === "percentage"
                          ? `${feeConfig.fee_value}% of amount`
                          : "Tiered fee"}{" "}
                        from system configuration
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Withdrawal...
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="mr-2 h-4 w-4" />
                    Process Withdrawal
                  </>
                )}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
