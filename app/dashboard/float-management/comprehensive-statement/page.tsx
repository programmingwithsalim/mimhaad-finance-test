"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ComprehensiveFloatStatement } from "@/components/float-management/comprehensive-float-statement";
import { useFloatAccounts } from "@/hooks/use-float-accounts";
import { AlertCircle } from "lucide-react";

export default function ComprehensiveFloatStatementPage() {
  const [selectedFloatAccountId, setSelectedFloatAccountId] =
    useState<string>("");
  const [selectedFloatAccountName, setSelectedFloatAccountName] =
    useState<string>("");

  const {
    accounts: floatAccounts,
    loading: floatAccountsLoading,
    error: floatAccountsError,
  } = useFloatAccounts();

  useEffect(() => {
    if (floatAccounts && floatAccounts.length > 0 && !selectedFloatAccountId) {
      setSelectedFloatAccountId(floatAccounts[0].id);
      setSelectedFloatAccountName(
        floatAccounts[0].account_name ||
          `${floatAccounts[0].account_type} - ${floatAccounts[0].branch_name}`
      );
    }
  }, [floatAccounts, selectedFloatAccountId]);

  const handleFloatAccountChange = (floatAccountId: string) => {
    setSelectedFloatAccountId(floatAccountId);
    const selectedAccount = floatAccounts.find(
      (account) => account.id === floatAccountId
    );
    if (selectedAccount) {
      setSelectedFloatAccountName(
        selectedAccount.account_name ||
          `${selectedAccount.account_type} - ${selectedAccount.branch_name}`
      );
    }
  };

  if (floatAccountsError) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load float accounts: {floatAccountsError}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Comprehensive Float Statement
        </h1>
        <p className="text-muted-foreground">
          View complete transaction history across all modules for any float
          account
        </p>
      </div>

      {/* Float Account Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Float Account</CardTitle>
        </CardHeader>
        <CardContent>
          {floatAccountsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="floatAccount">Float Account</Label>
                <Select
                  value={selectedFloatAccountId}
                  onValueChange={handleFloatAccountChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a float account" />
                  </SelectTrigger>
                  <SelectContent>
                    {floatAccounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {account.account_name ||
                              `${account.account_type} - ${account.branch_name}`}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {account.account_type} • {account.branch_name} •{" "}
                            {account.current_balance.toLocaleString("en-GH", {
                              style: "currency",
                              currency: "GHS",
                            })}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFloatAccountId && (
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedFloatAccountName}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comprehensive Float Statement */}
      {selectedFloatAccountId && (
        <ComprehensiveFloatStatement
          floatAccountId={selectedFloatAccountId}
          floatAccountName={selectedFloatAccountName}
        />
      )}

      {!selectedFloatAccountId && !floatAccountsLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                No Float Account Selected
              </h3>
              <p className="text-muted-foreground">
                Please select a float account above to view its comprehensive
                statement
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
