import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request) {
  try {
    // Get user context
    const user = await getCurrentUser(request);
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse pagination params
    const url = request?.nextUrl || request?.url || {};
    const searchParams =
      url.searchParams || new URL(url, "http://localhost").searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const offset = (page - 1) * pageSize;

    // Parse branchId from query or use user's branchId
    let branchId = searchParams.get("branchId");
    if (!branchId && user.role !== "Admin") {
      branchId = user.branchId;
    }

    // Build branch filter SQL
    const branchFilter = branchId ? sql`AND a.branch_id = ${branchId}` : sql``;
    const branchFilterWhere = branchId
      ? sql`WHERE a.is_active = true AND a.branch_id = ${branchId}`
      : sql`WHERE a.is_active = true`;

    // Get total count
    const totalResult =
      await sql`SELECT COUNT(*) AS total FROM gl_accounts a ${branchFilterWhere}`;
    const total_accounts = Number(totalResult[0]?.total || 0);

    // Join gl_accounts with gl_account_balances and branches to get all account info, balances, and branch info
    // Filter out invalid UUIDs in account_id to prevent errors
    const accountsWithBalances = await sql`
      SELECT 
        a.id,
        a.code AS account_code,
        a.name AS account_name,
        a.type AS account_type,
        a.branch_id,
        a.is_active,
        a.created_at,
        a.updated_at,
        b.current_balance AS balance,
        b.last_updated,
        br.name AS branch_name,
        br.code AS branch_code
      FROM gl_accounts a
      LEFT JOIN gl_account_balances b ON a.id = b.account_id::uuid
      LEFT JOIN branches br ON a.branch_id = br.id
      WHERE a.is_active = true
        ${branchId ? sql`AND a.branch_id = ${branchId}` : sql``}
        AND (b.account_id IS NULL OR b.account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      ORDER BY a.code
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    return NextResponse.json({
      success: true,
      accounts: accountsWithBalances,
      total_accounts,
      page,
      pageSize,
      totalPages: Math.ceil(total_accounts / pageSize),
    });
  } catch (error) {
    console.error("Error fetching GL accounts from database:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch GL accounts from database",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
