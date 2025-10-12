"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Calendar,
} from "lucide-react";

interface TransactionSummary {
  table: string;
  count: number;
  dateRange: {
    min: string;
    max: string;
  } | null;
}

export function TransactionChecker() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const checkTransactions = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/db/check-transactions", {
        credentials: "include",
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to check transactions",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking transactions:", error);
      toast({
        title: "Error",
        description: "Failed to check transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkTransactions();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
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
      <CardContent>
        <div className="space-y-4">
          <Button
            onClick={checkTransactions}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
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
              <div className="flex items-center gap-2">
                {data.hasData ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <span className="text-sm font-medium">
                  {data.hasData
                    ? `Found ${data.totalTransactions} total transactions`
                    : "No transaction data found"}
                </span>
              </div>

              <div className="grid gap-3">
                {data.transactionSummary.map((item: TransactionSummary) => (
                  <div
                    key={item.table}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={item.count > 0 ? "default" : "secondary"}>
                        {item.count}
                      </Badge>
                      <span className="text-sm font-medium">
                        {item.table
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.dateRange ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.dateRange.min)} -{" "}
                          {formatDate(item.dateRange.max)}
                        </div>
                      ) : (
                        "No dates"
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!data.hasData && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">
                    No Transaction Data Found
                  </h4>
                  <p className="text-sm text-yellow-700">
                    To see real data in reports, you need to create some
                    transactions first. Try creating transactions in MOMO,
                    Agency Banking, E-ZWICH, Power, or Jumia modules.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
