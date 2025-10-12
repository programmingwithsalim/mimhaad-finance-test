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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  TrendingUp,
} from "lucide-react";
import { format, subDays } from "date-fns";

interface DiagnosticData {
  timestamp: string;
  dateRange: { from: string | null; to: string | null };
  branch: string;
  user: { name: string; role: string };
  data: {
    agencyBanking: any;
    momo: any;
    ezwich: any;
    power: any;
    jumia: any;
    commissions: any;
    expenses: any;
    floatAccounts: any;
    fixedAssets: any;
    inventory: any;
    equity: any;
    calculatedTotals: any;
    dataQualityFlags: any;
    warnings: any[];
  };
}

export function DataIntegrityChecker() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [dateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const runDiagnostics = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `/api/reports/diagnostic?from=${format(
          dateRange.from,
          "yyyy-MM-dd"
        )}&to=${format(dateRange.to, "yyyy-MM-dd")}&branch=all`,
        { credentials: "include" }
      );

      const result = await response.json();

      if (result.success) {
        setDiagnostics(result.diagnostics);
        toast({
          title: "Diagnostics Complete",
          description: "Data integrity check completed successfully",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to run diagnostics",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error running diagnostics:", error);
      toast({
        title: "Error",
        description: "Failed to run diagnostics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Integrity Checker
              </CardTitle>
              <CardDescription>
                Verify data completeness and identify missing or zero values
              </CardDescription>
            </div>
            <Button onClick={runDiagnostics} disabled={loading}>
              {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Run Diagnostics
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!diagnostics && (
            <div className="text-center py-12 text-muted-foreground">
              Click "Run Diagnostics" to check data integrity
            </div>
          )}

          {diagnostics && (
            <div className="space-y-6">
              {/* Data Quality Overview */}
              <div>
                <h3 className="font-semibold mb-4">Data Quality Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(diagnostics.data.dataQualityFlags).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 p-3 border rounded-lg"
                      >
                        {value ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">
                          {key
                            .replace(/^has/, "")
                            .replace(/([A-Z])/g, " $1")
                            .trim()}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Warnings */}
              {diagnostics.data.warnings.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">
                    Warnings & Recommendations
                  </h3>
                  <div className="space-y-2">
                    {diagnostics.data.warnings.map((warning, index) => (
                      <Alert
                        key={index}
                        className={
                          warning.severity === "warning"
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-blue-200 bg-blue-50"
                        }
                      >
                        <AlertTriangle
                          className={`h-4 w-4 ${
                            warning.severity === "warning"
                              ? "text-yellow-600"
                              : "text-blue-600"
                          }`}
                        />
                        <AlertDescription>
                          <div className="space-y-1">
                            <p className="font-medium">{warning.module}:</p>
                            <p className="text-sm">{warning.message}</p>
                            <p className="text-xs text-muted-foreground">
                              💡 {warning.action}
                            </p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculated Totals */}
              <div>
                <h3 className="font-semibold mb-4">
                  Calculated Revenue & Expenses
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Revenue
                        </p>
                        <p className="text-2xl font-bold text-green-600">
                          GHS{" "}
                          {formatCurrency(
                            diagnostics.data.calculatedTotals.totalRevenue
                          )}
                        </p>
                        <div className="text-xs space-y-1 text-muted-foreground">
                          <div>
                            Fees: GHS{" "}
                            {formatCurrency(
                              diagnostics.data.calculatedTotals.totalServiceFees
                            )}
                          </div>
                          <div>
                            Commissions: GHS{" "}
                            {formatCurrency(
                              diagnostics.data.calculatedTotals.totalCommissions
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Expenses
                        </p>
                        <p className="text-2xl font-bold text-red-600">
                          GHS{" "}
                          {formatCurrency(
                            diagnostics.data.calculatedTotals.totalExpenses
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Net Income
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          GHS{" "}
                          {formatCurrency(
                            diagnostics.data.calculatedTotals.netIncome
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Service Fee Breakdown */}
              <div>
                <h3 className="font-semibold mb-4">Service Fee Breakdown</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Total Fees</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Agency Banking</TableCell>
                      <TableCell className="text-right">
                        GHS{" "}
                        {formatCurrency(
                          diagnostics.data.calculatedTotals.breakdown.agency
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            diagnostics.data.calculatedTotals.breakdown.agency >
                            0
                              ? "default"
                              : "secondary"
                          }
                        >
                          {diagnostics.data.agencyBanking.totalRecords}{" "}
                          transactions
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>MoMo</TableCell>
                      <TableCell className="text-right">
                        GHS{" "}
                        {formatCurrency(
                          diagnostics.data.calculatedTotals.breakdown.momo
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            diagnostics.data.calculatedTotals.breakdown.momo > 0
                              ? "default"
                              : "secondary"
                          }
                        >
                          {diagnostics.data.momo.totalRecords} transactions
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>E-Zwich</TableCell>
                      <TableCell className="text-right">
                        GHS{" "}
                        {formatCurrency(
                          diagnostics.data.calculatedTotals.breakdown.ezwich
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            diagnostics.data.calculatedTotals.breakdown.ezwich >
                            0
                              ? "default"
                              : "secondary"
                          }
                        >
                          {diagnostics.data.ezwich.totalRecords} transactions
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Power</TableCell>
                      <TableCell className="text-right">
                        GHS{" "}
                        {formatCurrency(
                          diagnostics.data.calculatedTotals.breakdown.power
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            diagnostics.data.calculatedTotals.breakdown.power >
                            0
                              ? "default"
                              : "secondary"
                          }
                        >
                          {diagnostics.data.power.totalRecords} transactions
                        </Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Jumia</TableCell>
                      <TableCell className="text-right">
                        GHS{" "}
                        {formatCurrency(
                          diagnostics.data.calculatedTotals.breakdown.jumia
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            diagnostics.data.calculatedTotals.breakdown.jumia >
                            0
                              ? "default"
                              : "secondary"
                          }
                        >
                          {diagnostics.data.jumia.totalRecords} transactions
                        </Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Transaction Status Details */}
              <div>
                <h3 className="font-semibold mb-4">
                  Transaction Status Distribution
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        MoMo Transactions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableBody>
                          {diagnostics.data.momo.byStatus.map(
                            (stat: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{stat.status}</TableCell>
                                <TableCell className="text-right">
                                  {stat.count} txns
                                </TableCell>
                                <TableCell className="text-right">
                                  GHS {formatCurrency(stat.totalFees)}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableBody>
                          {diagnostics.data.expenses.byStatus.map(
                            (stat: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{stat.status}</TableCell>
                                <TableCell className="text-right">
                                  {stat.count} records
                                </TableCell>
                                <TableCell className="text-right">
                                  GHS {formatCurrency(stat.totalAmount)}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Equity Status */}
              <div>
                <h3 className="font-semibold mb-4">Equity Ledger Status</h3>
                <Card>
                  <CardContent className="pt-6">
                    {diagnostics.data.equity.tableExists ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="text-green-600 font-medium">
                            Equity transactions table exists
                          </span>
                        </div>
                        {diagnostics.data.equity.transactions.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ledger Type</TableHead>
                                <TableHead className="text-right">
                                  Transactions
                                </TableHead>
                                <TableHead className="text-right">
                                  Debits
                                </TableHead>
                                <TableHead className="text-right">
                                  Credits
                                </TableHead>
                                <TableHead className="text-right">
                                  Balance
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {diagnostics.data.equity.transactions.map(
                                (txn: any, idx: number) => (
                                  <TableRow key={idx}>
                                    <TableCell>
                                      {txn.ledgerType
                                        .replace(/_/g, " ")
                                        .replace(/\b\w/g, (l: string) =>
                                          l.toUpperCase()
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {txn.count}
                                    </TableCell>
                                    <TableCell className="text-right text-red-600">
                                      GHS {formatCurrency(txn.totalDebit)}
                                    </TableCell>
                                    <TableCell className="text-right text-green-600">
                                      GHS {formatCurrency(txn.totalCredit)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                      GHS {formatCurrency(txn.balance)}
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        ) : (
                          <Alert className="border-yellow-200 bg-yellow-50">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-700">
                              Equity table exists but has no transactions. Use
                              Shareholders Fund Manager to add opening balances.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ) : (
                      <Alert className="border-red-200 bg-red-50">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-700">
                          <p className="font-medium mb-2">
                            Equity transactions table does not exist
                          </p>
                          <p className="text-sm">
                            This is why Balance Sheet shows 0 for Share Capital
                            and Retained Earnings. Access the Shareholders Fund
                            Manager to initialize the equity ledgers.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Float Accounts Summary */}
              <div>
                <h3 className="font-semibold mb-4">Float Accounts</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-center">Positive</TableHead>
                      <TableHead className="text-center">Negative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostics.data.floatAccounts.accounts.map(
                      (acc: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{acc.type}</TableCell>
                          <TableCell>{acc.provider || "N/A"}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              acc.balance >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            GHS {formatCurrency(acc.balance)}
                          </TableCell>
                          <TableCell className="text-center text-green-600">
                            GHS {formatCurrency(acc.positiveBalance)}
                          </TableCell>
                          <TableCell className="text-center text-red-600">
                            GHS {formatCurrency(acc.negativeBalance)}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>Total Cash Position</TableCell>
                      <TableCell className="text-right text-blue-600">
                        GHS{" "}
                        {formatCurrency(
                          diagnostics.data.floatAccounts.totalBalance
                        )}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Inventory */}
              {diagnostics.data.inventory.totalBatches > 0 && (
                <div>
                  <h3 className="font-semibold mb-4">
                    Inventory (E-Zwich Cards)
                  </h3>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground">
                          Total Inventory Value:{" "}
                          <span className="font-bold text-foreground">
                            GHS{" "}
                            {formatCurrency(
                              diagnostics.data.inventory.totalValue
                            )}
                          </span>
                        </p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batch Code</TableHead>
                            <TableHead className="text-right">
                              Available
                            </TableHead>
                            <TableHead className="text-right">
                              Unit Cost
                            </TableHead>
                            <TableHead className="text-right">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {diagnostics.data.inventory.batches.map(
                            (batch: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{batch.batchCode}</TableCell>
                                <TableCell className="text-right">
                                  {batch.available}
                                </TableCell>
                                <TableCell className="text-right">
                                  GHS {formatCurrency(batch.unitCost)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  GHS {formatCurrency(batch.value)}
                                </TableCell>
                              </TableRow>
                            )
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Diagnostic Metadata */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <strong>Generated:</strong>{" "}
                  {format(new Date(diagnostics.timestamp), "PPpp")}
                </p>
                <p>
                  <strong>Date Range:</strong> {diagnostics.dateRange.from} to{" "}
                  {diagnostics.dateRange.to}
                </p>
                <p>
                  <strong>Branch Filter:</strong> {diagnostics.branch}
                </p>
                <p>
                  <strong>User:</strong> {diagnostics.user.name} (
                  {diagnostics.user.role})
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

