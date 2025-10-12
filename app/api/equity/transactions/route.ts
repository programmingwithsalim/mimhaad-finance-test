import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// GET - Retrieve equity transactions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !["Admin", "Finance", "Manager"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");
    const ledgerType = searchParams.get("ledgerType"); // share_capital, retained_earnings, other_fund

    // Create equity_transactions table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS equity_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ledger_type VARCHAR(50) NOT NULL,
        transaction_date DATE NOT NULL,
        particulars TEXT NOT NULL,
        note_number INTEGER,
        debit DECIMAL(15,2) DEFAULT 0,
        credit DECIMAL(15,2) DEFAULT 0,
        balance DECIMAL(15,2) NOT NULL,
        description TEXT,
        branch_id UUID,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CHECK (ledger_type IN ('share_capital', 'retained_earnings', 'other_fund'))
      )
    `;

    // Build query with filters
    const effectiveBranchId = user.role === "Admin" ? branch : user.branchId;

    let query = sql`
      SELECT * FROM equity_transactions
      WHERE 1=1
    `;

    if (ledgerType) {
      query = sql`${query} AND ledger_type = ${ledgerType}`;
    }

    if (effectiveBranchId && effectiveBranchId !== "all") {
      query = sql`${query} AND branch_id = ${effectiveBranchId}`;
    }

    if (from && to) {
      query = sql`${query} AND transaction_date BETWEEN ${from} AND ${to}`;
    }

    query = sql`${query} ORDER BY transaction_date ASC, created_at ASC`;

    const transactions = await query;

    // Calculate balances for each ledger type
    const shareCapitalBalance = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = 'share_capital'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    const retainedEarningsBalance = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = 'retained_earnings'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    const otherFundBalance = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = 'other_fund'
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
    `;

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        balances: {
          shareCapital: Number(shareCapitalBalance[0].balance) || 0,
          retainedEarnings: Number(retainedEarningsBalance[0].balance) || 0,
          otherFund: Number(otherFundBalance[0].balance) || 0,
          total:
            Number(shareCapitalBalance[0].balance) +
            Number(retainedEarningsBalance[0].balance) +
            Number(otherFundBalance[0].balance),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching equity transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch equity transactions" },
      { status: 500 }
    );
  }
}

// POST - Create equity transaction
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !["Admin", "Finance", "Manager"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      ledger_type,
      transaction_date,
      particulars,
      note_number,
      debit,
      credit,
      description,
      branch_id,
    } = body;

    if (!ledger_type || !transaction_date || !particulars) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get current balance for the ledger type
    const effectiveBranchId = branch_id || user.branchId;

    const currentBalanceResult = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE ledger_type = ${ledger_type}
      ${effectiveBranchId ? sql`AND branch_id = ${effectiveBranchId}` : sql``}
    `;
    const currentBalance = Number(currentBalanceResult[0].balance) || 0;

    // Calculate new balance
    const debitAmount = Number(debit) || 0;
    const creditAmount = Number(credit) || 0;
    const newBalance = currentBalance + creditAmount - debitAmount;

    // Insert transaction
    const result = await sql`
      INSERT INTO equity_transactions (
        ledger_type,
        transaction_date,
        particulars,
        note_number,
        debit,
        credit,
        balance,
        description,
        branch_id,
        created_by
      ) VALUES (
        ${ledger_type},
        ${transaction_date},
        ${particulars},
        ${note_number || null},
        ${debitAmount},
        ${creditAmount},
        ${newBalance},
        ${description || null},
        ${effectiveBranchId},
        ${user.email}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Equity transaction created successfully",
    });
  } catch (error) {
    console.error("Error creating equity transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create equity transaction" },
      { status: 500 }
    );
  }
}
