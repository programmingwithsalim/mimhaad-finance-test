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
import { Loader2 } from "lucide-react";

interface EquityStatementProps {
  dateRange: {
    from: Date;
    to: Date;
  };
  branch: string;
}

interface EquityStatementData {
  period: {
    from: string | null;
    to: string | null;
  };
  opening: {
    note: number;
    shareCapital: number;
    retainedEarnings: number;
    otherFund: number;
    total: number;
  };
  movements: Array<{
    note: number;
    particulars: string;
    shareCapital: number;
    retainedEarnings: number;
    otherFund: number;
  }>;
  incomeForTheYear: number;
  closing: {
    note: number;
    shareCapital: number;
    retainedEarnings: number;
    otherFund: number;
    total: number;
  };
}

export function EquityStatement({ dateRange, branch }: EquityStatementProps) {
  const [equityData, setEquityData] = useState<EquityStatementData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEquityStatement();
  }, [dateRange, branch]);

  const fetchEquityStatement = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
        branch: branch,
      });

      const response = await fetch(`/api/reports/equity-statement?${params}`);
      const result = await response.json();

      if (result.success) {
        setEquityData(result.data);
      } else {
        setError(result.error || "Failed to fetch equity statement");
      }
    } catch (error) {
      console.error("Error fetching equity statement:", error);
      setError("Failed to fetch equity statement");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading statement of changes in equity...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-red-600 mb-2">Error loading equity statement</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!equityData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">
            No equity statement data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    if (amount < 0) {
      return `(${Math.abs(amount).toLocaleString("en-GH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })})`;
    }
    return amount.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <CardTitle>Statement of Changes in Equity</CardTitle>
            <CardDescription>
              For the period from {format(dateRange.from, "MMMM d, yyyy")} to{" "}
              {format(dateRange.to, "MMMM d, yyyy")}
              {branch !== "all" &&
                ` • ${branch.charAt(0).toUpperCase() + branch.slice(1)} Branch`}
            </CardDescription>
          </div>
          <Badge variant="default" className="h-6">
            Total: GHS {formatCurrency(equityData.closing.total)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Particulars</TableHead>
                  <TableHead className="text-center w-[8%]">Note</TableHead>
                  <TableHead className="text-right w-[15%]">
                    Share Capital (GHS)
                  </TableHead>
                  <TableHead className="text-right w-[15%]">
                    Retained Earnings (GHS)
                  </TableHead>
                  <TableHead className="text-right w-[15%]">
                    Other Fund (GHS)
                  </TableHead>
                  <TableHead className="text-right w-[17%]">
                    Total Equity (GHS)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening Balance */}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-medium">
                    Opening Balance (
                    {equityData.period.from
                      ? format(new Date(equityData.period.from), "d/M/yy")
                      : "N/A"}
                    )
                  </TableCell>
                  <TableCell className="text-center">
                    {equityData.opening.note}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(equityData.opening.shareCapital)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(equityData.opening.retainedEarnings)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(equityData.opening.otherFund)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(equityData.opening.total)}
                  </TableCell>
                </TableRow>

                {/* Movements */}
                {equityData.movements.map((movement, index) => {
                  const total =
                    movement.shareCapital +
                    movement.retainedEarnings +
                    movement.otherFund;
                  return (
                    <TableRow key={index}>
                      <TableCell>{movement.particulars}</TableCell>
                      <TableCell className="text-center">
                        {movement.note}
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.shareCapital !== 0
                          ? formatCurrency(movement.shareCapital)
                          : "0.00"}
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.retainedEarnings !== 0
                          ? formatCurrency(movement.retainedEarnings)
                          : "0.00"}
                      </TableCell>
                      <TableCell className="text-right">
                        {movement.otherFund !== 0
                          ? formatCurrency(movement.otherFund)
                          : "0.00"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(total)}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Closing Balance */}
                <TableRow className="font-bold text-base bg-green-50 border-t-2 border-green-300">
                  <TableCell>
                    Closing Balance (
                    {equityData.period.to
                      ? format(new Date(equityData.period.to), "d/M/yy")
                      : "N/A"}
                    )
                  </TableCell>
                  <TableCell className="text-center">
                    {equityData.closing.note}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {formatCurrency(equityData.closing.shareCapital)}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {formatCurrency(equityData.closing.retainedEarnings)}
                  </TableCell>
                  <TableCell className="text-right text-green-700">
                    {formatCurrency(equityData.closing.otherFund)}
                  </TableCell>
                  <TableCell className="text-right text-green-700 text-lg">
                    {formatCurrency(equityData.closing.total)}
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
                <span className="font-medium">22. Opening Balance:</span>{" "}
                Beginning balance at the start of the reporting period
              </div>
              <div>
                <span className="font-medium">
                  23. Issue or Redemption of Share Capital:
                </span>{" "}
                New shares issued or shares bought back by the company
              </div>
              <div>
                <span className="font-medium">24. Income for the Year:</span>{" "}
                Net profit/loss from the Profit & Loss statement
              </div>
              <div>
                <span className="font-medium">25. Other Fund Adjustments:</span>{" "}
                Revaluations, foreign exchange gains/losses, and unrealized
                comprehensive income
              </div>
              <div>
                <span className="font-medium">26. Dividends Declared:</span>{" "}
                Profits distributed to shareholders
              </div>
              <div>
                <span className="font-medium">27. Closing Balance:</span> Ending
                balance at the end of the reporting period
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
