"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TransactionData {
  [key: string]: {
    total_count: number;
    earliest_date?: string;
    latest_date?: string;
    unique_branches?: number;
    total_amount?: number;
    total_fees?: number;
    error?: string;
  };
}

export function TransactionDataChecker() {
  const [data, setData] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/debug/check-transaction-data", {
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        toast({
          title: "Data Check Complete",
          description: "Transaction data statistics retrieved successfully.",
        });
      } else {
        throw new Error(result.error || "Failed to check data");
      }
    } catch (error) {
      console.error("Error checking transaction data:", error);
      toast({
        title: "Error",
        description: "Failed to check transaction data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  const getTotalTransactions = () => {
    if (!data) return 0;
    return Object.values(data).reduce((sum, table) => {
      return sum + (table.total_count || 0);
    }, 0);
  };

  const getTotalAmount = () => {
    if (!data) return 0;
    return Object.values(data).reduce((sum, table) => {
      return sum + (table.total_amount || 0);
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Transaction Data Checker
        </CardTitle>
        <CardDescription>
          Check what transaction data exists in the database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={checkData} disabled={loading} className="w-full">
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking Data...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Check Transaction Data
            </>
          )}
        </Button>

        {data && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Total Transactions</p>
                <p className="text-2xl font-bold">
                  {formatNumber(getTotalTransactions())}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Total Amount</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(getTotalAmount())}
                </p>
              </div>
            </div>

            {/* Table Details */}
            <div className="space-y-3">
              {Object.entries(data).map(([tableName, tableData]) => (
                <div
                  key={tableName}
                  className="p-3 border rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium capitalize">
                      {tableName.replace(/_/g, " ")}
                    </h4>
                    {tableData.error ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {formatNumber(tableData.total_count || 0)} records
                      </Badge>
                    )}
                  </div>

                  {tableData.error ? (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{tableData.error}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {tableData.earliest_date && (
                        <div>
                          <span className="text-muted-foreground">
                            Earliest:
                          </span>
                          <br />
                          <span className="font-medium">
                            {new Date(
                              tableData.earliest_date
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {tableData.latest_date && (
                        <div>
                          <span className="text-muted-foreground">Latest:</span>
                          <br />
                          <span className="font-medium">
                            {new Date(
                              tableData.latest_date
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {tableData.unique_branches !== undefined && (
                        <div>
                          <span className="text-muted-foreground">
                            Branches:
                          </span>
                          <br />
                          <span className="font-medium">
                            {tableData.unique_branches}
                          </span>
                        </div>
                      )}
                      {tableData.total_amount !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <br />
                          <span className="font-medium">
                            {formatCurrency(tableData.total_amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recommendations */}
            {getTotalTransactions() === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No transaction data found. Consider creating sample
                  transactions or importing data to test the reports
                  functionality.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
