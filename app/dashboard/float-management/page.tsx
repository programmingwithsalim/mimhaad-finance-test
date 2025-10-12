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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Zap,
  Banknote,
  Smartphone,
  Building2,
  CreditCard,
  Wifi,
  ShoppingCart,
  PiggyBank,
  Activity,
  BarChart3,
  MoreVertical,
  PieChart,
  Target,
} from "lucide-react";
import { FloatRechargeDialog } from "@/components/float-management/float-recharge-dialog";
import { CreateFloatAccountModal } from "@/components/float-management/create-float-account-modal";
import { EditFloatAccountModal } from "@/components/float-management/edit-float-account-modal";
import { DeleteAccountDialog } from "@/components/float-management/delete-account-dialog";
import { GenerateStatement } from "@/components/float-management/generate-statement";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface FloatAccountData {
  id: string;
  account_type: string;
  provider: string;
  account_number?: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  is_active: boolean;
  branch_id: string;
  branch_name?: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  isezwichpartner?: boolean;
  notes?: string;
}

export default function FloatManagementPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [floatAccounts, setFloatAccounts] = useState<FloatAccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] =
    useState<FloatAccountData | null>(null);
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isGenerateStatementDialogOpen, setIsGenerateStatementDialogOpen] =
    useState(false);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isAdmin = user?.role === "Admin" || user?.role === "admin";

  const fetchFloatAccounts = async () => {
    try {
      setLoading(true);

      // Build URL with parameters
      let url = "/api/float-accounts?";
      const params = new URLSearchParams();

      if (!isAdmin && user?.branchId) {
        params.append("branchId", user.branchId);
      }

      if (statusFilter === "inactive") {
        params.append("showInactive", "true");
      }

      if (accountTypeFilter) {
        params.append("accountType", accountTypeFilter);
      }
      if (providerFilter) {
        params.append("provider", providerFilter);
      }
      if (statusFilter === "active") {
        params.append("isActive", "true");
      }

      const response = await fetch(`${url}${params.toString()}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Ensure floatAccounts is always an array
          const accounts = Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.floatAccounts)
            ? data.floatAccounts
            : Array.isArray(data.accounts)
            ? data.accounts
            : [];
          setFloatAccounts(accounts);
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to load float accounts",
            variant: "destructive",
          });
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load float accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFloatAccounts();
  }, [user?.branchId, accountTypeFilter, providerFilter, statusFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getAccountTypeLabel = (accountType: string, provider?: string) => {
    switch (accountType?.toLowerCase()) {
      case "momo":
        return `Mobile Money${provider ? ` (${provider})` : ""}`;
      case "agency-banking":
        return `Agency Banking${provider ? ` (${provider})` : ""}`;
      case "e-zwich":
        return "E-Zwich";
      case "cash-in-till":
        return "Cash in Till";
      case "power":
        return `Power${provider ? ` (${provider})` : ""}`;
      case "jumia":
        return `Jumia${provider ? ` (${provider})` : ""}`;
      default:
        return accountType || "Unknown";
    }
  };

  const getAccountTypeIcon = (accountType: string) => {
    switch (accountType?.toLowerCase()) {
      case "momo":
        return <Smartphone className="h-5 w-5" />;
      case "agency-banking":
        return <Building2 className="h-5 w-5" />;
      case "e-zwich":
        return <CreditCard className="h-5 w-5" />;
      case "cash-in-till":
        return <PiggyBank className="h-5 w-5" />;
      case "power":
        return <Zap className="h-5 w-5" />;
      case "jumia":
        return <ShoppingCart className="h-5 w-5" />;
      default:
        return <Banknote className="h-5 w-5" />;
    }
  };

  const getAccountTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case "momo":
        return "#10B981"; // green
      case "agency-banking":
        return "#3B82F6"; // blue
      case "e-zwich":
        return "#8B5CF6"; // purple
      case "cash-in-till":
        return "#F59E0B"; // amber
      case "power":
        return "#EF4444"; // red
      case "jumia":
        return "#EC4899"; // pink
      default:
        return "#6B7280"; // gray
    }
  };

  const getBalanceStatus = (account: FloatAccountData) => {
    if (account.current_balance <= account.min_threshold) {
      return { status: "low", color: "destructive" };
    } else if (account.current_balance >= account.max_threshold) {
      return { status: "high", color: "warning" };
    }
    return { status: "normal", color: "default" };
  };

  const canRecharge = (accountType: string) => {
    // Only power accounts can be recharged
    return ["power"].includes(accountType?.toLowerCase());
  };

  const canDeposit = (accountType: string) => {
    // MoMo, agency banking, and cash-in-till can accept deposits
    return ["momo", "agency-banking", "cash-in-till"].includes(
      accountType?.toLowerCase()
    );
  };

  const canBeUsedAsSource = (accountType: string) => {
    // Cash-in-till and other service accounts can be used as source for transfers
    // Exclude power and E-Zwich from being used as source
    return ["cash-in-till", "momo", "agency-banking", "jumia"].includes(
      accountType?.toLowerCase()
    );
  };

  const handleRecharge = (account: FloatAccountData) => {
    setSelectedAccount(account);
    setIsRechargeDialogOpen(true);
  };

  const handleDeposit = (account: FloatAccountData) => {
    setSelectedAccount(account);
    setIsRechargeDialogOpen(true); // Reuse recharge dialog for deposits
  };

  const handleEdit = (account: FloatAccountData) => {
    setSelectedAccount(account);
    setIsEditModalOpen(true);
  };

  const handleDelete = (account: FloatAccountData) => {
    setSelectedAccount(account);
    setIsDeleteDialogOpen(true);
  };

  const handleGenerateStatement = (account: FloatAccountData) => {
    setSelectedAccount(account);
    setIsGenerateStatementDialogOpen(true);
  };

  const handleReactivate = async (account: FloatAccountData) => {
    try {
      const response = await fetch("/api/float-accounts/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountId: account.id }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Account Reactivated",
          description: `${getAccountTypeLabel(
            account.account_type,
            account.provider
          )} has been reactivated successfully.`,
        });
        fetchFloatAccounts(); // Refresh the list
      } else {
        toast({
          title: "Reactivation Failed",
          description: data.error || "Failed to reactivate account",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Reactivation Failed",
        description: "Failed to reactivate account",
        variant: "destructive",
      });
    }
  };

  const handleSuccess = () => {
    fetchFloatAccounts();
    setIsRechargeDialogOpen(false);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteDialogOpen(false);
    setIsGenerateStatementDialogOpen(false);
    setSelectedAccount(null);
  };

  // Ensure floatAccounts is always an array
  const accountsArray = Array.isArray(floatAccounts) ? floatAccounts : [];

  // Calculate comprehensive statistics
  const totalAccounts = accountsArray.length;
  const activeAccounts = accountsArray.filter((acc) => acc.is_active).length;
  const inactiveAccounts = totalAccounts - activeAccounts;
  const totalBalance = accountsArray.reduce(
    (sum, acc) => sum + (Number(acc.current_balance) || 0),
    0
  );

  // Balance analysis
  const lowBalanceAccounts = accountsArray.filter(
    (acc) =>
      (Number(acc.current_balance) || 0) <= (Number(acc.min_threshold) || 0)
  ).length;
  const excessBalanceAccounts = accountsArray.filter(
    (acc) =>
      (Number(acc.current_balance) || 0) >= (Number(acc.max_threshold) || 0)
  ).length;
  const optimalBalanceAccounts =
    totalAccounts - lowBalanceAccounts - excessBalanceAccounts;

  // Account type distribution
  const accountTypeStats = accountsArray.reduce((stats, acc) => {
    const type = acc.account_type;
    if (!stats[type]) {
      stats[type] = { count: 0, balance: 0 };
    }
    stats[type].count++;
    stats[type].balance += Number(acc.current_balance) || 0;
    return stats;
  }, {} as Record<string, { count: number; balance: number }>);

  const mostUsedType = Object.entries(accountTypeStats).sort(
    (a, b) => b[1].count - a[1].count
  )[0];
  const highestBalanceType = Object.entries(accountTypeStats).sort(
    (a, b) => b[1].balance - a[1].balance
  )[0];

  // Average balance per account
  const averageBalancePerAccount =
    totalAccounts > 0 ? totalBalance / totalAccounts : 0;

  // Utilization rate (accounts with balance > 0)
  const accountsWithBalance = accountsArray.filter(
    (acc) => (Number(acc.current_balance) || 0) > 0
  ).length;
  const utilizationRate =
    totalAccounts > 0 ? (accountsWithBalance / totalAccounts) * 100 : 0;

  // Group accounts by type for better organization
  const groupedAccounts = accountsArray.reduce((groups, account) => {
    const type = account.account_type?.toLowerCase() || "other";
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
    return groups;
  }, {} as Record<string, FloatAccountData[]>);

  // Calculate balance distribution for chart
  const balanceDistribution = Object.entries(groupedAccounts).map(
    ([type, accounts]) => ({
      type: getAccountTypeLabel(type),
      total: accounts.reduce(
        (sum, acc) => sum + (Number(acc.current_balance) || 0),
        0
      ),
      count: accounts.length,
      color: getAccountTypeColor(type),
    })
  );

  // Get unique account types and providers for filters
  const uniqueAccountTypes = Array.from(
    new Set(accountsArray.map((acc) => acc.account_type))
  );
  const uniqueProviders = Array.from(
    new Set(accountsArray.map((acc) => acc.provider).filter(Boolean))
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading float accounts...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Float Management</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? "Manage float accounts across all branches"
              : `Manage float accounts for ${
                  user?.branchName || "your branch"
                }`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Filters Section */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Account Type
              </label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                {uniqueAccountTypes.map((type) => (
                  <option key={type} value={type}>
                    {getAccountTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Provider
              </label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
              >
                <option value="">All Providers</option>
                {uniqueProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            {(accountTypeFilter ||
              providerFilter ||
              statusFilter !== "all") && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground opacity-0">
                  Clear
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAccountTypeFilter("");
                    setProviderFilter("");
                    setStatusFilter("all");
                  }}
                  className="h-10 px-3 text-xs"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
          <CreateFloatAccountModal
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            onSuccess={handleSuccess}
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            }
          />
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Balance Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-700">
                  Total Float Balance
                </p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatCurrency(totalBalance)}
                </p>
                <p className="text-xs text-blue-600">
                  {totalAccounts} account{totalAccounts !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="p-3 bg-blue-500 rounded-full">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Status Card */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-700">
                  Account Status
                </p>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-green-900">
                    {activeAccounts}
                  </p>
                  <p className="text-xs text-green-600">
                    Active • {inactiveAccounts} Inactive
                  </p>
                </div>
                <p className="text-xs text-green-600">
                  {totalAccounts > 0
                    ? ((activeAccounts / totalAccounts) * 100).toFixed(1)
                    : 0}
                  % active rate
                </p>
              </div>
              <div className="p-3 bg-green-500 rounded-full">
                <Activity className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Health Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-700">
                  Balance Health
                </p>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-amber-900">
                    {optimalBalanceAccounts}
                  </p>
                  <p className="text-xs text-amber-600">
                    Optimal • {lowBalanceAccounts} Low • {excessBalanceAccounts}{" "}
                    High
                  </p>
                </div>
                <p className="text-xs text-amber-600">
                  {totalAccounts > 0
                    ? ((optimalBalanceAccounts / totalAccounts) * 100).toFixed(
                        1
                      )
                    : 0}
                  % optimal
                </p>
              </div>
              <div className="p-3 bg-amber-500 rounded-full">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-purple-700">
                  Performance
                </p>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-purple-900">
                    {formatCurrency(averageBalancePerAccount)}
                  </p>
                  <p className="text-xs text-purple-600">Avg per account</p>
                </div>
                <p className="text-xs text-purple-600">
                  {utilizationRate.toFixed(1)}% utilization
                </p>
              </div>
              <div className="p-3 bg-purple-500 rounded-full">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Type Insights */}
      {mostUsedType && highestBalanceType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Most Used Account Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {getAccountTypeLabel(mostUsedType[0])}
                  </span>
                  <Badge variant="secondary">
                    {mostUsedType[1].count} accounts
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total balance: {formatCurrency(mostUsedType[1].balance)}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${
                        totalAccounts > 0
                          ? (mostUsedType[1].count / totalAccounts) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Highest Balance Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {getAccountTypeLabel(highestBalanceType[0])}
                  </span>
                  <Badge variant="secondary">
                    {formatCurrency(highestBalanceType[1].balance)}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {highestBalanceType[1].count} accounts
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${
                        totalBalance > 0
                          ? (highestBalanceType[1].balance / totalBalance) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance Distribution Chart */}
      {balanceDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {isAdmin ? "Total Float Overview" : "Branch Float Overview"}
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? "Overview of all float accounts across branches"
                : `Overview of float accounts for ${
                    user?.branchName || "your branch"
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {balanceDistribution.map((item) => (
                <div key={item.type} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.type}</span>
                      <Badge variant="secondary" className="text-xs">
                        {item.count} account{item.count !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <span className="font-bold">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          totalBalance > 0
                            ? (item.total / totalBalance) * 100
                            : 0
                        }%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {totalBalance > 0
                      ? ((item.total / totalBalance) * 100).toFixed(1)
                      : 0}
                    % of total
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {accountsArray.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No float accounts found</p>
            <CreateFloatAccountModal
              open={isCreateModalOpen}
              onOpenChange={setIsCreateModalOpen}
              onSuccess={handleSuccess}
              trigger={
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Account
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([type, accounts]) => (
            <div key={type} className="space-y-4">
              <div className="flex items-center gap-2">
                {getAccountTypeIcon(type)}
                <h2 className="text-xl font-semibold">
                  {getAccountTypeLabel(type)} Accounts
                </h2>
                <Badge variant="secondary">{accounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((account) => {
                  const balanceStatus = getBalanceStatus(account);
                  return (
                    <Card
                      key={account.id}
                      className={`relative hover:shadow-md transition-shadow ${
                        !account.is_active ? "opacity-60 grayscale" : ""
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              {getAccountTypeIcon(account.account_type)}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">
                                {getAccountTypeLabel(
                                  account.account_type,
                                  account.provider
                                )}
                              </CardTitle>
                              <CardDescription>
                                {isAdmin && account.branch_name ? (
                                  <>
                                    <Building2 className="h-3 w-3 inline mr-1" />
                                    {account.branch_name}
                                  </>
                                ) : (
                                  account.branch_name || "Branch"
                                )}
                              </CardDescription>
                              {account.account_number && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Account: {account.account_number}
                                </p>
                              )}
                              {account.isezwichpartner && (
                                <Badge variant="secondary" className="mt-1">
                                  E-Zwich Partner
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                account.is_active ? "default" : "secondary"
                              }
                              className={
                                account.is_active
                                  ? ""
                                  : "bg-gray-400 text-white"
                              }
                            >
                              {account.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!account.is_active && (
                                  <DropdownMenuItem
                                    onClick={() => handleReactivate(account)}
                                    className="text-green-600"
                                  >
                                    <Activity className="h-4 w-4 mr-2" />
                                    Reactivate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleEdit(account)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleGenerateStatement(account)
                                  }
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Generate Statement
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(account)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Current Balance
                            </span>
                            <div className="flex items-center gap-1">
                              {account.current_balance <=
                              account.min_threshold ? (
                                <TrendingDown className="h-4 w-4 text-destructive" />
                              ) : account.current_balance >=
                                account.max_threshold ? (
                                <TrendingUp className="h-4 w-4 text-warning" />
                              ) : (
                                <DollarSign className="h-4 w-4 text-green-600" />
                              )}
                              <span
                                className={`font-bold text-lg ${
                                  balanceStatus.status === "low"
                                    ? "text-destructive"
                                    : balanceStatus.status === "high"
                                    ? "text-warning"
                                    : "text-green-600"
                                }`}
                              >
                                {formatCurrency(account.current_balance)}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Min: {formatCurrency(account.min_threshold)}
                            </span>
                            <span className="text-muted-foreground">
                              Max: {formatCurrency(account.max_threshold)}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          {canRecharge(account.account_type) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRecharge(account)}
                              className="flex items-center gap-1"
                            >
                              <Zap className="h-3 w-3" />
                              Recharge
                            </Button>
                          )}

                          {canDeposit(account.account_type) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeposit(account)}
                              className="flex items-center gap-1"
                            >
                              <Banknote className="h-3 w-3" />
                              Deposit
                            </Button>
                          )}

                          {!canRecharge(account.account_type) &&
                            !canDeposit(account.account_type) && (
                              <div className="col-span-2 h-8" />
                            )}
                        </div>
                      </CardContent>
                      {!account.is_active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70 rounded-lg">
                          <div className="text-center space-y-3">
                            <span className="text-white text-lg font-bold block">
                              Inactive Account
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleReactivate(account)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Activity className="h-4 w-4 mr-2" />
                              Reactivate
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <FloatRechargeDialog
        account={
          selectedAccount
            ? {
                id: selectedAccount.id,
                provider: selectedAccount.provider,
                account_type: selectedAccount.account_type,
                current_balance: selectedAccount.current_balance,
              }
            : null
        }
        open={isRechargeDialogOpen}
        onOpenChange={setIsRechargeDialogOpen}
        onSuccess={handleSuccess}
      />

      <EditFloatAccountModal
        account={
          selectedAccount
            ? {
                id: selectedAccount.id,
                branch_id: selectedAccount.branch_id,
                branch_name: selectedAccount.branch_name,
                account_type: selectedAccount.account_type,
                provider: selectedAccount.provider,
                account_number: selectedAccount.account_number,
                current_balance: selectedAccount.current_balance,
                min_threshold: selectedAccount.min_threshold,
                max_threshold: selectedAccount.max_threshold,
                last_updated:
                  selectedAccount.updated_at || selectedAccount.created_at,
                created_by: selectedAccount.created_by || "Unknown",
                created_at: selectedAccount.created_at,
              }
            : null
        }
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={handleSuccess}
      />

      <DeleteAccountDialog
        account={
          selectedAccount
            ? {
                id: selectedAccount.id,
                provider: selectedAccount.provider,
                account_type: selectedAccount.account_type,
                current_balance: selectedAccount.current_balance,
                branch_name: selectedAccount.branch_name,
              }
            : null
        }
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onSuccess={handleSuccess}
      />

      {selectedAccount && (
        <GenerateStatement
          key={`statement-${selectedAccount.id}`}
          floatAccountId={selectedAccount.id}
          floatAccountName={`${selectedAccount.provider} (${selectedAccount.account_type})`}
          open={isGenerateStatementDialogOpen}
          onOpenChange={setIsGenerateStatementDialogOpen}
        />
      )}
    </div>
  );
}
