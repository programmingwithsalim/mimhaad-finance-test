import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logger, LogCategory } from "@/lib/logger";

export async function POST() {
  try {
    await logger.info(LogCategory.SYSTEM, "Starting GL mapping fix");

    // Get all float accounts
    const floatAccounts = await sql`
      SELECT id, account_type, provider, branch_id FROM float_accounts WHERE is_active = true
    `;

    let mappingsUpdated = 0;

    for (const floatAcc of floatAccounts) {
      await logger.info(LogCategory.SYSTEM, `Processing float account: ${floatAcc.account_type}`, {
        accountId: floatAcc.id,
        accountType: floatAcc.account_type,
      });

      // Get existing mappings for this float account
      const existingMappings = await sql`
        SELECT * FROM gl_mappings 
        WHERE float_account_id = ${floatAcc.id} AND is_active = true
        ORDER BY transaction_type, mapping_type
      `;

      await logger.info(LogCategory.SYSTEM, `Found ${existingMappings.length} existing mappings for float account ${floatAcc.id}`);

      // Check what transaction types we need
      const neededTransactionTypes = ['withdrawal', 'recharge', 'initial', 'adjustment'];
      
      for (const neededType of neededTransactionTypes) {
        const hasMapping = existingMappings.some(m => m.transaction_type === neededType);
        
        if (!hasMapping) {
          await logger.warn(LogCategory.SYSTEM, `Missing mapping for transaction type: ${neededType}`, {
            floatAccountId: floatAcc.id,
            neededType,
          });

          // Find an existing mapping to use as a template
          const templateMapping = existingMappings.find(m => m.mapping_type === 'credit' || m.mapping_type === 'debit');
          
          if (templateMapping) {
            // Create the missing mapping
            await sql`
              INSERT INTO gl_mappings (
                id, float_account_id, gl_account_id, mapping_type, transaction_type,
                branch_id, is_active, created_at, updated_at
              ) VALUES (
                gen_random_uuid(),
                ${floatAcc.id},
                ${templateMapping.gl_account_id},
                ${templateMapping.mapping_type},
                ${neededType},
                ${floatAcc.branch_id},
                true,
                NOW(),
                NOW()
              )
            `;

            mappingsUpdated++;
            await logger.info(LogCategory.SYSTEM, `Created missing mapping for ${neededType}`, {
              floatAccountId: floatAcc.id,
              glAccountId: templateMapping.gl_account_id,
              mappingType: templateMapping.mapping_type,
            });
          } else {
            await logger.error(LogCategory.SYSTEM, `No template mapping found for float account ${floatAcc.id}`, {
              floatAccountId: floatAcc.id,
              neededType,
            });
          }
        } else {
          await logger.info(LogCategory.SYSTEM, `Mapping already exists for ${neededType}`, {
            floatAccountId: floatAcc.id,
            existingCount: existingMappings.filter(m => m.transaction_type === neededType).length,
          });
        }
      }
    }

    await logger.info(LogCategory.SYSTEM, "GL mapping fix completed", {
      totalMappingsUpdated: mappingsUpdated,
      floatAccountsProcessed: floatAccounts.length,
    });

    return NextResponse.json({
      success: true,
      message: `GL mapping fix completed successfully. Updated ${mappingsUpdated} mappings.`,
      data: {
        mappingsUpdated,
        floatAccountsProcessed: floatAccounts.length,
      },
    });
  } catch (error) {
    await logger.error(LogCategory.SYSTEM, "GL mapping fix failed", error as Error);
    return NextResponse.json(
      { error: "Failed to fix GL mappings" },
      { status: 500 }
    );
  }
} 