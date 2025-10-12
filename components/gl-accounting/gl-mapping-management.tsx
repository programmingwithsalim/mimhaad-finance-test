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
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBranches } from "@/hooks/use-branches";
import { BranchSelector } from "@/components/branch/branch-selector";
import { useBranch } from "@/contexts/branch-context";
import { Search, RefreshCw, Eye, EyeOff } from "lucide-react";

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

export function GLMappingManagement() {
  const { toast } = useToast();
  const { user, loading: userLoading } = useCurrentUser();
  const { branches, loading: branchesLoading } = useBranches();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [mappings, setMappings] = useState<GLMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Determine branchId to use
  const branchIdToUse =
    user && user.role === "Admin"
      ? selectedBranchId || user?.branchId
      : user?.branchId || "635844ab-029a-43f8-8523-d7882915266a";

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        setLoading(true);
        let url = `/api/gl/mappings/complete`;
        const params = new URLSearchParams();

        if (branchIdToUse) {
          params.append("branchId", branchIdToUse);
        }

        if (searchTerm) {
          params.append("search", searchTerm);
        }

        if (filterType !== "all") {
          params.append("type", filterType);
        }

        if (filterStatus !== "all") {
          params.append("status", filterStatus);
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
          setMappings(data.mappings || []);
        } else {
          throw new Error(data.error || "Failed to fetch mappings");
        }
      } catch (error) {
        console.error("Error fetching GL mappings:", error);
        setMappings([]);
        toast({
          title: "Error",
          description: "Failed to fetch GL mappings",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (branchIdToUse) {
      fetchMappings();
    }
  }, [branchIdToUse, searchTerm, filterType, filterStatus, toast]);

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

    // For non-float account mappings, parse transaction type
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
        return "Main Account";
      case "fee":
        return "Fee Account";
      case "revenue":
        return "Revenue Account";
      case "expense":
        return "Expense Account";
      case "asset":
        return "Asset Account";
      case "liability":
        return "Liability Account";
      case "commission":
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

  const filteredMappings = mappings.filter((mapping) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      mapping.transaction_type.toLowerCase().includes(search) ||
      mapping.mapping_type.toLowerCase().includes(search) ||
      mapping.gl_account?.code.toLowerCase().includes(search) ||
      mapping.gl_account?.name.toLowerCase().includes(search) ||
      mapping.branch_name?.toLowerCase().includes(search) ||
      getServiceTypeLabel(mapping.transaction_type, mapping.float_account)
        .toLowerCase()
        .includes(search);

    const matchesType =
      filterType === "all" || mapping.transaction_type.includes(filterType);
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && mapping.is_active) ||
      (filterStatus === "inactive" && !mapping.is_active);

    return matchesSearch && matchesType && matchesStatus;
  });

  const transactionTypes = Array.from(
    new Set(mappings.map((m) => m.transaction_type))
  ).sort();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>GL Mapping Management</CardTitle>
            <CardDescription>
              View and manage GL account mappings for transactions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                setSearchTerm("");
                setFilterType("all");
                setFilterStatus("all");
              }} 
              variant="outline" 
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {user && user.role === "Admin" && <BranchSelector />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search mappings..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {transactionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getServiceTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading mappings...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead>Mapping Type</TableHead>
                  <TableHead>GL Account</TableHead>
                  <TableHead>Float Account</TableHead>
                  <TableHead className="text-right">GL Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">
                      {mapping.branch_name || "Unknown Branch"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getServiceTypeLabel(
                          mapping.transaction_type,
                          mapping.float_account
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {mapping.transaction_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getMappingTypeLabel(mapping.mapping_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mapping.gl_account ? (
                        <div>
                          <div className="font-medium">
                            {mapping.gl_account.code} -{" "}
                            {mapping.gl_account.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {mapping.gl_account.type}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {mapping.float_account ? (
                        <div>
                          <div className="font-medium">
                            {mapping.float_account.account_type}
                            {mapping.float_account.provider &&
                              ` (${mapping.float_account.provider})`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {mapping.float_account.account_number}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {mapping.gl_account
                        ? formatCurrency(mapping.gl_account.balance)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={mapping.is_active ? "default" : "secondary"}
                      >
                        {mapping.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {filteredMappings.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No mappings found matching your criteria.
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredMappings.length} of {mappings.length} mappings
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
