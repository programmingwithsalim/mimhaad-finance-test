"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  RefreshCw,
  Info,
  BookOpen,
  AlertCircle,
  Database,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";

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

interface Mapping {
  id: string;
  float_account_id: string;
  gl_account_id: string;
  mapping_type: string;
  is_active: boolean;
  float_account: FloatAccount;
  gl_account: GLAccount;
}

export function ManualGLFloatMapping() {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [glAccounts, setGLAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false);
  const [selectedFloatAccount, setSelectedFloatAccount] = useState("");
  const [selectedGLAccount, setSelectedGLAccount] = useState("");
  const [mappingType, setMappingType] = useState("main_account");
  const [floatSearch, setFloatSearch] = useState("");
  const [glSearch, setGLSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalMappings, setTotalMappings] = useState(0);
  const [mappingSearch, setMappingSearch] = useState("");

  const mappingTypeOptions = [
    {
      value: "main_account",
      label: "Main Account",
      description: "Primary account for transaction amounts",
      example: "Cash account for MoMo transactions",
    },
    {
      value: "fee_account",
      label: "Fee Account",
      description: "Account for transaction fees and charges",
      example: "Revenue account for transaction fees",
    },
    {
      value: "commission_account",
      label: "Commission Account",
      description: "Account for commission earnings",
      example: "Revenue account for commissions earned",
    },
    {
      value: "revenue_account",
      label: "Revenue Account",
      description: "Account for service revenue (not just fees/commissions)",
      example: "Revenue account for MoMo service income",
    },
    {
      value: "expense_account",
      label: "Expense Account",
      description: "Account for service-related expenses",
      example: "Expense account for MoMo payouts",
    },
  ];

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const response = await fetch(
        `/api/float-gl-mapping/manual?page=1&pageSize=1000`
      );
      const data = await response.json();
      if (data.success) {
        setMappings(Array.isArray(data.mappings) ? data.mappings : []);
        setFloatAccounts(
          Array.isArray(data.floatAccounts) ? data.floatAccounts : []
        );
        setGLAccounts(Array.isArray(data.glAccounts) ? data.glAccounts : []);
      } else {
        setMappings([]);
        setFloatAccounts([]);
        setGLAccounts([]);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const response = await fetch(
      `/api/float-gl-mapping/manual?page=1&pageSize=1000`
    );
    const data = await response.json();
    if (data.success) {
      setMappings(Array.isArray(data.mappings) ? data.mappings : []);
      setFloatAccounts(
        Array.isArray(data.floatAccounts) ? data.floatAccounts : []
      );
      setGLAccounts(Array.isArray(data.glAccounts) ? data.glAccounts : []);
    } else {
      setMappings([]);
      setFloatAccounts([]);
      setGLAccounts([]);
    }
    setLoading(false);
  };

  const getAvailableFloatAccounts = () => {
    if (mappingType === "main_account") {
      const mappedAccountIds = mappings
        .filter((m) => m.mapping_type === "main_account" && m.is_active)
        .map((m) => m.float_account_id);
      return floatAccounts.filter(
        (account) => !mappedAccountIds.includes(account.id)
      );
    } else {
      return floatAccounts;
    }
  };

  const handleAddMapping = async () => {
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
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Mapping created successfully",
        });

        setIsAddDialogOpen(false);
        setSelectedFloatAccount("");
        setSelectedGLAccount("");
        setMappingType("main_account");
        fetchData();
      } else {
        throw new Error(result.error || "Failed to create mapping");
      }
    } catch (error) {
      console.error("❌ Error creating mapping:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create mapping",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm("Are you sure you want to delete this mapping?")) {
      return;
    }

    try {
      const response = await fetch("/api/float-gl-mapping/manual", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mapping_id: mappingId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Mapping deleted successfully",
        });
        fetchData();
      } else {
        throw new Error(result.error || "Failed to delete mapping");
      }
    } catch (error) {
      console.error("❌ Error deleting mapping:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete mapping",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getServiceLabel = (
    accountType: string,
    provider?: string,
    accountNumber?: string
  ) => {
    let label = "";
    switch (accountType?.toLowerCase()) {
      case "momo":
        label = `Mobile Money${provider ? ` (${provider})` : ""}`;
        break;
      case "agency-banking":
        label = `Agency Banking${provider ? ` (${provider})` : ""}`;
        break;
      case "e-zwich":
        label = "E-Zwich";
        break;
      case "cash-in-till":
        label = "Cash in Till";
        break;
      case "jumia":
        label = "Jumia";
        break;
      case "power":
        label = `Power${provider ? ` (${provider})` : ""}`;
        break;
      default:
        label = accountType || "Unknown";
    }

    if (accountNumber) {
      label += ` - ${accountNumber}`;
    }

    return label;
  };

  const availableFloatAccounts = getAvailableFloatAccounts();

  const filteredFloatAccounts = availableFloatAccounts.filter((account) => {
    const search = floatSearch.toLowerCase();
    return (
      account.branch_name.toLowerCase().includes(search) ||
      (account.account_type?.toLowerCase() || "").includes(search) ||
      (account.provider?.toLowerCase() || "").includes(search) ||
      (account.account_number?.toLowerCase() || "").includes(search)
    );
  });
  const filteredGLAccounts = glAccounts.filter((account) => {
    const search = glSearch.toLowerCase();
    return (
      account.account_code.toLowerCase().includes(search) ||
      account.account_name.toLowerCase().includes(search) ||
      (account.account_type?.toLowerCase() || "").includes(search)
    );
  });

  const filteredMappings = mappings.filter((mapping) => {
    const search = mappingSearch.toLowerCase();
    return (
      (mapping.float_account?.branch_name?.toLowerCase() || "").includes(
        search
      ) ||
      (mapping.float_account?.account_type?.toLowerCase() || "").includes(
        search
      ) ||
      (mapping.float_account?.provider?.toLowerCase() || "").includes(search) ||
      (mapping.float_account?.account_number?.toLowerCase() || "").includes(
        search
      ) ||
      (mapping.gl_account?.account_code?.toLowerCase() || "").includes(
        search
      ) ||
      (mapping.gl_account?.account_name?.toLowerCase() || "").includes(search)
    );
  });

  const paginatedMappings = filteredMappings.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.max(1, Math.ceil(filteredMappings.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [mappingSearch]);

  return (
    <div className="space-y-6">
      {/* GL-Float Mapping Guide */}
      <Dialog open={isGuideDialogOpen} onOpenChange={setIsGuideDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              GL-Float Mapping Guide
            </DialogTitle>
            <DialogDescription>
              Understanding how General Ledger accounts connect to Float
              accounts and Financial Reports
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">
                🏦 What is GL-Float Mapping?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                GL-Float mapping connects your operational float accounts (where
                you track service balances) to your accounting system's General
                Ledger accounts (for financial reporting).
              </p>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">
                  Example: Mobile Money Service
                </h4>
                <div className="text-sm space-y-1">
                  <div>
                    <strong>Float Account:</strong> "MTN MoMo - Accra Branch"
                    (Balance: GHS 50,000)
                  </div>
                  <div>
                    <strong>Main GL Account:</strong> "1003 - Mobile Money Cash"
                    (Asset)
                  </div>
                  <div>
                    <strong>Fee GL Account:</strong> "4001 - Transaction Fee
                    Revenue" (Revenue)
                  </div>
                  <div>
                    <strong>Commission GL Account:</strong> "4002 - MoMo
                    Commission Revenue" (Revenue)
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3">
                🔗 Mapping Types Explained
              </h3>
              <div className="space-y-3">
                {mappingTypeOptions.map((type) => (
                  <div key={type.value} className="border rounded-lg p-3">
                    <div className="font-medium">{type.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {type.description}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Example: {type.example}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manual GL-Float Account Mapping</CardTitle>
            <CardDescription>
              Create and manage manual mappings between float accounts and GL
              accounts
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsGuideDialogOpen(true)}
              variant="outline"
              size="sm"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Guide
            </Button>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setSelectedFloatAccount("");
                    setSelectedGLAccount("");
                    setMappingType("main_account");
                    setIsAddDialogOpen(true);
                  }}
                  disabled={glAccounts.length === 0}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Mapping
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                  <DialogTitle>Create New Mapping</DialogTitle>
                  <DialogDescription>
                    Map a float account to a general ledger account for
                    automatic posting
                  </DialogDescription>
                </DialogHeader>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Mapping Types:</strong>
                    <br />• <strong>Main Account:</strong> Primary account for
                    transaction amounts (1:1 mapping)
                    <br />• <strong>Fee Account:</strong> Account for
                    transaction fees and charges (N:1 mapping)
                    <br />• <strong>Commission Account:</strong> Account for
                    commission earnings (N:1 mapping)
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mapping Type</label>
                    <Select value={mappingType} onValueChange={setMappingType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {mappingTypeOptions.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {type.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Float Account ({availableFloatAccounts.length} available)
                    </label>
                    <Input
                      placeholder="Search float accounts..."
                      value={floatSearch}
                      onChange={(e) => setFloatSearch(e.target.value)}
                      className="mb-2"
                    />
                    <Select
                      value={selectedFloatAccount}
                      onValueChange={setSelectedFloatAccount}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select float account" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredFloatAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div>
                              <div className="font-medium">
                                {account.branch_name} -{" "}
                                {getServiceLabel(
                                  account.account_type,
                                  account.provider,
                                  account.account_number
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Balance:{" "}
                                {formatCurrency(account.current_balance)}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filteredFloatAccounts.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {mappingType === "main_account"
                          ? "All float accounts already have a main account mapping. Try fee or commission mapping types."
                          : "No float accounts available."}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      GL Account ({glAccounts.length} available)
                    </label>
                    <Input
                      placeholder="Search GL accounts..."
                      value={glSearch}
                      onChange={(e) => setGLSearch(e.target.value)}
                      className="mb-2"
                    />
                    <Select
                      value={selectedGLAccount}
                      onValueChange={setSelectedGLAccount}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select GL account" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredGLAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div>
                              <div className="font-medium">
                                {account.account_code} - {account.account_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Type: {account.account_type} | Balance:{" "}
                                {formatCurrency(account.balance)}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filteredGLAccounts.length === 0 && (
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>
                          No GL accounts available. Basic GL accounts should
                          have been created automatically.
                        </p>
                        <Button onClick={fetchData} variant="outline" size="sm">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Data
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddMapping}
                    disabled={
                      !selectedFloatAccount ||
                      !selectedGLAccount ||
                      glAccounts.length === 0
                    }
                  >
                    Create Mapping
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading mappings...</div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {floatAccounts.length}
                  </div>
                  <div className="text-sm text-blue-600">Float Accounts</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {glAccounts.length}
                  </div>
                  <div className="text-sm text-green-600">GL Accounts</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {mappings.length}
                  </div>
                  <div className="text-sm text-purple-600">Active Mappings</div>
                </div>
              </div>

              {glAccounts.length === 0 && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>No GL Accounts Found:</strong> Basic GL accounts
                    should have been created automatically. If you still see 0
                    GL accounts after refreshing, please check that the GL
                    accounts table exists and has data.
                    <br />
                    <Button
                      onClick={fetchData}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Now
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="mb-4 flex items-center gap-2">
                <Input
                  type="search"
                  placeholder="Search mappings (branch, float, GL, provider, etc.)..."
                  value={mappingSearch}
                  onChange={(e) => setMappingSearch(e.target.value)}
                  className="w-96"
                />
              </div>

              <Table id="manual-gl-float-mapping-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Float Account</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Float Balance</TableHead>
                    <TableHead>GL Account</TableHead>
                    <TableHead>GL Type</TableHead>
                    <TableHead>GL Balance</TableHead>
                    <TableHead>Mapping Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {mapping.float_account?.branch_name || "Unknown Branch"}
                      </TableCell>
                      <TableCell>
                        {getServiceLabel(
                          mapping.float_account?.account_type,
                          mapping.float_account?.provider,
                          mapping.float_account?.account_number
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          mapping.float_account?.current_balance || 0
                        )}
                      </TableCell>
                      <TableCell>
                        {mapping.gl_account?.account_code} -{" "}
                        {mapping.gl_account?.account_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {mapping.gl_account?.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(mapping.gl_account?.balance || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {mappingTypeOptions.find(
                            (opt) => opt.value === mapping.mapping_type
                          )?.label ||
                            mapping.mapping_type
                              .replace("_", " ")
                              .toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={mapping.is_active ? "default" : "secondary"}
                        >
                          {mapping.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <div>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages} | Total Mappings:{" "}
                    {totalMappings}
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
                      setPage(1); // Reset to first page on page size change
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
            </>
          )}

          {mappings.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="text-gray-500">
                No mappings found. Create your first mapping using the "Add
                Mapping" button.
              </div>
              {glAccounts.length === 0 && (
                <div className="mt-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Missing GL Accounts:</strong> Basic GL accounts
                      should have been created automatically. Try refreshing the
                      page.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
