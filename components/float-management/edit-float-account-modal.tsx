"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Branch {
  id: string;
  name: string;
}

interface FloatAccount {
  id: string;
  branch_id: string;
  branch_name?: string;
  account_type: string;
  provider?: string | null;
  account_number?: string | null;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  last_updated: string;
  created_by: string;
  created_at: string;
}

interface EditFloatAccountModalProps {
  account: FloatAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditFloatAccountModal({
  account,
  open,
  onOpenChange,
  onSuccess,
}: EditFloatAccountModalProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [provider, setProvider] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [maxThreshold, setMaxThreshold] = useState("");

  const isAdmin = user?.role === "Admin" || user?.role === "admin";

  // Account type options
  const accountTypes = [
    {
      value: "momo",
      label: "Mobile Money",
      hasProvider: true,
      hasAccountNumber: true,
    },
    {
      value: "agency-banking",
      label: "Agency Banking",
      hasProvider: true,
      hasAccountNumber: true,
    },
    {
      value: "cash-in-till",
      label: "Cash in Till",
      hasProvider: false,
      hasAccountNumber: false,
    },
    {
      value: "e-zwich",
      label: "E-Zwich",
      hasProvider: false,
      hasAccountNumber: true,
    },
    {
      value: "jumia",
      label: "Jumia",
      hasProvider: false,
      hasAccountNumber: true,
    },
    {
      value: "power",
      label: "Power",
      hasProvider: true,
      hasAccountNumber: false,
    },
  ];

  // Provider options based on account type
  const getProviderOptions = (type: string) => {
    switch (type) {
      case "momo":
        return [
          { value: "MTN", label: "MTN Mobile Money" },
          { value: "Vodafone", label: "Vodafone Cash" },
          { value: "AirtelTigo", label: "AirtelTigo Money" },
          { value: "GhanaPay", label: "GhanaPay" },
          { value: "GMoney", label: "G-Money" },
          { value: "Zeepay", label: "Zeepay" },
        ];
      case "agency-banking":
        return [
          { value: "Ecobank", label: "Ecobank" },
          { value: "GCB", label: "GCB Bank" },
          { value: "Absa", label: "Absa Bank" },
          { value: "Stanbic", label: "Stanbic Bank" },
          { value: "GTBank", label: "GT Bank" },
          { value: "NIB", label: "NIB" },
          { value: "Fidelity", label: "Fidelity" },
          { value: "Zenith", label: "Zenith" },
          { value: "CBG", label: "CBG" },
          { value: "Access", label: "Access" },
          { value: "CalBank", label: "Cal Bank" },
          { value: "ADB", label: "ADB" },
        ];
      case "power":
        return [
          { value: "ECG", label: "Electricity Company of Ghana" },
          { value: "VRA", label: "Volta River Authority" },
          {
            value: "NEDCo",
            label: "Northern Electricity Distribution Company",
          },
        ];
      default:
        return [];
    }
  };

  // Fetch branches when modal opens
  useEffect(() => {
    if (open) {
      fetchBranches();
    }
  }, [open]);

  // Reset form when account changes
  useEffect(() => {
    if (account) {
      setBranchId(account.branch_id || "");
      setProvider(account.provider || "");
      setAccountNumber(account.account_number || "");
      setCurrentBalance(account.current_balance?.toString() || "0");
      setMinThreshold(account.min_threshold?.toString() || "0");
      setMaxThreshold(account.max_threshold?.toString() || "0");
    } else {
      // Reset form when account is null
      setBranchId("");
      setProvider("");
      setAccountNumber("");
      setCurrentBalance("0");
      setMinThreshold("0");
      setMaxThreshold("0");
    }
  }, [account]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/branches");
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }
      const branchesData = await response.json();

      if (branchesData.success) {
        setBranches(branchesData.data || []);
      } else {
        throw new Error(branchesData.error || "Failed to load branches");
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast({
        title: "Error",
        description: "Failed to load branches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) {
      toast({
        title: "Error",
        description: "No account selected for editing",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      // Validate thresholds
      const minThresholdValue = Number.parseFloat(minThreshold || "0");
      const maxThresholdValue = Number.parseFloat(maxThreshold || "0");
      const currentBalanceValue = Number.parseFloat(currentBalance || "0");

      if (minThresholdValue >= maxThresholdValue) {
        toast({
          title: "Validation Error",
          description: "Minimum threshold must be less than maximum threshold",
          variant: "destructive",
        });
        return;
      }

      if (currentBalanceValue < 0) {
        toast({
          title: "Validation Error",
          description: "Current balance cannot be negative",
          variant: "destructive",
        });
        return;
      }

      // Prepare update data
      const updateData: any = {
        branch_id: branchId,
        min_threshold: minThresholdValue,
        max_threshold: maxThresholdValue,
      };

      // Add provider and account number if applicable
      const accountTypeInfo = accountTypes.find(
        (t) => t.value === account.account_type
      );

      if (accountTypeInfo?.hasProvider) {
        updateData.provider = provider;
      }

      if (accountTypeInfo?.hasAccountNumber) {
        updateData.account_number = accountNumber;
      }

      // Send update request
      const response = await fetch(`/api/float-accounts/${account.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update float account");
      }

      toast({
        title: "Success",
        description: "Float account updated successfully",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error updating float account:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update float account",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!account) {
    return null;
  }

  const accountTypeInfo = accountTypes.find(
    (t) => t.value === account.account_type
  );
  const showProvider = accountTypeInfo?.hasProvider;
  const showAccountNumber = accountTypeInfo?.hasAccountNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Float Account</DialogTitle>
          <DialogDescription>
            Update the details for your{" "}
            {accountTypeInfo?.label || account.account_type} account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type</Label>
            <Input
              id="accountType"
              value={accountTypeInfo?.label || account.account_type}
              disabled
            />
            <p className="text-sm text-muted-foreground">
              Account type cannot be changed after creation
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            {isAdmin ? (
              <Select
                value={branchId}
                onValueChange={setBranchId}
                disabled={loading}
              >
                <SelectTrigger id="branchId">
                  <SelectValue
                    placeholder={
                      loading ? "Loading branches..." : "Select branch"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {branches &&
                    branches.length > 0 &&
                    branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="branchId"
                value={account.branch_name || "Unknown Branch"}
                disabled
              />
            )}
            {!isAdmin && (
              <p className="text-sm text-muted-foreground">
                Only administrators can change the branch assignment
              </p>
            )}
          </div>

          {showProvider && (
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {getProviderOptions(account.account_type).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showAccountNumber && (
            <div className="space-y-2">
              <Label htmlFor="accountNumber">
                {account.account_type === "momo"
                  ? "Phone Number"
                  : "Account Number"}
              </Label>
              <Input
                id="accountNumber"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={
                  account.account_type === "momo"
                    ? "Enter phone number"
                    : "Enter account number"
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentBalance">Current Balance (GHS)</Label>
            <Input
              id="currentBalance"
              type="number"
              step="0.01"
              min="0"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Current balance cannot be modified directly. Use deposit/recharge
              functions to change the balance.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minThreshold">Minimum Threshold (GHS)</Label>
              <Input
                id="minThreshold"
                type="number"
                step="0.01"
                min="0"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum balance before alerts are triggered
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxThreshold">Maximum Threshold (GHS)</Label>
              <Input
                id="maxThreshold"
                type="number"
                step="0.01"
                min="0"
                value={maxThreshold}
                onChange={(e) => setMaxThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum recommended balance for this account
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
