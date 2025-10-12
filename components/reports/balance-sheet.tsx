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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { InfoIcon, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BalanceSheetProps {
  date: Date;
  branch: string;
}

type NoteValue = { note: number; value: number } | number;

interface BalanceSheetData {
  asOf: string;
  period: {
    from: string | null;
    to: string | null;
  };
  assets: {
    nonCurrent: {
      fixedAssetsNet: NoteValue;
      total: number;
    };
    current: {
      cashAndCashEquivalents: NoteValue;
      accountsReceivable: NoteValue;
      closingInventory: NoteValue;
      total: number;
    };
    totalAssets: number;
  };
  equity: {
    shareholdersFund: {
      equities: NoteValue;
      retainedEarnings: NoteValue;
      profitForTheYear: NoteValue;
      otherFund?: number;
      total: number;
    };
  };
  liabilities: {
    current: {
      accountsPayable: NoteValue;
      bankOverdraft: NoteValue;
      settlementsArrears: NoteValue;
      total: number;
    };
    nonCurrent: {
      bankLoan: NoteValue;
      total: number;
    };
    totalLiabilities: number;
  };
  totalEquityAndLiabilities: number;
  summary: {
    totalAssets: number;
    totalEquityAndLiabilities: number;
    balanceCheck: boolean;
    difference: number;
  };
}

export function BalanceSheet({ date, branch }: BalanceSheetProps) {
  const [balanceSheetData, setBalanceSheetData] =
    useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalanceSheetData();
  }, [date, branch]);

  const fetchBalanceSheetData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        to: format(date, "yyyy-MM-dd"),
        branch: branch,
      });

      const response = await fetch(`/api/reports/balance-sheet?${params}`);
      const result = await response.json();

      if (result.success) {
        setBalanceSheetData(result.data);
      } else {
        setError(result.error || "Failed to fetch balance sheet data");
      }
    } catch (error) {
      console.error("Error fetching balance sheet:", error);
      setError("Failed to fetch balance sheet data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading balance sheet...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading balance sheet</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!balanceSheetData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">
            No balance sheet data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Helper to extract value from NoteValue type
  const getValue = (noteValue: NoteValue): number => {
    if (typeof noteValue === "number") return noteValue;
    return noteValue.value;
  };

  // Helper to extract note from NoteValue type
  const getNote = (noteValue: NoteValue): number | string => {
    if (typeof noteValue === "number") return "";
    return noteValue.note;
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <CardTitle>Balance Sheet</CardTitle>
              <CardDescription>
                For the period ending {format(date, "MMMM d, yyyy")}
                {branch !== "all" &&
                  ` • ${
                    branch.charAt(0).toUpperCase() + branch.slice(1)
                  } Branch`}
              </CardDescription>
            </div>
            <Badge
              variant={
                balanceSheetData.summary.balanceCheck
                  ? "default"
                  : "destructive"
              }
              className="h-6"
            >
              {balanceSheetData.summary.balanceCheck
                ? "Balanced"
                : "Unbalanced"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* ASSETS SECTION */}
            <div>
              <div className="bg-primary/10 p-2 mb-2 rounded">
                <h3 className="font-bold text-lg">ASSETS</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%]">Description</TableHead>
                    <TableHead className="text-center w-[10%]">Note</TableHead>
                    <TableHead className="text-right w-[30%]">GHS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Non-Current Assets */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3}>Non-Current Assets</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Fixed Assets (net)</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.assets.nonCurrent.fixedAssetsNet
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.assets.nonCurrent.fixedAssetsNet
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total Non-Current Assets</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(balanceSheetData.assets.nonCurrent.total)}
                    </TableCell>
                  </TableRow>

                  {/* Current Assets */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3} className="pt-4">
                      Current Assets
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">
                      Cash and Cash Equivalents
                    </TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.assets.current.cashAndCashEquivalents
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.assets.current.cashAndCashEquivalents
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Accounts Receivables</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.assets.current.accountsReceivable
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.assets.current.accountsReceivable
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Closing Inventory</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.assets.current.closingInventory
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.assets.current.closingInventory
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total Current Assets</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(balanceSheetData.assets.current.total)}
                    </TableCell>
                  </TableRow>

                  {/* Total Assets */}
                  <TableRow className="font-bold text-base bg-primary/5">
                    <TableCell className="pt-4">TOTAL ASSETS</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="pt-4 text-right">
                      {formatCurrency(balanceSheetData.assets.totalAssets)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* EQUITIES AND LIABILITIES SECTION */}
            <div>
              <div className="bg-primary/10 p-2 mb-2 rounded">
                <h3 className="font-bold text-lg">EQUITIES AND LIABILITIES</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%]">Description</TableHead>
                    <TableHead className="text-center w-[10%]">Note</TableHead>
                    <TableHead className="text-right w-[30%]">GHS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Shareholders Fund */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3}>Shareholders Fund</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Equities</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.equity.shareholdersFund.equities || 0
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.equity.shareholdersFund.equities || 0
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Retained Earnings</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.equity.shareholdersFund
                          .retainedEarnings
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.equity.shareholdersFund
                            .retainedEarnings
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Profit for the Year</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.equity.shareholdersFund
                          .profitForTheYear
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.equity.shareholdersFund
                            .profitForTheYear
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total Equities</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        balanceSheetData.equity.shareholdersFund.total
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Current Liabilities */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3} className="pt-4">
                      Current Liabilities
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Accounts Payables</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.liabilities.current.accountsPayable
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.liabilities.current.accountsPayable
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Bank Overdraft</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.liabilities.current.bankOverdraft
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.liabilities.current.bankOverdraft
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Settlement Arrears</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.liabilities.current.settlementsArrears
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.liabilities.current
                            .settlementsArrears
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total Current Liabilities</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        balanceSheetData.liabilities.current.total
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Non-Current Liabilities */}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={3} className="pt-4">
                      Non-Current Liabilities
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Bank Loan</TableCell>
                    <TableCell className="text-center">
                      {getNote(
                        balanceSheetData.liabilities.nonCurrent.bankLoan
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        getValue(
                          balanceSheetData.liabilities.nonCurrent.bankLoan
                        )
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Total Non-Current Liabilities</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        balanceSheetData.liabilities.nonCurrent.total
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Total Equities and Liabilities */}
                  <TableRow className="font-bold text-base bg-primary/5">
                    <TableCell className="pt-4">
                      TOTAL EQUITIES AND LIABILITIES
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="pt-4 text-right">
                      {formatCurrency(
                        balanceSheetData.totalEquityAndLiabilities
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Balance Check */}
            {!balanceSheetData.summary.balanceCheck && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
                <p className="text-sm font-medium text-yellow-800">
                  Balance Sheet is not balanced!
                </p>
                <p className="text-xs text-yellow-700 mt-1">
                  Difference: GHS{" "}
                  {formatCurrency(
                    Math.abs(balanceSheetData.summary.difference)
                  )}
                </p>
              </div>
            )}

            {/* Notes to the Accounts */}
            <div>
              <div className="bg-muted p-2 mb-2 rounded">
                <h3 className="font-semibold text-sm">Notes to the Accounts</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">1. Fixed Assets (net):</span>{" "}
                  Net book value of all business assets (Cost - Accumulated
                  Depreciation)
                </div>
                <div>
                  <span className="font-medium">
                    2. Cash and Cash Equivalents:
                  </span>{" "}
                  Sum of positive balances in all float accounts
                  (Cash/MoMo/Bank/Power/Jumia)
                </div>
                <div>
                  <span className="font-medium">3. Accounts Receivables:</span>{" "}
                  Commissions yet to be received and pending approvals
                </div>
                <div>
                  <span className="font-medium">4. Closing Inventory:</span>{" "}
                  Available stock × unit cost (E-Zwich cards and other
                  inventory)
                </div>
                <div>
                  <span className="font-medium">5. Equities:</span> Funds raised
                  by issuing shares to shareholders (includes share capital and
                  contributed surplus)
                </div>
                <div>
                  <span className="font-medium">6. Retained Earnings:</span>{" "}
                  Accumulated profits retained from previous periods
                </div>
                <div>
                  <span className="font-medium">7. Profit for the Year:</span>{" "}
                  Current period profit/loss (Total Revenue - Total Expenses)
                </div>
                <div>
                  <span className="font-medium">8. Accounts Payables:</span>{" "}
                  Pending/unapproved expenses and amounts owing to creditors
                </div>
                <div>
                  <span className="font-medium">9. Bank Overdraft:</span>{" "}
                  Negative balances in bank float accounts
                </div>
                <div>
                  <span className="font-medium">10. Settlements Arrears:</span>{" "}
                  Outstanding negative balance on Jumia float account
                </div>
                <div>
                  <span className="font-medium">11. Bank Loan:</span>{" "}
                  Outstanding long-term bank loans and facilities
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
