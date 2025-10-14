"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GLStatistics } from "./gl-statistics";
import { AccountBalances } from "./account-balances";
import { TransactionHistory } from "./transaction-history";
import { ManualJournalEntry } from "./manual-journal-entry";
import { DateRangePicker } from "./date-range-picker";
import { AccountFilter } from "./account-filter";
import { TransactionTypeFilter } from "./transaction-type-filter";
import type { DateRange } from "react-day-picker";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BranchSelector } from "@/components/branch/branch-selector";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBranch } from "@/contexts/branch-context";
import { useToast } from "@/hooks/use-toast";

interface GLAccountingDashboardProps {
  initialDateRange?: DateRange;
}

export function GLAccountingDashboard({
  initialDateRange,
}: GLAccountingDashboardProps) {
  const { user } = useCurrentUser();
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const { toast } = useToast();
  const branchIdToUse =
    user && user.role === "Admin" ? selectedBranchId : user?.branchId;
  const [dateRange, setDateRange] = useState<DateRange>(
    initialDateRange || {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    }
  );
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedTransactionType, setSelectedTransactionType] = useState<
    string | null
  >(null);
  const [filterTimestamp, setFilterTimestamp] = useState(Date.now());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccount(accountId);
  };

  const handleAccountChange = (accountId: string | null) => {
    console.log("Account filter changed:", accountId);
    setSelectedAccount(accountId);
    // Force a refresh by updating the timestamp
    setFilterTimestamp(Date.now());
  };

  const handleTransactionTypeChange = (type: string | null) => {
    console.log("Transaction type filter changed:", type);
    setSelectedTransactionType(type);
    // Force a refresh by updating the timestamp
    setFilterTimestamp(Date.now());
  };

  const handleDateRangeChange = (range: DateRange) => {
    console.log("Date range filter changed:", range);
    setDateRange(range);
    // Force a refresh by updating the timestamp
    setFilterTimestamp(Date.now());
  };

  const clearAllFilters = () => {
    setSelectedAccount(null);
    setSelectedTransactionType(null);
    setDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });
    setFilterTimestamp(Date.now());
  };

  const hasActiveFilters = selectedAccount || selectedTransactionType;

  return (
    <div className="space-y-6">
      {user?.role === "Admin" && (
        <div className="mb-4">
          <BranchSelector onBranchChange={setSelectedBranchId} />
        </div>
      )}

      {/* 1. Dashboard Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-blue-900">
            GL Dashboard Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GLStatistics compact branchId={branchIdToUse} />
        </CardContent>
      </Card>

      {/* 2. Collapsible Filters */}
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-700">Filters</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? "Hide Filters" : "Show Filters"}
        </Button>
      </div>
      {filtersOpen && (
        <Card
          className="border-2 border-dashed border-gray-200 bg-white"
          ref={filtersRef}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-blue-900">
                  GL Accounting Filters
                </CardTitle>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-red-600 border-red-200"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
            <CardDescription className="text-blue-700">
              Filter and analyze your general ledger data with advanced controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  Date Range
                </label>
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <DateRangePicker
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  Account Filter
                </label>
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <AccountFilter
                    selectedAccount={selectedAccount}
                    onAccountChange={handleAccountChange}
                    key={`account-filter-${filterTimestamp}`}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  Transaction Type
                </label>
                <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <TransactionTypeFilter
                    selectedType={selectedTransactionType}
                    onTypeChange={handleTransactionTypeChange}
                    key={`type-filter-${filterTimestamp}`}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Active Filters Summary (only if filters are active) */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
          <span className="text-sm font-medium text-gray-600">
            Active Filters:
          </span>
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            {dateRange.from?.toLocaleDateString()} -{" "}
            {dateRange.to?.toLocaleDateString()}
          </Badge>
          {selectedAccount && (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200"
            >
              Account: {selectedAccount}
            </Badge>
          )}
          {selectedTransactionType && (
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200"
            >
              Type: {selectedTransactionType}
            </Badge>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterTimestamp(Date.now())}
              className="bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>
      )}

      {/* 4. Main Content Tabs (lazy load) */}
      <Tabs defaultValue="balances" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="balances">Account Balances</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
        </TabsList>
        <TabsContent value="balances" className="space-y-4">
          <AccountBalances
            dateRange={dateRange}
            selectedAccount={selectedAccount}
            onAccountSelect={handleAccountSelect}
            key={`balances-${filterTimestamp}`}
          />
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <TransactionHistory
            accountId={selectedAccount}
            title={`Transaction History${selectedAccount ? " (Filtered)" : ""}`}
            dateRange={dateRange}
            transactionType={selectedTransactionType}
            key={`history-${filterTimestamp}`}
          />
        </TabsContent>
        <TabsContent value="manual" className="space-y-4">
          <ManualJournalEntry />
        </TabsContent>
      </Tabs>
    </div>
  );
}
