import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userId, branchId, ...updateData } = body;

    if (!id || !userId || !branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Card ID, userId, and branchId are required",
        },
        { status: 400 }
      );
    }

    // Check if card exists
    const existingCard = await sql`
      SELECT * FROM ezwich_card_issuance WHERE id = ${id}
    `;

    if (existingCard.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (updateData.customer_name !== undefined) {
      updateFields.push(`customer_name = $${paramIndex++}`);
      updateValues.push(updateData.customer_name);
    }
    if (updateData.customer_phone !== undefined) {
      updateFields.push(`customer_phone = $${paramIndex++}`);
      updateValues.push(updateData.customer_phone);
    }
    if (updateData.customer_email !== undefined) {
      updateFields.push(`customer_email = $${paramIndex++}`);
      updateValues.push(updateData.customer_email);
    }
    if (updateData.date_of_birth !== undefined) {
      updateFields.push(`date_of_birth = $${paramIndex++}`);
      updateValues.push(
        updateData.date_of_birth ? new Date(updateData.date_of_birth) : null
      );
    }
    if (updateData.gender !== undefined) {
      updateFields.push(`gender = $${paramIndex++}`);
      updateValues.push(updateData.gender);
    }
    if (updateData.id_type !== undefined) {
      updateFields.push(`id_type = $${paramIndex++}`);
      updateValues.push(updateData.id_type);
    }
    if (updateData.id_number !== undefined) {
      updateFields.push(`id_number = $${paramIndex++}`);
      updateValues.push(updateData.id_number);
    }
    if (updateData.id_expiry_date !== undefined) {
      updateFields.push(`id_expiry_date = $${paramIndex++}`);
      updateValues.push(
        updateData.id_expiry_date ? new Date(updateData.id_expiry_date) : null
      );
    }
    if (updateData.address_line1 !== undefined) {
      updateFields.push(`address_line1 = $${paramIndex++}`);
      updateValues.push(updateData.address_line1);
    }
    if (updateData.city !== undefined) {
      updateFields.push(`city = $${paramIndex++}`);
      updateValues.push(updateData.city);
    }
    if (updateData.region !== undefined) {
      updateFields.push(`region = $${paramIndex++}`);
      updateValues.push(updateData.region);
    }
    if (updateData.card_status !== undefined) {
      updateFields.push(`card_status = $${paramIndex++}`);
      updateValues.push(updateData.card_status);
    }
    if (updateData.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      updateValues.push(updateData.notes);
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    // Execute update
    const setClause = updateFields.join(", ");
    const result = await sql.query(
      `UPDATE ezwich_card_issuance SET ${setClause} WHERE id = $${paramIndex} RETURNING *`,
      [...updateValues, id]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to update card" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Card information updated successfully",
    });
  } catch (error) {
    console.error("Error updating card:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update card" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userId, branchId, reason } = body;

    if (!id || !userId || !branchId || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: "Card ID, userId, branchId, and reason are required",
        },
        { status: 400 }
      );
    }

    // Check if card exists
    const existingCard = await sql`
      SELECT * FROM ezwich_card_issuance WHERE id = ${id}
    `;

    if (existingCard.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card not found" },
        { status: 404 }
      );
    }

    // Soft delete by marking as deleted
    await sql`
      UPDATE ezwich_card_issuance 
      SET deleted = true, updated_at = NOW() 
      WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: "Card deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting card:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete card" },
      { status: 500 }
    );
  }
}
