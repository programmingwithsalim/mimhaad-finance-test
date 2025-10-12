import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to get agency banking float account
async function getAgencyBankingFloatAccount(branchId: string) {
  try {
    const account = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId} 
      AND account_type = 'agency-banking' 
      AND is_active = true
      LIMIT 1
    `;
    return account[0] || null;
  } catch (error) {
    console.error("Error getting agency banking float account:", error);
    return null;
  }
}

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: branchId } = await params;
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") || undefined;

    // Get the agency banking float account for this branch
    const account = await getAgencyBankingFloatAccount(branchId);

    if (!account) {
      return NextResponse.json(
        { error: "Agency banking float account not found for this branch" },
        { status: 404 }
      );
    }

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Error fetching agency banking float account:", error);
    return NextResponse.json(
      {
        error: `Failed to fetch agency banking float account: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
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

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Error initializing agency banking float account:", error);
    return NextResponse.json(
      {
        error: `Failed to initialize agency banking float account: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
