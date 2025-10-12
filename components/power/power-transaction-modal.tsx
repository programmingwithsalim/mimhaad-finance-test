"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency";

const powerTransactionSchema = z.object({
  meterNumber: z.string().min(5, "Meter number must be at least 5 characters"),
  floatAccountId: z.string().min(1, "Power float account is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  customerName: z
    .string()
    .min(3, "Customer name must be at least 3 characters")
    .optional(),
  customerPhone: z
    .string()
    .min(10, "Phone number must be exactly 10 digits")
    .max(10, "Phone number must be exactly 10 digits")
    .regex(/^\d{10}$/, "Phone number must contain only digits")
    .optional(),
});

type PowerTransactionFormData = z.infer<typeof powerTransactionSchema>;

interface PowerFloat {
  id: string;
  provider: string;
  current_balance: number;
  account_type: string;
}

interface PowerTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PowerTransactionModal({
  open,
  onOpenChange,
  onSuccess,
}: PowerTransactionModalProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [powerFloats, setPowerFloats] = useState<PowerFloat[]>([]);
  const [loadingFloats, setLoadingFloats] = useState(false);

  const form = useForm<PowerTransactionFormData>({
    resolver: zodResolver(powerTransactionSchema),
    defaultValues: {
      meterNumber: "",
      floatAccountId: "",
      amount: 0,
      customerName: "",
      customerPhone: "",
    },
  });

  const selectedFloatId = form.watch("floatAccountId");
  const selectedFloat = powerFloats.find((f) => f.id === selectedFloatId);

  const loadPowerFloats = async () => {
    if (!user?.branchId) return;

    setLoadingFloats(true);
    try {
      const response = await fetch(
        `/api/float-accounts?branchId=${user.branchId}&accountType=power`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPowerFloats(data.accounts || []);
        }
      }
    } catch (error) {
      console.error("Error loading power floats:", error);
      toast({
        title: "Error",
        description: "Failed to load power float accounts",
        variant: "destructive",
      });
    } finally {
      setLoadingFloats(false);
    }
  };

  useEffect(() => {
    if (open && user?.branchId) {
      loadPowerFloats();
    }
  }, [open, user?.branchId]);

  const onSubmit = async (data: PowerTransactionFormData) => {
    if (!user || !selectedFloat) {
      toast({
        title: "Error",
        description: "User information or float account not available",
        variant: "destructive",
      });
      return;
    }

    // Check if float has sufficient balance
    if (selectedFloat.current_balance < data.amount) {
      toast({
        title: "Insufficient Balance",
        description: `Float account has insufficient balance. Available: ${formatCurrency(
          selectedFloat.current_balance
        )}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionData = {
        meterNumber: data.meterNumber,
        provider: selectedFloat.provider,
        amount: data.amount,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        userId: user.id,
        branchId: user.branchId,
        floatAccountId: data.floatAccountId,
      };

      console.log("🔄 [POWER] Submitting transaction:", transactionData);

      const response = await fetch("/api/power/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Success",
          description: "Power transaction processed successfully",
        });
        form.reset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to process transaction");
      }
    } catch (error) {
      console.error("Error processing power transaction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to process transaction",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Power Transaction
          </DialogTitle>
          <DialogDescription>
            Process a power/electricity payment
          </DialogDescription>
        </DialogHeader>

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
              name="floatAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Power Float Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loadingFloats}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingFloats
                              ? "Loading..."
                              : "Select power float account"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {powerFloats.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No power float accounts found
                        </SelectItem>
                      ) : (
                        powerFloats.map((float) => (
                          <SelectItem key={float.id} value={float.id}>
                            {float.provider} -{" "}
                            {formatCurrency(float.current_balance)}
                          </SelectItem>
                        ))
                      )}
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
                      min="1"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  {selectedFloat && (
                    <p className="text-xs text-muted-foreground">
                      Available balance:{" "}
                      {formatCurrency(selectedFloat.current_balance)}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name (Optional)</FormLabel>
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
                  <FormLabel>Customer Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter customer phone" {...field} />
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
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Process Payment
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
