"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Loader2 } from "lucide-react";

interface CashFlowStatementProps {
  dateRange: { from: Date; to: Date };
  branch: string;
}

type NoteValue = { note: number | null; value: number } | number;

interface CashFlowData {
  period: { from: string; to: string };
  operatingActivities: {
    netProfit: NoteValue;
    adjustmentsForNonCashItems: NoteValue;
    operatingProfitBeforeWorkingCapital: number;
    workingCapitalChanges: {
      accountsReceivable: NoteValue;
      inventory: NoteValue;
      accountsPayable: NoteValue;
      settlementsArrears: NoteValue;
    };
    netCashFromOperations: number;
  };
  investingActivities: {
    purchaseOfFixedAssets: NoteValue;
    disposalOfFixedAssets: NoteValue;
    netCashFromInvesting: number;
  };
  financingActivities: {
    equityIntroduced: NoteValue;
    retainedEarningsAdjustment: NoteValue;
    bankLoan: NoteValue;
    dividendsPaid: NoteValue;
    netCashFromFinancing: number;
  };
  summary: {
    netChangeInCash: number;
    openingCashBalance: number;
    closingCashBalance: number;
  };
}

export function CashFlowStatement({
  dateRange,
  branch,
}: CashFlowStatementProps) {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCashFlowData();
  }, [dateRange, branch]);

  const fetchCashFlowData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
        branch: branch,
      });

      const response = await fetch(`/api/reports/cash-flow?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch cash flow data");
      }
    } catch (error) {
      console.error("Error fetching cash flow:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
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

  // Helper to extract value from NoteValue type
  const getValue = (noteValue: NoteValue): number => {
    if (typeof noteValue === "number") return noteValue;
    return noteValue.value;
  };

  // Helper to extract note from NoteValue type
  const getNote = (noteValue: NoteValue): number | string => {
    if (typeof noteValue === "number") return "";
    return noteValue.note || "";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading cash flow statement...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <CardTitle>Statement of Cash Flows</CardTitle>
            <CardDescription>
              For the period ended {format(dateRange.to, "MMMM d, yyyy")}
              {branch !== "all" &&
                ` • ${branch.charAt(0).toUpperCase() + branch.slice(1)} Branch`}
            </CardDescription>
          </div>
          <Badge
            variant={
              data.summary.netChangeInCash >= 0 ? "default" : "destructive"
            }
            className="h-6"
          >
            {data.summary.netChangeInCash >= 0
              ? "Positive Flow"
              : "Negative Flow"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* OPERATING ACTIVITIES */}
          <div>
            <div className="bg-primary/10 p-2 mb-2 rounded">
              <h3 className="font-bold text-lg">
                CASH FLOWS FROM OPERATING ACTIVITIES
              </h3>
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
                <TableRow>
                  <TableCell className="pl-4">
                    Net Profit for the Year
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(data.operatingActivities.netProfit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(data.operatingActivities.netProfit)
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4">
                    Adjustments for Non-Cash Items
                  </TableCell>
                  <TableCell className="text-center"></TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(
                        data.operatingActivities.adjustmentsForNonCashItems
                      )
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="font-medium bg-muted/30">
                  <TableCell className="pl-4">
                    Operating Profit Before Working Capital
                  </TableCell>
                  <TableCell className="text-center"></TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      data.operatingActivities
                        .operatingProfitBeforeWorkingCapital
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell colSpan={3} className="pl-4">
                    Changes in Working Capital:
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">
                    (Increase)/Decrease in Accounts Receivable
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(
                      data.operatingActivities.workingCapitalChanges
                        .accountsReceivable
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(
                        data.operatingActivities.workingCapitalChanges
                          .accountsReceivable
                      )
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">
                    (Increase)/Decrease in Inventory
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(
                      data.operatingActivities.workingCapitalChanges.inventory
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(
                        data.operatingActivities.workingCapitalChanges.inventory
                      )
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">
                    Increase/(Decrease) in Accounts Payable
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(
                      data.operatingActivities.workingCapitalChanges
                        .accountsPayable
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(
                        data.operatingActivities.workingCapitalChanges
                          .accountsPayable
                      )
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-8">
                    (Increase)/Decrease in Settlement Arrears
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(
                      data.operatingActivities.workingCapitalChanges
                        .settlementsArrears
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(
                        data.operatingActivities.workingCapitalChanges
                          .settlementsArrears
                      )
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="font-bold bg-green-50">
                  <TableCell>
                    Net Cash Generated from Operating Activities
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(
                      data.operatingActivities.netCashFromOperations
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* INVESTING ACTIVITIES */}
          <div>
            <div className="bg-primary/10 p-2 mb-2 rounded">
              <h3 className="font-bold text-lg">
                CASH FLOWS FROM INVESTING ACTIVITIES
              </h3>
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
                <TableRow>
                  <TableCell className="pl-4">
                    Purchase of Non-Current Assets
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(data.investingActivities.purchaseOfFixedAssets)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(
                      getValue(data.investingActivities.purchaseOfFixedAssets)
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4">
                    Disposal of Non-Current Assets
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(data.investingActivities.disposalOfFixedAssets)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(
                      getValue(data.investingActivities.disposalOfFixedAssets)
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="font-bold bg-blue-50">
                  <TableCell>Net Cash from Investing Activities</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right text-blue-600">
                    {formatCurrency(
                      data.investingActivities.netCashFromInvesting
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* FINANCING ACTIVITIES */}
          <div>
            <div className="bg-primary/10 p-2 mb-2 rounded">
              <h3 className="font-bold text-lg">
                CASH FLOWS FROM FINANCING ACTIVITIES
              </h3>
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
                <TableRow>
                  <TableCell className="pl-4">Equity Introduced</TableCell>
                  <TableCell className="text-center">
                    {getNote(data.financingActivities.equityIntroduced)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(
                      getValue(data.financingActivities.equityIntroduced)
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4">
                    Retained Earnings Adjustment
                  </TableCell>
                  <TableCell className="text-center">
                    {getNote(
                      data.financingActivities.retainedEarningsAdjustment
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      getValue(
                        data.financingActivities.retainedEarningsAdjustment
                      )
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4">Bank Loan</TableCell>
                  <TableCell className="text-center">
                    {getNote(data.financingActivities.bankLoan)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(
                      getValue(data.financingActivities.bankLoan)
                    )}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4">Dividends Paid</TableCell>
                  <TableCell className="text-center">
                    {getNote(data.financingActivities.dividendsPaid)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(
                      getValue(data.financingActivities.dividendsPaid)
                    )}
                  </TableCell>
                </TableRow>
                <TableRow className="font-bold bg-purple-50">
                  <TableCell>Net Cash from Financing Activities</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right text-purple-600">
                    {formatCurrency(
                      data.financingActivities.netCashFromFinancing
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* SUMMARY */}
          <div>
            <Table>
              <TableBody>
                <TableRow className="font-bold text-lg bg-primary/5 border-t-2">
                  <TableCell className="w-[60%]">
                    Net Increase/(Decrease) in Cash & Equivalents
                  </TableCell>
                  <TableCell className="text-center w-[10%]"></TableCell>
                  <TableCell
                    className={`text-right w-[30%] ${
                      data.summary.netChangeInCash >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(data.summary.netChangeInCash)}
                  </TableCell>
                </TableRow>
                <TableRow className="font-medium">
                  <TableCell>Opening Cash & Cash Equivalents</TableCell>
                  <TableCell className="text-center"></TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(data.summary.openingCashBalance)}
                  </TableCell>
                </TableRow>
                <TableRow className="font-bold text-lg bg-green-100 border-t-2 border-green-300">
                  <TableCell>Closing Cash & Cash Equivalents</TableCell>
                  <TableCell className="text-center"></TableCell>
                  <TableCell className="text-right text-green-700">
                    {formatCurrency(data.summary.closingCashBalance)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Notes */}
          <div>
            <div className="bg-muted p-2 mb-2 rounded">
              <h3 className="font-semibold text-sm">Notes to the Accounts</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">
                  28. Net Profit for the Year:
                </span>{" "}
                From Profit & Loss statement
              </div>
              <div>
                <span className="font-medium">
                  29-32. Working Capital Changes:
                </span>{" "}
                Changes in current assets and liabilities
              </div>
              <div>
                <span className="font-medium">
                  33-34. Investing Activities:
                </span>{" "}
                Purchase and disposal of fixed assets
              </div>
              <div>
                <span className="font-medium">35. Equity Introduced:</span> New
                equity contributions from shareholders
              </div>
              <div>
                <span className="font-medium">36. Retained Earnings:</span>{" "}
                Adjustments to retained earnings
              </div>
              <div>
                <span className="font-medium">37. Bank Loan:</span> Long-term
                bank loan proceeds
              </div>
              <div>
                <span className="font-medium">38. Dividends Paid:</span>{" "}
                Distributions to shareholders
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
