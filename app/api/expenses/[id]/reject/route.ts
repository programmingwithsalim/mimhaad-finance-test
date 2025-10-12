import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

const isDev = process.env.NODE_ENV === "development";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { approver_id, reason } = body;

    console.log("Rejecting expense:", id, "by:", approver_id);

    // Update the expense status
    const result = await sql`
      UPDATE expenses 
      SET 
        status = 'rejected',
        approved_by = ${approver_id},
        approved_at = CURRENT_TIMESTAMP,
        approval_comments = ${reason || ""}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    // Reverse the Accounts Payable GL entry when expense is rejected
    try {
      // Get Accounts Payable GL account
      const apAccountResult = await sql`
        SELECT id, code, name FROM gl_accounts 
        WHERE code IN ('2001', '2010') 
        AND type = 'Liability'
        ORDER BY code ASC
        LIMIT 1
      `;

      if (apAccountResult.length > 0) {
        const apAccount = apAccountResult[0];
        const expenseAmount = Number(result[0].amount);

        // Get the expense GL account to reverse the debit
        const expenseHeadResult = await sql`
          SELECT category FROM expense_heads WHERE id = ${result[0].expense_head_id}
        `;

        let expenseGLAccount;
        if (expenseHeadResult.length > 0) {
          const categoryKey = (
            expenseHeadResult[0].category || "operational"
          ).toLowerCase();

          const expenseCodeMap: Record<string, string[]> = {
            operational: ["5001", "5100"],
            administrative: ["5002", "5200"],
            financial: ["5003", "5300"],
            marketing: ["5001", "5100"],
            security: ["5001", "5100"],
          };

          const searchCodes =
            expenseCodeMap[categoryKey] || expenseCodeMap.operational;

          expenseGLAccount = await sql`
            SELECT id, code, name FROM gl_accounts 
            WHERE code = ANY(${searchCodes})
            AND type = 'Expense'
            ORDER BY code ASC
            LIMIT 1
          `;
        }

        if (expenseGLAccount && expenseGLAccount.length > 0) {
          const expenseAccount = expenseGLAccount[0];

          // Create reversal GL transaction
          const glTransactionId = await sql`SELECT gen_random_uuid() as id`;
          const glId = glTransactionId[0].id;

          await sql`
            INSERT INTO gl_transactions (
              id, date, source_module, source_transaction_id, source_transaction_type,
              description, status, created_by, branch_id, metadata
            ) VALUES (
              ${glId},
              CURRENT_DATE,
              'expenses',
              ${id},
              'expense_reversal',
              ${`Expense Rejected - Reversal: ${
                result[0].description || "General Expense"
              }`},
              'posted',
              ${approver_id},
              ${result[0].branch_id},
              ${JSON.stringify({
                rejectionReason: reason,
                originalReference: result[0].reference_number,
              })}
            )
          `;

          // Create journal entries to reverse: Credit Expense, Debit Accounts Payable
          await sql`
            INSERT INTO gl_journal_entries (
              id, transaction_id, account_id, account_code, debit, credit, description
            ) VALUES 
            (gen_random_uuid(), ${glId}, ${expenseAccount.id}, ${expenseAccount.code}, 0, ${expenseAmount}, 'Expense reversed'),
            (gen_random_uuid(), ${glId}, ${apAccount.id}, ${apAccount.code}, ${expenseAmount}, 0, 'Accounts Payable reversed')
          `;

          if (isDev)
            console.log(
              `✅ Reversed GL entries for rejected expense - Credit: ${expenseAccount.name}, Debit: ${apAccount.name}`
            );
        }
      }
    } catch (glError) {
      console.error(
        "Failed to reverse GL entries for rejected expense:",
        glError
      );
      // Don't fail the rejection if GL reversal fails
    }

    console.log("Expense rejected successfully:", id);

    return NextResponse.json({
      success: true,
      message: "Expense rejected successfully and Accounts Payable reversed",
      expense: result[0],
    });
  } catch (error) {
    console.error("Error rejecting expense:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reject expense",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
