"use client";

import type React from "react";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search, RefreshCw, Database } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBranches } from "@/hooks/use-branches";
import { BranchSelector } from "@/components/branch/branch-selector";
import { useBranch } from "@/contexts/branch-context";

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id?: string;
  description?: string;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch_id: string;
  branch_name?: string;
}

export function GLAccountManagement() {
  const { toast } = useToast();
  const { user, loading: userLoading } = useCurrentUser();
  const { branches, loading: branchesLoading } = useBranches();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<GLAccount | null>(
    null
  );
  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "",
    parent_id: "",
    is_active: true,
    branch_id: "",
  });
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalAccounts, setTotalAccounts] = useState(0);

  const accountTypes = [
    { value: "Asset", label: "Asset" },
    { value: "Liability", label: "Liability" },
    { value: "Equity", label: "Equity" },
    { value: "Revenue", label: "Revenue" },
    { value: "Expense", label: "Expense" },
  ];

  // Determine branchId to use
  const branchIdToUse =
    user && (user.role === "Admin" || user.role === "admin")
      ? selectedBranchId || user?.branchId
      : user?.branchId;

  // Single useEffect to handle all data fetching
  useEffect(() => {
    const fetchData = async () => {
      // Don't fetch if user is still loading or no branch ID
      if (userLoading || !branchIdToUse) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let url = `/api/gl/accounts/complete?all=true`;
        if (branchIdToUse) {
          url += `&branchId=${branchIdToUse}`;
        }

        console.log("Fetching GL accounts with URL:", url);
        console.log("User:", user);
        console.log("Branch ID to use:", branchIdToUse);

        const response = await fetch(url);
        const data = await response.json();

        console.log("GL accounts response:", data);

        if (data.success) {
          setAccounts(data.accounts || []);
          setTotalAccounts(data.accounts?.length || 0);
        } else {
          console.error("Failed to fetch GL accounts:", data.error);
          setAccounts([]);
          setTotalAccounts(0);
          toast({
            title: "Error",
            description: data.error || "Failed to fetch GL accounts",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching GL accounts:", error);
        setAccounts([]);
        setTotalAccounts(0);
        toast({
          title: "Error",
          description: "Failed to fetch GL accounts",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [branchIdToUse, userLoading, toast, user]);

  // Reset page when search term changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!formData.account_code) {
      toast({
        title: "Validation Error",
        description: "Account code is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.account_name) {
      toast({
        title: "Validation Error",
        description: "Account name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.account_type) {
      toast({
        title: "Validation Error",
        description: "Account type is required",
        variant: "destructive",
      });
      return;
    }

    if (!branchIdToUse) {
      toast({
        title: "Validation Error",
        description: "Branch selection is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const url = selectedAccount
        ? `/api/gl/accounts/${selectedAccount.id}`
        : "/api/gl/accounts";
      const method = selectedAccount ? "PUT" : "POST";

      const submitData = {
        ...formData,
        parent_id:
          formData.parent_id === "none" || formData.parent_id === ""
            ? null
            : formData.parent_id,
        branch_id: branchIdToUse,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save account");
      }

      toast({
        title: "Success",
        description: `GL account ${
          selectedAccount ? "updated" : "created"
        } successfully`,
      });

      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedAccount(null);
      resetForm();
      // Refresh data by triggering useEffect
      setSearchTerm("");
      setPage(1);
    } catch (error) {
      console.error("Error saving GL account:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save account",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (account: GLAccount) => {
    setSelectedAccount(account);
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      parent_id: account.parent_id || "",
      is_active: account.is_active,
      branch_id: account.branch_id || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (account: GLAccount) => {
    if (
      !confirm(
        `Are you sure you want to delete account "${account.account_name}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/gl/accounts/${account.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete account");
      }

      toast({
        title: "Success",
        description: "GL account deleted successfully",
      });

      // Refresh data by triggering useEffect
      setSearchTerm("");
      setPage(1);
    } catch (error) {
      console.error("Error deleting GL account:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete account",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      account_code: "",
      account_name: "",
      account_type: "",
      parent_id: "",
      is_active: true,
      branch_id: "",
    });
  };

  // Add branch name to search filter
  const filteredAccounts = accounts.filter((account) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      account.account_code.toLowerCase().includes(searchLower) ||
      account.account_name.toLowerCase().includes(searchLower) ||
      account.account_type.toLowerCase().includes(searchLower) ||
      (account.branch_name?.toLowerCase() || "").includes(searchLower)
    );
  });

  // Paginate filtered results on the frontend
  const paginatedAccounts = filteredAccounts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case "asset":
        return "bg-green-100 text-green-800";
      case "liability":
        return "bg-red-100 text-red-800";
      case "equity":
        return "bg-blue-100 text-blue-800";
      case "revenue":
        return "bg-purple-100 text-purple-800";
      case "expense":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === "Admin" && (
        <div className="mb-4">
          <BranchSelector onBranchChange={setSelectedBranchId} />
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>GL Account Management</CardTitle>
            <CardDescription>
              Create, edit, and manage general ledger accounts
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setSearchTerm("");
                setPage(1);
              }}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsAddDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New GL Account</DialogTitle>
                  <DialogDescription>
                    Create a new general ledger account
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="account_code">Account Code *</Label>
                      <Input
                        id="account_code"
                        value={formData.account_code}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            account_code: e.target.value,
                          }))
                        }
                        placeholder="e.g., 1001"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_type">Account Type *</Label>
                      <Select
                        value={formData.account_type}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            account_type: value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_name">Account Name *</Label>
                    <Input
                      id="account_name"
                      value={formData.account_name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          account_name: e.target.value,
                        }))
                      }
                      placeholder="e.g., Cash in Bank"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent_id">Parent Account</Label>
                    <Select
                      value={formData.parent_id}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, parent_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Parent</SelectItem>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_code} - {account.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Branch selection (only for admin) */}
                  {user && user.role === "Admin" && (
                    <div className="mb-4">
                      <Label htmlFor="branch_id">Branch</Label>
                      <Select
                        value={formData.branch_id}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, branch_id: value }))
                        }
                      >
                        <SelectTrigger id="branch_id">
                          <SelectValue
                            placeholder={
                              branchesLoading ? "Loading..." : "Select branch"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {/* For non-admins, branch is auto-assigned and hidden */}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Account</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search accounts..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {userLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading user data...</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading accounts...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                <Database className="h-12 w-12 mx-auto mb-2" />
                <p>No GL accounts found for this branch.</p>
                <p className="text-sm">Branch ID: {branchIdToUse}</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAccounts.map((account) => {
                  const branch = branches.find(
                    (b) => b.id === account.branch_id
                  );
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">
                        {account.account_code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {account.account_name}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(
                            account.account_type
                          )}`}
                        >
                          {account.account_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        {account.branch_name || branch?.name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(account.balance)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.is_active ? "default" : "secondary"}
                        >
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(account)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {filteredAccounts.length === 0 &&
            !loading &&
            !userLoading &&
            accounts.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                No accounts found matching your search.
              </div>
            )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} | Total Accounts:{" "}
                {filteredAccounts.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span className="text-sm">{page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
              <select
                className="ml-2 border rounded px-2 py-1 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit GL Account</DialogTitle>
            <DialogDescription>
              Update the general ledger account details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_account_code">Account Code *</Label>
                <Input
                  id="edit_account_code"
                  value={formData.account_code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      account_code: e.target.value,
                    }))
                  }
                  placeholder="e.g., 1001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_account_type">Account Type *</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, account_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_account_name">Account Name *</Label>
              <Input
                id="edit_account_name"
                value={formData.account_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    account_name: e.target.value,
                  }))
                }
                placeholder="e.g., Cash in Bank"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_parent_id">Parent Account</Label>
              <Select
                value={formData.parent_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, parent_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent account (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Parent</SelectItem>
                  {accounts
                    .filter((acc) => acc.id !== selectedAccount?.id)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.account_code} - {account.account_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="edit_is_active">Active</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
