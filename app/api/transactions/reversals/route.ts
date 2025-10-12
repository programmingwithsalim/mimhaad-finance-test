import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    // Validate required fields
    if (
      !data.transaction_id ||
      !data.service_type ||
      !data.reversal_type ||
      !data.reason ||
      !data.requested_by ||
      !data.branch_id
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Insert reversal request into transaction_reversals table (adjust table/columns as needed)
    await sql`
      INSERT INTO transaction_reversals (
        transaction_id,
        service_type,
        reversal_type,
        reason,
        additional_notes,
        requested_by,
        branch_id,
        status,
        created_at
      ) VALUES (
        ${data.transaction_id},
        ${data.service_type},
        ${data.reversal_type},
        ${data.reason},
        ${data.additional_notes || null},
        ${data.requested_by},
        ${data.branch_id},
        'pending',
        NOW()
      )
    `;

    // Optionally, log to audit_logs
    await sql`
      INSERT INTO audit_logs (action, entity, entity_id, user_id, branch_id, details, created_at)
      VALUES (
        'reversal_request',
        'transaction',
        ${data.transaction_id},
        ${data.requested_by},
        ${data.branch_id},
        ${JSON.stringify(data)},
        NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      message: "Reversal request submitted successfully.",
    });
  } catch (error) {
    console.error("Error handling reversal request:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit reversal request." },
      { status: 500 }
    );
  }
}
