import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const requestData = await request.json();
    console.log(
      "[RECHARGE] Processing recharge:",
      JSON.stringify(requestData, null, 2)
    );

    const { accountId, amount, paymentAccountId, description, performedBy } =
      requestData;

    // Validate required fields
    if (!accountId || !amount || !performedBy) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: accountId, amount, performedBy",
        },
        { status: 400 }
      );
    }

    const rechargeAmount = Number(amount);
    if (rechargeAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Amount must be greater than 0",
        },
        { status: 400 }
      );
    }

    // Require paymentAccountId for all recharges
    if (!paymentAccountId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "All recharges must be a transfer from another account (paymentAccountId required)",
        },
        { status: 400 }
      );
    }

    // Get target account details
    const targetAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE id = ${accountId} AND is_active = true
    `;

    if (targetAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Target account not found or inactive",
        },
        { status: 400 }
      );
    }

    const currentBalance = Number(targetAccount[0].current_balance);

    // If payment account is specified, check its balance and deduct
    if (paymentAccountId) {
      const paymentAccount = await sql`
        SELECT * FROM float_accounts 
        WHERE id = ${paymentAccountId} AND is_active = true
      `;

      if (paymentAccount.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Payment account not found or inactive",
          },
          { status: 400 }
        );
      }

      const paymentBalance = Number(paymentAccount[0].current_balance);
      if (paymentBalance < rechargeAmount) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient balance in payment account. Available: GHS ${paymentBalance.toFixed(
              2
            )}, Required: GHS ${rechargeAmount.toFixed(2)}`,
          },
          { status: 400 }
        );
      }

      // Deduct from payment account
      await sql`
        UPDATE float_accounts 
        SET 
          current_balance = current_balance - ${rechargeAmount},
          last_updated = NOW()
        WHERE id = ${paymentAccountId}
      `;

      // Record payment account transaction
      await sql`
        INSERT INTO float_transactions (
          float_account_id,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          description,
          processed_by,
          branch_id,
          user_id,
          status,
          created_at
        ) VALUES (
          ${paymentAccountId}::uuid,
          'transfer_out',
          ${-rechargeAmount},
          ${paymentBalance},
          ${paymentBalance - rechargeAmount},
          ${
            description ||
            `Transfer to ${targetAccount[0].account_type} account`
          },
          ${performedBy},
          ${targetAccount[0].branch_id}::uuid,
          ${performedBy}::uuid,
          'completed',
          NOW()
        )
      `;
    }

    // Add to target account
    const newBalance = currentBalance + rechargeAmount;
    await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newBalance},
        last_updated = NOW()
      WHERE id = ${accountId}
    `;

    // Record target account transaction
    const transactionResult = await sql`
      INSERT INTO float_transactions (
        float_account_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        description,
        processed_by,
        branch_id,
        user_id,
        status,
        created_at
      ) VALUES (
        ${accountId}::uuid,
        'recharge',
        ${rechargeAmount},
        ${currentBalance},
        ${newBalance},
        ${description || `Account recharge - GHS ${rechargeAmount}`},
        ${performedBy},
        ${targetAccount[0].branch_id}::uuid,
        ${performedBy}::uuid,
        'completed',
        NOW()
      )
      RETURNING *
    `;

    // Create GL entries for recharge
    try {
      const { FloatAccountGLService } = await import(
        "@/lib/services/float-account-gl-service"
      );
      await FloatAccountGLService.createRechargeGLEntries(
        accountId,
        rechargeAmount,
        "transfer", // Since this is a transfer from another account
        performedBy,
        targetAccount[0].branch_id,
        reference || `RECHARGE-${Date.now()}`
      );
      console.log("[RECHARGE] GL entries created for recharge");
    } catch (glError) {
      console.error("[RECHARGE] Failed to create GL entries:", glError);
      // Don't fail the operation for GL entry issues
    }

    console.log("[RECHARGE] Recharge processed successfully");

    return NextResponse.json({
      success: true,
      message: "Account recharged successfully",
      transaction: {
        id: transactionResult[0].id,
        amount: rechargeAmount,
        new_balance: newBalance,
        description: transactionResult[0].description,
        date: transactionResult[0].created_at,
      },
    });
  } catch (error: any) {
    console.error("[RECHARGE] Error processing recharge:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Recharge failed",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
