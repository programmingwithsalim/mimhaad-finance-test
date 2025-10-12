import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to initialize agency banking float account
async function initializeAgencyBankingFloatAccount(
  branchId: string,
  createdBy: string
) {
  try {
    // Check if agency banking account already exists
    const existingAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId} 
      AND account_type = 'agency-banking' 
      AND is_active = true
      LIMIT 1
    `;

    if (existingAccount.length > 0) {
      return existingAccount[0];
    }

    // Create new agency banking float account
    const newAccount = await sql`
      INSERT INTO float_accounts (
        branch_id, account_type, provider, current_balance, 
        min_threshold, max_threshold, is_active, created_by
      ) VALUES (
        ${branchId}, 'agency-banking', 'Agency Banking', 0.00, 
        1000.00, 100000.00, true, ${createdBy}
      ) RETURNING *
    `;

    return newAccount[0];
  } catch (error) {
    console.error("Error initializing agency banking float account:", error);
    throw error;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: branchId } = await params;
    const body = await request.json();
    const createdBy = body.created_by || "system";

    // Initialize the agency banking float account
    const account = await initializeAgencyBankingFloatAccount(
      branchId,
      createdBy
    );

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error("Error initializing agency banking:", error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to initialize agency banking: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
