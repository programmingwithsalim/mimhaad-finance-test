"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useCardBatches } from "@/hooks/use-e-zwich";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

const formSchema = z
  .object({
    inventory_type: z.string().min(1, "Inventory type is required"),
    quantity_received: z.number().min(1, "Quantity must be at least 1"),
    card_type: z.string().default("standard"),
    unit_cost: z.number().min(0, "Unit cost must be 0 or greater"),
    partner_bank_id: z.string().optional(),
    partner_bank_name: z.string().optional(),
    payment_method_id: z.string().min(1, "Payment method is required"),
    expiry_date: z.date().optional(),
    branch_id: z.string().min(1, "Branch is required"),
    branch_name: z.string().min(1, "Branch name is required"),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      // Partner bank is required only for E-Zwich inventory
      if (data.inventory_type === "e-zwich") {
        return data.partner_bank_id && data.partner_bank_id.length > 0;
      }
      return true;
    },
    {
      message: "Partner bank is required for E-Zwich inventory",
      path: ["partner_bank_id"],
    }
  );

interface EZwichAddStockFormProps {
  onSuccess?: () => void;
}

export function EZwichAddStockForm({ onSuccess }: EZwichAddStockFormProps) {
  const { toast } = useToast();
  const { createBatch } = useCardBatches();
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [partnerBanks, setPartnerBanks] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inventory_type: "e-zwich",
      quantity_received: 0,
      card_type: "standard",
      unit_cost: 0,
      partner_bank_id: "",
      partner_bank_name: "",
      payment_method_id: "",
      branch_id: user?.branchId || "",
      branch_name: user?.branchName || "",
      notes: "",
    },
  });

  // Fetch payment methods (float accounts) on component mount
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        setLoadingPaymentMethods(true);

        const response = await fetch(
          `/api/float-accounts?branchId=${user?.branchId || ""}&isActive=true`
        );
        const data = await response.json();

        if (data.success) {
          setPaymentMethods(data.accounts || []);
        } else {
          console.error("Failed to fetch payment methods:", data.error);
          toast({
            title: "Error",
            description: "Failed to load payment methods",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching payment methods:", error);
        toast({
          title: "Error",
          description: "Failed to load payment methods",
          variant: "destructive",
        });
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    // Only fetch if user is available
    if (user?.branchId) {
      fetchPaymentMethods();
    }
  }, [user?.branchId, toast]);

  // Fetch partner banks on component mount
  useEffect(() => {
    const fetchPartnerBanks = async () => {
      try {
        setLoadingBanks(true);

        // Use the dedicated E-Zwich partner banks endpoint
        const response = await fetch(
          `/api/float-accounts/ezwich-partners?branchId=${user?.branchId || ""}`
        );
        const data = await response.json();

        if (data.success) {
          setPartnerBanks(data.accounts || []);
        } else {
          console.error("Failed to fetch E-Zwich partner banks:", data.error);
          toast({
            title: "Error",
            description: "Failed to load E-Zwich partner banks",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching E-Zwich partner banks:", error);
        toast({
          title: "Error",
          description: "Failed to load E-Zwich partner banks",
          variant: "destructive",
        });
      } finally {
        setLoadingBanks(false);
      }
    };

    // Only fetch if user is available
    if (user?.branchId) {
      fetchPartnerBanks();
    }
  }, [user?.branchId, toast]);

  // Fetch branches for admin users
  useEffect(() => {
    const fetchBranches = async () => {
      if (user?.role !== "Admin") return;

      try {
        setLoadingBranches(true);
        const response = await fetch("/api/branches");
        const data = await response.json();

        if (data.success) {
          setBranches(data.data || []);
        } else {
          console.error("Failed to fetch branches:", data.error);
          toast({
            title: "Error",
            description: "Failed to load branches",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
        toast({
          title: "Error",
          description: "Failed to load branches",
          variant: "destructive",
        });
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [user?.role, toast]);

  // Update form when user data is available
  useEffect(() => {
    if (user) {
      form.setValue("branch_id", user.branchId || "");
      form.setValue("branch_name", user.branchName || "");
    }
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      const batchData = {
        inventory_type: values.inventory_type,
        quantity_received: values.quantity_received,
        card_type: values.card_type,
        unit_cost: values.unit_cost,
        partner_bank_id: values.partner_bank_id,
        partner_bank_name: values.partner_bank_name,
        payment_method_id: values.payment_method_id,
        expiry_date: values.expiry_date
          ? format(values.expiry_date, "yyyy-MM-dd")
          : undefined,
        branch_id: values.branch_id,
        notes: values.notes,
      };

      await createBatch(batchData);

      toast({
        title: "Success",
        description: "Card batch added successfully",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating batch:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create batch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerBankChange = (bankId: string) => {
    const selectedBank = partnerBanks.find((bank) => bank.id === bankId);
    if (selectedBank) {
      form.setValue("partner_bank_id", bankId);
      form.setValue(
        "partner_bank_name",
        selectedBank.provider || selectedBank.account_number
      );
    }
  };

  const handleBranchChange = (branchId: string) => {
    const selectedBranch = branches.find((branch) => branch.id === branchId);
    if (selectedBranch) {
      form.setValue("branch_id", branchId);
      form.setValue("branch_name", selectedBranch.name);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inventory Type */}
          <FormField
            control={form.control}
            name="inventory_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inventory Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select inventory type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="e-zwich">E-Zwich Cards</SelectItem>
                    <SelectItem value="sim">SIM Cards</SelectItem>
                    <SelectItem value="rollers">Paper Rollers</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Quantity Received */}
          <FormField
            control={form.control}
            name="quantity_received"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity Received</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter quantity"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Card Type */}
          <FormField
            control={form.control}
            name="card_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Card Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select card type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Unit Cost */}
          <FormField
            control={form.control}
            name="unit_cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Cost (GHS)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Partner Bank - Only for E-Zwich inventory */}
          {form.watch("inventory_type") === "e-zwich" && (
            <FormField
              control={form.control}
              name="partner_bank_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner Bank</FormLabel>
                  <Select
                    onValueChange={handlePartnerBankChange}
                    disabled={loadingBanks}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingBanks ? "Loading..." : "Select partner bank"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partnerBanks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.provider} - {bank.account_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Payment Method */}
          <FormField
            control={form.control}
            name="payment_method_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loadingPaymentMethods}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingPaymentMethods
                            ? "Loading..."
                            : "Select payment method"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.account_type?.toUpperCase()} - {method.provider}{" "}
                        ({method.account_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Branch Selection */}
          <FormField
            control={form.control}
            name="branch_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                {user?.role === "Admin" ? (
                  <Select
                    onValueChange={handleBranchChange}
                    disabled={loadingBranches}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingBranches ? "Loading..." : "Select branch"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <FormControl>
                    <Input
                      value={field.value}
                      disabled
                      className="bg-gray-50"
                    />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Expiry Date */}
          <FormField
            control={form.control}
            name="expiry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expiry Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    placeholder="Select expiry date"
                    {...field}
                    value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                    onChange={(e) => {
                      const date = e.target.value
                        ? new Date(e.target.value)
                        : undefined;
                      field.onChange(date);
                    }}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes about this batch..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={loading} className="min-w-[120px]">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Batch"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
