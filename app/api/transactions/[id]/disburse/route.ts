import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { UnifiedTransactionService } from "@/lib/services/unified-transaction-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const { sourceModule, reason } = body;

    // Get current user
    const currentUser = await getCurrentUser(request);
    if (!currentUser?.id || !currentUser?.branchId) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    // Check if user is Cashier or has appropriate permissions
    if (
      currentUser.role?.toLowerCase() !== "cashier" &&
      currentUser.role?.toLowerCase() !== "admin" &&
      currentUser.role?.toLowerCase() !== "manager"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only Cashiers, Managers, and Admins can disburse transactions",
        },
        { status: 403 }
      );
    }

    if (!sourceModule) {
      return NextResponse.json(
        { success: false, error: "Source module is required" },
        { status: 400 }
      );
    }

    console.log("Disbursing transaction:", {
      transactionId,
      sourceModule,
      userId: currentUser.id,
      userRole: currentUser.role,
    });

    // First, check the current transaction status
    let currentTransaction;
    try {
      switch (sourceModule) {
        case "momo":
          const momoResult = await sql`
            SELECT id, status, amount, customer_name, reference, created_at
            FROM momo_transactions 
            WHERE id = ${transactionId}
          `;
          currentTransaction = momoResult[0];
          break;
        case "agency_banking":
          const agencyResult = await sql`
            SELECT id, status, amount, customer_name, reference, created_at
            FROM agency_banking_transactions 
            WHERE id = ${transactionId}
          `;
          currentTransaction = agencyResult[0];
          break;
        case "e_zwich":
          // Check both withdrawals and card issuances
          const withdrawalResult = await sql`
            SELECT id, status, amount, customer_name, reference, created_at
            FROM e_zwich_withdrawals 
            WHERE id = ${transactionId}
          `;
          if (withdrawalResult.length > 0) {
            currentTransaction = withdrawalResult[0];
          } else {
            const cardResult = await sql`
              SELECT id, status, fee_charged as amount, customer_name, reference, created_at
              FROM e_zwich_card_issuances 
              WHERE id = ${transactionId}
            `;
            currentTransaction = cardResult[0];
          }
          break;
        case "power":
          const powerResult = await sql`
            SELECT id, status, amount, customer_name, reference, created_at
            FROM power_transactions 
            WHERE id = ${transactionId}
          `;
          currentTransaction = powerResult[0];
          break;
        case "jumia":
          const jumiaResult = await sql`
            SELECT transaction_id as id, status, amount, customer_name, reference, created_at
            FROM jumia_transactions 
            WHERE transaction_id = ${transactionId}
          `;
          currentTransaction = jumiaResult[0];
          break;
        default:
          return NextResponse.json(
            { success: false, error: "Invalid source module" },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error("Error fetching transaction:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch transaction details" },
        { status: 500 }
      );
    }

    if (!currentTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if transaction is already reversed
    if (currentTransaction.status?.toLowerCase() === "reversed") {
      return NextResponse.json(
        { success: false, error: "Cannot disburse a reversed transaction" },
        { status: 400 }
      );
    }

    // Check if transaction is already disbursed
    if (currentTransaction.status?.toLowerCase() === "disbursed") {
      return NextResponse.json(
        { success: false, error: "Transaction is already disbursed" },
        { status: 400 }
      );
    }

    // Update transaction status to disbursed
    let updateResult;
    try {
      switch (sourceModule) {
        case "momo":
          updateResult = await sql`
            UPDATE momo_transactions 
            SET status = 'disbursed', updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          break;
        case "agency_banking":
          updateResult = await sql`
            UPDATE agency_banking_transactions 
            SET status = 'disbursed', updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          break;
        case "e_zwich":
          // Check if it's a withdrawal or card issuance
          const withdrawal = await sql`
            SELECT id FROM e_zwich_withdrawals WHERE id = ${transactionId}
          `;
          if (withdrawal.length > 0) {
            updateResult = await sql`
              UPDATE e_zwich_withdrawals 
              SET status = 'disbursed', updated_at = NOW()
              WHERE id = ${transactionId}
              RETURNING *
            `;
          } else {
            updateResult = await sql`
              UPDATE e_zwich_card_issuances 
              SET status = 'disbursed', updated_at = NOW()
              WHERE id = ${transactionId}
              RETURNING *
            `;
          }
          break;
        case "power":
          // For Power transactions, complete them instead of disbursing
          updateResult = await sql`
            UPDATE power_transactions 
            SET status = 'completed', updated_at = NOW()
            WHERE id = ${transactionId}
            RETURNING *
          `;
          break;
        case "jumia":
          // For Jumia transactions, deliver them instead of disbursing
          updateResult = await sql`
            UPDATE jumia_transactions 
            SET status = 'delivered', updated_at = NOW()
            WHERE transaction_id = ${transactionId}
            RETURNING *
          `;
          break;
      }
    } catch (error) {
      console.error("Error updating transaction status:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update transaction status" },
        { status: 500 }
      );
    }

    if (!updateResult || updateResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to update transaction" },
        { status: 500 }
      );
    }

    const updatedTransaction = updateResult[0];

    // Log the action (disburse, complete, or deliver)
    const actionType =
      sourceModule === "power"
        ? "complete"
        : sourceModule === "jumia"
        ? "deliver"
        : "disburse";

    try {
      await sql`
        INSERT INTO audit_logs (
          user_id, 
          username, 
          action, 
          transaction_type, 
          transaction_id, 
          amount, 
          details, 
          severity,
          created_at
        ) VALUES (
          ${currentUser.id},
          ${currentUser.name || currentUser.username || "Unknown"},
          ${actionType},
          ${sourceModule},
          ${transactionId},
          ${currentTransaction.amount || 0},
          ${JSON.stringify({
            previousStatus: currentTransaction.status,
            newStatus: "disbursed",
            reason: reason || "Cash disbursement",
            customerName: currentTransaction.customer_name,
            reference: currentTransaction.reference,
          })},
          ${(currentTransaction.amount || 0) > 10000 ? "high" : "medium"},
          NOW()
        )
      `;
    } catch (auditError) {
      console.warn("Failed to log audit entry:", auditError);
      // Don't fail the transaction if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: "Transaction disbursed successfully",
      transaction: {
        id: updatedTransaction.id || updatedTransaction.transaction_id,
        status: "disbursed",
        amount: updatedTransaction.amount,
        customer_name: updatedTransaction.customer_name,
        reference: updatedTransaction.reference,
        disbursed_by: currentUser.name || currentUser.username,
        disbursed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error disbursing transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to disburse transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
