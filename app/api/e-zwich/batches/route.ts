import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const userId = searchParams.get("userId");

    // Get current user for role-based access
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    // Ensure card batches table exists with partner bank field and inventory type
    await sql`
      CREATE TABLE IF NOT EXISTS ezwich_card_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_code VARCHAR(50) UNIQUE NOT NULL,
        inventory_type VARCHAR(50) DEFAULT 'e-zwich',
        quantity_received INTEGER NOT NULL,
        quantity_issued INTEGER DEFAULT 0,
        quantity_available INTEGER GENERATED ALWAYS AS (quantity_received - quantity_issued) STORED,
        card_type VARCHAR(50) DEFAULT 'standard',
        unit_cost DECIMAL(10,2) DEFAULT 0.00,
        total_cost DECIMAL(10,2) DEFAULT 0.00,
        partner_bank_id UUID,
        partner_bank_name VARCHAR(100),
        payment_method_id UUID,
        payment_method_name VARCHAR(100),
        expiry_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        branch_id VARCHAR(100) NOT NULL,
        branch_name VARCHAR(100),
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `;

    // Add inventory_type column if it doesn't exist (for existing tables)
    try {
      await sql`
        ALTER TABLE ezwich_card_batches 
        ADD COLUMN IF NOT EXISTS inventory_type VARCHAR(50) DEFAULT 'e-zwich'
      `;
    } catch (error) {
      // Column might already exist, ignore error
      console.log(
        "inventory_type column already exists or error adding it:",
        error
      );
    }

    // Debug: log incoming branchId, user.branchId, and all batch branch_ids
    console.log("API branchId param:", branchId);
    console.log("User branchId from session:", user.branchId);
    const allBatchesRaw =
      await sql`SELECT id, batch_code, branch_id FROM ezwich_card_batches`;
    console.log(
      "All batch branch_ids:",
      allBatchesRaw.map((b) => b.branch_id)
    );

    let batches;

    // Admin can see all batches, others only see their branch
    if (user.role === "Admin") {
      // Admin always sees all batches, regardless of branchId parameter
      batches = await sql`
        SELECT 
          cb.*,
          b.name as branch_name,
          fa.provider as payment_method_provider,
          fa.account_type as payment_method_type
        FROM ezwich_card_batches cb
        LEFT JOIN branches b ON cb.branch_id = b.id
        LEFT JOIN float_accounts fa ON cb.payment_method_id = fa.id
        ORDER BY cb.created_at DESC
      `;
      console.log(`🔍 [DEBUG] Admin: Found ${batches.length} total batches`);
    } else {
      // Non-admin users only see their branch's batches
      batches = await sql`
      SELECT 
          cb.*,
          b.name as branch_name,
          fa.provider as payment_method_provider,
          fa.account_type as payment_method_type
        FROM ezwich_card_batches cb
        LEFT JOIN branches b ON cb.branch_id = b.id
        LEFT JOIN float_accounts fa ON cb.payment_method_id = fa.id
        WHERE cb.branch_id = ${user.branchId}
        ORDER BY cb.created_at DESC
      `;
      console.log(
        `🔍 [DEBUG] Non-admin: Found ${batches.length} batches for branch ${user.branchId}`
      );
    }

    return NextResponse.json({
      success: true,
      data: batches,
    });
  } catch (error) {
    console.error("Error fetching card batches:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch card batches" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      batch_code,
      inventory_type,
      quantity_received,
      card_type,
      unit_cost,
      partner_bank_id,
      partner_bank_name,
      expiry_date,
      branch_id,
      created_by,
      notes,
    } = body;

    // Default to e-zwich if not provided
    const finalInventoryType = inventory_type || "e-zwich";

    console.log("📦 Received inventory_type:", inventory_type);
    console.log("📦 Final inventory_type:", finalInventoryType);
    console.log("📦 Partner bank ID:", partner_bank_id);

    // Get current user for role-based access
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!batch_code || !quantity_received || !body.payment_method_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: batch_code, quantity_received, payment_method_id",
        },
        { status: 400 }
      );
    }

    // Partner bank is required only for E-Zwich inventory
    if (
      finalInventoryType === "e-zwich" &&
      (!partner_bank_id || partner_bank_id.trim() === "")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Partner bank is required for E-Zwich inventory",
        },
        { status: 400 }
      );
    }

    // Validate payment method (float account) exists and is active
    const paymentMethod = await sql`
      SELECT id, current_balance, account_type, provider 
      FROM float_accounts 
      WHERE id = ${body.payment_method_id} 
      AND is_active = true
      LIMIT 1
    `;

    if (paymentMethod.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Selected payment method (float account) not found or inactive",
        },
        { status: 400 }
      );
    }

    // Check if float account has sufficient balance
    const totalCost = (unit_cost || 0) * quantity_received;
    if (paymentMethod[0].current_balance < totalCost) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient balance in selected payment method. Available: ₵${paymentMethod[0].current_balance.toLocaleString()}, Required: ₵${totalCost.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    // Non-admin users can only create batches for their own branch
    if (user.role !== "admin" && branch_id !== user.branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only create batches for your own branch",
        },
        { status: 403 }
      );
    }

    // Use user's branch if not admin and no branch specified
    const targetBranchId = user.role === "admin" ? branch_id : user.branchId;
    const targetBranchName = user.role === "admin" ? "" : user.branchName;

    // Ensure table exists with partner bank field and inventory type
    await sql`
      CREATE TABLE IF NOT EXISTS ezwich_card_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_code VARCHAR(50) UNIQUE NOT NULL,
        inventory_type VARCHAR(50) DEFAULT 'e-zwich',
        quantity_received INTEGER NOT NULL,
        quantity_issued INTEGER DEFAULT 0,
        quantity_available INTEGER GENERATED ALWAYS AS (quantity_received - quantity_issued) STORED,
        card_type VARCHAR(50) DEFAULT 'standard',
        unit_cost DECIMAL(10,2) DEFAULT 0.00,
        total_cost DECIMAL(10,2) DEFAULT 0.00,
        partner_bank_id UUID,
        partner_bank_name VARCHAR(100),
        payment_method_id UUID,
        payment_method_name VARCHAR(100),
        expiry_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        branch_id VARCHAR(100) NOT NULL,
        branch_name VARCHAR(100),
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `;

    // Add inventory_type column if it doesn't exist (for existing tables)
    try {
      await sql`
        ALTER TABLE ezwich_card_batches 
        ADD COLUMN IF NOT EXISTS inventory_type VARCHAR(50) DEFAULT 'e-zwich'
      `;
    } catch (error) {
      // Column might already exist, ignore error
      console.log(
        "inventory_type column already exists or error adding it:",
        error
      );
    }

    // Create the batch - convert empty strings to null for UUID fields
    const result = await sql`
      INSERT INTO ezwich_card_batches (
        batch_code,
        inventory_type,
        quantity_received,
        card_type,
        unit_cost,
        total_cost,
        partner_bank_id,
        partner_bank_name,
        payment_method_id,
        payment_method_name,
        expiry_date,
        branch_id,
        branch_name,
        created_by,
        notes
      ) VALUES (
        ${batch_code},
        ${finalInventoryType},
        ${quantity_received},
        ${card_type || "standard"},
        ${unit_cost || 0},
        ${totalCost},
        ${
          partner_bank_id && partner_bank_id.trim() !== ""
            ? partner_bank_id
            : null
        },
        ${partner_bank_name || null},
        ${body.payment_method_id},
        ${paymentMethod[0].provider || "Unknown Payment Method"},
        ${expiry_date ? new Date(expiry_date) : null},
        ${targetBranchId},
        ${targetBranchName},
        ${created_by || user.username},
        ${notes || null}
      )
      RETURNING *
    `;

    const batch = result[0];

    // Debit the selected float account for the purchase
    if (totalCost > 0) {
      try {
        // Debit the float account
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance - ${totalCost},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${body.payment_method_id}
        `;

        // Log the float transaction
        await sql`
          INSERT INTO float_transactions (
            float_account_id,
            transaction_type,
            amount,
            balance_before,
            balance_after,
            description,
            reference,
            created_at
          ) VALUES (
            ${body.payment_method_id},
            'debit',
            ${totalCost},
            ${paymentMethod[0].current_balance},
            ${paymentMethod[0].current_balance - totalCost},
            ${`E-Zwich card batch purchase: ${batch_code} - ${quantity_received} cards`},
            ${batch_code},
            CURRENT_TIMESTAMP
          )
        `;

        console.log(
          `Debited ₵${totalCost} from float account ${body.payment_method_id}`
        );
      } catch (floatError) {
        console.error("Error debiting float account:", floatError);
        // Rollback the batch creation if float debit fails
        await sql`DELETE FROM ezwich_card_batches WHERE id = ${batch.id}`;
        return NextResponse.json(
          {
            success: false,
            error:
              "Failed to debit payment method. Batch creation rolled back.",
          },
          { status: 500 }
        );
      }
    }

    // Create GL entries for inventory purchase (asset, not expense)
    if (totalCost > 0) {
      try {
        const glResult =
          await UnifiedGLPostingService.createInventoryPurchaseGLEntries({
            transactionId: batch.id,
            sourceModule: "e-zwich-inventory",
            transactionType: "inventory_purchase",
            amount: totalCost,
            fee: 0,
            customerName: partner_bank_name || "Partner Bank",
            reference: batch_code,
            processedBy: created_by || user.username,
            branchId: targetBranchId,
            branchName: targetBranchName || user.branchName,
            metadata: {
              batch_code: batch_code,
              quantity: quantity_received,
              unit_cost: unit_cost,
              partner_bank_id: partner_bank_id,
              partner_bank_name: partner_bank_name,
              payment_method_id: body.payment_method_id,
              payment_method_name:
                paymentMethod[0].provider || "Unknown Payment Method",
            },
          });

        if (!glResult.success) {
          console.error("GL posting failed:", glResult.error);
          // Don't fail the entire transaction, just log the error
        }
      } catch (glError) {
        console.error("Error creating GL entries:", glError);
        // Don't fail the entire transaction, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      data: batch,
      message:
        "Card batch added successfully. Payment method debited and inventory recorded.",
    });
  } catch (error) {
    console.error("Error creating card batch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create card batch" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      batch_code,
      quantity_received,
      card_type,
      unit_cost,
      partner_bank_id,
      partner_bank_name,
      expiry_date,
      branch_id,
      created_by,
      notes,
    } = body;

    // Get current user for role-based access
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!id || !batch_code || !quantity_received || !partner_bank_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: id, batch_code, quantity_received, partner_bank_id",
        },
        { status: 400 }
      );
    }

    // Get the original batch to calculate cost differences
    const originalBatch = await sql`
      SELECT * FROM ezwich_card_batches WHERE id = ${id}
    `;

    if (originalBatch.length === 0) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    const original = originalBatch[0];

    // Check permissions - non-admin users can only update their branch's batches
    if (user.role !== "Admin" && original.branch_id !== user.branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only update batches from your own branch",
        },
        { status: 403 }
      );
    }

    // Use user's branch if not admin and no branch specified
    const targetBranchId = user.role === "Admin" ? branch_id : user.branchId;
    const targetBranchName = user.role === "Admin" ? "" : user.branchName;

    // Calculate total cost
    const totalCost = (unit_cost || 0) * quantity_received;
    const originalTotalCost =
      (original.unit_cost || 0) * original.quantity_received;
    const costDifference = totalCost - originalTotalCost;

    // Update the batch
    const result = await sql`
      UPDATE ezwich_card_batches SET
        batch_code = ${batch_code},
        quantity_received = ${quantity_received},
        card_type = ${card_type || "standard"},
        unit_cost = ${unit_cost || 0},
        total_cost = ${totalCost},
        partner_bank_id = ${partner_bank_id},
        partner_bank_name = ${partner_bank_name || ""},
        expiry_date = ${expiry_date ? new Date(expiry_date) : null},
        branch_id = ${targetBranchId},
        branch_name = ${targetBranchName},
        notes = ${notes || ""},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    const batch = result[0];

    // Create GL entries for cost adjustment if there's a difference
    if (Math.abs(costDifference) > 0.01) {
      try {
        const glResult =
          await UnifiedGLPostingService.createInventoryAdjustmentGLEntries({
            transactionId: batch.id,
            sourceModule: "e-zwich-inventory",
            transactionType: "inventory_adjustment",
            amount: Math.abs(costDifference),
            fee: 0,
            customerName: partner_bank_name || "Partner Bank",
            reference: `${batch_code} - Adjustment`,
            processedBy: created_by || user.id || user.username || "system",
            branchId: targetBranchId,
            branchName: targetBranchName || user.branchName,
            metadata: {
              batch_code: batch_code,
              original_cost: originalTotalCost,
              new_cost: totalCost,
              cost_difference: costDifference,
              partner_bank_id: partner_bank_id,
              partner_bank_name: partner_bank_name,
              adjustment_type: costDifference > 0 ? "increase" : "decrease",
            },
          });

        if (!glResult.success) {
          console.error("GL posting failed:", glResult.error);
        }
      } catch (glError) {
        console.error("Error creating GL entries:", glError);
      }
    }

    return NextResponse.json({
      success: true,
      data: batch,
      message: "Card batch updated successfully",
    });
  } catch (error) {
    console.error("Error updating card batch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update card batch" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("id");

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: "Batch ID is required" },
        { status: 400 }
      );
    }

    // Get current user for role-based access
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    // Get the batch to check permissions and get details for GL reversal
    const batchResult = await sql`
      SELECT * FROM ezwich_card_batches WHERE id = ${batchId}
    `;

    if (batchResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    const batch = batchResult[0];

    // Check permissions - non-admin users can only delete their branch's batches
    if (user.role !== "Admin" && batch.branch_id !== user.branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "You can only delete batches from your own branch",
        },
        { status: 403 }
      );
    }

    // Check if batch has issued cards
    if (batch.quantity_issued > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete batch with issued cards. Please void the issued cards first.",
        },
        { status: 400 }
      );
    }

    // Create GL reversal entries before deleting
    if (batch.total_cost > 0) {
      try {
        const glResult =
          await UnifiedGLPostingService.createInventoryReversalGLEntries({
            transactionId: batch.id,
            sourceModule: "e-zwich-inventory",
            transactionType: "inventory_reversal",
            amount: batch.total_cost,
            fee: 0,
            customerName: batch.partner_bank_name || "Partner Bank",
            reference: `${batch.batch_code} - Deletion`,
            processedBy: user.id || user.username || "system",
            branchId: batch.branch_id,
            branchName: batch.branch_name || user.branchName,
            metadata: {
              batch_code: batch.batch_code,
              original_cost: batch.total_cost,
              quantity_received: batch.quantity_received,
              partner_bank_id: batch.partner_bank_id,
              partner_bank_name: batch.partner_bank_name,
              deletion_reason: "Batch deletion",
            },
          });

        if (!glResult.success) {
          console.error("GL reversal failed:", glResult.error);
          // Continue with deletion even if GL reversal fails
        }
      } catch (glError) {
        console.error("Error creating GL reversal entries:", glError);
        // Continue with deletion even if GL reversal fails
      }
    }

    // Delete the batch
    await sql`
      DELETE FROM ezwich_card_batches WHERE id = ${batchId}
    `;

    return NextResponse.json({
      success: true,
      message: "Card batch deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting card batch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete card batch" },
      { status: 500 }
    );
  }
}
