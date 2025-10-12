"use client";

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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBranches } from "@/hooks/use-branches";
import { BranchSelector } from "@/components/branch/branch-selector";
import { useBranch } from "@/contexts/branch-context";
import {
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Info,
  BookOpen,
  AlertCircle,
  Database,
  Settings,
  Link,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GLMapping {
  id: string;
  transaction_type: string;
  mapping_type: string;
  gl_account_id: string;
  float_account_id?: string;
  branch_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  gl_account?: {
    code: string;
    name: string;
    type: string;
    balance: number;
  };
  float_account?: {
    account_type: string;
    provider?: string;
    account_number: string;
    current_balance: number;
  };
  branch_name?: string;
}

interface FloatAccount {
  id: string;
  provider: string;
  account_type: string;
  current_balance: number;
  branch_id: string;
  account_number?: string;
  branch_name: string;
}

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
}

interface ManualMapping {
  id: string;
  float_account_id: string;
  gl_account_id: string;
  mapping_type: string;
  is_active: boolean;
  float_account: FloatAccount;
  gl_account: GLAccount;
}

export function UnifiedGLMapping() {
  const { toast } = useToast();
  const { user, loading: userLoading } = useCurrentUser();
  const { branches, loading: branchesLoading } = useBranches();
  const { selectedBranchId, setSelectedBranchId } = useBranch();

  // State for GL Mappings
  const [glMappings, setGLMappings] = useState<GLMapping[]>([]);
  const [glMappingsLoading, setGLMappingsLoading] = useState(true);
  const [glSearchTerm, setGLSearchTerm] = useState("");
  const [glFilterType, setGLFilterType] = useState("all");
  const [glFilterStatus, setGLFilterStatus] = useState("all");

  // State for Manual Float Mappings
  const [manualMappings, setManualMappings] = useState<ManualMapping[]>([]);
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([]);
  const [manualMappingsLoading, setManualMappingsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedFloatAccount, setSelectedFloatAccount] = useState("");
  const [selectedGLAccount, setSelectedGLAccount] = useState("");
  const [mappingType, setMappingType] = useState("main_account");
  const [manualSearch, setManualSearch] = useState("");

  const handleBranchChange = (newBranchId: string) => {
    console.log("Branch changed from", selectedBranchId, "to", newBranchId);
    setSelectedBranchId(newBranchId);
  };

  // Determine branchId to use
  const branchIdToUse =
    user && (user.role === "Admin" || user.role === "admin")
      ? selectedBranchId || user?.branchId
      : user?.branchId;

  console.log("UnifiedGLMapping - User:", user);
  console.log("UnifiedGLMapping - Selected Branch ID:", selectedBranchId);
  console.log("UnifiedGLMapping - Branch ID to use:", branchIdToUse);
  console.log("UnifiedGLMapping - User Branch ID:", user?.branchId);

  // Fetch GL Mappings
  useEffect(() => {
    const fetchGLMappings = async () => {
      try {
        setGLMappingsLoading(true);
        let url = `/api/gl/mappings/complete`;
        const params = new URLSearchParams();

        if (branchIdToUse) {
          params.append("branchId", branchIdToUse);
        }

        if (glSearchTerm) {
          params.append("search", glSearchTerm);
        }

        if (glFilterType !== "all") {
          params.append("type", glFilterType);
        }

        if (glFilterStatus !== "all") {
          params.append("status", glFilterStatus);
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        console.log("Fetching GL mappings with URL:", url);
        console.log("Branch ID to use:", branchIdToUse);

        const response = await fetch(url);
        const data = await response.json();

        console.log("GL mappings response:", data);

        if (data.success) {
          setGLMappings(data.mappings || []);
        } else {
          throw new Error(data.error || "Failed to fetch GL mappings");
        }
      } catch (error) {
        console.error("Error fetching GL mappings:", error);
        setGLMappings([]);
        toast({
          title: "Error",
          description: "Failed to fetch GL mappings",
          variant: "destructive",
        });
      } finally {
        setGLMappingsLoading(false);
      }
    };

    if (branchIdToUse) {
      fetchGLMappings();
    }
  }, [branchIdToUse, glSearchTerm, glFilterType, glFilterStatus, toast]);

  // Fetch Manual Mappings
  useEffect(() => {
    const fetchManualMappings = async () => {
      try {
        setManualMappingsLoading(true);
        const url = `/api/float-gl-mapping/manual?page=1&pageSize=1000&branchId=${
          branchIdToUse || ""
        }`;

        console.log("Fetching manual mappings with URL:", url);
        console.log("Branch ID to use for manual mappings:", branchIdToUse);

        const response = await fetch(url);
        const data = await response.json();

        console.log("Manual mappings response:", data);

        if (data.success) {
          setManualMappings(Array.isArray(data.mappings) ? data.mappings : []);
          setFloatAccounts(
            Array.isArray(data.floatAccounts) ? data.floatAccounts : []
          );
          setGLAccounts(Array.isArray(data.glAccounts) ? data.glAccounts : []);
        } else {
          console.error("Failed to fetch manual mappings:", data.error);
          setManualMappings([]);
          setFloatAccounts([]);
          setGLAccounts([]);
        }
      } catch (error) {
        console.error("Error fetching manual mappings:", error);
        setManualMappings([]);
        setFloatAccounts([]);
        setGLAccounts([]);
      } finally {
        setManualMappingsLoading(false);
      }
    };

    if (branchIdToUse) {
      fetchManualMappings();
    }
  }, [branchIdToUse]);

  const getServiceTypeLabel = (transactionType: string, floatAccount?: any) => {
    if (floatAccount) {
      const accountType = floatAccount.account_type;
      const provider = floatAccount.provider;

      switch (accountType) {
        case "momo":
          return `MoMo${provider ? ` (${provider})` : ""}`;
        case "agency-banking":
          return `Agency Banking${provider ? ` (${provider})` : ""}`;
        case "e-zwich":
          return "E-Zwich";
        case "power":
          return `Power${provider ? ` (${provider})` : ""}`;
        case "jumia":
          return "Jumia";
        case "cash-in-till":
          return "Cash in Till";
        default:
          return accountType || "Unknown";
      }
    }

    if (transactionType.includes("momo")) return "MoMo";
    if (transactionType.includes("agency")) return "Agency Banking";
    if (
      transactionType.includes("e_zwich") ||
      transactionType.includes("ezwich")
    )
      return "E-Zwich";
    if (transactionType.includes("power")) return "Power";
    if (transactionType.includes("jumia")) return "Jumia";
    if (transactionType.includes("expense")) return "Expenses";
    if (transactionType.includes("inventory")) return "Inventory";

    return transactionType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getMappingTypeLabel = (mappingType: string) => {
    switch (mappingType) {
      case "main":
      case "main_account":
        return "Main Account";
      case "fee":
      case "fee_account":
        return "Fee Account";
      case "revenue":
      case "revenue_account":
        return "Revenue Account";
      case "expense":
      case "expense_account":
        return "Expense Account";
      case "asset":
        return "Asset Account";
      case "liability":
        return "Liability Account";
      case "commission":
      case "commission_account":
        return "Commission Account";
      case "float":
        return "Float Account";
      default:
        return mappingType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  const handleAddManualMapping = async () => {
    if (!selectedFloatAccount || !selectedGLAccount) {
      toast({
        title: "Validation Error",
        description: "Please select both a float account and GL account",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/float-gl-mapping/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          float_account_id: selectedFloatAccount,
          gl_account_id: selectedGLAccount,
          mapping_type: mappingType,
          branch_id: branchIdToUse,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Mapping created successfully",
        });
        setIsAddDialogOpen(false);
        setSelectedFloatAccount("");
        setSelectedGLAccount("");
        setMappingType("main_account");

        // Refresh data
        const refreshResponse = await fetch(
          `/api/float-gl-mapping/manual?page=1&pageSize=1000&branchId=${
            branchIdToUse || ""
          }`
        );
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setManualMappings(
            Array.isArray(refreshData.mappings) ? refreshData.mappings : []
          );
          setFloatAccounts(
            Array.isArray(refreshData.floatAccounts)
              ? refreshData.floatAccounts
              : []
          );
          setGLAccounts(
            Array.isArray(refreshData.glAccounts) ? refreshData.glAccounts : []
          );
        }
      } else {
        throw new Error(data.error || "Failed to create mapping");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create mapping",
        variant: "destructive",
      });
    }
  };

  const handleDeleteManualMapping = async (mappingId: string) => {
    try {
      const response = await fetch(
        `/api/float-gl-mapping/manual/${mappingId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Mapping deleted successfully",
        });

        // Refresh data
        const refreshResponse = await fetch(
          `/api/float-gl-mapping/manual?page=1&pageSize=1000&branchId=${
            branchIdToUse || ""
          }`
        );
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setManualMappings(
            Array.isArray(refreshData.mappings) ? refreshData.mappings : []
          );
        }
      } else {
        throw new Error(data.error || "Failed to delete mapping");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete mapping",
        variant: "destructive",
      });
    }
  };

  const getAvailableFloatAccounts = () => {
    if (mappingType === "main_account") {
      const mappedAccountIds = manualMappings
        .filter((m) => m.mapping_type === "main_account" && m.is_active)
        .map((m) => m.float_account_id);
      return floatAccounts.filter(
        (account) => !mappedAccountIds.includes(account.id)
      );
    } else {
      return floatAccounts;
    }
  };

  const getServiceLabel = (
    accountType: string,
    provider?: string,
    accountNumber?: string
  ) => {
    switch (accountType) {
      case "momo":
        return `MoMo${provider ? ` (${provider})` : ""}`;
      case "agency-banking":
        return `Agency Banking${provider ? ` (${provider})` : ""}`;
      case "e-zwich":
        return "E-Zwich";
      case "power":
        return `Power${provider ? ` (${provider})` : ""}`;
      case "jumia":
        return "Jumia";
      case "cash-in-till":
        return "Cash in Till";
      default:
        return accountType || "Unknown";
    }
  };

  const mappingTypeOptions = [
    {
      value: "main_account",
      label: "Main Account",
      description: "Primary account for transaction amounts",
    },
    {
      value: "fee_account",
      label: "Fee Account",
      description: "Account for transaction fees and charges",
    },
    {
      value: "commission_account",
      label: "Commission Account",
      description: "Account for commission earnings",
    },
    {
      value: "revenue_account",
      label: "Revenue Account",
      description: "Account for service revenue",
    },
    {
      value: "expense_account",
      label: "Expense Account",
      description: "Account for service-related expenses",
    },
  ];

  const filteredManualMappings = manualMappings.filter((mapping) => {
    if (!manualSearch) return true;

    const floatAccount = mapping.float_account;
    const glAccount = mapping.gl_account;

    return (
      getServiceLabel(floatAccount.account_type, floatAccount.provider)
        .toLowerCase()
        .includes(manualSearch.toLowerCase()) ||
      glAccount.account_name
        .toLowerCase()
        .includes(manualSearch.toLowerCase()) ||
      glAccount.account_code
        .toLowerCase()
        .includes(manualSearch.toLowerCase()) ||
      mappingTypeOptions
        .find((opt) => opt.value === mapping.mapping_type)
        ?.label.toLowerCase()
        .includes(manualSearch.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header with Branch Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">GL Account Mappings</h2>
          <p className="text-muted-foreground">
            Manage GL account mappings for transactions and float accounts
          </p>
          {(user?.role === "Admin" || user?.role === "admin") &&
            branchIdToUse && (
              <p className="text-sm text-blue-600 mt-1">
                Current Branch: {branchIdToUse}
              </p>
            )}
          {/* Debug info for admin */}
          {(user?.role === "Admin" || user?.role === "admin") && (
            <div className="text-xs text-gray-500 mt-1">
              <p>User Branch: {user?.branchId}</p>
              <p>Selected Branch: {selectedBranchId || "None"}</p>
              <p>Effective Branch: {branchIdToUse}</p>
            </div>
          )}
        </div>
        {(user?.role === "Admin" || user?.role === "admin") && (
          <BranchSelector
            onBranchChange={handleBranchChange}
            showActiveOnly={false}
          />
        )}
      </div>

      <Tabs defaultValue="gl-mappings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gl-mappings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            GL Mappings
          </TabsTrigger>
          <TabsTrigger
            value="manual-mappings"
            className="flex items-center gap-2"
          >
            <Link className="h-4 w-4" />
            Manual Float Mappings
          </TabsTrigger>
        </TabsList>

        {/* GL Mappings Tab */}
        <TabsContent value="gl-mappings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                GL Transaction Mappings
              </CardTitle>
              <CardDescription>
                Automatic GL account mappings for different transaction types
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search mappings..."
                    value={glSearchTerm}
                    onChange={(e) => setGLSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Select value={glFilterType} onValueChange={setGLFilterType}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="momo">MoMo</SelectItem>
                    <SelectItem value="agency">Agency Banking</SelectItem>
                    <SelectItem value="e_zwich">E-Zwich</SelectItem>
                    <SelectItem value="power">Power</SelectItem>
                    <SelectItem value="jumia">Jumia</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={glFilterStatus}
                  onValueChange={setGLFilterStatus}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGLSearchTerm("");
                    setGLFilterType("all");
                    setGLFilterStatus("all");
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>

              {/* GL Mappings Table */}
              {glMappingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading GL mappings...
                </div>
              ) : glMappings.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No GL mappings found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Mapping Type</TableHead>
                      <TableHead>GL Account</TableHead>
                      <TableHead>Float Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glMappings.map((mapping) => {
                      console.log("Rendering GL mapping:", mapping);
                      return (
                        <TableRow key={mapping.id}>
                          <TableCell>
                            {getServiceTypeLabel(
                              mapping.transaction_type,
                              mapping.float_account
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getMappingTypeLabel(mapping.mapping_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {mapping.gl_account ? (
                              <div>
                                <div className="font-medium">
                                  {mapping.gl_account.code}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {mapping.gl_account.name}
                                </div>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell>
                            {mapping.float_account ? (
                              <div>
                                <div className="font-medium">
                                  {mapping.float_account.account_type}
                                </div>
                                {mapping.float_account.provider && (
                                  <div className="text-sm text-muted-foreground">
                                    {mapping.float_account.provider}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-muted-foreground">
                                No Float Account
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                mapping.is_active ? "default" : "secondary"
                              }
                            >
                              {mapping.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {mapping.gl_account
                              ? formatCurrency(mapping.gl_account.balance)
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Float Mappings Tab */}
        <TabsContent value="manual-mappings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-5 w-5" />
                    Manual Float Account Mappings
                  </CardTitle>
                  <CardDescription>
                    Manually map float accounts to GL accounts for specific
                    transaction types
                  </CardDescription>
                </div>
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={setIsAddDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Mapping
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Float Account Mapping</DialogTitle>
                      <DialogDescription>
                        Create a new mapping between a float account and GL
                        account
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">
                          Float Account
                        </label>
                        <Select
                          value={selectedFloatAccount}
                          onValueChange={setSelectedFloatAccount}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select float account" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableFloatAccounts().map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {getServiceLabel(
                                  account.account_type,
                                  account.provider
                                )}{" "}
                                - {formatCurrency(account.current_balance)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          GL Account
                        </label>
                        <Select
                          value={selectedGLAccount}
                          onValueChange={setSelectedGLAccount}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select GL account" />
                          </SelectTrigger>
                          <SelectContent>
                            {glAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.account_code} - {account.account_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          Mapping Type
                        </label>
                        <Select
                          value={mappingType}
                          onValueChange={setMappingType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select mapping type" />
                          </SelectTrigger>
                          <SelectContent>
                            {mappingTypeOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddManualMapping}>
                        Create Mapping
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-6">
                <Input
                  placeholder="Search mappings..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              {/* Manual Mappings Table */}
              {manualMappingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading manual mappings...
                </div>
              ) : filteredManualMappings.length === 0 ? (
                <div className="text-center py-8">
                  <Link className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No manual mappings found
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Float Account</TableHead>
                      <TableHead>GL Account</TableHead>
                      <TableHead>Mapping Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManualMappings.map((mapping) => {
                      console.log("Rendering manual mapping:", mapping);
                      return (
                        <TableRow key={mapping.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {mapping.float_account
                                  ? getServiceLabel(
                                      mapping.float_account.account_type,
                                      mapping.float_account.provider
                                    )
                                  : "Unknown Account"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Balance:{" "}
                                {mapping.float_account
                                  ? formatCurrency(
                                      mapping.float_account.current_balance
                                    )
                                  : "N/A"}
                              </div>
                              <div className="text-xs text-red-500">
                                Float Account ID: {mapping.float_account_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {mapping.gl_account?.account_code || "N/A"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {mapping.gl_account?.account_name || "N/A"}
                              </div>
                              <div className="text-xs text-red-500">
                                GL Account ID: {mapping.gl_account_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {mappingTypeOptions.find(
                                (opt) => opt.value === mapping.mapping_type
                              )?.label || mapping.mapping_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                mapping.is_active ? "default" : "secondary"
                              }
                            >
                              {mapping.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleDeleteManualMapping(mapping.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
