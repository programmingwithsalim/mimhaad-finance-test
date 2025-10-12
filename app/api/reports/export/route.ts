"use server";

import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import * as XLSX from "xlsx";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const exportFormat = searchParams.get("format") || "csv";
    const userRole = searchParams.get("userRole");
    const userBranchId = searchParams.get("userBranchId");
    const branch = searchParams.get("branch");

    // Role-based access control
    const isAdmin = userRole === "Admin";
    const isFinance = userRole === "Finance";
    const isManager = userRole === "Manager";

    if (!isAdmin && !isFinance && !isManager) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to export reports",
        },
        { status: 403 }
      );
    }

    // Determine effective branch filter
    const effectiveBranchId = isAdmin ? branch : userBranchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? `AND branch_id = '${effectiveBranchId}'`
        : "";

    // Get transaction data organized by service
    const momoQuery = `
      SELECT 
        'MOMO' as service,
        created_at,
        amount,
        fee,
        status,
        reference,
        customer_name
      FROM momo_transactions 
      WHERE created_at::date BETWEEN '${from}' AND '${to}' ${branchFilter}
      ORDER BY created_at DESC
    `;

    const agencyQuery = `
      SELECT 
        'AGENCY BANKING' as service,
        created_at,
        amount,
        fee,
        status,
        reference,
        customer_name
      FROM agency_banking_transactions 
      WHERE created_at::date BETWEEN '${from}' AND '${to}' ${branchFilter}
      ORDER BY created_at DESC
    `;

    const ezwichQuery = `
      SELECT 
        'E-ZWICH' as service,
        created_at,
        amount,
        fee,
        status,
        reference,
        customer_name
      FROM e_zwich_withdrawals 
      WHERE created_at::date BETWEEN '${from}' AND '${to}' ${branchFilter}
      ORDER BY created_at DESC
    `;

    const powerQuery = `
      SELECT 
        'POWER' as service,
        created_at,
        amount,
        fee,
        status,
        reference,
        customer_name
      FROM power_transactions 
      WHERE created_at::date BETWEEN '${from}' AND '${to}' ${branchFilter}
      ORDER BY created_at DESC
    `;

    const jumiaQuery = `
      SELECT 
        'JUMIA' as service,
        created_at,
        amount,
        fee,
        status,
        reference,
        customer_name
      FROM jumia_transactions 
      WHERE created_at::date BETWEEN '${from}' AND '${to}' ${branchFilter}
      ORDER BY created_at DESC
    `;

    // Execute queries
    const [momoResult, agencyResult, ezwichResult, powerResult, jumiaResult] =
      await Promise.all([
        sql.unsafe(momoQuery),
        sql.unsafe(agencyQuery),
        sql.unsafe(ezwichQuery),
        sql.unsafe(powerQuery),
        sql.unsafe(jumiaQuery),
      ]);

    // Extract arrays from results
    const momoTransactions = Array.isArray(momoResult)
      ? momoResult
      : momoResult?.rows || [];
    const agencyTransactions = Array.isArray(agencyResult)
      ? agencyResult
      : agencyResult?.rows || [];
    const ezwichTransactions = Array.isArray(ezwichResult)
      ? ezwichResult
      : ezwichResult?.rows || [];
    const powerTransactions = Array.isArray(powerResult)
      ? powerResult
      : powerResult?.rows || [];
    const jumiaTransactions = Array.isArray(jumiaResult)
      ? jumiaResult
      : jumiaResult?.rows || [];

    // Combine all transactions for summary
    const allTransactions = [
      ...momoTransactions,
      ...agencyTransactions,
      ...ezwichTransactions,
      ...powerTransactions,
      ...jumiaTransactions,
    ];

    // Calculate summary data
    const totalAmount = allTransactions.reduce(
      (sum: number, t: any) => sum + Number(t.amount || 0),
      0
    );
    const totalFees = allTransactions.reduce(
      (sum: number, t: any) => sum + Number(t.fee || 0),
      0
    );

    const serviceBreakdown = {
      MOMO: {
        count: momoTransactions.length,
        amount: momoTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.amount || 0),
          0
        ),
        fees: momoTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.fee || 0),
          0
        ),
      },
      "AGENCY BANKING": {
        count: agencyTransactions.length,
        amount: agencyTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.amount || 0),
          0
        ),
        fees: agencyTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.fee || 0),
          0
        ),
      },
      "E-ZWICH": {
        count: ezwichTransactions.length,
        amount: ezwichTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.amount || 0),
          0
        ),
        fees: ezwichTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.fee || 0),
          0
        ),
      },
      POWER: {
        count: powerTransactions.length,
        amount: powerTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.amount || 0),
          0
        ),
        fees: powerTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.fee || 0),
          0
        ),
      },
      JUMIA: {
        count: jumiaTransactions.length,
        amount: jumiaTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.amount || 0),
          0
        ),
        fees: jumiaTransactions.reduce(
          (sum: number, t: any) => sum + Number(t.fee || 0),
          0
        ),
      },
    };

    // Generate export content based on format
    let content: Buffer | string = "";
    let filename = "";
    let contentType = "";

    if (exportFormat === "csv") {
      // Generate CSV content with all transactions
      const headers = [
        "Service",
        "Date",
        "Customer",
        "Amount",
        "Fee",
        "Status",
        "Reference",
      ];
      content = headers.join(",") + "\n";

      allTransactions.forEach((transaction: any) => {
        const row = [
          transaction.service,
          transaction.created_at,
          transaction.customer_name || "",
          transaction.amount,
          transaction.fee,
          transaction.status,
          transaction.reference || "",
        ]
          .map((field) => `"${field || ""}"`)
          .join(",");
        content += row + "\n";
      });

      filename = `financial-report-${from}-${to}.csv`;
      contentType = "text/csv";
    } else if (exportFormat === "excel") {
      // Generate proper Excel file with multiple sheets
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ["FINANCIAL REPORT SUMMARY"],
        ["", ""],
        ["Report Period", `${from} to ${to}`],
        ["Generated", new Date().toLocaleString()],
        ["", ""],
        ["Total Transactions", allTransactions.length],
        ["Total Amount", `GHS ${totalAmount.toLocaleString()}`],
        ["Total Fees", `GHS ${totalFees.toLocaleString()}`],
        ["", ""],
        ["Service Breakdown", "", ""],
        ["Service", "Transactions", "Amount", "Fees"],
        ...Object.entries(serviceBreakdown).map(
          ([service, data]: [string, any]) => [
            service,
            data.count,
            `GHS ${data.amount.toLocaleString()}`,
            `GHS ${data.fees.toLocaleString()}`,
          ]
        ),
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Individual service sheets
      if (momoTransactions.length > 0) {
        const momoData = [
          ["MOMO TRANSACTIONS"],
          ["", ""],
          ["Date", "Customer", "Amount", "Fee", "Status", "Reference"],
          ...momoTransactions.map((t: any) => [
            t.created_at,
            t.customer_name || "",
            Number(t.amount),
            Number(t.fee),
            t.status,
            t.reference || "",
          ]),
        ];
        const momoSheet = XLSX.utils.aoa_to_sheet(momoData);
        XLSX.utils.book_append_sheet(workbook, momoSheet, "MOMO");
      }

      if (agencyTransactions.length > 0) {
        const agencyData = [
          ["AGENCY BANKING TRANSACTIONS"],
          ["", ""],
          ["Date", "Customer", "Amount", "Fee", "Status", "Reference"],
          ...agencyTransactions.map((t: any) => [
            t.created_at,
            t.customer_name || "",
            Number(t.amount),
            Number(t.fee),
            t.status,
            t.reference || "",
          ]),
        ];
        const agencySheet = XLSX.utils.aoa_to_sheet(agencyData);
        XLSX.utils.book_append_sheet(workbook, agencySheet, "Agency Banking");
      }

      if (ezwichTransactions.length > 0) {
        const ezwichData = [
          ["E-ZWICH TRANSACTIONS"],
          ["", ""],
          ["Date", "Customer", "Amount", "Fee", "Status", "Reference"],
          ...ezwichTransactions.map((t: any) => [
            t.created_at,
            t.customer_name || "",
            Number(t.amount),
            Number(t.fee),
            t.status,
            t.reference || "",
          ]),
        ];
        const ezwichSheet = XLSX.utils.aoa_to_sheet(ezwichData);
        XLSX.utils.book_append_sheet(workbook, ezwichSheet, "E-ZWICH");
      }

      if (powerTransactions.length > 0) {
        const powerData = [
          ["POWER TRANSACTIONS"],
          ["", ""],
          ["Date", "Customer", "Amount", "Fee", "Status", "Reference"],
          ...powerTransactions.map((t: any) => [
            t.created_at,
            t.customer_name || "",
            Number(t.amount),
            Number(t.fee),
            t.status,
            t.reference || "",
          ]),
        ];
        const powerSheet = XLSX.utils.aoa_to_sheet(powerData);
        XLSX.utils.book_append_sheet(workbook, powerSheet, "Power");
      }

      if (jumiaTransactions.length > 0) {
        const jumiaData = [
          ["JUMIA TRANSACTIONS"],
          ["", ""],
          ["Date", "Customer", "Amount", "Fee", "Status", "Reference"],
          ...jumiaTransactions.map((t: any) => [
            t.created_at,
            t.customer_name || "",
            Number(t.amount),
            Number(t.fee),
            t.status,
            t.reference || "",
          ]),
        ];
        const jumiaSheet = XLSX.utils.aoa_to_sheet(jumiaData);
        XLSX.utils.book_append_sheet(workbook, jumiaSheet, "Jumia");
      }

      // All transactions sheet
      const allTransactionsData = [
        ["ALL TRANSACTIONS"],
        ["", ""],
        ["Service", "Date", "Customer", "Amount", "Fee", "Status", "Reference"],
        ...allTransactions.map((t: any) => [
          t.service,
          t.created_at,
          t.customer_name || "",
          Number(t.amount),
          Number(t.fee),
          t.status,
          t.reference || "",
        ]),
      ];

      const allTransactionsSheet = XLSX.utils.aoa_to_sheet(allTransactionsData);
      XLSX.utils.book_append_sheet(
        workbook,
        allTransactionsSheet,
        "All Transactions"
      );

      content = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      filename = `financial-report-${from}-${to}.xlsx`;
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (exportFormat === "pdf") {
      // Generate simple text-based PDF content
      let pdfContent = "";

      // Header
      pdfContent += "FINANCIAL REPORT\n";
      pdfContent += "=".repeat(50) + "\n\n";
      pdfContent += `Period: ${from} to ${to}\n`;
      pdfContent += `Generated: ${new Date().toLocaleString()}\n\n`;

      // Summary
      pdfContent += "SUMMARY\n";
      pdfContent += "-".repeat(20) + "\n";
      pdfContent += `Total Transactions: ${allTransactions.length}\n`;
      pdfContent += `Total Amount: GHS ${totalAmount.toLocaleString()}\n`;
      pdfContent += `Total Fees: GHS ${totalFees.toLocaleString()}\n\n`;

      // Service Breakdown
      pdfContent += "SERVICE BREAKDOWN\n";
      pdfContent += "-".repeat(20) + "\n";
      Object.entries(serviceBreakdown).forEach(
        ([service, data]: [string, any]) => {
          pdfContent += `${service}:\n`;
          pdfContent += `  Transactions: ${data.count}\n`;
          pdfContent += `  Amount: GHS ${data.amount.toLocaleString()}\n`;
          pdfContent += `  Fees: GHS ${data.fees.toLocaleString()}\n\n`;
        }
      );

      // Transactions by service
      if (momoTransactions.length > 0) {
        pdfContent += "MOMO TRANSACTIONS\n";
        pdfContent += "-".repeat(20) + "\n";
        momoTransactions.forEach((t: any) => {
          pdfContent += `${t.created_at} | ${
            t.customer_name || "N/A"
          } | GHS ${Number(t.amount).toLocaleString()} | GHS ${Number(
            t.fee
          ).toLocaleString()} | ${t.status}\n`;
        });
        pdfContent += "\n";
      }

      if (agencyTransactions.length > 0) {
        pdfContent += "AGENCY BANKING TRANSACTIONS\n";
        pdfContent += "-".repeat(20) + "\n";
        agencyTransactions.forEach((t: any) => {
          pdfContent += `${t.created_at} | ${
            t.customer_name || "N/A"
          } | GHS ${Number(t.amount).toLocaleString()} | GHS ${Number(
            t.fee
          ).toLocaleString()} | ${t.status}\n`;
        });
        pdfContent += "\n";
      }

      if (ezwichTransactions.length > 0) {
        pdfContent += "E-ZWICH TRANSACTIONS\n";
        pdfContent += "-".repeat(20) + "\n";
        ezwichTransactions.forEach((t: any) => {
          pdfContent += `${t.created_at} | ${
            t.customer_name || "N/A"
          } | GHS ${Number(t.amount).toLocaleString()} | GHS ${Number(
            t.fee
          ).toLocaleString()} | ${t.status}\n`;
        });
        pdfContent += "\n";
      }

      if (powerTransactions.length > 0) {
        pdfContent += "POWER TRANSACTIONS\n";
        pdfContent += "-".repeat(20) + "\n";
        powerTransactions.forEach((t: any) => {
          pdfContent += `${t.created_at} | ${
            t.customer_name || "N/A"
          } | GHS ${Number(t.amount).toLocaleString()} | GHS ${Number(
            t.fee
          ).toLocaleString()} | ${t.status}\n`;
        });
        pdfContent += "\n";
      }

      if (jumiaTransactions.length > 0) {
        pdfContent += "JUMIA TRANSACTIONS\n";
        pdfContent += "-".repeat(20) + "\n";
        jumiaTransactions.forEach((t: any) => {
          pdfContent += `${t.created_at} | ${
            t.customer_name || "N/A"
          } | GHS ${Number(t.amount).toLocaleString()} | GHS ${Number(
            t.fee
          ).toLocaleString()} | ${t.status}\n`;
        });
        pdfContent += "\n";
      }

      content = Buffer.from(pdfContent, "utf-8");
      filename = `financial-report-${from}-${to}.txt`;
      contentType = "text/plain";
    }

    // Return the file
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export report",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
