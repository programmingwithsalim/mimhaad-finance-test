"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertTriangle, RefreshCw, DollarSign } from "lucide-react";
import { useCashInTillRobust } from "@/hooks/use-cash-in-till-robust";

interface FloatAccount {
  id: string;
  account_name: string;
  current_balance: number;
  min_threshold: number;
  max_threshold: number;
  account_type: string;
  provider: string;
  branch_id: string;
  is_active: boolean;
}

interface DynamicFloatDisplayProps {
  selectedProvider?: string;
  floatAccounts: FloatAccount[];
  serviceType: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DynamicFloatDisplay({
  selectedProvider,
  floatAccounts,
  serviceType,
  onRefresh,
  isLoading = false,
}: DynamicFloatDisplayProps) {
  const {
    cashAccount,
    isLoading: cashLoading,
    error: cashError,
    balanceStatus,
    refreshCashTill,
  } = useCashInTillRobust();

  const formatCurrency = (amount: number | null | undefined) => {
    const safeAmount = amount || 0;
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(safeAmount);
  };

  const getBalanceStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getFloatStatus = (current: number, min: number) => {
    if (current < min * 0.5)
      return { label: "Critical", color: "destructive" as const };
    if (current < min) return { label: "Low", color: "secondary" as const };
    return { label: "Healthy", color: "default" as const };
  };

  // Find the selected provider's float account
  const selectedFloatAccount = useMemo(() => {
    if (!floatAccounts.length) return null;

    // For Jumia service type, find the Jumia account by account type
    if (serviceType === "jumia") {
      return (
        floatAccounts.find(
          (account) => account.account_type.toLowerCase() === "jumia"
        ) || null
      );
    }

    // For other service types, use provider-based matching
    if (!selectedProvider) return null;

    return (
      floatAccounts.find(
        (account) =>
          account.provider.toLowerCase() === selectedProvider.toLowerCase() ||
          account.provider
            .toLowerCase()
            .includes(selectedProvider.toLowerCase())
      ) || null
    );
  }, [selectedProvider, floatAccounts, serviceType]);

  const handleRefreshAll = async () => {
    await refreshCashTill();
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Cash in Till Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cash in Till
            </CardTitle>
            <CardDescription>Available cash for transactions</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAll}
            disabled={cashLoading || isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                cashLoading || isLoading ? "animate-spin" : ""
              }`}
            />
          </Button>
        </CardHeader>
        <CardContent>
          {cashLoading ? (
            <div className="space-y-2">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-24"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="animate-pulse h-6 bg-gray-200 rounded w-16"></div>
                <div className="animate-pulse h-4 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ) : cashError ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Error loading cash balance: {cashError}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <div
                className={`text-2xl font-bold ${getBalanceStatusColor(
                  balanceStatus
                )}`}
              >
                {cashAccount
                  ? formatCurrency(cashAccount.current_balance)
                  : formatCurrency(0)}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    balanceStatus === "healthy"
                      ? "default"
                      : balanceStatus === "warning"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {balanceStatus}
                </Badge>
                {cashAccount && (
                  <span className="text-xs text-muted-foreground">
                    Min: {formatCurrency(cashAccount.min_threshold)}
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Provider Float Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {serviceType === "jumia"
                ? "Jumia Float Account Balance (Liability)"
                : selectedProvider
                ? `${selectedProvider} Float`
                : `${serviceType} Float`}
            </CardTitle>
            <CardDescription>
              {serviceType === "jumia"
                ? "Unsettled POD collections owed to Jumia"
                : selectedProvider
                ? `Available float for ${selectedProvider} transactions`
                : `Select a provider to view float balance`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {selectedFloatAccount ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatCurrency(selectedFloatAccount.current_balance)}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    getFloatStatus(
                      selectedFloatAccount.current_balance,
                      selectedFloatAccount.min_threshold
                    ).color
                  }
                >
                  {
                    getFloatStatus(
                      selectedFloatAccount.current_balance,
                      selectedFloatAccount.min_threshold
                    ).label
                  }
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Min: {formatCurrency(selectedFloatAccount.min_threshold)}
                </span>
              </div>
              {selectedFloatAccount.current_balance <
                selectedFloatAccount.min_threshold && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    Float balance is below minimum threshold
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : selectedProvider ? (
            <div className="text-center py-4">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No float account found for {selectedProvider}
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Select a provider to view float balance
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Float Accounts Summary */}
      {floatAccounts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              All {serviceType} Providers
            </CardTitle>
            <CardDescription>Overview of all float accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {floatAccounts.map((account) => {
                const status = getFloatStatus(
                  account.current_balance,
                  account.min_threshold
                );
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.provider}</span>
                      <Badge variant={status.color} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(account.current_balance)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              All {serviceType} Providers
            </CardTitle>
            <CardDescription>Overview of all float accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No float accounts found for {serviceType}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
