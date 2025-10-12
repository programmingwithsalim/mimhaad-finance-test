import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { logger, LogCategory } from "@/lib/logger";

export async function POST() {
  try {
    await logger.info(LogCategory.SYSTEM, "Starting quick GL mapping fix");

    // Get the specific float account
    const floatAccountId = "bb656fc8-0d85-45cf-901f-df4ffc860ede";
    
    const [floatAccount] = await sql`
      SELECT * FROM float_accounts WHERE id = ${floatAccountId}
    `;

    if (!floatAccount) {
      await logger.error(LogCategory.SYSTEM, "Float account not found", undefined, { floatAccountId });
      return NextResponse.json({ error: "Float account not found" }, { status: 404 });
    }

    // Get existing mappings for this float account
    const existingMappings = await sql`
      SELECT * FROM gl_mappings 
      WHERE float_account_id = ${floatAccountId} AND is_active = true
      ORDER BY transaction_type, mapping_type
    `;

    await logger.info(LogCategory.SYSTEM, `Found ${existingMappings.length} existing mappings for float account ${floatAccountId}`);

    // Check what transaction types we need
    const neededTransactionTypes = ['withdrawal', 'recharge', 'initial', 'adjustment'];
    let mappingsCreated = 0;

    for (const neededType of neededTransactionTypes) {
      const hasMapping = existingMappings.some(m => m.transaction_type === neededType);
      
      if (!hasMapping) {
        await logger.warn(LogCategory.SYSTEM, `Missing mapping for transaction type: ${neededType}`, {
          floatAccountId,
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
              ${floatAccountId},
              ${templateMapping.gl_account_id},
              ${templateMapping.mapping_type},
              ${neededType},
              ${floatAccount.branch_id},
              true,
              NOW(),
              NOW()
            )
          `;

          mappingsCreated++;
          await logger.info(LogCategory.SYSTEM, `Created missing mapping for ${neededType}`, {
            floatAccountId,
            glAccountId: templateMapping.gl_account_id,
            mappingType: templateMapping.mapping_type,
          });
        } else {
          await logger.error(LogCategory.SYSTEM, `No template mapping found for float account ${floatAccountId}`, {
            floatAccountId,
            neededType,
          });
        }
      } else {
        await logger.info(LogCategory.SYSTEM, `Mapping already exists for ${neededType}`, {
          floatAccountId,
          existingCount: existingMappings.filter(m => m.transaction_type === neededType).length,
        });
      }
    }

    // Get updated mappings
    const updatedMappings = await sql`
      SELECT 
        gm.*,
        ga.code as gl_account_code,
        ga.name as gl_account_name
      FROM gl_mappings gm
      LEFT JOIN gl_accounts ga ON gm.gl_account_id = ga.id
      WHERE gm.float_account_id = ${floatAccountId}
      AND gm.is_active = true
      ORDER BY gm.transaction_type, gm.mapping_type
    `;

    await logger.info(LogCategory.SYSTEM, "Quick GL mapping fix completed", {
      mappingsCreated,
      totalMappings: updatedMappings.length,
    });

    return NextResponse.json({
      success: true,
      message: `Quick GL mapping fix completed. Created ${mappingsCreated} mappings.`,
      data: {
        mappingsCreated,
        totalMappings: updatedMappings.length,
        mappings: updatedMappings,
        summary: {
          hasWithdrawalMappings: updatedMappings.some(m => m.transaction_type === 'withdrawal'),
          hasRechargeMappings: updatedMappings.some(m => m.transaction_type === 'recharge'),
          hasInitialMappings: updatedMappings.some(m => m.transaction_type === 'initial'),
          hasAdjustmentMappings: updatedMappings.some(m => m.transaction_type === 'adjustment'),
          transactionTypesFound: [...new Set(updatedMappings.map(m => m.transaction_type))],
        }
      },
    });
  } catch (error) {
    await logger.error(LogCategory.SYSTEM, "Quick GL mapping fix failed", error as Error);
    return NextResponse.json(
      { error: "Failed to fix GL mappings" },
      { status: 500 }
    );
  }
} 