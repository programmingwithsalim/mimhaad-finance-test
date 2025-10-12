import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logger, LogCategory } from "@/lib/logger";

export async function POST() {
  try {
    await logger.info(LogCategory.SYSTEM, "Starting GL mapping seeder");

    // Get all float accounts
    const floatAccounts = await sql`
      SELECT id, account_type, provider, branch_id FROM float_accounts WHERE is_active = true
    `;

    await logger.info(LogCategory.SYSTEM, `Found ${floatAccounts.length} active float accounts`);

    // Get GL accounts for mapping
    const glAccounts = await sql`
      SELECT id, code, name, type FROM gl_accounts WHERE is_active = true
    `;

    await logger.info(LogCategory.SYSTEM, `Found ${glAccounts.length} active GL accounts`);

    // Find specific GL accounts for float operations
    const cashAccount = glAccounts.find(acc => acc.code === "1000" || acc.name.toLowerCase().includes("cash"));
    const bankAccount = glAccounts.find(acc => acc.code === "1100" || acc.name.toLowerCase().includes("bank"));
    const floatAccount = glAccounts.find(acc => acc.code === "1200" || acc.name.toLowerCase().includes("float"));
    const revenueAccount = glAccounts.find(acc => acc.code === "4000" || acc.name.toLowerCase().includes("revenue"));
    const expenseAccount = glAccounts.find(acc => acc.code === "5000" || acc.name.toLowerCase().includes("expense"));

    if (!cashAccount || !bankAccount || !floatAccount) {
      await logger.error(LogCategory.SYSTEM, "Required GL accounts not found", undefined, {
        cashAccount: !!cashAccount,
        bankAccount: !!bankAccount,
        floatAccount: !!floatAccount,
      });
      return NextResponse.json({
        error: "Required GL accounts not found. Please ensure cash, bank, and float accounts exist.",
      }, { status: 400 });
    }

    let mappingsCreated = 0;

    // Create mappings for each float account
    for (const floatAcc of floatAccounts) {
      await logger.info(LogCategory.SYSTEM, `Processing float account: ${floatAcc.account_type}`, {
        accountId: floatAcc.id,
        accountType: floatAcc.account_type,
        provider: floatAcc.provider,
      });

      // Check if mappings already exist for this float account
      const existingMappings = await sql`
        SELECT COUNT(*) as count FROM gl_mappings 
        WHERE float_account_id = ${floatAcc.id} AND is_active = true
      `;

      if (existingMappings[0].count > 0) {
        await logger.info(LogCategory.SYSTEM, `Mappings already exist for float account ${floatAcc.id}`, {
          existingCount: existingMappings[0].count,
        });
        continue;
      }

      // Create withdrawal mappings (when money leaves the float account)
      await sql`
        INSERT INTO gl_mappings (
          id, float_account_id, gl_account_id, mapping_type, transaction_type,
          branch_id, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${floatAcc.id},
          ${floatAccount.id},
          'debit',
          'withdrawal',
          ${floatAcc.branch_id},
          true,
          NOW(),
          NOW()
        )
      `;

      // Create recharge mappings (when money enters the float account)
      await sql`
        INSERT INTO gl_mappings (
          id, float_account_id, gl_account_id, mapping_type, transaction_type,
          branch_id, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${floatAcc.id},
          ${floatAccount.id},
          'credit',
          'recharge',
          ${floatAcc.branch_id},
          true,
          NOW(),
          NOW()
        )
      `;

      // Create initial balance mappings
      await sql`
        INSERT INTO gl_mappings (
          id, float_account_id, gl_account_id, mapping_type, transaction_type,
          branch_id, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${floatAcc.id},
          ${floatAccount.id},
          'credit',
          'initial',
          ${floatAcc.branch_id},
          true,
          NOW(),
          NOW()
        )
      `;

      // Create adjustment mappings
      await sql`
        INSERT INTO gl_mappings (
          id, float_account_id, gl_account_id, mapping_type, transaction_type,
          branch_id, is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          ${floatAcc.id},
          ${floatAccount.id},
          'credit',
          'adjustment',
          ${floatAcc.branch_id},
          true,
          NOW(),
          NOW()
        )
      `;

      mappingsCreated += 4;
      await logger.info(LogCategory.SYSTEM, `Created 4 mappings for float account ${floatAcc.id}`);
    }

    // Create transaction-type based mappings for common float types
    const commonFloatTypes = ['momo', 'agency-banking', 'ezwich', 'power'];
    
    for (const floatType of commonFloatTypes) {
      const transactionType = `${floatType.replace(/-/g, '_')}_float`;
      
      // Check if transaction-type mappings already exist
      const existingTypeMappings = await sql`
        SELECT COUNT(*) as count FROM gl_mappings 
        WHERE transaction_type = ${transactionType} AND float_account_id IS NULL
      `;

      if (existingTypeMappings[0].count > 0) {
        await logger.info(LogCategory.SYSTEM, `Transaction-type mappings already exist for ${transactionType}`);
        continue;
      }

      // Create transaction-type based mappings for each branch
      const branches = await sql`SELECT id FROM branches WHERE is_active = true`;
      
      for (const branch of branches) {
        // Withdrawal mapping
        await sql`
          INSERT INTO gl_mappings (
            id, gl_account_id, mapping_type, transaction_type, branch_id,
            is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${floatAccount.id},
            'debit',
            ${transactionType},
            ${branch.id},
            true,
            NOW(),
            NOW()
          )
        `;

        // Recharge mapping
        await sql`
          INSERT INTO gl_mappings (
            id, gl_account_id, mapping_type, transaction_type, branch_id,
            is_active, created_at, updated_at
          ) VALUES (
            gen_random_uuid(),
            ${floatAccount.id},
            'credit',
            ${transactionType},
            ${branch.id},
            true,
            NOW(),
            NOW()
          )
        `;

        mappingsCreated += 2;
      }

      await logger.info(LogCategory.SYSTEM, `Created transaction-type mappings for ${transactionType}`);
    }

    await logger.info(LogCategory.SYSTEM, "GL mapping seeder completed", {
      totalMappingsCreated: mappingsCreated,
      floatAccountsProcessed: floatAccounts.length,
    });

    return NextResponse.json({
      success: true,
      message: `GL mapping seeder completed successfully. Created ${mappingsCreated} mappings.`,
      data: {
        mappingsCreated,
        floatAccountsProcessed: floatAccounts.length,
      },
    });
  } catch (error) {
    await logger.error(LogCategory.SYSTEM, "GL mapping seeder failed", error as Error);
    return NextResponse.json(
      { error: "Failed to seed GL mappings" },
      { status: 500 }
    );
  }
} 