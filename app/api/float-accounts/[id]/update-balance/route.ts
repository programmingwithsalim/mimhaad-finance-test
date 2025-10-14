import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth-service";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to check if table exists
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      )
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

// Helper function to log transaction (optional if table doesn't exist)
async function logTransaction(
  accountId: string,
  transactionType: string,
  amount: number,
  balanceBefore: number,
  balanceAfter: number,
  description: string
): Promise<void> {
  try {
    const exists = await tableExists("float_transactions");
    if (!exists) {
      console.log(
        "float_transactions table doesn't exist, skipping transaction log"
      );
      return;
    }

    // Check if the required columns exist before inserting
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'float_transactions' 
      AND column_name IN ('balance_before', 'balance_after')
    `;

    const hasBalanceColumns = columnCheck.length >= 2;

    if (hasBalanceColumns) {
      // Use the full schema with balance columns
      await sql`
        INSERT INTO float_transactions (
          account_id,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          description,
          reference,
          created_at
        ) VALUES (
          ${accountId},
          ${transactionType},
          ${Math.abs(amount)},
          ${balanceBefore},
          ${balanceAfter},
          ${description},
          ${`TXN-${Date.now()}`},
          CURRENT_TIMESTAMP
        )
      `;
    } else {
      // Use simplified schema without balance columns
      await sql`
        INSERT INTO float_transactions (
          account_id,
          transaction_type,
          amount,
          description,
          reference,
          created_at
        ) VALUES (
          ${accountId},
          ${transactionType},
          ${Math.abs(amount)},
          ${description},
          ${`TXN-${Date.now()}`},
          CURRENT_TIMESTAMP
        )
      `;
    }
    console.log("Transaction logged successfully");
  } catch (error) {
    console.error("Error logging transaction (non-critical):", error);
    // Don't throw error - transaction logging is optional
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user || session.user.role?.toLowerCase() !== "super-admin") {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden: Only super-admins can use this endpoint.",
      },
      { status: 403 }
    );
  }
  try {
    const { id: accountId } = await params;

    // Validate account ID
    if (!accountId || accountId === "undefined" || accountId === "null") {
      console.error("Invalid account ID received:", accountId);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid account ID provided",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, description, transaction_type } = body;

    console.log("Updating account balance:", {
      accountId,
      amount,
      description,
      transaction_type,
    });

    if (amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, error: "Amount is required" },
        { status: 400 }
      );
    }

    // Get current account details
    const accountResult = await sql`
      SELECT id, current_balance, account_type, account_number, branch_id
      FROM float_accounts 
      WHERE id = ${accountId}
    `;

    if (accountResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    const account = accountResult[0];
    const currentBalance = Number.parseFloat(account.current_balance || "0");
    const newBalance = currentBalance + amount;

    console.log("Balance calculation:", { currentBalance, amount, newBalance });

    // Check for negative balance (only for debits)
    if (amount < 0 && newBalance < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient balance",
          details: `Current balance: ${currentBalance}, Requested: ${Math.abs(
            amount
          )}`,
        },
        { status: 400 }
      );
    }

    // Update the account balance
    const updateResult = await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newBalance},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${accountId}
      RETURNING *
    `;

    if (updateResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to update account" },
        { status: 500 }
      );
    }

    console.log("Account balance updated successfully");

    // Log the transaction (optional - won't fail if table doesn't exist)
    await logTransaction(
      accountId,
      transaction_type || (amount > 0 ? "credit" : "debit"),
      amount,
      currentBalance,
      newBalance,
      description || "Balance update"
    );

    // Create GL entries for balance adjustment
    try {
      const { FloatAccountGLService } = await import(
        "@/lib/services/float-account-gl-service"
      );
      await FloatAccountGLService.createBalanceAdjustmentGLEntries(
        accountId,
        amount,
        description || "Balance adjustment",
        session.user.id,
        account.branch_id,
        `BAL-ADJ-${Date.now()}`
      );
      console.log("[BALANCE-UPDATE] GL entries created for balance adjustment");
    } catch (glError) {
      console.error("[BALANCE-UPDATE] Failed to create GL entries:", glError);
      // Don't fail the operation for GL entry issues
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updateResult[0],
        current_balance: Number.parseFloat(
          updateResult[0].current_balance || "0"
        ),
        previous_balance: currentBalance,
        transaction_amount: amount,
      },
    });
  } catch (error) {
    console.error("Error updating float account balance:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update account balance",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
