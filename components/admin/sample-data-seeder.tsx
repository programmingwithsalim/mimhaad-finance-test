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
import {
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SeedResult {
  totalTransactions: number;
  totalExpenses: number;
  branchesUsed: number;
  dateRange: {
    from: string;
    to: string;
  };
}

export function SampleDataSeeder() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const seedSampleData = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/debug/seed-sample-data", {
        method: "POST",
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        toast({
          title: "Success!",
          description: "Sample data has been seeded successfully.",
        });
      } else {
        setResult({ error: data.error, details: data.details });
        toast({
          title: "Error",
          description: "Failed to seed sample data. Check console for details.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error seeding data:", error);
      setResult({
        error: "Network error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
      toast({
        title: "Error",
        description: "Failed to connect to the server.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Sample Data Seeder
        </CardTitle>
        <CardDescription>
          Populate the database with sample data for testing the dashboard and
          other features. This will create sample branches, users, transactions,
          and other data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={seedSampleData} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Seeding Data...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Seed Sample Data
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            {result.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {result.error}
                  {result.details && (
                    <div className="mt-1 text-sm opacity-90">
                      Details: {result.details}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Success!</strong> Sample data has been seeded
                  successfully.
                  {result.summary && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <strong>Branches:</strong> {result.summary.branches}
                      </div>
                      <div>
                        <strong>Users:</strong> {result.summary.users}
                      </div>
                      <div>
                        <strong>Float Accounts:</strong>{" "}
                        {result.summary.floatAccounts}
                      </div>
                      <div>
                        <strong>Agency Transactions:</strong>{" "}
                        {result.summary.agencyTransactions}
                      </div>
                      <div>
                        <strong>MoMo Transactions:</strong>{" "}
                        {result.summary.momoTransactions}
                      </div>
                      <div>
                        <strong>E-Zwich Transactions:</strong>{" "}
                        {result.summary.ezwichTransactions}
                      </div>
                      <div>
                        <strong>Power Transactions:</strong>{" "}
                        {result.summary.powerTransactions}
                      </div>
                      <div>
                        <strong>Jumia Transactions:</strong>{" "}
                        {result.summary.jumiaTransactions}
                      </div>
                      <div>
                        <strong>Expenses:</strong> {result.summary.expenses}
                      </div>
                      <div>
                        <strong>Commissions:</strong>{" "}
                        {result.summary.commissions}
                      </div>
                      <div>
                        <strong>Notifications:</strong>{" "}
                        {result.summary.notifications}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <strong>Note:</strong> This will create sample data for testing
          purposes. The data includes branches, users, transactions, expenses,
          commissions, and notifications. You can now test the dashboard with
          realistic data.
        </div>
      </CardContent>
    </Card>
  );
}
