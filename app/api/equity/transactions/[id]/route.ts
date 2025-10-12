import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// DELETE - Delete equity transaction and recalculate balances
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !["Admin", "Finance", "Manager"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Get the transaction to be deleted
    const transaction = await sql`
      SELECT * FROM equity_transactions WHERE id = ${id}
    `;

    if (transaction.length === 0) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    const txn = transaction[0];

    // Delete the transaction
    await sql`DELETE FROM equity_transactions WHERE id = ${id}`;

    // Recalculate balances for all subsequent transactions in the same ledger
    const subsequentTransactions = await sql`
      SELECT id FROM equity_transactions
      WHERE ledger_type = ${txn.ledger_type}
      AND transaction_date >= ${txn.transaction_date}
      ${txn.branch_id ? sql`AND branch_id = ${txn.branch_id}` : sql``}
      ORDER BY transaction_date ASC, created_at ASC
    `;

    // Recalculate each subsequent transaction's balance
    for (const subsequent of subsequentTransactions) {
      const priorBalance = await sql`
        SELECT COALESCE(SUM(credit - debit), 0) as balance
        FROM equity_transactions
        WHERE ledger_type = ${txn.ledger_type}
        ${txn.branch_id ? sql`AND branch_id = ${txn.branch_id}` : sql``}
        AND id != ${subsequent.id}
        AND (
          transaction_date < (SELECT transaction_date FROM equity_transactions WHERE id = ${
            subsequent.id
          })
          OR (transaction_date = (SELECT transaction_date FROM equity_transactions WHERE id = ${
            subsequent.id
          })
              AND created_at < (SELECT created_at FROM equity_transactions WHERE id = ${
                subsequent.id
              }))
        )
      `;

      const txnData =
        await sql`SELECT debit, credit FROM equity_transactions WHERE id = ${subsequent.id}`;
      const newBalance =
        Number(priorBalance[0].balance) +
        Number(txnData[0].credit) -
        Number(txnData[0].debit);

      await sql`UPDATE equity_transactions SET balance = ${newBalance} WHERE id = ${subsequent.id}`;
    }

    return NextResponse.json({
      success: true,
      message: "Equity transaction deleted and balances recalculated",
    });
  } catch (error) {
    console.error("Error deleting equity transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete equity transaction" },
      { status: 500 }
    );
  }
}
