import { NextResponse, NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { logger, LogCategory } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { floatAccountId, glAccountId, mappingType, transactionType, branchId } = body;

    if (!floatAccountId || !glAccountId || !mappingType || !transactionType || !branchId) {
      return NextResponse.json({
        error: "Missing required fields: floatAccountId, glAccountId, mappingType, transactionType, branchId"
      }, { status: 400 });
    }

    await logger.info(LogCategory.API, "Creating GL mapping", {
      floatAccountId,
      glAccountId,
      mappingType,
      transactionType,
      branchId,
    });

    // Verify float account exists
    const [floatAccount] = await sql`
      SELECT * FROM float_accounts WHERE id = ${floatAccountId}
    `;

    if (!floatAccount) {
      await logger.error(LogCategory.API, "Float account not found", undefined, { floatAccountId });
      return NextResponse.json({ error: "Float account not found" }, { status: 404 });
    }

    // Verify GL account exists
    const [glAccount] = await sql`
      SELECT * FROM gl_accounts WHERE id = ${glAccountId}
    `;

    if (!glAccount) {
      await logger.error(LogCategory.API, "GL account not found", undefined, { glAccountId });
      return NextResponse.json({ error: "GL account not found" }, { status: 404 });
    }

    // Check if mapping already exists
    const existingMapping = await sql`
      SELECT * FROM gl_mappings 
      WHERE float_account_id = ${floatAccountId} 
      AND gl_account_id = ${glAccountId}
      AND mapping_type = ${mappingType}
      AND transaction_type = ${transactionType}
      AND branch_id = ${branchId}
    `;

    if (existingMapping.length > 0) {
      await logger.warn(LogCategory.API, "GL mapping already exists", {
        existingMappingId: existingMapping[0].id,
      });
      return NextResponse.json({
        success: true,
        message: "GL mapping already exists",
        data: existingMapping[0],
      });
    }

    // Create the mapping
    const [newMapping] = await sql`
      INSERT INTO gl_mappings (
        id, float_account_id, gl_account_id, mapping_type, transaction_type,
        branch_id, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${floatAccountId},
        ${glAccountId},
        ${mappingType},
        ${transactionType},
        ${branchId},
        true,
        NOW(),
        NOW()
      ) RETURNING *
    `;

    await logger.info(LogCategory.API, "GL mapping created successfully", {
      mappingId: newMapping.id,
      floatAccountId,
      glAccountId,
      mappingType,
      transactionType,
    });

    return NextResponse.json({
      success: true,
      message: "GL mapping created successfully",
      data: newMapping,
    });
  } catch (error) {
    await logger.error(LogCategory.API, "Failed to create GL mapping", error as Error);
    return NextResponse.json(
      { error: "Failed to create GL mapping" },
      { status: 500 }
    );
  }
} 