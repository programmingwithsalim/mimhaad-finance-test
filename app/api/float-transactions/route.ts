import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth-service";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId =
      searchParams.get("accountId") || searchParams.get("floatAccountId");
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build the complete query with all conditions
    const query = sql`
      SELECT 
        ft.id,
        ft.float_account_id,
        ft.transaction_type,
        ft.amount,
        ft.balance_before,
        ft.balance_after,
        ft.description,
        ft.created_at,
        ft.reference,
        fa.provider,
        fa.account_type,
        u.name as created_by_name
      FROM float_transactions ft
      LEFT JOIN float_accounts fa ON ft.float_account_id = fa.id
      LEFT JOIN users u ON ft.processed_by = u.id
      WHERE 1=1
      ${accountId ? sql`AND ft.float_account_id = ${accountId}` : sql``}
      ${type ? sql`AND ft.transaction_type = ${type}` : sql``}
      ${startDate ? sql`AND ft.created_at >= ${startDate}` : sql``}
      ${endDate ? sql`AND ft.created_at <= ${endDate}` : sql``}
      ${
        session.user.role !== "Admin" && session.user.branchId
          ? sql`AND ft.branch_id = ${session.user.branchId}`
          : sql``
      }
      ORDER BY ft.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const transactions = await query;

    // Get total count for pagination
    const countQuery = sql`
      SELECT COUNT(*) as total
      FROM float_transactions ft
      WHERE 1=1
      ${accountId ? sql`AND ft.float_account_id = ${accountId}` : sql``}
      ${type ? sql`AND ft.transaction_type = ${type}` : sql``}
      ${startDate ? sql`AND ft.created_at >= ${startDate}` : sql``}
      ${endDate ? sql`AND ft.created_at <= ${endDate}` : sql``}
      ${
        session.user.role !== "Admin" && session.user.branchId
          ? sql`AND ft.branch_id = ${session.user.branchId}`
          : sql``
      }
    `;

    const countResult = await countQuery;
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching float transactions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
