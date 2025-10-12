"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useCommissions } from "@/hooks/use-commissions";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Commission } from "@/lib/commission-types";

// Schema for bulk edit - only include fields that make sense to bulk edit
const bulkEditSchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  amountAction: z
    .enum(["unchanged", "set", "increase", "decrease"])
    .default("unchanged"),
  amountValue: z.string().refine(
    (val) => {
      if (val === "") return true;
      const num = Number.parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Amount must be a positive number" }
  ),
});

type BulkEditFormValues = z.infer<typeof bulkEditSchema>;

interface BulkEditDialogProps {
  selectedCommissions: Commission[];
  onSuccess: () => void;
  disabled?: boolean;
}

export function BulkEditDialog({
  selectedCommissions,
  onSuccess,
  disabled = false,
}: BulkEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { updateCommission } = useCommissions();

  const form = useForm<BulkEditFormValues>({
    resolver: zodResolver(bulkEditSchema),
    defaultValues: {
      status: "unchanged",
      source: "unchanged",
      amountAction: "unchanged",
      amountValue: "",
    },
  });

  const amountAction = form.watch("amountAction");

  const handleSubmit = async (values: BulkEditFormValues) => {
    // Create updates object
    const updates: Record<string, any> = {};

    // Add status if changed
    if (values.status && values.status !== "unchanged") {
      updates.status = values.status;
    }

    // Add source if changed
    if (values.source && values.source !== "unchanged") {
      updates.source = values.source;
    }

    // Process amount changes
    if (values.amountAction !== "unchanged" && values.amountValue) {
      const amountValue = Number.parseFloat(values.amountValue);

      if (!isNaN(amountValue)) {
        // For each commission, calculate the new amount based on the action
        const updatePromises = selectedCommissions.map(async (commission) => {
          let newAmount: number;

          switch (values.amountAction) {
            case "set":
              newAmount = amountValue;
              break;
            case "increase":
              newAmount = commission.amount * (1 + amountValue / 100);
              break;
            case "decrease":
              newAmount = commission.amount * (1 - amountValue / 100);
              break;
            default:
              return null;
          }

          // Ensure amount is not negative
          newAmount = Math.max(0, newAmount);

          // Round to 2 decimal places
          newAmount = Math.round(newAmount * 100) / 100;

          // Update the commission with the new amount
          return updateCommission(commission.id, {
            ...updates,
            amount: newAmount,
          });
        });

        setIsSubmitting(true);

        try {
          const results = await Promise.all(updatePromises);
          const successCount = results.filter(Boolean).length;

          toast({
            title: "Bulk update successful",
            description: `Updated ${successCount} of ${selectedCommissions.length} commissions.`,
          });

          setOpen(false);
          form.reset();
          onSuccess();
        } catch (error) {
          console.error("Error in bulk update:", error);
          toast({
            variant: "destructive",
            title: "Update failed",
            description: "There was an error updating the commissions.",
          });
        } finally {
          setIsSubmitting(false);
        }

        return;
      }
    }

    // If no amount changes, just update the other fields if any
    if (Object.keys(updates).length === 0) {
      toast({
        variant: "destructive",
        title: "No changes to apply",
        description: "Please select at least one field to update.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Process each commission update sequentially
      const results = await Promise.all(
        selectedCommissions.map((commission) =>
          updateCommission(commission.id, updates)
        )
      );

      const successCount = results.filter(Boolean).length;

      toast({
        title: "Bulk update successful",
        description: `Updated ${successCount} of ${selectedCommissions.length} commissions.`,
      });

      setOpen(false);
      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "There was an error updating the commissions.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || selectedCommissions.length === 0}
          onClick={() => setOpen(true)}
        >
          <Edit className="mr-2 h-4 w-4" />
          Bulk Edit ({selectedCommissions.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Edit Commissions</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Editing {selectedCommissions.length} commissions. Only fields you
            change will be updated.
          </p>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Leave unchanged" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unchanged">
                          Leave unchanged
                        </SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Leave unchanged" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unchanged">
                          Leave unchanged
                        </SelectItem>
                        <SelectItem value="mtn">MTN</SelectItem>
                        <SelectItem value="vodafone">Vodafone</SelectItem>
                        <SelectItem value="airtel-tigo">AirtelTigo</SelectItem>
                        <SelectItem value="ghanapay">GhanaPay</SelectItem>
                        <SelectItem value="g-money">G-Money</SelectItem>
                        <SelectItem value="zeepay">Zeepay</SelectItem>
                        <SelectItem value="gt-bank">GT Bank</SelectItem>
                        <SelectItem value="nib">NIB</SelectItem>
                        <SelectItem value="fidelity">Fidelity</SelectItem>
                        <SelectItem value="zenith">Zenith</SelectItem>
                        <SelectItem value="cbg">CBG</SelectItem>
                        <SelectItem value="access">Access</SelectItem>
                        <SelectItem value="cal-bank">Cal Bank</SelectItem>
                        <SelectItem value="adb">ADB</SelectItem>
                        <SelectItem value="jumia">Jumia</SelectItem>
                        <SelectItem value="vra">VRA</SelectItem>
                        <SelectItem value="agency-banking">
                          Agency Banking
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amountAction"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Amount Action</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="unchanged" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Leave unchanged
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="set" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Set to specific amount
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="increase" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Increase by percentage
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="decrease" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            Decrease by percentage
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {amountAction !== "unchanged" && (
                <FormField
                  control={form.control}
                  name="amountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {amountAction === "set"
                          ? "Amount (GHS)"
                          : amountAction === "increase"
                          ? "Increase Percentage (%)"
                          : "Decrease Percentage (%)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step={amountAction === "set" ? "0.01" : "0.1"}
                          min="0"
                          placeholder={
                            amountAction === "set"
                              ? "Enter amount in GHS"
                              : amountAction === "increase"
                              ? "Enter percentage to increase"
                              : "Enter percentage to decrease"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setOpen(false);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating..." : "Update Commissions"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
