import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    // Get current user for authentication
    let user;
    try {
      user = await getCurrentUser(request);
      if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch (authError) {
      console.warn("Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { floatAccountId, accountType, branchId } = body;

    if (!floatAccountId || !accountType || !branchId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: floatAccountId, accountType, branchId",
        },
        { status: 400 }
      );
    }

    console.log("🔧 [GL MAPPINGS] Creating float-specific mappings:", {
      floatAccountId,
      accountType,
      branchId,
      userRole: user.role,
    });

    // Get the transaction type for this account type
    const transactionType = `${accountType.replace(/-/g, "_")}_float`;

    // Find existing transaction-type based mappings for this account type and branch
    const existingMappings = await sql`
      SELECT 
        gm.id,
        gm.transaction_type,
        gm.gl_account_id,
        gm.mapping_type,
        gm.branch_id,
        ga.code as account_code,
        ga.name as account_name
      FROM gl_mappings gm
      JOIN gl_accounts ga ON gm.gl_account_id = ga.id
      WHERE gm.transaction_type = ${transactionType}
        AND gm.branch_id = ${branchId}
        AND gm.is_active = true
        AND gm.float_account_id IS NULL
    `;

    console.log(
      `🔧 [GL MAPPINGS] Found ${existingMappings.length} existing transaction-type mappings`
    );

    if (existingMappings.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No transaction-type mappings found for ${transactionType} in branch ${branchId}`,
        },
        { status: 404 }
      );
    }

    // Create float-specific mappings by copying the transaction-type mappings
    const createdMappings = [];

    for (const mapping of existingMappings) {
      try {
        // Check if float-specific mapping already exists
        const existingFloatMapping = await sql`
          SELECT id FROM gl_mappings 
          WHERE float_account_id = ${floatAccountId}
            AND mapping_type = ${mapping.mapping_type}
            AND is_active = true
        `;

        if (existingFloatMapping.length > 0) {
          console.log(
            `ℹ️ [GL MAPPINGS] Float-specific mapping already exists for ${mapping.mapping_type}`
          );
          continue;
        }

        // Create the float-specific mapping
        const newMapping = await sql`
          INSERT INTO gl_mappings (
            id,
            transaction_type,
            gl_account_id,
            float_account_id,
            mapping_type,
            branch_id,
            is_active,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${mapping.transaction_type},
            ${mapping.gl_account_id},
            ${floatAccountId},
            ${mapping.mapping_type},
            ${mapping.branch_id},
            true,
            NOW(),
            NOW()
          )
          RETURNING id, mapping_type, gl_account_id
        `;

        createdMappings.push(newMapping[0]);
        console.log(
          `✅ [GL MAPPINGS] Created mapping for ${mapping.mapping_type}: ${newMapping[0].id}`
        );
      } catch (error) {
        console.error(
          `❌ [GL MAPPINGS] Failed to create mapping for ${mapping.mapping_type}:`,
          error
        );
      }
    }

    console.log(
      `✅ [GL MAPPINGS] Created ${createdMappings.length} float-specific mappings`
    );

    return NextResponse.json({
      success: true,
      data: {
        floatAccountId,
        accountType,
        transactionType,
        createdMappings,
        totalCreated: createdMappings.length,
      },
    });
  } catch (error) {
    console.error("Error creating float-specific GL mappings:", error);
    return NextResponse.json(
      { error: "Failed to create float-specific GL mappings" },
      { status: 500 }
    );
  }
}
