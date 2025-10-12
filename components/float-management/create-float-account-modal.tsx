"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2, Plus } from "lucide-react";

const createAccountSchema = z
  .object({
    provider: z.string().min(1, "Provider is required"),
    account_type: z.string().min(1, "Account type is required"),
    account_number: z.string().optional(),
    current_balance: z.string().min(0, "Balance must be positive"),
    min_threshold: z.string().min(0, "Minimum threshold must be positive"),
    max_threshold: z.string().min(0, "Maximum threshold must be positive"),
    is_active: z.boolean().default(true),
    isEzwichPartner: z.boolean().default(false),
    notes: z.string().optional(),
    branch_id: z.string().min(1, "Branch is required"),
  })
  .refine(
    (data) => {
      // Require account number for MoMo and Agency Banking
      if (
        ["momo", "agency-banking"].includes(data.account_type) &&
        !data.account_number
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Account number is required for Mobile Money and Agency Banking accounts",
      path: ["account_number"],
    }
  );

type CreateAccountForm = z.infer<typeof createAccountSchema>;

interface CreateFloatAccountModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  branchId?: string;
  trigger?: React.ReactNode;
}

export function CreateFloatAccountModal({
  open,
  onOpenChange,
  onSuccess,
  branchId,
  trigger,
}: CreateFloatAccountModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [isCustomProvider, setIsCustomProvider] = useState(false);
  const { toast } = useToast();
  const { user } = useCurrentUser();

  const form = useForm<CreateAccountForm>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      provider: "",
      account_type: "",
      account_number: "",
      current_balance: "0",
      min_threshold: "1000",
      max_threshold: "50000",
      is_active: true,
      isEzwichPartner: false,
      notes: "",
      branch_id: branchId || user?.branchId || "",
    },
  });

  const selectedAccountType = form.watch("account_type");
  const isAdmin = user?.role === "Admin" || user?.role === "admin";

  console.log("CreateFloatAccountModal - User role:", user?.role);
  console.log("CreateFloatAccountModal - Is admin:", isAdmin);
  console.log("CreateFloatAccountModal - Branches loaded:", branches.length);

  // Load branches for admin users
  useEffect(() => {
    console.log("useEffect triggered - isAdmin:", isAdmin);
    if (isAdmin) {
      console.log("Loading branches for admin user...");
      loadBranches();
    }
  }, [isAdmin]);

  // Set default branch for non-admin users
  useEffect(() => {
    if (!isAdmin && user?.branchId) {
      form.setValue("branch_id", user.branchId);
    }
  }, [isAdmin, user?.branchId, form]);

  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      console.log("Loading branches for admin user...");
      const response = await fetch("/api/branches");
      console.log("Branches API response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Branches API response data:", data);

        if (data.success) {
          const branchesData = data.data || [];
          console.log("Setting branches:", branchesData);
          setBranches(branchesData);

          if (branchesData.length === 0) {
            console.warn("No branches found in database");
            toast({
              title: "No Branches Found",
              description:
                "No branches are available. Please contact an administrator to add branches.",
              variant: "destructive",
            });
          }
        } else {
          console.error("Branches API returned error:", data.error);
          toast({
            title: "Error Loading Branches",
            description: data.error || "Failed to load branches",
            variant: "destructive",
          });
        }
      } else {
        console.error("Branches API failed with status:", response.status);
        toast({
          title: "Error Loading Branches",
          description: `Failed to load branches (HTTP ${response.status})`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error loading branches:", error);
      toast({
        title: "Error Loading Branches",
        description: "Failed to load branches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingBranches(false);
    }
  };

  // Reset account number when account type changes
  useEffect(() => {
    if (!["momo", "agency-banking"].includes(selectedAccountType)) {
      form.setValue("account_number", "");
    }
    // Reset custom provider mode when account type changes
    setIsCustomProvider(false);
  }, [selectedAccountType, form]);

  const handleSubmit = async (data: CreateAccountForm) => {
    setIsSubmitting(true);
    setIsCustomProvider(false); // Reset custom mode

    try {
      const requestBody = {
        provider: data.provider,
        account_type: data.account_type,
        account_number: data.account_number || null,
        current_balance: Number.parseFloat(data.current_balance),
        min_threshold: Number.parseFloat(data.min_threshold),
        max_threshold: Number.parseFloat(data.max_threshold),
        is_active: data.is_active,
        isEzwichPartner: data.isEzwichPartner,
        notes: data.notes || null,
        branch_id: data.branch_id,
      };

      console.log("Creating float account with data:", requestBody);

      const response = await fetch("/api/float-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP ${response.status}: Failed to create account`
        );
      }

      const result = await response.json();
      console.log("Float account created successfully:", result);

      toast({
        title: "Account Created",
        description: "Float account has been created successfully.",
      });

      form.reset();
      if (onOpenChange) {
        onOpenChange(false);
      } else {
        setIsOpen(false);
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error creating account:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalOpen = open !== undefined ? open : isOpen;
  const setModalOpen = onOpenChange || setIsOpen;

  // Provider options for each account type
  const getProviderOptions = (accountType: string): string[] => {
    switch (accountType) {
      case "momo":
        return [
          "MTN",
          "Vodafone",
          "AirtelTigo",
          "Telecel",
          "GhanaPay",
          "G-Money",
          "Zeepay",
          "ATcash",
          "TCash",
        ];
      case "agency-banking":
        return [
          "Ecobank",
          "GCB",
          "Fidelity",
          "GT Bank",
          "NIB",
          "Zenith",
          "CBG",
          "Access",
          "Cal Bank",
          "ADB",
          "UBA",
          "Stanbic",
          "Standard Chartered",
        ];
      case "power":
        return ["ECG", "NEDCo", "VRA"];
      case "jumia":
        return ["Jumia Ghana"];
      case "e-zwich":
        return ["Ghana Interbank", "E-Zwich Settlement", "GhIPSS"];
      case "cash-in-till":
        return ["Cash"];
      default:
        return [];
    }
  };

  const getProviderPlaceholder = (accountType: string) => {
    switch (accountType) {
      case "momo":
        return "Select Mobile Money provider";
      case "agency-banking":
        return "Select bank";
      case "power":
        return "Select power company";
      case "jumia":
        return "Select Jumia";
      case "e-zwich":
        return "Select E-Zwich provider";
      default:
        return "Select provider";
    }
  };

  const getAccountNumberPlaceholder = (accountType: string) => {
    switch (accountType) {
      case "momo":
        return "e.g., 0241234567";
      case "agency-banking":
        return "e.g., 1234567890";
      default:
        return "Account number";
    }
  };

  return (
    <Dialog
      open={modalOpen}
      onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) {
          setIsCustomProvider(false); // Reset custom mode when dialog closes
        }
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Float Account</DialogTitle>
          <DialogDescription>
            Create a new float account for managing service balances.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Account Type, Branch (for admin), and Provider */}
            <div
              className={`grid ${
                isAdmin ? "grid-cols-3" : "grid-cols-2"
              } gap-4`}
            >
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="momo">Mobile Money</SelectItem>
                        <SelectItem value="agency-banking">
                          Agency Banking
                        </SelectItem>
                        <SelectItem value="e-zwich">E-Zwich</SelectItem>
                        <SelectItem value="cash-in-till">
                          Cash in Till
                        </SelectItem>
                        <SelectItem value="power">Power</SelectItem>
                        <SelectItem value="jumia">Jumia</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Branch Selection - Only for Admin users */}
              {isAdmin && (
                <FormField
                  control={form.control}
                  name="branch_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={loadingBranches}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                loadingBranches
                                  ? "Loading branches..."
                                  : "Select branch"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.length > 0 ? (
                            branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-branches" disabled>
                              No branches available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      {branches.length === 0 && !loadingBranches && (
                        <div className="text-sm text-muted-foreground mt-2">
                          <p>No branches found. You can:</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-1"
                            onClick={async () => {
                              try {
                                const response = await fetch(
                                  "/api/branches/seed-sample",
                                  {
                                    method: "POST",
                                  }
                                );
                                const result = await response.json();
                                if (response.ok) {
                                  toast({
                                    title: "Sample Data Created",
                                    description:
                                      "Sample branches have been created. Please refresh.",
                                  });
                                  loadBranches();
                                } else {
                                  toast({
                                    title: "Error",
                                    description:
                                      result.error ||
                                      "Failed to create sample data",
                                    variant: "destructive",
                                  });
                                }
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to create sample data",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Create Sample Branches
                          </Button>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => {
                  const providerOptions =
                    getProviderOptions(selectedAccountType);

                  // If no account type selected or no providers available, show input
                  if (!selectedAccountType || providerOptions.length === 0) {
                    return (
                      <FormItem>
                        <FormLabel>Provider *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter provider name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }

                  // Show dropdown with provider options
                  return (
                    <FormItem>
                      <FormLabel>Provider *</FormLabel>
                      {!isCustomProvider ? (
                        <Select
                          onValueChange={(value) => {
                            if (value === "_custom") {
                              setIsCustomProvider(true);
                              field.onChange("");
                            } else {
                              field.onChange(value);
                            }
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={getProviderPlaceholder(
                                  selectedAccountType
                                )}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {providerOptions.map((provider) => (
                              <SelectItem key={provider} value={provider}>
                                {provider}
                              </SelectItem>
                            ))}
                            <SelectItem value="_custom">
                              <span className="text-muted-foreground italic">
                                Other (type custom name)
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-2">
                          <FormControl>
                            <Input
                              placeholder="Enter custom provider name"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              autoFocus
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setIsCustomProvider(false);
                              field.onChange("");
                            }}
                            className="text-xs"
                          >
                            ← Back to provider list
                          </Button>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* Account Number (conditional) */}
            {["momo", "agency-banking"].includes(selectedAccountType) && (
              <FormField
                control={form.control}
                name="account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={getAccountNumberPlaceholder(
                          selectedAccountType
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Balance and Thresholds */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="current_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Balance (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
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
                name="min_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Threshold (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1000.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="max_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Threshold (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="50000.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Switches */}
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Active Account</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable this account for transactions
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {selectedAccountType === "agency-banking" && (
                <FormField
                  control={form.control}
                  name="isEzwichPartner"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>E-Zwich Partner</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Mark as E-Zwich partner account
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this account..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
