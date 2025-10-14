import { type NextRequest, NextResponse } from "next/server";
import { markCommissionPaid } from "@/lib/commission-database-service";
import { AuditLoggerService } from "@/lib/services/audit-logger-service";
import { GLPostingService } from "@/lib/services/gl-posting-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { neon } from "@neondatabase/serverless";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid commission ID format" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { paymentInfo = {} } = body;

    console.log("Marking commission as paid:", id);

    const updatedCommission = await markCommissionPaid(
      id,
      user.id,
      user.name || user.username,
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

    // Log the action (optional - don't fail if audit logging fails)
    try {
      await AuditLoggerService.logTransaction({
        userId: user.id,
        username: user.name || user.username,
        action: "complete",
        transactionType: "commission_payment",
        transactionId: id,
        amount: updatedCommission.amount,
        details: {
          source: updatedCommission.source,
          reference: updatedCommission.reference,
          paymentInfo: paymentInfo,
        },
        severity: updatedCommission.amount > 10000 ? "high" : "medium",
        branchId: updatedCommission.branchId || user.branchId,
        branchName: updatedCommission.branchName || user.branchName,
      });
    } catch (auditError) {
      console.warn("Failed to create audit log:", auditError);
      // Continue - payment succeeded even if audit log failed
    }

    // Create GL entries (optional - don't fail payment if GL posting fails)
    if (updatedCommission.amount > 0) {
      try {
        await GLPostingService.createCommissionPaymentGLEntries({
          commissionId: updatedCommission.id,
          source: updatedCommission.source,
          reference: updatedCommission.reference,
          amount: updatedCommission.amount,
          paymentMethod: paymentInfo.method || "bank_transfer",
          createdBy: user.id,
        });
        console.log("GL entries created successfully");
      } catch (glError) {
        console.error("Failed to create GL entries:", glError);
        // Continue - payment succeeded even if GL posting failed
      }

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
              `Added commission amount ${updatedCommission.amount} to float account ${floatAccountId} (${currentBalance} -> ${newBalance})`
            );

            // Log the transaction in float_transactions (this shows on statements!)
            // Use the EXACT same schema as other working code
            try {
              const insertResult = await sql`
                INSERT INTO float_transactions (
                  account_id, transaction_type, amount, reference, description, created_at
                ) VALUES (
                  ${floatAccountId}::UUID,
                  'commission_payment'::VARCHAR,
                  ${updatedCommission.amount}::NUMERIC,
                  ${updatedCommission.reference}::VARCHAR,
                  ${"Commission payment: " + updatedCommission.reference}::TEXT,
                  NOW()
                )
                RETURNING id
              `;

              console.log(
                "Float transaction created with ID:",
                insertResult[0]?.id
              );
              console.log("  ├─ Account ID:", floatAccountId);
              console.log("  ├─ Type: commission_payment");
              console.log("  ├─ Amount:", updatedCommission.amount);
              console.log("  └─ Reference:", updatedCommission.reference);

              // Verify it can be queried back
              const verifyCount = await sql`
                SELECT COUNT(*) as count FROM float_transactions 
                WHERE account_id = ${floatAccountId}
              `;
              console.log(
                `Total float_transactions for this account: ${verifyCount[0].count}`
              );
            } catch (logError) {
              console.error("❌ Failed to log float transaction:", logError);
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
