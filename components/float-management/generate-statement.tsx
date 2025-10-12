"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import {
  Download,
  Calendar,
  FileText,
  TrendingUp,
  TrendingDown,
  Loader2,
  BookOpen,
  DollarSign,
  ArrowUpDown,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface FloatStatementEntry {
  id: string;
  transactionDate: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  reference: string;
  sourceModule?: string;
  sourceTransactionId?: string;
  processedBy: string;
  branchId: string;
  branchName: string;
  glEntries?: GLEntry[];
}

interface GLEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

interface FloatStatementSummary {
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalDebits: number;
  netChange: number;
  transactionCount: number;
  glTransactionCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

interface GenerateStatementProps {
  floatAccountId: string;
  floatAccountName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateStatement({
  floatAccountId,
  floatAccountName,
  open,
  onOpenChange,
}: GenerateStatementProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<FloatStatementEntry[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<FloatStatementSummary | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Set default date range (last 30 days)
  useEffect(() => {
    if (open) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);

      setEndDate(end.toISOString().split("T")[0]);
      setStartDate(start.toISOString().split("T")[0]);
    }
  }, [open]);

  // Fetch statement when dates change
  useEffect(() => {
    if (open && floatAccountId && startDate && endDate) {
      fetchStatement();
    }
  }, [open, floatAccountId, startDate, endDate]);

