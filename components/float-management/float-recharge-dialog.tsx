"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Loader2,
  Plus,
  Wallet,
  Building2,
  CreditCard,
  PiggyBank,
  Zap,
  ShoppingCart,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

// Update schema: only allow 'transfer' and require sourceAccountId
const rechargeSchema = z.object({
  amount: z.number().min(1, "Amount must be greater than 0"),
  sourceAccountId: z.string().min(1, "Source account is required"),
  rechargeMethod: z.literal("transfer"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type RechargeFormData = z.infer<typeof rechargeSchema>;

interface FloatAccount {
  id: string;
  provider: string;
  account_type: string;
  current_balance: number;
  branch_id: string;
  is_active: boolean;
}

interface FloatRechargeDialogProps {
  account: {
    id: string;
    provider: string;
    account_type: string;
    current_balance: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FloatRechargeDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: FloatRechargeDialogProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<FloatAccount[]>(
    []
  );
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // In defaultValues, set rechargeMethod to 'transfer' and sourceAccountId to ""
  const form = useForm<RechargeFormData>({
    resolver: zodResolver(rechargeSchema),
    defaultValues: {
      amount: 0,
      sourceAccountId: "",
      rechargeMethod: "transfer",
      reference: "",
      notes: "",
    },
  });

  // Fetch available source accounts when dialog opens
  useEffect(() => {
    if (open && user?.branchId) {
      fetchAvailableAccounts();
    }
  }, [open, user?.branchId]);

  const fetchAvailableAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const response = await fetch(
        `/api/float-accounts?branchId=${user?.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          // Filter accounts based on business logic:
          // 1. Exclude the target account
          // 2. Only include accounts that can be used as source
          // 3. Exclude power and E-Zwich accounts from being used as source
          const available = data.data.filter(
            (acc: FloatAccount) =>
              acc.id !== account?.id &&
              acc.is_active &&
              acc.current_balance > 0 &&
              ["cash-in-till", "momo", "agency-banking", "jumia"].includes(
                acc.account_type?.toLowerCase()
              )
          );
          setAvailableAccounts(available);
        }
      }
    } catch (error) {
      console.error("Error fetching available accounts:", error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const getAccountIcon = (accountType: string) => {
    switch (accountType?.toLowerCase()) {
      case "momo":
        return <Wallet className="h-4 w-4" />;
      case "agency-banking":
        return <Building2 className="h-4 w-4" />;
      case "e-zwich":
        return <CreditCard className="h-4 w-4" />;
      case "cash-in-till":
        return <PiggyBank className="h-4 w-4" />;
      case "power":
        return <Zap className="h-4 w-4" />;
      case "jumia":
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const onSubmit = async (data: RechargeFormData) => {
    if (!account || !user) {
      toast({
        title: "Error",
        description: "Account or user information missing",
        variant: "destructive",
      });
      return;
    }

    // Validate source account balance if selected
    if (data.sourceAccountId && data.rechargeMethod === "transfer") {
      const sourceAccount = availableAccounts.find(
        (acc) => acc.id === data.sourceAccountId
      );
      if (sourceAccount && sourceAccount.current_balance < data.amount) {
        toast({
          title: "Insufficient Balance",
          description: `Source account has insufficient balance. Available: ${formatCurrency(
            sourceAccount.current_balance
          )}`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/float-accounts/${account.id}/recharge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // <-- Ensure cookies/session are sent
          body: JSON.stringify({
            amount: data.amount,
            sourceAccountId:
              data.rechargeMethod === "transfer"
                ? data.sourceAccountId
                : undefined,
            rechargeMethod: data.rechargeMethod,
            reference:
              data.reference ||
              `${account.account_type.toUpperCase()}-RECHARGE-${Date.now()}`,
            notes: data.notes,
            description:
              data.rechargeMethod === "transfer" && data.sourceAccountId
                ? `Transfer from ${
                    availableAccounts.find(
                      (acc) => acc.id === data.sourceAccountId
                    )?.provider || "Unknown"
                  } to ${account.provider}`
                : `${account.provider} float recharge`,
          }),
        }
      );

      console.log(response);

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Recharge Successful",
          description: `${formatCurrency(data.amount)} added to ${
            account.provider
          } float account`,
        });
        form.reset();
        onOpenChange(false);
        onSuccess();
      } else {
        throw new Error(result.error || "Failed to recharge account");
      }
    } catch (error) {
      console.error("Recharge error:", error);
      toast({
        title: "Recharge Failed",
        description:
          error instanceof Error ? error.message : "Failed to recharge account",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const watchedRechargeMethod = form.watch("rechargeMethod");
  const watchedSourceAccount = form.watch("sourceAccountId");
  const selectedSourceAccount = availableAccounts.find(
    (acc) => acc.id === watchedSourceAccount
  );

  // Helper to determine if this is a power float
  const isPowerFloat = account?.account_type?.toLowerCase() === "power";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isPowerFloat ? "Recharge" : "Deposit"} Float Account
          </DialogTitle>
          <DialogDescription>
            {isPowerFloat ? "Add funds to" : "Deposit funds into"}{" "}
            {account?.provider} ({account?.account_type}) float account
          </DialogDescription>
        </DialogHeader>

        {account && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Current Balance:</span>
              <span className="font-bold">
                {formatCurrency(account.current_balance)}
              </span>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recharge Amount (GHS)</FormLabel>
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

            {/* Remove recharge method select UI, always use transfer */}
            {/* Remove conditional rendering for rechargeMethod, always show source account select */}

            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={loadingAccounts}>
                        <SelectValue
                          placeholder={
                            loadingAccounts
                              ? "Loading accounts..."
                              : "Select source account"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                            {getAccountIcon(acc.account_type)}
                            <span>{acc.provider}</span>
                            <span className="text-muted-foreground">
                              ({formatCurrency(acc.current_balance)})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSourceAccount && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Available balance:{" "}
                      {formatCurrency(selectedSourceAccount.current_balance)}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter reference number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional notes"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !form.formState.isValid}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {isPowerFloat ? "Recharge Account" : "Deposit to Account"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
