import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { AuditService } from "@/lib/audit-service";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fromAccountId,
      toAccountId,
      amount,
      reference,
      processedBy,
      userId,
    } = body;

    // Validate required fields
    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields or invalid amount" },
        { status: 400 }
      );
    }

    // Get account details
    const [fromAccount] = await sql`
      SELECT * FROM float_accounts WHERE id = ${fromAccountId}
    `;

    const [toAccount] = await sql`
      SELECT * FROM float_accounts WHERE id = ${toAccountId}
    `;

    if (!fromAccount || !toAccount) {
      return NextResponse.json(
        { success: false, error: "One or both accounts not found" },
        { status: 404 }
      );
    }

    // Check if from account has sufficient balance
    const fromBalance = Number(fromAccount.current_balance || 0);
    if (fromBalance < amount) {
      return NextResponse.json(
        { success: false, error: "Insufficient balance in source account" },
        { status: 400 }
      );
    }

    // Perform the transfer
    await sql`BEGIN`;

    try {
      // Debit from account
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance - ${amount},
            updated_at = NOW()
        WHERE id = ${fromAccountId}
      `;

      // Credit to account
      await sql`
        UPDATE float_accounts 
        SET current_balance = current_balance + ${amount},
            updated_at = NOW()
        WHERE id = ${toAccountId}
      `;

      // Record the transfer transaction (using float_account_id to match the schema)
      await sql`
        INSERT INTO float_transactions (
          float_account_id,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          description,
          reference,
          processed_by,
          branch_id,
          created_at
        ) VALUES 
        (${fromAccountId}, 'transfer_out', ${-amount}, ${fromBalance}, ${
        fromBalance - amount
      }, 'Transfer to partner account', ${reference}, ${processedBy}, ${
        fromAccount.branch_id
      }, NOW()),
        (${toAccountId}, 'transfer_in', ${amount}, ${Number(
        toAccount.current_balance || 0
      )}, ${
        Number(toAccount.current_balance || 0) + amount
      }, 'Transfer from E-Zwich settlement', ${reference}, ${processedBy}, ${
        toAccount.branch_id
      }, NOW())
      `;

      await sql`COMMIT`;

      // Log the transfer
      await AuditService.log({
        userId: userId,
        username: processedBy,
        actionType: "ezwich_settlement_transfer",
        entityType: "float_transfer",
        entityId: `${fromAccountId}-${toAccountId}`,
        description: `Transferred GHS ${amount} from E-Zwich settlement to partner account`,
        details: {
          from_account: fromAccountId,
          to_account: toAccountId,
          amount: amount,
          reference: reference,
        },
        severity: "medium",
        status: "success",
      });

      return NextResponse.json({
        success: true,
        message: `Successfully transferred GHS ${amount.toFixed(
          2
        )} to partner account`,
        transfer: {
          amount,
          from_account: fromAccount.account_type,
          to_account: `${toAccount.provider} - ${toAccount.account_number}`,
          reference,
        },
      });
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error("Error processing E-Zwich settlement transfer:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process transfer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
