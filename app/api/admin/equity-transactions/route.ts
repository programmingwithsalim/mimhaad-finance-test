import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

// GET - Fetch all equity transactions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only Admin users can manage equity transactions
    if (user.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Ensure table exists
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

    // Fetch all equity transactions
    const transactions = await sql`
      SELECT 
        id,
        ledger_type,
        transaction_date,
        particulars,
        note_number,
        debit,
        credit,
        balance,
        description,
        created_by,
        created_at
      FROM equity_transactions
      ORDER BY transaction_date DESC, created_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    devLog.error("Error fetching equity transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch equity transactions" },
      { status: 500 }
    );
  }
}

// POST - Create new equity transaction
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only Admin users can manage equity transactions
    if (user.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
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
    } = body;

    // Validation
    if (!ledger_type || !transaction_date || !particulars) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (
      !["share_capital", "retained_earnings", "other_fund"].includes(
        ledger_type
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid ledger type" },
        { status: 400 }
      );
    }

    // Calculate running balance for this ledger type
    const balanceResult = await sql`
      SELECT COALESCE(SUM(credit - debit), 0) as current_balance
      FROM equity_transactions
      WHERE ledger_type = ${ledger_type}
    `;

    const currentBalance = Number(balanceResult[0]?.current_balance) || 0;
    const netAmount = Number(credit || 0) - Number(debit || 0);
    const newBalance = currentBalance + netAmount;

    // Insert new transaction
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
        created_by
      ) VALUES (
        ${ledger_type},
        ${transaction_date},
        ${particulars},
        ${note_number || null},
        ${Number(debit || 0)},
        ${Number(credit || 0)},
        ${newBalance},
        ${description || null},
        ${user.name || user.email}
      )
      RETURNING *
    `;

    devLog.info("Equity transaction created:", {
      ledger_type,
      particulars,
      amount: netAmount,
      balance: newBalance,
      created_by: user.name || user.email,
    });

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Equity transaction recorded successfully",
    });
  } catch (error) {
    devLog.error("Error creating equity transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create equity transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

