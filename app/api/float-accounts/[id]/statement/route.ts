import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);

    // Get date range parameters
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const format = searchParams.get("format") || "csv"; // csv or json

    // Default to last 30 days if no dates provided
    const fromDate =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
    const toDate = endDate || new Date().toISOString().split("T")[0];

    // Get account details
    const account = await sql`
      SELECT fa.*, b.name as branch_name 
      FROM float_accounts fa
      LEFT JOIN branches b ON fa.branch_id = b.id
      WHERE fa.id = ${id}
    `;

    if (account.length === 0) {
      return NextResponse.json(
        { error: "Float account not found" },
        { status: 404 }
      );
    }

    // Get transactions for the specified date range
    const transactions = await sql`
      SELECT 
        ft.*,
        CASE 
          WHEN ft.transaction_type = 'recharge' THEN 'Recharge'
          WHEN ft.transaction_type = 'deposit' THEN 'Deposit'
          WHEN ft.transaction_type = 'withdrawal' THEN 'Withdrawal'
          WHEN ft.transaction_type = 'transfer' THEN 'Transfer'
          WHEN ft.transaction_type = 'adjustment' THEN 'Balance Adjustment'
          WHEN ft.transaction_type = 'fee' THEN 'Service Fee'
          ELSE ft.transaction_type
        END as transaction_type_display
      FROM float_transactions ft
      WHERE ft.float_account_id = ${id}
      AND ft.created_at >= ${fromDate}::date
      AND ft.created_at <= ${toDate}::date + INTERVAL '1 day'
      ORDER BY ft.created_at DESC
    `;

    // Get GL entries for this account in the date range
    const glEntries = await sql`
      SELECT 
        gt.source_transaction_id,
        gt.amount,
        gt.created_at,
        gje.account_id,
        gje.debit,
        gje.credit,
        gje.description
      FROM gl_transactions gt
      JOIN gl_journal_entries gje ON gt.id = gje.transaction_id
      WHERE gt.source_module IN ('momo', 'agency_banking', 'power', 'jumia', 'e_zwich')
      AND gt.created_at >= ${fromDate}::date
      AND gt.created_at <= ${toDate}::date + INTERVAL '1 day'
      ORDER BY gt.created_at DESC
    `;

    const accountData = account[0];

    // Calculate summary statistics
    const totalTransactions = transactions.length;
    const totalCredits = transactions
      .filter((tx) => Number(tx.amount) > 0)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalDebits = transactions
      .filter((tx) => Number(tx.amount) < 0)
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
    const netChange = totalCredits - totalDebits;

    if (format === "json") {
      return NextResponse.json({
        success: true,
        account: {
          id: accountData.id,
          accountType: accountData.account_type,
          provider: accountData.provider,
          branchName: accountData.branch_name,
          currentBalance: Number(accountData.current_balance),
          minThreshold: Number(accountData.min_threshold),
          maxThreshold: Number(accountData.max_threshold),
        },
        statement: {
          period: { fromDate, toDate },
          generatedAt: new Date().toISOString(),
          summary: {
            totalTransactions,
            totalCredits,
            totalDebits,
            netChange,
          },
          transactions: transactions.map((tx) => ({
            id: tx.id,
            date: tx.created_at,
            type: tx.transaction_type_display,
            amount: Number(tx.amount),
            balanceBefore: Number(tx.balance_before),
            balanceAfter: Number(tx.balance_after),
            description: tx.description,
            processedBy: tx.processed_by,
            reference: tx.reference,
          })),
          glEntries: glEntries.map((entry) => ({
            transactionId: entry.source_transaction_id,
            date: entry.created_at,
            accountId: entry.account_id,
            debit: Number(entry.debit),
            credit: Number(entry.credit),
            description: entry.description,
          })),
        },
      });
    }

    // Generate CSV content
    const headers = [
      "Date",
      "Transaction Type",
      "Amount",
      "Balance Before",
      "Balance After",
      "Description",
      "Processed By",
      "Reference",
    ];

    const csvRows = transactions.map((tx) => [
      new Date(tx.created_at).toLocaleDateString(),
      tx.transaction_type_display,
      Number(tx.amount).toFixed(2),
      Number(tx.balance_before).toFixed(2),
      Number(tx.balance_after).toFixed(2),
      tx.description || "",
      tx.processed_by || "",
      tx.reference || "",
    ]);

    const csvContent = [
      [
        `Float Account Statement - ${
          accountData.provider || accountData.account_type
        }`,
      ],
      [`Branch: ${accountData.branch_name || "Unknown"}`],
      [`Account Type: ${accountData.account_type}`],
      [
        `Current Balance: GHS ${Number(accountData.current_balance).toFixed(
          2
        )}`,
      ],
      [`Min Threshold: GHS ${Number(accountData.min_threshold).toFixed(2)}`],
      [`Max Threshold: GHS ${Number(accountData.max_threshold).toFixed(2)}`],
      [`Statement Period: ${fromDate} to ${toDate}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Total Transactions: ${totalTransactions}`],
      [`Total Credits: GHS ${totalCredits.toFixed(2)}`],
      [`Total Debits: GHS ${totalDebits.toFixed(2)}`],
      [`Net Change: GHS ${netChange.toFixed(2)}`],
      [],
      headers,
      ...csvRows,
    ]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    // Return as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${
          accountData.provider || accountData.account_type
        }-statement-${fromDate}-to-${toDate}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error generating statement:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
