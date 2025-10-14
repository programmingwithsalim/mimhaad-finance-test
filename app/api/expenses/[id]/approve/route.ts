import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to map payment methods to GL transaction types
function getExpenseTransactionType(paymentMethod: string): string {
  switch (paymentMethod?.toLowerCase()) {
    case "cash":
      return "expense_cash";
    case "bank":
    case "bank transfer":
      return "expense_bank";
    case "card":
    case "credit card":
    case "debit card":
      return "expense_card";
    case "momo":
    case "mobile money":
      return "expense_momo";
    case "momo_mtn":
    case "mtn momo":
      return "expense_momo_mtn";
    case "momo_telecel":
    case "telecel momo":
      return "expense_momo_telecel";
    case "agency_gcb":
    case "gcb":
      return "expense_agency_gcb";
    case "agency_fidelity":
    case "fidelity":
      return "expense_agency_fidelity";
    case "agency_cal":
    case "cal bank":
      return "expense_bank"; // Uses Cal Bank agency account
    default:
      return "expense_cash"; // Default to cash instead of expense_other
  }
}

// Helper function to map expense head categories to GL mapping keys
function getGLCategoryFromExpenseHead(headCategory: string): string {
  switch ((headCategory || "").toLowerCase()) {
    case "operational":
      return "expense_operational";
    case "administrative":
      return "expense_administrative";
    case "financial":
      return "expense_financial";
    case "capital":
      return "expense_capital";
    case "marketing":
      return "expense_operational"; // Map marketing to operational
    case "security":
      return "expense_operational"; // Map security to operational
    case "human resources":
      return "expense_administrative"; // Map HR to administrative
    default:
      return "expense_operational"; // Default to operational (Cash in Till) instead of expense_other
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { approver_id, comments } = body;

    console.log("Approving expense:", id, "by:", approver_id);

    // First, get the expense details to determine GL mapping
    const expenseResult = await sql`
      SELECT e.*, eh.name as expense_head_name, b.name as branch_name
      FROM expenses e
      LEFT JOIN expense_heads eh ON e.expense_head_id = eh.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.id = ${id}
    `;

    if (expenseResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    const expense = expenseResult[0];

    // Update the expense status using correct column name
    const result = await sql`
      UPDATE expenses 
      SET 
        status = 'approved',
        approved_by = ${approver_id},
        approved_at = CURRENT_TIMESTAMP,
        comments = ${comments || ""}
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    // After updating the expense status, auto-debit the float account if payment_source is not 'cash'
    const paymentSource = expense.payment_source;
    const expenseAmount = Number(expense.amount);
    if (paymentSource && paymentSource !== "cash") {
      // Fetch the float account
      const floatAccountResult =
        await sql`SELECT * FROM float_accounts WHERE id = ${paymentSource}`;
      if (!floatAccountResult[0]) {
        return NextResponse.json(
          {
            success: false,
            error: "Float account for payment source not found.",
          },
          { status: 400 }
        );
      }
      const floatAccount = floatAccountResult[0];
      const currentBalance = Number(floatAccount.current_balance);
      if (currentBalance < expenseAmount) {
        return NextResponse.json(
          {
            success: false,
            error: "Insufficient float account balance for this expense.",
          },
          { status: 400 }
        );
      }
      const newBalance = currentBalance - expenseAmount;
      // Update float account balance
      await sql`UPDATE float_accounts SET current_balance = ${newBalance}, updated_at = NOW() WHERE id = ${paymentSource}`;
      // Record float transaction
      await sql`INSERT INTO float_transactions (id, account_id, type, amount, balance_before, balance_after, description, created_by, branch_id, created_at) VALUES (gen_random_uuid(), ${paymentSource}, 'expense_debit', ${-expenseAmount}, ${currentBalance}, ${newBalance}, ${"Expense auto-debit on approval"}, ${approver_id}, ${
        expense.branch_id
      }, NOW())`;
    }

    // Post GL entries for payment after approval
    // This will: Debit Accounts Payable, Credit Payment Source
    try {
      // Get Accounts Payable GL account
      const apAccountResult = await sql`
        SELECT id, code, name FROM gl_accounts 
        WHERE code IN ('2001', '2010') 
        AND type = 'Liability'
        ORDER BY code ASC
        LIMIT 1
      `;

      if (apAccountResult.length === 0) {
        console.warn(
          "⚠️ Accounts Payable GL account not found - skipping payment GL entry"
        );
      } else {
        const apAccount = apAccountResult[0];
        const expenseAmount = Number(expense.amount);

        // Determine payment source GL account
        let paymentSourceAccount;

        if (paymentSource && paymentSource !== "cash") {
          // It's a float account
          const floatAccountResult = await sql`
            SELECT id, account_type, provider FROM float_accounts WHERE id = ${paymentSource}
          `;

          if (floatAccountResult.length > 0) {
            const floatAccount = floatAccountResult[0];

            // Get GL mapping for this float account or its type
            const mappingResult = await sql`
              SELECT gl_account_id, ga.code, ga.name
              FROM gl_mappings gm
              JOIN gl_accounts ga ON gm.gl_account_id = ga.id
              WHERE (gm.float_account_id = ${paymentSource} OR gm.transaction_type = ${
              floatAccount.account_type + "_float"
            })
              AND gm.mapping_type = 'asset'
              AND gm.is_active = true
              ORDER BY gm.float_account_id DESC NULLS LAST
              LIMIT 1
            `;

            if (mappingResult.length > 0) {
              paymentSourceAccount = {
                id: mappingResult[0].gl_account_id,
                code: mappingResult[0].code,
                name: mappingResult[0].name,
              };
            }
          }
        }

        // If no specific float account, default to Cash in Till
        if (!paymentSourceAccount) {
          const cashResult = await sql`
            SELECT id, code, name FROM gl_accounts 
            WHERE code IN ('1001', '1100')
            AND type = 'Asset'
            ORDER BY code ASC
            LIMIT 1
          `;

          if (cashResult.length > 0) {
            paymentSourceAccount = cashResult[0];
          }
        }

        if (paymentSourceAccount) {
          // Create GL transaction for payment
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
              'expense_payment',
              ${`Expense Payment: ${
                expense.description ||
                expense.expense_head_name ||
                "General Expense"
              }`},
              'posted',
              ${approver_id},
              ${expense.branch_id},
              ${JSON.stringify({
                expenseHeadId: expense.expense_head_id,
                expenseHeadName: expense.expense_head_name,
                paymentSource: paymentSource,
                referenceNumber: expense.reference_number,
              })}
            )
          `;

          // Create journal entries: Debit Accounts Payable, Credit Payment Source
          await sql`
            INSERT INTO gl_journal_entries (
              id, transaction_id, account_id, account_code, debit, credit, description
            ) VALUES 
            (gen_random_uuid(), ${glId}, ${apAccount.id}, ${apAccount.code}, ${expenseAmount}, 0, 'Accounts Payable cleared'),
            (gen_random_uuid(), ${glId}, ${paymentSourceAccount.id}, ${paymentSourceAccount.code}, 0, ${expenseAmount}, 'Payment disbursed')
          `;

          console.log(
            `Created payment GL entries - Debit: ${apAccount.name}, Credit: ${paymentSourceAccount.name}`
          );
        }
      }
    } catch (glError) {
      console.error("Failed to create payment GL entries:", glError);
      // Don't fail the approval if GL posting fails
    }

    console.log("Expense approved successfully:", id);

    return NextResponse.json({
      success: true,
      message: "Expense approved successfully and Accounts Payable cleared",
      expense: result[0],
    });
  } catch (error) {
    console.error("Error approving expense:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to approve expense",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
