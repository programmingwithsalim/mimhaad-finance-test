import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const branch = searchParams.get("branch");

    const effectiveBranchId = user.role === "Admin" ? branch : user.branchId;

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

    // Get opening balances (transactions before 'from' date)
    const openingBalances = await sql`
      SELECT 
        ledger_type,
        COALESCE(SUM(credit - debit), 0) as balance
      FROM equity_transactions
      WHERE transaction_date < ${from || "1900-01-01"}
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      GROUP BY ledger_type
    `;

    const opening = {
      shareCapital:
        openingBalances.find((b) => b.ledger_type === "share_capital")
          ?.balance || 0,
      retainedEarnings:
        openingBalances.find((b) => b.ledger_type === "retained_earnings")
          ?.balance || 0,
      otherFund:
        openingBalances.find((b) => b.ledger_type === "other_fund")?.balance ||
        0,
    };
    opening.shareCapital = Number(opening.shareCapital);
    opening.retainedEarnings = Number(opening.retainedEarnings);
    opening.otherFund = Number(opening.otherFund);

    // Get period transactions grouped by note
    const periodTransactions = await sql`
      SELECT 
        note_number,
        particulars,
        ledger_type,
        COALESCE(SUM(debit), 0) as total_debit,
        COALESCE(SUM(credit), 0) as total_credit
      FROM equity_transactions
      WHERE transaction_date BETWEEN ${from || "1900-01-01"} AND ${
      to || "2100-12-31"
    }
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      GROUP BY note_number, particulars, ledger_type
      ORDER BY note_number, ledger_type
    `;

    // Get income for the year from profit & loss
    const revenueResult = await sql`
      SELECT COALESCE(SUM(fee), 0) as total_fees
      FROM (
        SELECT fee FROM agency_banking_transactions WHERE status = 'completed' 
          ${
            effectiveBranchId && effectiveBranchId !== "all"
              ? sql`AND branch_id = ${effectiveBranchId}`
              : sql``
          }
          ${
            from && to
              ? sql`AND created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }
        UNION ALL
        SELECT fee FROM momo_transactions WHERE status = 'completed'
          ${
            effectiveBranchId && effectiveBranchId !== "all"
              ? sql`AND branch_id = ${effectiveBranchId}`
              : sql``
          }
          ${
            from && to
              ? sql`AND created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }
        UNION ALL
        SELECT fee FROM e_zwich_withdrawals WHERE status = 'completed'
          ${
            effectiveBranchId && effectiveBranchId !== "all"
              ? sql`AND branch_id = ${effectiveBranchId}`
              : sql``
          }
          ${
            from && to
              ? sql`AND created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }
        UNION ALL
        SELECT fee FROM power_transactions WHERE status = 'completed'
          ${
            effectiveBranchId && effectiveBranchId !== "all"
              ? sql`AND branch_id = ${effectiveBranchId}`
              : sql``
          }
          ${
            from && to
              ? sql`AND created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }
        UNION ALL
        SELECT COALESCE(fee, 0) FROM jumia_transactions WHERE status = 'completed'
          ${
            effectiveBranchId && effectiveBranchId !== "all"
              ? sql`AND branch_id = ${effectiveBranchId}`
              : sql``
          }
          ${
            from && to
              ? sql`AND created_at::date BETWEEN ${from} AND ${to}`
              : sql``
          }
      ) all_fees
    `;
    const totalFees = Number(revenueResult[0].total_fees) || 0;

    const commissionsResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_commissions
      FROM commissions 
      WHERE status IN ('approved', 'paid')
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${
        from && to ? sql`AND created_at::date BETWEEN ${from} AND ${to}` : sql``
      }
    `;
    const totalCommissions =
      Number(commissionsResult[0].total_commissions) || 0;

    const expensesResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses 
      WHERE status IN ('approved', 'paid')
      ${
        effectiveBranchId && effectiveBranchId !== "all"
          ? sql`AND branch_id = ${effectiveBranchId}`
          : sql``
      }
      ${
        from && to ? sql`AND created_at::date BETWEEN ${from} AND ${to}` : sql``
      }
    `;
    const totalExpenses = Number(expensesResult[0].total_expenses) || 0;

    const incomeForTheYear = totalFees + totalCommissions - totalExpenses;

    // Build movements array
    const movements = [];

    // Group transactions by note
    const noteGroups = new Map();
    periodTransactions.forEach((txn) => {
      const key = `${txn.note_number}-${txn.particulars}`;
      if (!noteGroups.has(key)) {
        noteGroups.set(key, {
          note: txn.note_number,
          particulars: txn.particulars,
          shareCapital: 0,
          retainedEarnings: 0,
          otherFund: 0,
        });
      }
      const group = noteGroups.get(key);
      const netAmount = Number(txn.total_credit) - Number(txn.total_debit);

      if (txn.ledger_type === "share_capital") {
        group.shareCapital = netAmount;
      } else if (txn.ledger_type === "retained_earnings") {
        group.retainedEarnings = netAmount;
      } else if (txn.ledger_type === "other_fund") {
        group.otherFund = netAmount;
      }
    });

    noteGroups.forEach((group) => movements.push(group));

    // Add income for the year if not already in movements
    const hasIncomeEntry = movements.some((m) => m.note === 24);
    if (!hasIncomeEntry) {
      movements.push({
        note: 24,
        particulars: "Income for the Year",
        shareCapital: 0,
        retainedEarnings: incomeForTheYear,
        otherFund: 0,
      });
    }

    // Add standard rows for completeness (Note 23, 25, 26) even if zero
    const standardNotes = [
      {
        note: 23,
        particulars: "Issue of Share Capital",
        ledger: "shareCapital",
      },
      { note: 25, particulars: "Other Fund Adjustments", ledger: "otherFund" },
      {
        note: 26,
        particulars: "Dividends Declared",
        ledger: "retainedEarnings",
      },
    ];

    for (const standard of standardNotes) {
      const exists = movements.some((m) => m.note === standard.note);
      if (!exists) {
        movements.push({
          note: standard.note,
          particulars: standard.particulars,
          shareCapital: 0,
          retainedEarnings: 0,
          otherFund: 0,
        });
      }
    }

    // Sort movements by note
    movements.sort((a, b) => (a.note || 999) - (b.note || 999));

    // Calculate closing balances - just add movements to opening
    // (Income for the Year is already in movements, so don't double-count)
    const closing = {
      shareCapital: opening.shareCapital,
      retainedEarnings: opening.retainedEarnings,
      otherFund: opening.otherFund,
    };

    movements.forEach((m) => {
      closing.shareCapital += m.shareCapital;
      closing.retainedEarnings += m.retainedEarnings;
      closing.otherFund += m.otherFund;
    });

    return NextResponse.json({
      success: true,
      data: {
        period: { from, to },
        opening: {
          note: 22,
          shareCapital: opening.shareCapital,
          retainedEarnings: opening.retainedEarnings,
          otherFund: opening.otherFund,
          total:
            opening.shareCapital + opening.retainedEarnings + opening.otherFund,
        },
        movements,
        incomeForTheYear,
        closing: {
          note: 27,
          shareCapital: closing.shareCapital,
          retainedEarnings: closing.retainedEarnings,
          otherFund: closing.otherFund,
          total:
            closing.shareCapital + closing.retainedEarnings + closing.otherFund,
        },
        branchFilter: effectiveBranchId,
        generatedBy: user.name || user.email,
      },
    });
  } catch (error) {
    devLog.error("Error generating equity statement:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate equity statement" },
      { status: 500 }
    );
  }
}
