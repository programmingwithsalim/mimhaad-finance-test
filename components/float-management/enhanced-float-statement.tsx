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
  const [summary, setSummary] = useState<FloatStatementSummary | null>(null);
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeGL, setIncludeGL] = useState(true);
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
  }, [open, floatAccountId, startDate, endDate, includeGL]);

  const fetchStatement = async () => {
    if (!floatAccountId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        floatAccountId,
        startDate,
        endDate,
        includeGL: includeGL.toString(),
      });

      const response = await fetch(
        `/api/float-accounts/enhanced-statement?${params}`
      );
      const data = await response.json();

      if (data.success) {
        setEntries(data.data.entries || []);
        setSummary(data.data.summary);
        setAccount(data.data.account);
      } else {
        throw new Error(data.error || "Failed to fetch statement");
      }
    } catch (error) {
      console.error("Error fetching float statement:", error);
      toast({
        title: "Error",
        description: "Failed to fetch float statement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!account || !entries.length) return;

    try {
      setGeneratingPDF(true);

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const { width, height } = page.getSize();

      // Load font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let yPosition = height - 50;

      // Header
      page.drawText("ENHANCED FLOAT ACCOUNT STATEMENT", {
        x: 50,
        y: yPosition,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 30;

      // Account details
      page.drawText(`Account: ${account.provider} (${account.accountType})`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(`Branch: ${account.branchName}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      page.drawText(
        `Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(
          endDate
        ).toLocaleDateString()}`,
        {
          x: 50,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        }
      );
      yPosition -= 20;

      page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 40;

      // Summary section
      if (summary) {
        page.drawText("SUMMARY", {
          x: 50,
          y: yPosition,
          size: 14,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;

        const summaryData = [
          {
            label: "Opening Balance",
            value: formatCurrency(summary.openingBalance),
          },
          {
            label: "Closing Balance",
            value: formatCurrency(summary.closingBalance),
          },
          {
            label: "Total Credits",
            value: formatCurrency(summary.totalCredits),
          },
          { label: "Total Debits", value: formatCurrency(summary.totalDebits) },
          { label: "Net Change", value: formatCurrency(summary.netChange) },
          { label: "Transactions", value: summary.transactionCount.toString() },
          {
            label: "GL Transactions",
            value: summary.glTransactionCount.toString(),
          },
        ];

        summaryData.forEach((item) => {
          page.drawText(`${item.label}:`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font,
            color: rgb(0, 0, 0),
          });
          page.drawText(item.value, {
            x: 200,
            y: yPosition,
            size: 10,
            font: boldFont,
            color: rgb(0, 0, 0),
          });
          yPosition -= 15;
        });

        yPosition -= 20;
      }

      // Transactions section
      page.drawText("TRANSACTIONS", {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;

      // Table headers
      const headers = [
        "Date",
        "Type",
        "Amount",
        "Balance",
        "Description",
        "Reference",
      ];
      const headerX = [50, 100, 180, 250, 320, 450];

      headers.forEach((header, index) => {
        page.drawText(header, {
          x: headerX[index],
          y: yPosition,
          size: 8,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      });
      yPosition -= 15;

      // Transaction rows
      entries.slice(0, 40).forEach((entry) => {
        // Limit to first 40 for PDF
        if (yPosition < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          yPosition = height - 50;
        }

        const date = new Date(entry.transactionDate).toLocaleDateString();
        const type = entry.transactionType;
        const amount = formatCurrency(entry.amount);
        const balance = formatCurrency(entry.balanceAfter);
        const description = entry.description.substring(0, 25);
        const reference = entry.reference.substring(0, 20);

        page.drawText(date, {
          x: headerX[0],
          y: yPosition,
          size: 7,
          font: font,
          color: rgb(0, 0, 0),
        });
        page.drawText(type, {
          x: headerX[1],
          y: yPosition,
          size: 7,
          font: font,
          color: rgb(0, 0, 0),
        });
        page.drawText(amount, {
          x: headerX[2],
          y: yPosition,
          size: 7,
          font: font,
          color: rgb(0, 0, 0),
        });
        page.drawText(balance, {
          x: headerX[3],
          y: yPosition,
          size: 7,
          font: font,
          color: rgb(0, 0, 0),
        });
        page.drawText(description, {
          x: headerX[4],
          y: yPosition,
          size: 7,
          font: font,
          color: rgb(0, 0, 0),
        });
        page.drawText(reference, {
          x: headerX[5],
          y: yPosition,
          size: 7,
          font: font,
          color: rgb(0, 0, 0),
        });

        yPosition -= 12;
      });

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `enhanced-float-statement-${account.provider}-${startDate}-${endDate}.pdf`;
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
    a.download = `enhanced-float-statement-${account?.provider}-${startDate}-${endDate}.csv`;
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div>
              <Label htmlFor="includeGL">Include GL Entries</Label>
              <Select
                value={includeGL ? "true" : "false"}
                onValueChange={(value) => setIncludeGL(value === "true")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
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
                  "Refresh"
                )}
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Transactions
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summary.transactionCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.glTransactionCount} with GL entries
                  </p>
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
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Processed By</TableHead>
                  <TableHead>GL Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
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
                    <TableCell
                      className={
                        entry.amount >= 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {entry.amount >= 0 ? "+" : ""}
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell>{formatCurrency(entry.balanceAfter)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.description}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.reference}
                    </TableCell>
                    <TableCell>{entry.processedBy}</TableCell>
                    <TableCell>
                      {entry.glEntries ? (
                        <Badge variant="outline">
                          {entry.glEntries.length} entries
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
