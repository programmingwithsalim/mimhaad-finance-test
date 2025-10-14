import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();

    const { batch_id, item_number, customer_name, customer_phone, notes } =
      body;

    console.log("Issuing inventory item:", body);

    // Validate required fields
    if (!batch_id || !item_number || !customer_name || !customer_phone) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get batch details
    const batchResult = await sql`
      SELECT * FROM ezwich_card_batches
      WHERE id = ${batch_id}
    `;

    if (batchResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    const batch = batchResult[0];

    // Check if batch has available items
    if (batch.quantity_available <= 0) {
      return NextResponse.json(
        { success: false, error: "No items available in this batch" },
        { status: 400 }
      );
    }

    // Ensure inventory_issued table exists
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_issued (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id UUID NOT NULL REFERENCES ezwich_card_batches(id) ON DELETE CASCADE,
        inventory_type VARCHAR(50) NOT NULL,
        item_number VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        branch_id UUID NOT NULL,
        user_id UUID NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        notes TEXT,
        issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert issued item record
    const issuedResult = await sql`
      INSERT INTO inventory_issued (
        batch_id,
        inventory_type,
        item_number,
        customer_name,
        customer_phone,
        branch_id,
        user_id,
        status,
        notes
      ) VALUES (
        ${batch_id},
        ${batch.inventory_type || "other"},
        ${item_number},
        ${customer_name},
        ${customer_phone},
        ${user.branchId},
        ${user.id},
        'issued',
        ${notes || ""}
      )
      RETURNING *
    `;

    // Update batch quantity (quantity_available is auto-calculated)
    await sql`
      UPDATE ezwich_card_batches
      SET 
        quantity_issued = quantity_issued + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${batch_id}
    `;

    console.log("Inventory item issued successfully:", issuedResult[0].id);

    return NextResponse.json({
      success: true,
      message: "Item issued successfully",
      data: issuedResult[0],
    });
  } catch (error) {
    console.error("Error issuing inventory item:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to issue item",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
