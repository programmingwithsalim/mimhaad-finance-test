import { type NextRequest, NextResponse } from "next/server";
import { markCommissionPaid } from "@/lib/commission-database-service";
import { AuditLoggerService } from "@/lib/services/audit-logger-service";
import { GLPostingService } from "@/lib/services/gl-posting-service";
import { neon } from "@neondatabase/serverless";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test((await params).id)) {
      return NextResponse.json(
        { error: "Invalid commission ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      paymentInfo = {},
      userId = "system",
      userName = "System User",
    } = body;

    console.log("Marking commission as paid:", (await params).id);

    const updatedCommission = await markCommissionPaid(
      (
        await params
      ).id,
      userId,
      userName,
      paymentInfo
    );

    if (!updatedCommission) {
      return NextResponse.json(
        { error: "Commission not found or already paid" },
        { status: 404 }
      );
    }

    console.log(
      "Commission marked as paid successfully:",
      updatedCommission.reference
    );

    await AuditLoggerService.logTransaction({
      userId: userId,
      username: userName,
      action: "complete",
      transactionType: "commission_payment",
      transactionId: (await params).id,
      amount: updatedCommission.amount,
      details: {
        source: updatedCommission.source,
        reference: updatedCommission.reference,
        paymentInfo: paymentInfo,
      },
      severity: updatedCommission.amount > 10000 ? "high" : "medium",
    });

    if (updatedCommission.amount > 0) {
      await GLPostingService.createCommissionPaymentGLEntries({
        commissionId: updatedCommission.id,
        source: updatedCommission.source,
        reference: updatedCommission.reference,
        amount: updatedCommission.amount,
        paymentMethod: paymentInfo.method || "bank_transfer",
        createdBy: userId,
      });

      // Add commission amount to the associated float account
      try {
        const sql = neon(process.env.DATABASE_URL!);
        const floatAccountId = updatedCommission.source;

        if (floatAccountId) {
          // Get current balance
          const accountResult = await sql`
            SELECT current_balance FROM float_accounts 
            WHERE id = ${floatAccountId}
          `;

          if (accountResult.length > 0) {
            const currentBalance = Number.parseFloat(
              String(accountResult[0].current_balance || "0")
            );
            const newBalance = currentBalance + updatedCommission.amount;

            // Update the account balance
            await sql`
              UPDATE float_accounts 
              SET 
                current_balance = ${newBalance}::numeric,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${floatAccountId}
            `;

            console.log(
              `✅ Added commission amount ${updatedCommission.amount} to float account ${floatAccountId} (${currentBalance} -> ${newBalance})`
            );

            // Log the transaction
            try {
              await sql`
                INSERT INTO float_transactions (
                  float_account_id, transaction_type, amount, 
                  balance_before, balance_after, description, 
                  reference, created_by_id, created_by_name
                ) VALUES (
                  ${floatAccountId}::UUID,
                  'commission_payment'::VARCHAR,
                  ${updatedCommission.amount}::NUMERIC,
                  ${currentBalance}::NUMERIC,
                  ${newBalance}::NUMERIC,
                  ${"Commission payment: " + updatedCommission.reference}::TEXT,
                  ${updatedCommission.reference}::VARCHAR,
                  ${userId}::VARCHAR,
                  ${userName}::VARCHAR
                )
              `;
            } catch (logError) {
              console.warn("Failed to log float transaction:", logError);
              // Don't fail the operation if logging fails
            }
          } else {
            console.error(`Float account ${floatAccountId} not found`);
          }
        }
      } catch (floatUpdateError) {
        console.error(
          "Error updating float account balance:",
          floatUpdateError
        );
        // Don't fail the commission payment if float update fails
      }
    }

    return NextResponse.json(updatedCommission);
  } catch (error) {
    console.error("Error marking commission as paid:", error);
    return NextResponse.json(
      { error: "Failed to mark commission as paid" },
      { status: 500 }
    );
  }
}
