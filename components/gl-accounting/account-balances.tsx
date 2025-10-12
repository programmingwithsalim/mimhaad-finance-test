"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Database,
  AlertTriangle,
  Download,
  Printer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AccountBalancesProps {
  dateRange: { from: Date; to: Date };
  selectedAccount: string | null;
  onAccountSelect: (accountId: string) => void;
}

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export function AccountBalances({
  dateRange,
  selectedAccount,
  onAccountSelect,
}: AccountBalancesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [glAccountsData, setGlAccountsData] = useState<GLAccount[]>([]);
  const [summaryData, setSummaryData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [selectedAccountDetails, setSelectedAccountDetails] =
    useState<GLAccount | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);

  useEffect(() => {
    fetchGLAccountBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, page, pageSize]);

  const fetchDebugInfo = async () => {
    try {
      const response = await fetch("/api/gl/debug");
      const data = await response.json();
      setDebugData(data);
      console.log("Debug data:", data);
    } catch (error) {
      console.error("Failed to fetch debug info:", error);
    }
  };

  const fetchGLAccountBalances = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching GL accounts...");
      const response = await fetch(
        `/api/gl/accounts/complete?page=${page}&pageSize=${pageSize}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error(`Response is not JSON: ${text.substring(0, 100)}...`);
      }

      const data = await response.json();
      console.log("GL accounts response:", data);

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch GL accounts");
      }

      const accounts = data.accounts || [];
      setGlAccountsData(accounts);
      setSummaryData(calculateSummary(accounts));
      setTotalAccounts(data.total_accounts || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching GL account balances:", error);
      setError(error.message || "Failed to fetch GL account balances");
      fetchDebugInfo();
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (accounts: GLAccount[]) => {
    const summary = {
      totalAccounts: accounts.length,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      accountTypes: new Set(accounts.map((acc) => acc.account_type)).size,
    };

    accounts.forEach((account) => {
      const balance = Number.parseFloat(String(account.balance || 0));
      switch (account.account_type?.toLowerCase()) {
        case "asset":
          summary.totalAssets += balance;
          break;
        case "liability":
          summary.totalLiabilities += balance;
          break;
        case "equity":
          summary.totalEquity += balance;
          break;
        case "revenue":
          summary.totalRevenue += balance;
          break;
        case "expense":
          summary.totalExpenses += balance;
          break;
      }
    });

    return summary;
  };

  const handleAccountDetails = async (accountId: string) => {
    try {
      const response = await fetch(`/api/gl/accounts/${accountId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch account details");
      }

      const data = await response.json();
      setSelectedAccountDetails(data.account);
      setIsDetailsDialogOpen(true);

      // Also call the parent callback
      onAccountSelect(accountId);
    } catch (error) {
      console.error("Error fetching account details:", error);
    }
  };

  const filteredAccounts = glAccountsData.filter((account) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (account.account_name || "").toLowerCase().includes(searchLower) ||
      (account.account_code || "").toLowerCase().includes(searchLower) ||
      (account.account_type || "").toLowerCase().includes(searchLower);

    const matchesType =
      !accountTypeFilter ||
      (account.account_type || "").toLowerCase() ===
        accountTypeFilter.toLowerCase();

    return matchesSearch && matchesType;
  });

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

  const getBalanceIcon = (balance: number, accountType: string) => {
    if (balance > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (balance < 0) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return null;
  };

  const handleExport = () => {
    try {
      // Create CSV content with proper escaping
      const headers = [
        "Account Code",
        "Account Name",
        "Type",
        "Balance",
        "Status",
      ];
      let csvContent = headers.join(",") + "\n";

      filteredAccounts.forEach((account) => {
        const balance = Number.parseFloat(String(account.balance || 0));
        const row = [
          `"${(account.account_code || "").replace(/"/g, '""')}"`,
          `"${(account.account_name || "").replace(/"/g, '""')}"`,
          `"${(account.account_type || "").replace(/"/g, '""')}"`,
          balance.toFixed(2),
          account.is_active ? "Active" : "Inactive",
        ];
        csvContent += row.join(",") + "\n";
      });

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `gl-accounts-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    }
  };

  const handlePrint = () => {
    try {
      const printWindow = window.open("", "_blank", "width=800,height=600");

      if (!printWindow) {
        alert("Please allow popups for this site to enable printing.");
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>GL Account Balances</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; margin-bottom: 10px; }
              .meta { color: #666; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
              th { background-color: #f2f2f2; font-weight: bold; }
              .text-right { text-align: right; }
              .badge { padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; }
              .badge-active { background-color: #d1fae5; color: #065f46; }
              .badge-inactive { background-color: #f3f4f6; color: #374151; }
              .type-asset { background-color: #d1fae5; color: #065f46; }
              .type-liability { background-color: #fee2e2; color: #991b1b; }
              .type-equity { background-color: #dbeafe; color: #1e40af; }
              .type-revenue { background-color: #f3e8ff; color: #6b21a8; }
              .type-expense { background-color: #ffedd5; color: #9a3412; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <h1>GL Account Balances</h1>
            <div class="meta">
              <p>Generated on: ${new Date().toLocaleString()}</p>
              <p>Total Accounts: ${filteredAccounts.length}</p>
              <p>Date Range: ${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th class="text-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredAccounts
                  .map((account) => {
                    const balance = Number.parseFloat(
                      String(account.balance || 0)
                    );
                    const typeClass = `type-${(
                      account.account_type || "unknown"
                    ).toLowerCase()}`;
                    return `
                    <tr>
                      <td>${account.account_code || "N/A"}</td>
                      <td>${account.account_name || "Unnamed Account"}</td>
                      <td><span class="badge ${typeClass}">${
                      account.account_type || "Unknown"
                    }</span></td>
                      <td class="text-right">${formatCurrency(balance)}</td>
                      <td><span class="badge ${
                        account.is_active ? "badge-active" : "badge-inactive"
                      }">${
                      account.is_active ? "Active" : "Inactive"
                    }</span></td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      // Wait for content to load then print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error("Print failed:", error);
      alert("Print failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Error Loading GL Account Balances</div>
            <div className="mt-2 text-sm">{error}</div>
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex gap-2 justify-center">
                <Button onClick={fetchGLAccountBalances} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button
                  onClick={() => setShowDebug(!showDebug)}
                  variant="outline"
                  size="sm"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Debug Info
                </Button>
                <Button onClick={fetchDebugInfo} variant="outline" size="sm">
                  Fetch Debug
                </Button>
              </div>

              {showDebug && debugData && (
                <div className="mt-4 text-left">
                  <div className="p-4 bg-gray-100 rounded text-xs space-y-2">
                    <div>
                      <strong>Table exists:</strong>{" "}
                      {debugData.tableExists ? "Yes" : "No"}
                    </div>
                    <div>
                      <strong>Total records:</strong>{" "}
                      {debugData.totalRecords || 0}
                    </div>
                    <div>
                      <strong>Active records:</strong>{" "}
                      {debugData.activeRecords?.length || 0}
                    </div>
                    {debugData.activeRecords?.length > 0 && (
                      <details>
                        <summary>Sample records</summary>
                        <pre className="mt-2 bg-white p-2 rounded overflow-auto">
                          {JSON.stringify(
                            debugData.activeRecords.slice(0, 3),
                            null,
                            2
                          )}
                        </pre>
                      </details>
                    )}
                    <div className="mt-2">
                      <Button
                        onClick={() =>
                          window.open(
                            "/dashboard/admin/gl-initialize",
                            "_blank"
                          )
                        }
                        variant="link"
                        size="sm"
                      >
                        Go to GL Initialization →
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GL Account Balances Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            General Ledger Account Balances ({glAccountsData.length} accounts)
          </CardTitle>
          <CardDescription>
            Chart of accounts with current balances as of{" "}
            {dateRange.to.toLocaleDateString()}
          </CardDescription>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search accounts by name, code, type..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-shrink-0">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={accountTypeFilter}
                onChange={(e) => setAccountTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="asset">Assets</option>
                <option value="liability">Liabilities</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expenses</option>
              </select>
            </div>
            <Button onClick={() => handleExport()} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => handlePrint()} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={fetchGLAccountBalances}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setShowDebug(!showDebug)}
              variant="outline"
              size="sm"
            >
              <Database className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showDebug && (
            <div className="mb-4 p-4 bg-gray-50 rounded">
              <h4 className="font-semibold mb-2">Debug Information</h4>
              <div className="text-sm space-y-2">
                <div>Total GL accounts: {glAccountsData.length}</div>
                <div>Filtered accounts: {filteredAccounts.length}</div>
                <div>Account types: {summaryData.accountTypes}</div>
                {glAccountsData.length > 0 && (
                  <details>
                    <summary>Sample GL account data</summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto">
                      {JSON.stringify(glAccountsData[0], null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          <Table id="gl-accounts-table">
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono">
                    {account.account_code || "N/A"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {account.account_name || "Unnamed Account"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(
                        account.account_type
                      )}`}
                    >
                      {account.account_type || "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-1">
                      {getBalanceIcon(
                        Number.parseFloat(String(account.balance || 0)),
                        account.account_type
                      )}
                      {formatCurrency(
                        Number.parseFloat(String(account.balance || 0))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={account.is_active ? "default" : "secondary"}
                    >
                      {account.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAccountDetails(account.id)}
                    >
                      Details
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between mt-4">
            <div>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} | Total Accounts: {totalAccounts}
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

          {filteredAccounts.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm
                ? "No GL accounts match your search criteria."
                : "No GL accounts found. Please check the debug information or reinitialize the GL system."}
              {!searchTerm && (
                <div className="mt-2 space-x-2">
                  <Button onClick={fetchDebugInfo} variant="outline" size="sm">
                    Check Debug Info
                  </Button>
                  <Button
                    onClick={() =>
                      window.open("/dashboard/admin/gl-initialize", "_blank")
                    }
                    variant="outline"
                    size="sm"
                  >
                    Initialize GL System
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
            <DialogDescription>
              Detailed information for the selected GL account
            </DialogDescription>
          </DialogHeader>
          {selectedAccountDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Account Code
                  </label>
                  <p className="font-mono">
                    {selectedAccountDetails.account_code}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Account Name
                  </label>
                  <p className="font-medium">
                    {selectedAccountDetails.account_name}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Account Type
                  </label>
                  <p>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(
                        selectedAccountDetails.account_type
                      )}`}
                    >
                      {selectedAccountDetails.account_type}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Current Balance
                  </label>
                  <p className="font-medium text-lg">
                    {formatCurrency(
                      Number.parseFloat(
                        String(selectedAccountDetails.balance || 0)
                      )
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <p>
                    <Badge
                      variant={
                        selectedAccountDetails.is_active
                          ? "default"
                          : "secondary"
                      }
                    >
                      {selectedAccountDetails.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Parent Account
                  </label>
                  <p>
                    {selectedAccountDetails.parent_id
                      ? "Has Parent"
                      : "Root Account"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Created
                  </label>
                  <p className="text-sm">
                    {new Date(
                      selectedAccountDetails.created_at
                    ).toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Last Updated
                  </label>
                  <p className="text-sm">
                    {new Date(
                      selectedAccountDetails.updated_at
                    ).toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
