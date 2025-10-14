import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Account ID is required" },
        { status: 400 }
      );
    }

    console.log("[FLOAT] Reactivating account:", accountId);

    // TEMP: Hardcoded user (replace with real auth later)
    const user = {
      id: "00000000-0000-0000-0000-000000000000",
      name: "System User",
      username: "system",
      role: "Admin",
      branchId: "635844ab-029a-43f8-8523-d7882915266a",
      branchName: "Main Branch",
    };

    const isAdmin = user.role === "Admin" || user.role === "admin";

    // Get the account to check permissions
    const account = await sql`
      SELECT * FROM float_accounts WHERE id = ${accountId}
    `;

    if (account.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Float account not found" },
        { status: 404 }
      );
    }

    const floatAccount = account.rows[0];

    // Check if user has permission to reactivate this account
    if (!isAdmin && floatAccount.branch_id !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied to this account" },
        { status: 403 }
      );
    }

    // Reactivate the account
    const result = await sql`
      UPDATE float_accounts 
      SET is_active = true, updated_at = NOW()
      WHERE id = ${accountId}
      RETURNING *
    `;

    console.log("[FLOAT] Account reactivated successfully:", result.rows[0]);

    return NextResponse.json({
      success: true,
      account: result.rows[0],
      message: "Float account reactivated successfully",
    });
  } catch (error) {
    console.error("[FLOAT] Error reactivating account:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reactivate float account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
