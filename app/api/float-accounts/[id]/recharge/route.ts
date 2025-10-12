import { NextResponse, NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getDatabaseSession } from "@/lib/database-session-service";
import { logger, LogCategory } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Convert to NextRequest for cookie access
    const nextRequest =
      request instanceof NextRequest
        ? request
        : new NextRequest(request.url, request);
    // 1. Session check
    const session = await getDatabaseSession(nextRequest);
    await logger.info(LogCategory.API, "Recharge request started", { session: !!session }, { userId: session?.user?.id });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized: No session" },
        { status: 401 }
      );
    }
    const user = session.user;
    await logger.info(LogCategory.API, "User authenticated for recharge", { userId: user.id, role: user.role });

    // 2. Parse and validate body
    const { amount, sourceAccountId } = await request.json();
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!sourceAccountId) {
      return NextResponse.json(
        { error: "Source account required" },
        { status: 400 }
      );
    }

    // 3. Get target account
    const { id: accountId } = await params;
    const [targetAccount] =
      await sql`SELECT * FROM float_accounts WHERE id = ${accountId}`;
    if (!targetAccount) {
      await logger.error(LogCategory.API, "Target account not found for recharge", undefined, { accountId });
      return NextResponse.json(
        { error: "Target account not found" },
        { status: 404 }
      );
    }
    await logger.info(LogCategory.FLOAT_ACCOUNT, "Target account found for recharge", {
      accountId,
      accountType: targetAccount.account_type,
      currentBalance: targetAccount.current_balance,
    }, { entityId: accountId });

    // 4. Permission check
    const isAdmin = user.role?.toLowerCase() === "admin";
    const isManager =
      user.role?.toLowerCase() === "manager" &&
      user.branchId === targetAccount.branch_id;
    const isFinance =
      user.role?.toLowerCase() === "finance" &&
      user.branchId === targetAccount.branch_id;
    if (!isAdmin && !isManager && !isFinance) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient privileges" },
        { status: 403 }
      );
    }

    // 5. Get and check source account
    const [sourceAccount] =
      await sql`SELECT * FROM float_accounts WHERE id = ${sourceAccountId}`;
    if (!sourceAccount) {
      return NextResponse.json(
        { error: "Source account not found" },
        { status: 404 }
      );
    }
    if (!sourceAccount.is_active) {
      return NextResponse.json(
        { error: "Source account is not active" },
        { status: 400 }
      );
    }
    if (Number(sourceAccount.current_balance) < amount) {
      return NextResponse.json(
        { error: "Insufficient source account balance" },
        { status: 400 }
      );
    }

    // 6. Update balances
    const newSourceBalance = Number(sourceAccount.current_balance) - amount;
    const newTargetBalance = Number(targetAccount.current_balance) + amount;
    await sql`UPDATE float_accounts SET current_balance = ${newSourceBalance}, updated_at = NOW() WHERE id = ${sourceAccountId}`;
    await sql`UPDATE float_accounts SET current_balance = ${newTargetBalance}, updated_at = NOW() WHERE id = ${accountId}`;

    // 7. Record transactions using sql
    await sql`
      INSERT INTO float_transactions (
        id, float_account_id, transaction_type, amount, balance_before, balance_after, description, processed_by, branch_id, created_at
      ) VALUES (
        gen_random_uuid(),
        ${sourceAccountId},
        'transfer_out',
        ${-amount},
        ${Number(sourceAccount.current_balance)},
        ${newSourceBalance},
        ${`Transfer to ${targetAccount.provider}`},
        ${user.id},
        ${user.branchId},
        NOW()
      )
    `;

    await sql`
      INSERT INTO float_transactions (
        id, float_account_id, transaction_type, amount, balance_before, balance_after, description, processed_by, branch_id, created_at
      ) VALUES (
        gen_random_uuid(),
        ${accountId},
        'recharge',
        ${amount},
        ${Number(targetAccount.current_balance)},
        ${newTargetBalance},
        ${`Recharge from ${sourceAccount.provider}`},
        ${user.id},
        ${user.branchId},
        NOW()
      )
    `;

    // 8. Create GL entries for the recharge operation
    try {
      await logger.info(LogCategory.GL_ENTRY, "Starting GL entry creation for recharge", {
        sourceAccountId,
        targetAccountId: accountId,
        amount,
        user: user.id,
      });

      const { FloatAccountGLService } = await import(
        "@/lib/services/float-account-gl-service"
      );

      // Create GL entries for source account withdrawal
      await logger.info(LogCategory.GL_ENTRY, "Creating withdrawal GL entries for source account", {
        sourceAccountId,
        amount,
        description: `Transfer to ${targetAccount.provider}`,
      });
      
      await FloatAccountGLService.createWithdrawalGLEntries(
        sourceAccountId,
        amount,
        "transfer",
        user.id,
        user.branchId,
        `Transfer to ${targetAccount.provider}`
      );

      // Create GL entries for target account recharge
      await logger.info(LogCategory.GL_ENTRY, "Creating recharge GL entries for target account", {
        targetAccountId: accountId,
        amount,
        description: `Recharge from ${sourceAccount.provider}`,
      });

      await FloatAccountGLService.createRechargeGLEntries(
        accountId,
        amount,
        "transfer",
        user.id,
        user.branchId,
        `Recharge from ${sourceAccount.provider}`
      );

      await logger.info(LogCategory.GL_ENTRY, "GL entries created successfully for recharge", {
        sourceAccountId,
        targetAccountId: accountId,
        amount,
      });
    } catch (glError) {
      await logger.error(LogCategory.GL_ENTRY, "Failed to create GL entries for recharge", glError as Error, {
        sourceAccountId,
        targetAccountId: accountId,
        amount,
        user: user.id,
      });
      // Don't fail the entire operation for GL entry issues
    }

    // 9. Success response
    await logger.info(LogCategory.TRANSACTION, "Recharge completed successfully", {
      sourceAccountId,
      targetAccountId: accountId,
      amount,
      newTargetBalance,
      user: user.id,
    });
    
    return NextResponse.json({
      success: true,
      message: "Recharge successful",
      newTargetBalance,
    });
  } catch (error: any) {
    await logger.error(LogCategory.API, "Recharge operation failed", error as Error, {
      sourceAccountId,
      targetAccountId: accountId,
      amount,
      user: user.id,
    });
    return NextResponse.json(
      { error: error?.message || "Internal error" },
      { status: 500 }
    );
  }
}
