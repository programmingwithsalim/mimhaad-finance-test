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

interface ProfitLossProps {
  dateRange: {
    from: Date;
    to: Date;
  };
  branch: string;
}

interface ProfitLossData {
  period: {
    from: string | null;
    to: string | null;
  };
  revenue: {
    breakdown: Array<{
      service: string;
      note: number;
      amount: number;
    }>;
    total: number;
  };
  expenses: {
    breakdown: Array<{
      category: string;
      note: number;
      amount: number;
    }>;
    total: number;
  };
  grossProfit: number;
  commissions: {
    note: number;
    total: number;
  };
  netProfit: number;
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    grossProfit: number;
    totalCommissions: number;
    netProfit: number;
    profitMargin: number;
  };
}

export function ProfitLossStatement({ dateRange, branch }: ProfitLossProps) {
  const [profitLossData, setProfitLossData] = useState<ProfitLossData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfitLossData();
  }, [dateRange, branch]);

  const fetchProfitLossData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
        branch: branch,
      });

      const response = await fetch(`/api/reports/profit-loss?${params}`);
      const result = await response.json();

      if (result.success) {
        setProfitLossData(result.data);
      } else {
        setError(result.error || "Failed to fetch profit & loss data");
      }
    } catch (error) {
      console.error("Error fetching profit & loss:", error);
      setError("Failed to fetch profit & loss data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading profit & loss statement...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="text-red-600 mb-2">
              Error loading profit & loss statement
            </p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profitLossData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">
            No profit & loss data available
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

  const isProfit = profitLossData.netProfit >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <CardTitle>Profit and Loss Account</CardTitle>
            <CardDescription>
              For the period ended {format(dateRange.to, "MMMM d, yyyy")}
              {branch !== "all" &&
                ` • ${branch.charAt(0).toUpperCase() + branch.slice(1)} Branch`}
            </CardDescription>
          </div>
          <Badge variant={isProfit ? "default" : "destructive"} className="h-6">
            {isProfit ? "Profit" : "Loss"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* REVENUE SECTION */}
          <div>
            <div className="bg-primary/10 p-2 mb-2 rounded">
              <h3 className="font-bold text-lg">REVENUE</h3>
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
                {profitLossData.revenue.breakdown.map((item) => (
                  <TableRow key={item.service}>
                    <TableCell className="pl-4">{item.service}</TableCell>
                    <TableCell className="text-center">{item.note}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold text-base bg-green-50">
                  <TableCell>Total Revenue</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(profitLossData.revenue.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* EXPENSES SECTION */}
          <div>
            <div className="bg-primary/10 p-2 mb-2 rounded">
              <h3 className="font-bold text-lg">EXPENSES</h3>
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
                {profitLossData.expenses.breakdown.map((item) => (
                  <TableRow key={item.category}>
                    <TableCell className="pl-4">{item.category}</TableCell>
                    <TableCell className="text-center">{item.note}</TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold text-base bg-red-50">
                  <TableCell>Total Expense</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(profitLossData.expenses.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* GROSS PROFIT/LOSS */}
          <div>
            <Table>
              <TableBody>
                <TableRow
                  className={`font-bold text-base ${
                    profitLossData.grossProfit >= 0
                      ? "bg-green-50"
                      : "bg-red-50"
                  }`}
                >
                  <TableCell className="w-[60%]">
                    Gross Profit/Loss (Total Revenue - Total Expense)
                  </TableCell>
                  <TableCell className="text-center w-[10%]"></TableCell>
                  <TableCell
                    className={`text-right w-[30%] ${
                      profitLossData.grossProfit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(profitLossData.grossProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* COMMISSIONS */}
          <div>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-[60%] pl-4">Commissions</TableCell>
                  <TableCell className="text-center w-[10%]">
                    {profitLossData.commissions.note}
                  </TableCell>
                  <TableCell className="text-right w-[30%] text-green-600">
                    {formatCurrency(profitLossData.commissions.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* NET PROFIT/LOSS */}
          <div>
            <Table>
              <TableBody>
                <TableRow
                  className={`font-bold text-lg ${
                    profitLossData.netProfit >= 0
                      ? "bg-green-100 border-green-300"
                      : "bg-red-100 border-red-300"
                  } border-2`}
                >
                  <TableCell className="w-[60%]">NET PROFIT/LOSS</TableCell>
                  <TableCell className="text-center w-[10%]"></TableCell>
                  <TableCell
                    className={`text-right w-[30%] text-lg font-bold ${
                      profitLossData.netProfit >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {formatCurrency(profitLossData.netProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Notes to the Accounts */}
          <div>
            <div className="bg-muted p-2 mb-2 rounded">
              <h3 className="font-semibold text-sm">Notes to the Accounts</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">12. Agency Banking:</span> Total
                fees received for Agency Banking transactions
              </div>
              <div>
                <span className="font-medium">13. MoMo:</span> Total fees
                received for mobile money transactions
              </div>
              <div>
                <span className="font-medium">14. E-Zwich:</span> Total fees and
                revenue from E-Zwich transactions and card issuance
              </div>
              <div>
                <span className="font-medium">15. Power:</span> Total fees
                received for power sales transactions
              </div>
              <div>
                <span className="font-medium">16. Jumia:</span> Total fees
                received for Jumia transactions
              </div>
              <div>
                <span className="font-medium">17. Administrative:</span> Total
                administrative expenses recorded and approved
              </div>
              <div>
                <span className="font-medium">18. Human Resources:</span> Total
                HR expenses including salaries and staff costs
              </div>
              <div>
                <span className="font-medium">19. Marketing:</span> Total
                marketing and promotional expenses
              </div>
              <div>
                <span className="font-medium">20. Operational:</span> Total
                operational expenses including utilities and supplies
              </div>
              <div>
                <span className="font-medium">21. Commissions:</span> Total
                commissions received from all floats and services
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
