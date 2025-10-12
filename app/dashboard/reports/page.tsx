"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  TrendingUp,
  BarChart3,
  PieChart,
  Eye,
  Building2,
  AlertTriangle,
  RefreshCw,
  Download,
  Calculator,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { ReportsFilterBar } from "@/components/reports/reports-filter-bar";
import { normalizeRole } from "@/lib/rbac/unified-rbac";
import { BalanceSheet } from "@/components/reports/balance-sheet";
import { ProfitLossStatement } from "@/components/reports/profit-loss-statement";
import { EquityStatement } from "@/components/reports/equity-statement";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
  degrees,
} from "pdf-lib";

interface Branch {
  id: string;
  name: string;
  location?: string;
}

interface ReportData {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    cashPosition: number;
    profitMargin: number;
    revenueChange: number;
    expenseChange: number;
  };
  services: Array<{
    service: string;
    transactions: number;
    volume: number;
    fees: number;
  }>;
  timeSeries: Array<{
    date: string;
    revenue: number;
    expenses: number;
  }>;
  lastUpdated: string;
  note?: string;
  hasData: boolean;
  fixedAssets?: any;
  expenses?: any;
  equity?: any;
  profitLoss?: any;
  cashFlow?: any;
  balanceSheet?: any;
}

export default function ReportsPage() {
  const { user, loading: userLoading, error: userError } = useCurrentUser();
  const { toast } = useToast();

  // Determine user permissions first (using normalized roles)
  const normalizedRole = normalizeRole(user?.role);

  // Fallback: if normalization fails, try direct comparison with common variations
  const originalRole = user?.role?.toLowerCase();

  // Comprehensive role checking with multiple variations
  const isAdmin =
    normalizedRole === "Admin" ||
    originalRole === "admin" ||
    originalRole === "administrator";
  const isFinance =
    normalizedRole === "Finance" ||
    originalRole === "finance" ||
    originalRole === "financial";
  const isManager =
    normalizedRole === "Manager" ||
    originalRole === "manager" ||
    originalRole === "management";
  const isOperations =
    normalizedRole === "Operations" ||
    originalRole === "operations" ||
    originalRole === "operation";
  const isCashier =
    normalizedRole === "Cashier" ||
    originalRole === "cashier" ||
    originalRole === "cash";
  const canViewAllBranches = isAdmin;
  const userBranchId = user?.branchId;
  const userBranchName = user?.branchName;

  // Role-based access control
  const canViewReports = isAdmin || isFinance || isManager;

  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedBranch, setSelectedBranch] = useState(
    canViewAllBranches ? "all" : userBranchId || "all"
  );
  const [branches, setBranches] = useState<Branch[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper functions for date ranges
  const setQuickDateRange = (days: number) => {
    setDateRange({
      from: subDays(new Date(), days),
      to: new Date(),
    });
  };

  const setMonthRange = (months: number) => {
    const now = new Date();
    setDateRange({
      from: subMonths(now, months),
      to: now,
    });
  };

  const fetchBranches = async () => {
    if (canViewAllBranches) {
      // Admin users: fetch all branches
      try {
        const response = await fetch("/api/branches", {
          credentials: "include",
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            setBranches(result.data);
          } else if (Array.isArray(result)) {
            setBranches(result);
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    } else if (userBranchId && userBranchName) {
      // Non-admin users: set only their assigned branch and auto-select it
      setBranches([{ id: userBranchId, name: userBranchName }]);
      setSelectedBranch(userBranchId); // Auto-select their branch
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use UNIFIED API - Single call instead of 7 separate calls
      const response = await fetch(
        `/api/reports/unified?from=${format(
          dateRange.from,
          "yyyy-MM-dd"
        )}&to=${format(dateRange.to, "yyyy-MM-dd")}&branch=${selectedBranch}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch report data");
      }

      const result = await response.json();

      if (result.success) {
        setReportData(result.data);
      } else {
        setError(result.error || "Failed to fetch report data");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch report data"
      );
    } finally {
      setLoading(false);
    }
  };

  const exportReportPDF = async (reportType: string, data: any) => {
    try {
      // Fallback for dateRange if it's not available
      const currentDateRange = dateRange || {
        from: subDays(new Date(), 30),
        to: new Date(),
      };

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Embed the logo image
      let logoImage;
      try {
        const logoResponse = await fetch("/logo.png");
        const logoArrayBuffer = await logoResponse.arrayBuffer();
        logoImage = await pdfDoc.embedPng(logoArrayBuffer);
      } catch (logoError) {
        logoImage = null;
      }

      // Add watermark
      const watermarkText = "Mimhaad Ventures";
      const watermarkFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Draw watermark diagonally across the page
      page.drawText(watermarkText, {
        x: width / 2 - 100,
        y: height / 2 + 50,
        size: 48,
        font: watermarkFont,
        color: rgb(0.9, 0.9, 0.9), // Very light gray
        rotate: degrees(-45), // Rotate 45 degrees
        opacity: 0.1, // Very transparent
      });

      // Header with logo
      const companyName = "Mimhaad Financial Services";
      const reportTitle = `${reportType} Report`;
      const dateRangeText = `${format(
        currentDateRange.from,
        "MMM dd, yyyy"
      )} - ${format(currentDateRange.to, "MMM dd, yyyy")}`;
      const branchInfo =
        selectedBranch === "all"
          ? "All Branches"
          : branches.find((b) => b.id === selectedBranch)?.name ||
            "Unknown Branch";

      // Draw header with logo
      if (logoImage) {
        // Draw the actual logo image
        const logoWidth = 60;
        const logoHeight = (logoImage.height * logoWidth) / logoImage.width;
        page.drawImage(logoImage, {
          x: 50,
          y: height - 80,
          width: logoWidth,
          height: logoHeight,
        });

        // Draw company name next to logo
        page.drawText(companyName, {
          x: 130,
          y: height - 60,
          size: 18,
          font: boldFont,
        });
      } else {
        // Fallback to text logo if image fails to load
        page.drawText("MFS", {
          x: 50,
          y: height - 60,
          size: 32,
          font: boldFont,
          color: rgb(0.2, 0.4, 0.8),
        });

        page.drawText(companyName, {
          x: 50,
          y: height - 100,
          size: 18,
          font: boldFont,
        });
      }

      page.drawText(reportTitle, {
        x: 50,
        y: height - 130,
        size: 16,
        font: boldFont,
      });

      page.drawText(`Period: ${dateRangeText}`, {
        x: 50,
        y: height - 160,
        size: 12,
        font: font,
      });

      page.drawText(`Branch: ${branchInfo}`, {
        x: 50,
        y: height - 175,
        size: 12,
        font: font,
      });

      page.drawText(
        `Generated: ${format(new Date(), "MMM dd, yyyy 'at' HH:mm")}`,
        {
          x: 50,
          y: height - 190,
          size: 12,
          font: font,
        }
      );

      // Draw separator line
      page.drawLine({
        start: { x: 50, y: height - 210 },
        end: { x: width - 50, y: height - 210 },
        thickness: 2,
        color: rgb(0.2, 0.4, 0.8),
      });

      let yPosition = height - 260;

      // Draw report content based on type
      switch (reportType) {
        case "Summary":
          yPosition = drawSummaryContent(page, data, yPosition, font, boldFont);
          break;
        case "Balance Sheet":
          yPosition = drawBalanceSheetContent(
            page,
            data,
            yPosition,
            font,
            boldFont
          );
          break;
        case "Profit & Loss":
          yPosition = drawProfitLossContent(
            page,
            data,
            yPosition,
            font,
            boldFont
          );
          break;
        case "Equity":
          yPosition = drawEquityContent(page, data, yPosition, font, boldFont);
          break;
        case "Cash Flow":
          yPosition = drawCashFlowContent(
            page,
            data,
            yPosition,
            font,
            boldFont
          );
          break;
        case "Fixed Assets":
          yPosition = drawFixedAssetsContent(
            page,
            data,
            yPosition,
            font,
            boldFont
          );
          break;
        case "Expenses":
          yPosition = drawExpensesContent(
            page,
            data,
            yPosition,
            font,
            boldFont
          );
          break;
      }

      // Footer
      page.drawText("Mimhaad Financial Services - Confidential", {
        x: width / 2 - 100,
        y: 30,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType
        .toLowerCase()
        .replace(/\s+/g, "-")}-report-${format(
        currentDateRange.from,
        "yyyy-MM-dd"
      )}-${format(currentDateRange.to, "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `${reportType} report exported as PDF`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Helper functions to draw content for each report type
  const drawSummaryContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    // Key Metrics
    page.drawText("Financial Summary", {
      x: 50,
      y,
      size: 16,
      font: boldFont,
    });
    y -= 30;

    const metrics = [
      {
        label: "Total Revenue",
        value: `GHS ${data.summary.totalRevenue.toLocaleString()}`,
      },
      {
        label: "Total Expenses",
        value: `GHS ${data.summary.totalExpenses.toLocaleString()}`,
      },
      {
        label: "Net Income",
        value: `GHS ${data.summary.netIncome.toLocaleString()}`,
      },
      {
        label: "Cash Position",
        value: `GHS ${data.summary.cashPosition.toLocaleString()}`,
      },
    ];

    metrics.forEach((metric) => {
      page.drawText(metric.label, {
        x: 50,
        y,
        size: 12,
        font: boldFont,
      });
      page.drawText(metric.value, {
        x: 300,
        y,
        size: 12,
        font: font,
      });
      y -= 20;
    });

    return y;
  };

  const drawBalanceSheetContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    // Assets
    page.drawText("ASSETS", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    page.drawText("Current Assets:", {
      x: 60,
      y,
      size: 12,
      font: boldFont,
    });
    y -= 20;

    page.drawText("Cash & Cash Equivalents", {
      x: 80,
      y,
      size: 10,
      font: font,
    });
    page.drawText(
      `GHS ${getValue(
        data.assets.current.cashAndCashEquivalents
      ).toLocaleString()}`,
      {
        x: 400,
        y,
        size: 10,
        font: font,
      }
    );
    y -= 15;

    page.drawText("Accounts Receivable", {
      x: 80,
      y,
      size: 10,
      font: font,
    });
    page.drawText(
      `GHS ${getValue(
        data.assets.current.accountsReceivable
      ).toLocaleString()}`,
      {
        x: 400,
        y,
        size: 10,
        font: font,
      }
    );
    y -= 15;

    page.drawText("Inventory", {
      x: 80,
      y,
      size: 10,
      font: font,
    });
    page.drawText(
      `GHS ${getValue(data.assets.current.closingInventory).toLocaleString()}`,
      {
        x: 400,
        y,
        size: 10,
        font: font,
      }
    );
    y -= 20;

    page.drawText("Fixed Assets:", {
      x: 60,
      y,
      size: 12,
      font: boldFont,
    });
    y -= 20;

    page.drawText("Net Fixed Assets", {
      x: 80,
      y,
      size: 10,
      font: font,
    });
    page.drawText(
      `GHS ${getValue(
        data.assets.nonCurrent?.fixedAssetsNet
      ).toLocaleString()}`,
      {
        x: 400,
        y,
        size: 10,
        font: font,
      }
    );
    y -= 25;

    page.drawText("Total Assets", {
      x: 50,
      y,
      size: 12,
      font: boldFont,
    });
    page.drawText(
      `GHS ${data.assets.totalAssets?.toLocaleString() || "0.00"}`,
      {
        x: 400,
        y,
        size: 12,
        font: boldFont,
      }
    );

    return y;
  };

  const drawProfitLossContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    // Revenue
    page.drawText("REVENUE", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    data.revenue.breakdown.forEach((service: any) => {
      page.drawText(service.service, {
        x: 60,
        y,
        size: 10,
        font: font,
      });
      page.drawText(`GHS ${service.revenue.toLocaleString()}`, {
        x: 400,
        y,
        size: 10,
        font: font,
      });
      y -= 15;
    });

    y -= 10;
    page.drawText("Total Revenue", {
      x: 50,
      y,
      size: 12,
      font: boldFont,
    });
    page.drawText(`GHS ${data.revenue.total.toLocaleString()}`, {
      x: 400,
      y,
      size: 12,
      font: boldFont,
    });

    return y;
  };

  const drawFixedAssetsContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    page.drawText("Fixed Assets Summary", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    const summary = data.summary;
    const metrics = [
      { label: "Total Assets", value: summary.totalAssets },
      { label: "Total Value", value: summary.totalCurrentValue },
      { label: "Purchase Cost", value: summary.totalPurchaseCost },
    ];

    metrics.forEach((metric) => {
      page.drawText(metric.label, {
        x: 60,
        y,
        size: 10,
        font: font,
      });
      page.drawText(`GHS ${metric.value.toLocaleString()}`, {
        x: 400,
        y,
        size: 10,
        font: font,
      });
      y -= 20;
    });

    return y;
  };

  const drawExpensesContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    page.drawText("Expenses Summary", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    const summary = data.summary;
    const metrics = [
      { label: "Total Expenses", value: summary.totalAmount },
      { label: "Paid Expenses", value: summary.paidAmount },
      { label: "Pending Expenses", value: summary.pendingAmount },
    ];

    metrics.forEach((metric) => {
      page.drawText(metric.label, {
        x: 60,
        y,
        size: 10,
        font: font,
      });
      page.drawText(`GHS ${metric.value.toLocaleString()}`, {
        x: 400,
        y,
        size: 10,
        font: font,
      });
      y -= 20;
    });

    return y;
  };

  const drawEquityContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    if (!data) {
      page.drawText("No equity data available", {
        x: 50,
        y,
        size: 12,
        font: font,
      });
      return y - 30;
    }

    // Title
    page.drawText("Equity Report", {
      x: 50,
      y,
      size: 16,
      font: boldFont,
    });
    y -= 30;

    // Summary
    page.drawText("Summary", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    page.drawText(
      `Total Equity: GHS ${data.summary?.totalEquity?.toLocaleString() || "0"}`,
      {
        x: 50,
        y,
        size: 12,
        font: font,
      }
    );
    y -= 30;

    // Components
    if (data.components && data.components.length > 0) {
      page.drawText("Equity Components", {
        x: 50,
        y,
        size: 14,
        font: boldFont,
      });
      y -= 25;

      data.components.forEach((component: any) => {
        page.drawText(
          `${component.name}: GHS ${component.amount.toLocaleString()}`,
          {
            x: 70,
            y,
            size: 12,
            font: font,
          }
        );
        y -= 20;
      });
    }

    return y;
  };

  const drawCashFlowContent = (
    page: PDFPage,
    data: any,
    startY: number,
    font: PDFFont,
    boldFont: PDFFont
  ) => {
    let y = startY;

    if (!data) {
      page.drawText("No cash flow data available", {
        x: 50,
        y,
        size: 12,
        font: font,
      });
      return y - 30;
    }

    // Title
    page.drawText("Cash Flow Statement", {
      x: 50,
      y,
      size: 16,
      font: boldFont,
    });
    y -= 30;

    // Operating Activities
    page.drawText("Operating Activities", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    page.drawText(
      `Net Income: GHS ${
        data.operatingActivities?.netIncome?.toLocaleString() || "0"
      }`,
      {
        x: 70,
        y,
        size: 12,
        font: font,
      }
    );
    y -= 20;

    page.drawText(
      `Net Cash from Operations: GHS ${
        data.operatingActivities?.netCashFromOperations?.toLocaleString() || "0"
      }`,
      {
        x: 70,
        y,
        size: 12,
        font: font,
      }
    );
    y -= 30;

    // Investing Activities
    page.drawText("Investing Activities", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    page.drawText(
      `Net Cash from Investing: GHS ${
        data.investingActivities?.netCashFromInvesting?.toLocaleString() || "0"
      }`,
      {
        x: 70,
        y,
        size: 12,
        font: font,
      }
    );
    y -= 30;

    // Financing Activities
    page.drawText("Financing Activities", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    page.drawText(
      `Net Cash from Financing: GHS ${
        data.financingActivities?.netCashFromFinancing?.toLocaleString() || "0"
      }`,
      {
        x: 70,
        y,
        size: 12,
        font: font,
      }
    );
    y -= 30;

    // Summary
    page.drawText("Summary", {
      x: 50,
      y,
      size: 14,
      font: boldFont,
    });
    y -= 25;

    page.drawText(
      `Net Change in Cash: GHS ${
        data.summary?.netChangeInCash?.toLocaleString() || "0"
      }`,
      {
        x: 70,
        y,
        size: 12,
        font: font,
      }
    );
    y -= 20;

    page.drawText(
      `Ending Cash Balance: GHS ${
        data.summary?.endingCashBalance?.toLocaleString() || "0"
      }`,
      {
        x: 70,
        y,
        size: 12,
        font: font,
      }
    );

    return y - 30;
  };

  useEffect(() => {
    fetchBranches();
    // Set initial branch selection based on user role
    if (!canViewAllBranches && userBranchId) {
      setSelectedBranch(userBranchId);
    }
  }, []);

  useEffect(() => {
    if (canViewReports) {
      fetchReportData();
    }
  }, [dateRange, selectedBranch, canViewReports]);

  // Helper function to extract value from note-value objects
  const getValue = (noteValue: any): number => {
    if (noteValue === null || noteValue === undefined) return 0;
    if (typeof noteValue === "number") return noteValue;
    if (typeof noteValue === "object" && "value" in noteValue) {
      return noteValue.value || 0;
    }
    return 0;
  };

  // If user data is not loaded yet, show loading
  if (userLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Loading User Data</h3>
              <p className="text-muted-foreground">
                Please wait while we load your user information...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there's an error loading user data
  if (userError || !user) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            {userError ||
              "Failed to load user data. Please refresh the page or contact support."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If user doesn't have permission to view reports
  if (!canViewReports) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            You don't have permission to view financial reports. Please contact
            your administrator. (Role: {user?.role || "Unknown"})
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Financial Reports
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate and view comprehensive financial reports
          </p>

          {/* Branch and Role Info */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className="flex items-center gap-2 px-3 py-1"
            >
              {canViewAllBranches ? (
                selectedBranch === "all" ? (
                  <>
                    <Eye className="h-4 w-4" />
                    All Branches
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4" />
                    {branches.find((b) => b.id === selectedBranch)?.name ||
                      "Selected Branch"}
                  </>
                )
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  {userBranchName || "Your Branch"}
                </>
              )}
            </Badge>
            {user?.role && (
              <Badge variant="secondary" className="px-3 py-1">
                {user.role}
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchReportData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            onClick={() => exportReportPDF("Summary", reportData)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <ReportsFilterBar
        dateRange={dateRange}
        setDateRange={setDateRange}
        branches={branches}
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
        canViewAllBranches={canViewAllBranches}
        onApply={fetchReportData}
        onReset={() => {
          setDateRange({ from: subDays(new Date(), 30), to: new Date() });
          if (canViewAllBranches) {
            setSelectedBranch("all");
          } else {
            setSelectedBranch(userBranchId || "all");
          }
          fetchReportData();
        }}
        loading={loading}
      />

      {/* Alerts */}
      {reportData && !reportData.hasData && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            No transaction data found for the selected date range. Try adjusting
            the date range or create some transactions first.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            {error} - Please try again or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      )}

      {reportData?.note && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            {reportData.note}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Loading Reports</h3>
              <p className="text-muted-foreground">
                Fetching financial data...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Reports Tabs */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="equity">Equity</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
          <TabsTrigger value="fixed-assets">Fixed Assets</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        {canViewReports && (
          <TabsContent value="summary" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Financial Summary</CardTitle>
                    <CardDescription>
                      Overview of financial performance for the selected period
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => exportReportPDF("Summary", reportData)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData ? (
                  <div className="space-y-8">
                    {/* Key Metrics */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Total Revenue
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              GHS{" "}
                              {reportData.summary.totalRevenue.toLocaleString()}
                            </p>
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
                              {reportData.summary.totalExpenses.toLocaleString()}
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
                              {reportData.summary.netIncome.toLocaleString()}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Cash Position
                            </p>
                            <p className="text-2xl font-bold text-purple-600">
                              GHS{" "}
                              {reportData.summary.cashPosition.toLocaleString()}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Service Breakdown */}
                    {reportData.services && reportData.services.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold">
                          Service Performance
                        </h3>
                        <div className="space-y-3">
                          {reportData.services.map((service, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center py-3 border-b border-gray-100"
                            >
                              <div>
                                <span className="font-medium">
                                  {service.service}
                                </span>
                                <p className="text-sm text-muted-foreground">
                                  {service.transactions} transactions
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-green-600">
                                  GHS {service.volume.toLocaleString()}
                                </span>
                                <p className="text-sm text-muted-foreground">
                                  Fees: GHS {service.fees.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Summary Data
                    </h3>
                    <p className="text-muted-foreground">
                      No financial data available for the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="balance-sheet" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Balance Sheet</CardTitle>
                    <CardDescription>
                      Assets, liabilities, and equity as of the selected date
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportReportPDF("Balance Sheet", reportData?.balanceSheet)
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData?.balanceSheet ? (
                  <div className="space-y-8">
                    {/* Assets Section */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-green-600">
                        Assets
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Cash & Cash Equivalents
                          </span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {getValue(
                              reportData.balanceSheet.assets.current
                                .cashAndCashEquivalents
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Accounts Receivable
                          </span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {getValue(
                              reportData.balanceSheet.assets.current
                                .accountsReceivable
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">Inventory</span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {getValue(
                              reportData.balanceSheet.assets.current
                                .closingInventory
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-green-200 font-bold text-lg">
                          <span>Total Current Assets</span>
                          <span className="text-green-600">
                            GHS{" "}
                            {reportData.balanceSheet.assets.current.total?.toLocaleString() ||
                              "0.00"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Fixed Assets (Net)
                          </span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {getValue(
                              reportData.balanceSheet.assets.nonCurrent
                                ?.fixedAssetsNet
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-green-200 font-bold text-lg">
                          <span>Total Assets</span>
                          <span className="text-green-600">
                            GHS{" "}
                            {reportData.balanceSheet.assets.totalAssets?.toLocaleString() ||
                              "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Liabilities Section */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-red-600">
                        Liabilities
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">Accounts Payable</span>
                          <span className="font-semibold text-red-600">
                            GHS{" "}
                            {getValue(
                              reportData.balanceSheet.liabilities.current
                                .accountsPayable
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-red-200 font-bold text-lg">
                          <span>Total Liabilities</span>
                          <span className="text-red-600">
                            GHS{" "}
                            {reportData.balanceSheet.liabilities.totalLiabilities?.toLocaleString() ||
                              "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Equity Section */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-blue-600">
                        Equity
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">Retained Earnings</span>
                          <span className="font-semibold text-blue-600">
                            GHS{" "}
                            {getValue(
                              reportData.balanceSheet.equity.shareholdersFund
                                ?.retainedEarnings
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-blue-200 font-bold text-lg">
                          <span>Total Equity</span>
                          <span className="text-blue-600">
                            GHS{" "}
                            {reportData.balanceSheet.equity.shareholdersFund?.total?.toLocaleString() ||
                              "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Check */}
                    <div className="space-y-4">
                      <div
                        className={`flex justify-between items-center py-6 border-t-2 border-b-2 font-bold text-xl px-4 rounded-lg ${
                          reportData.balanceSheet.summary.balanceCheck
                            ? "border-green-200 bg-green-50 text-green-600"
                            : "border-red-200 bg-red-50 text-red-600"
                        }`}
                      >
                        <span>Total Assets = Liabilities + Equity</span>
                        <span>
                          GHS{" "}
                          {reportData.balanceSheet.assets.totalAssets?.toLocaleString() ||
                            "0.00"}
                          {reportData.balanceSheet.summary?.balanceCheck
                            ? " ✓"
                            : " ✗"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Balance Sheet Data
                    </h3>
                    <p className="text-muted-foreground">
                      No transaction data available for balance sheet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="profit-loss" className="space-y-6">
            <ProfitLossStatement
              dateRange={dateRange}
              branch={selectedBranch}
            />
          </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="fixed-assets" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Fixed Assets</CardTitle>
                    <CardDescription>
                      Property, plant, and equipment details
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportReportPDF("Fixed Assets", reportData?.fixedAssets)
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData?.fixedAssets ? (
                  <div className="space-y-8">
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Total Assets
                            </p>
                            <p className="text-2xl font-bold text-blue-600">
                              {reportData.fixedAssets.summary?.totalAssets ||
                                "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Total Value
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              GHS{" "}
                              {reportData.fixedAssets.summary?.totalCurrentValue?.toLocaleString() ||
                                "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Purchase Cost
                            </p>
                            <p className="text-2xl font-bold text-purple-600">
                              GHS{" "}
                              {reportData.fixedAssets.summary?.totalPurchaseCost?.toLocaleString() ||
                                "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Asset Details */}
                    {reportData.fixedAssets.assets &&
                      reportData.fixedAssets.assets.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold">
                            Asset Details
                          </h3>
                          <div className="space-y-3">
                            {reportData.fixedAssets.assets.map(
                              (asset: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center py-3 border-b border-gray-100"
                                >
                                  <div>
                                    <span className="font-medium">
                                      {asset.name}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      {asset.category} - {asset.status}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-semibold">
                                      GHS{" "}
                                      {asset.current_value?.toLocaleString() ||
                                        "0"}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      Cost: GHS{" "}
                                      {asset.purchase_cost?.toLocaleString() ||
                                        "0"}
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Category Breakdown */}
                    {reportData.fixedAssets.categoryBreakdown &&
                      reportData.fixedAssets.categoryBreakdown.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold">
                            Category Breakdown
                          </h3>
                          <div className="space-y-3">
                            {reportData.fixedAssets.categoryBreakdown.map(
                              (category: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center py-3 border-b border-gray-100"
                                >
                                  <div>
                                    <span className="font-medium">
                                      {category.category}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      {category.count} assets
                                    </p>
                                  </div>
                                  <span className="font-semibold">
                                    GHS{" "}
                                    {category.total_value?.toLocaleString() ||
                                      "0"}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Fixed Assets Data
                    </h3>
                    <p className="text-muted-foreground">
                      No fixed assets data available for the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="expenses" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Expenses Report</CardTitle>
                    <CardDescription>
                      Operating and administrative expenses breakdown
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportReportPDF("Expenses", reportData?.expenses)
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData?.expenses ? (
                  <div className="space-y-8">
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border-l-4 border-l-red-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Total Expenses
                            </p>
                            <p className="text-2xl font-bold text-red-600">
                              GHS{" "}
                              {reportData.expenses.summary?.totalAmount?.toLocaleString() ||
                                "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Paid Expenses
                            </p>
                            <p className="text-2xl font-bold text-orange-600">
                              GHS{" "}
                              {reportData.expenses.summary?.paidAmount?.toLocaleString() ||
                                "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Pending
                            </p>
                            <p className="text-2xl font-bold text-purple-600">
                              GHS{" "}
                              {reportData.expenses.summary?.pendingAmount?.toLocaleString() ||
                                "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Expense Categories */}
                    {reportData.expenses.categoryBreakdown &&
                      reportData.expenses.categoryBreakdown.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold">
                            Expense Categories
                          </h3>
                          <div className="space-y-3">
                            {reportData.expenses.categoryBreakdown.map(
                              (category: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center py-3 border-b border-gray-100"
                                >
                                  <div>
                                    <span className="font-medium">
                                      {category.category}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      {category.count} expenses
                                    </p>
                                  </div>
                                  <span className="font-semibold text-red-600">
                                    GHS{" "}
                                    {category.total_amount?.toLocaleString() ||
                                      "0"}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Expense Head Breakdown */}
                    {reportData.expenses.expenseHeadBreakdown &&
                      reportData.expenses.expenseHeadBreakdown.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold">
                            Expense Head Breakdown
                          </h3>
                          <div className="space-y-3">
                            {reportData.expenses.expenseHeadBreakdown
                              .slice(0, 10)
                              .map((head: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center py-3 border-b border-gray-100"
                                >
                                  <div>
                                    <span className="font-medium">
                                      {head.expense_head}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      {head.category}
                                    </p>
                                  </div>
                                  <span className="font-semibold text-red-600">
                                    GHS{" "}
                                    {head.total_amount?.toLocaleString() || "0"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Expenses Data
                    </h3>
                    <p className="text-muted-foreground">
                      No expenses data available for the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="equity" className="space-y-6">
            <EquityStatement dateRange={dateRange} branch={selectedBranch} />
          </TabsContent>
        )}

        {canViewReports && false && (
          <TabsContent value="equity-old" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Statement of Equity (Old)</CardTitle>
                    <CardDescription>
                      Changes in equity for the selected period
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportReportPDF("Equity", reportData?.equity)
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData?.equity ? (
                  <div className="space-y-8">
                    {/* Summary */}
                    <div className="grid gap-4 md:grid-cols-3">
                      <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Total Equity
                            </p>
                            <p className="text-2xl font-bold text-blue-600">
                              GHS{" "}
                              {reportData.equity.summary.totalEquity.toLocaleString()}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Share Capital
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              GHS{" "}
                              {reportData.equity.components
                                .find((c: any) => c.name === "Share Capital")
                                ?.amount.toLocaleString() || "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              Retained Earnings
                            </p>
                            <p className="text-2xl font-bold text-purple-600">
                              GHS{" "}
                              {reportData.equity.components
                                .find(
                                  (c: any) => c.name === "Retained Earnings"
                                )
                                ?.amount.toLocaleString() || "0"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Equity Components */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold">
                        Equity Components
                      </h3>
                      <div className="space-y-3">
                        {reportData.equity.components.map(
                          (component: any, index: number) => (
                            <div
                              key={index}
                              className="flex justify-between items-center py-3 border-b border-gray-100"
                            >
                              <div>
                                <span className="font-medium">
                                  {component.name}
                                </span>
                                <p className="text-sm text-muted-foreground">
                                  {component.description}
                                </p>
                              </div>
                              <span className="font-semibold text-blue-600">
                                GHS {component.amount.toLocaleString()}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Equity Transactions */}
                    {reportData.equity.transactions &&
                      reportData.equity.transactions.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold">
                            Equity Transactions
                          </h3>
                          <div className="space-y-3">
                            {reportData.equity.transactions
                              .slice(0, 10)
                              .map((transaction: any, index: number) => (
                                <div
                                  key={index}
                                  className="flex justify-between items-center py-3 border-b border-gray-100"
                                >
                                  <div>
                                    <span className="font-medium">
                                      {transaction.source_name}
                                    </span>
                                    <p className="text-sm text-muted-foreground">
                                      {transaction.source} -{" "}
                                      {transaction.status}
                                    </p>
                                  </div>
                                  <span className="font-semibold text-blue-600">
                                    GHS {transaction.amount.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Equity Data
                    </h3>
                    <p className="text-muted-foreground">
                      No equity data available for the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewReports && (
          <TabsContent value="cash-flow" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cash Flow Statement</CardTitle>
                    <CardDescription>
                      Cash flows from operating, investing, and financing
                      activities
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportReportPDF("Cash Flow", reportData?.cashFlow)
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reportData?.cashFlow ? (
                  <div className="space-y-8">
                    {/* Operating Activities */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-green-600">
                        Operating Activities
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">Net Income</span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {reportData.cashFlow.operatingActivities.netIncome.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">Depreciation</span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {reportData.cashFlow.operatingActivities.depreciation.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Changes in Accounts Receivable
                          </span>
                          <span className="font-semibold text-red-600">
                            GHS{" "}
                            {reportData.cashFlow.operatingActivities.accountsReceivable.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Changes in Accounts Payable
                          </span>
                          <span className="font-semibold text-green-600">
                            GHS{" "}
                            {reportData.cashFlow.operatingActivities.accountsPayable.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-green-200 font-bold text-lg">
                          <span>Net Cash from Operating Activities</span>
                          <span className="text-green-600">
                            GHS{" "}
                            {reportData.cashFlow.operatingActivities.netCashFromOperations.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Investing Activities */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-blue-600">
                        Investing Activities
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Purchase of Fixed Assets
                          </span>
                          <span className="font-semibold text-red-600">
                            GHS{" "}
                            {reportData.cashFlow.investingActivities.purchaseOfFixedAssets.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-blue-200 font-bold text-lg">
                          <span>Net Cash from Investing Activities</span>
                          <span className="text-blue-600">
                            GHS{" "}
                            {reportData.cashFlow.investingActivities.netCashFromInvesting.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financing Activities */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-purple-600">
                        Financing Activities
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">Dividends Paid</span>
                          <span className="font-semibold text-red-600">
                            GHS{" "}
                            {reportData.cashFlow.financingActivities.dividendsPaid.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 border-t-2 border-purple-200 font-bold text-lg">
                          <span>Net Cash from Financing Activities</span>
                          <span className="text-purple-600">
                            GHS{" "}
                            {reportData.cashFlow.financingActivities.netCashFromFinancing.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="space-y-4">
                      <h3 className="text-xl font-semibold text-gray-600">
                        Summary
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center py-4 border-t-2 border-b-2 border-gray-200 font-bold text-xl">
                          <span>Net Change in Cash</span>
                          <span className="text-gray-600">
                            GHS{" "}
                            {reportData.cashFlow.summary.netChangeInCash.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-gray-100">
                          <span className="font-medium">
                            Ending Cash Balance
                          </span>
                          <span className="font-semibold text-gray-600">
                            GHS{" "}
                            {reportData.cashFlow.summary.endingCashBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Cash Flow Data
                    </h3>
                    <p className="text-muted-foreground">
                      No cash flow data available for the selected period.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
