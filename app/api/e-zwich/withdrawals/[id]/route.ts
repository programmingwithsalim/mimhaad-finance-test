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
    const {
      card_number,
      amount,
      transaction_type,
      status,
      processed_by,
      branch_id,
    } = body;

    if (!card_number || !amount || !processed_by || !branch_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if withdrawal exists
    const existingWithdrawal = await sql`
      SELECT * FROM ezwich_withdrawals WHERE id = ${id}
    `;

    if (existingWithdrawal.length === 0) {
      return NextResponse.json(
        { success: false, error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    // Update the withdrawal
    const result = await sql`
      UPDATE ezwich_withdrawals 
      SET 
        card_number = ${card_number},
        amount = ${amount},
        transaction_type = ${transaction_type || "withdrawal"},
        status = ${status || "completed"},
        processed_by = ${processed_by},
        branch_id = ${branch_id}
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Withdrawal updated successfully",
    });
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update withdrawal" },
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

    // Check if withdrawal exists
    const existingWithdrawal = await sql`
      SELECT * FROM ezwich_withdrawals WHERE id = ${id}
    `;

    if (existingWithdrawal.length === 0) {
      return NextResponse.json(
        { success: false, error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    // Delete the withdrawal
    await sql`
      DELETE FROM ezwich_withdrawals WHERE id = ${id}
    `;

    return NextResponse.json({
      success: true,
      message: "Withdrawal deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete withdrawal" },
      { status: 500 }
    );
  }
}