  const fetchStatement = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        floatAccountId,
        startDate,
        endDate,
        page: "1",
        pageSize: "1000", // Get more transactions for statement view
      });

      const response = await fetch(
        `/api/float-accounts/optimized-statement?${params}`
      );

      const result = await response.json();

      if (result.success && result.data) {
        // Transform optimized format to expected format
        const transformedEntries = result.data.entries.map((entry: any) => ({
          id: entry.id,
          transactionDate: entry.date,
          transactionType: entry.type,
          amount: entry.debit > 0 ? entry.debit : -entry.credit,
          balanceBefore: 0,
          balanceAfter: entry.balance,
          description: entry.description,
          reference: entry.reference,
          sourceModule: entry.source,
          processedBy: entry.processedBy,
          branchId: "",
          branchName: "",
        }));

        setEntries(transformedEntries);
        setSummary({
          openingBalance: result.data.summary.openingBalance,
          closingBalance: result.data.summary.closingBalance,
          totalCredits: result.data.summary.totalCredits,
          totalDebits: result.data.summary.totalDebits,
          netChange:
            result.data.summary.closingBalance -
            result.data.summary.openingBalance,
          transactionCount: result.data.summary.transactionCount,
          glTransactionCount: result.data.summary.transactionCount,
          period: { startDate, endDate },
        });
        toast({
          title: "Success",
          description: `Statement generated with ${result.data.entries.length} entries`,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to generate statement",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching statement:", error);
      toast({
        title: "Error",
        description: "Failed to generate statement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!entries.length) return;

    setGeneratingPDF(true);
    try {
      const pdfDoc = await PDFDocument.create();
      // Use landscape orientation (A4 landscape: 841.89 x 595.28)
      const page = pdfDoc.addPage([841.89, 595.28]);
      const { width, height } = page.getSize();

      // Embed fonts
      const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Light color palette
      const primaryBlue = rgb(0.2, 0.4, 0.8); // Light blue
      const secondaryYellow = rgb(1, 0.9, 0.4); // Light yellow
      const lightGray = rgb(0.9, 0.9, 0.9);
      const darkGray = rgb(0.3, 0.3, 0.3);
      const watermarkGray = rgb(0.95, 0.95, 0.95);

      // Add watermark logo
      try {
        const logoResponse = await fetch("/logo.png");
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImage = await pdfDoc.embedPng(logoBytes);

        // Create watermark - large, centered, very light
        const watermarkWidth = 400;
        const watermarkHeight = 400;
        const watermarkX = (width - watermarkWidth) / 2;
        const watermarkY = (height - watermarkHeight) / 2;

        page.drawImage(logoImage, {
          x: watermarkX,
          y: watermarkY,
          width: watermarkWidth,
          height: watermarkHeight,
          opacity: 0.05, // Very light watermark
        });
      } catch (error) {
        console.log("Logo not found, continuing without watermark");
      }

      // Add header with logo
      const headerY = height - 50;

      // Draw header background
      page.drawRectangle({
        x: 0,
        y: headerY - 15,
        width: width,
        height: 65,
        color: lightGray,
      });

      // Add logo to header
      try {
        const logoResponse = await fetch("/logo.png");
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImage = await pdfDoc.embedPng(logoBytes);

        const logoWidth = 45;
        const logoHeight = 45;
        page.drawImage(logoImage, {
          x: 40,
          y: headerY - 10,
          width: logoWidth,
          height: logoHeight,
        });
      } catch (error) {
        console.log("Logo not found for header");
      }

      // Add company name
      page.drawText("MIMHAAD VENTURES", {
        x: 100,
        y: headerY + 10,
        size: 18,
        font: titleFont,
        color: primaryBlue,
      });

      // Add document title
      page.drawText("Float Account Statement", {
        x: 100,
        y: headerY - 10,
        size: 14,
        font: regularFont,
        color: darkGray,
      });

      // Add account info section
      const infoY = headerY - 100;

      // Info background
      page.drawRectangle({
        x: 40,
        y: infoY - 15,
        width: width - 80,
        height: 50,
        color: secondaryYellow,
        opacity: 0.3,
      });

      page.drawText(`Account: ${floatAccountName}`, {
        x: 60,
        y: infoY,
        size: 14,
        font: titleFont,
        color: darkGray,
      });

      page.drawText(`Period: ${startDate} to ${endDate}`, {
        x: 60,
        y: infoY - 25,
        size: 12,
        font: regularFont,
        color: darkGray,
      });

      // Add summary section
      if (summary) {
        const summaryY = infoY - 100;

        // Summary background
        page.drawRectangle({
          x: 40,
          y: summaryY - 15,
          width: width - 80,
          height: 70,
          color: lightGray,
          opacity: 0.5,
        });

        page.drawText("Statement Summary", {
          x: 60,
          y: summaryY + 5,
          size: 16,
          font: titleFont,
          color: primaryBlue,
        });

        const summaryData = [
          {
            label: "Opening Balance:",
            value: summary.openingBalance.toFixed(2),
          },
          {
            label: "Closing Balance:",
            value: summary.closingBalance.toFixed(2),
          },
          { label: "Total Credits:", value: summary.totalCredits.toFixed(2) },
          { label: "Total Debits:", value: summary.totalDebits.toFixed(2) },
          { label: "Net Change:", value: summary.netChange.toFixed(2) },
          {
            label: "Transactions:",
            value: summary.transactionCount.toString(),
          },
        ];

        // Create three columns for summary in landscape mode
        const col1X = 60;
        const col2X = 350;
        const col3X = 640;
        const rowHeight = 18;

        summaryData.forEach((item, index) => {
          let x;
          if (index < 2) x = col1X;
          else if (index < 4) x = col2X;
          else x = col3X;

          const y = summaryY - 15 - (index % 2) * rowHeight;

          page.drawText(item.label, {
            x,
            y,
            size: 11,
            font: titleFont,
            color: darkGray,
          });

          page.drawText(item.value, {
            x: x + 130,
            y,
            size: 11,
            font: regularFont,
            color: darkGray,
          });
        });
      }

      // Add transactions table
      const tableY = height - 280;

      // Table header background
      page.drawRectangle({
        x: 40,
        y: tableY - 15,
        width: width - 80,
        height: 35,
        color: primaryBlue,
        opacity: 0.2,
      });

      page.drawText("Transaction Details", {
        x: 60,
        y: tableY + 5,
        size: 16,
        font: titleFont,
        color: primaryBlue,
      });

      // Table headers
      const headers = [
        "Date",
        "Type",
        "Amount",
        "Balance Before",
        "Balance After",
        "Description",
        "Processed By",
      ];
      const columnWidths = [80, 90, 90, 100, 100, 220, 120];
      let currentX = 60;

      headers.forEach((header, index) => {
        page.drawText(header, {
          x: currentX,
          y: tableY - 25,
          size: 11,
          font: titleFont,
          color: darkGray,
        });
        currentX += columnWidths[index];
      });

      // Draw transactions (limit to first 20 for PDF in landscape)
      const transactionsToShow = entries.slice(0, 20);
      transactionsToShow.forEach((entry, index) => {
        const y = tableY - 60 - index * 20;
        if (y < 80) return; // Don't draw below page margin

        // Alternate row colors
        if (index % 2 === 0) {
          page.drawRectangle({
            x: 40,
            y: y - 2,
            width: width - 80,
            height: 20,
            color: lightGray,
            opacity: 0.3,
          });
        }

        const rowData = [
          new Date(entry.transactionDate).toLocaleDateString(),
          entry.transactionType,
          entry.amount.toFixed(2),
          entry.balanceBefore.toFixed(2),
          entry.balanceAfter.toFixed(2),
          entry.description.substring(0, 40) +
            (entry.description.length > 40 ? "..." : ""),
          entry.processedBy,
        ];

        currentX = 60;
        rowData.forEach((text, colIndex) => {
          page.drawText(text, {
            x: currentX,
            y,
            size: 10,
            font: regularFont,
            color: darkGray,
          });
          currentX += columnWidths[colIndex];
        });
      });

      // Add footer
      const footerY = 80;
      page.drawText(
        `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        {
          x: 60,
          y: footerY,
          size: 9,
          font: regularFont,
          color: darkGray,
        }
      );

      page.drawText("MIMHAAD VENTURES - Financial Management System", {
        x: 60,
        y: footerY - 20,
        size: 9,
        font: regularFont,
        color: darkGray,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `float-statement-${
        floatAccountName || "account"
      }-${startDate}-${endDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated",
        description: "Enhanced float statement has been downloaded",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF statement",
        variant: "destructive",
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const exportCSV = () => {
    if (!entries.length) return;

    const headers = [
      "Date",
      "Type",
      "Amount",
      "Balance Before",
      "Balance After",
      "Description",
      "Reference",
      "Processed By",
      "Source Module",
      "GL Entries",
    ];

    const csvRows = entries.map((entry) => [
      new Date(entry.transactionDate).toLocaleDateString(),
      entry.transactionType,
      entry.amount,
      entry.balanceBefore,
      entry.balanceAfter,
      `"${entry.description}"`,
      entry.reference,
      entry.processedBy,
      entry.sourceModule || "N/A",
      entry.glEntries ? `${entry.glEntries.length} entries` : "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `float-statement-${
      floatAccountName || "account"
    }-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV Exported",
      description: "Enhanced float statement data has been downloaded",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Enhanced Float Statement
          </DialogTitle>
          <DialogDescription>
            Comprehensive float statement with GL journal entries for{" "}
            {floatAccountName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Date Range and Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={fetchStatement}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Generate Statement"
                )}
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Opening Balance
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary.openingBalance)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Closing Balance
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(summary.closingBalance)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Credits
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.totalCredits)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Debits
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.totalDebits)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Net Change
                  </CardTitle>
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${
                      summary.netChange >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {summary.netChange >= 0 ? "+" : ""}
                    {formatCurrency(summary.netChange)}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 lg:col-span-5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Transaction Summary
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-lg font-bold">
                        {summary.transactionCount}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total Transactions
                      </p>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {summary.glTransactionCount}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        With GL Entries
                      </p>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {summary.period.startDate}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Start Date
                      </p>
                    </div>
                    <div>
                      <div className="text-lg font-bold">
                        {summary.period.endDate}
                      </div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={generatePDF}
              disabled={generatingPDF || !entries.length}
            >
              {generatingPDF ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Export PDF
            </Button>
            <Button
              onClick={exportCSV}
              disabled={!entries.length}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Transactions Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">
                    <div>Debit</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      (Inflows)
                    </div>
                  </TableHead>
                  <TableHead className="text-right">
                    <div>Credit</div>
                    <div className="text-xs text-muted-foreground font-normal">
                      (Outflows)
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Processed By</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => {
                  // Debit = positive amounts (adds to float)
                  const debit = entry.amount > 0 ? entry.amount : 0;
                  // Credit = negative amounts shown as positive (subtracts from float)
                  const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0;

                  return (
                    <TableRow key={`${entry.id}-${index}`}>
                      <TableCell>
                        {new Date(entry.transactionDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.sourceModule ? "default" : "secondary"}
                        >
                          {entry.transactionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {debit > 0 ? (
                          <span className="text-green-600 font-medium">
                            {formatCurrency(debit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {credit > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatCurrency(credit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(entry.balanceAfter)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.description}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.reference}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.processedBy}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entry.sourceModule || "Float"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {entries.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">
                  No Transactions Found
                </h3>
                <p className="text-sm mb-4">
                  This float account has no transaction history for the selected
                  period.
                </p>
                <div className="text-xs space-y-1">
                  <p>• No direct float transactions exist</p>
                  <p>• No GL journal entries are configured</p>
                  <p>
                    • Try adjusting the date range or contact an administrator
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
