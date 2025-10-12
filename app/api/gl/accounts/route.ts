import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    // Get user context for authorization
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (error) {
      console.warn("Authentication failed:", error);
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const active = searchParams.get("active");
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const branch = searchParams.get("branch");

    // Determine effective branch filter based on user role
    const isAdmin = user.role === "admin" || user.role === "Admin";
    const effectiveBranchId = isAdmin ? branch : user.branchId;
    const branchFilter =
      effectiveBranchId && effectiveBranchId !== "all"
        ? sql`AND branch_id = ${effectiveBranchId}`
        : sql``;

    // Build the WHERE clause and parameters
    let whereParts: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (active === "true") {
      whereParts.push(`is_active = true`);
    }
    if (type) {
      whereParts.push(`type = $${paramIndex++}`);
      params.push(type);
    }
    if (search) {
      whereParts.push(
        `(code ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    let whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    // Add branch filter to the query
    const branchFilterClause =
      effectiveBranchId && effectiveBranchId !== "all"
        ? `AND branch_id = '${effectiveBranchId}'`
        : "";

    const query = `
      SELECT 
        id,
        code as account_code,
        name as account_name,
        type as account_type,
        COALESCE(balance, 0) as balance,
        is_active,
        branch_id
      FROM gl_accounts
      ${whereClause} ${branchFilterClause}
      ORDER BY code ASC
    `;

    // Use sql.query for parameterized queries
    const accountsResult: any = await sql.query(query, params);
    const accountsArray = Array.isArray(accountsResult)
      ? accountsResult
      : accountsResult.rows
      ? accountsResult.rows
      : [];

    return NextResponse.json({
      success: true,
      accounts: accountsArray.map((account: any) => ({
        id: account.id,
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        balance: Number(account.balance) || 0,
        is_active: account.is_active,
        branch_id: account.branch_id,
      })),
    });
  } catch (error: unknown) {
    console.error("Error fetching GL accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch GL accounts",
        details: (error as any)?.message
          ? (error as any).message
          : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Get user context for authorization
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (error) {
      console.warn("Authentication failed:", error);
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      account_code,
      account_name,
      account_type,
      parent_id,
      description,
      is_active = true,
      branch_id,
    } = body;

    if (!account_code || !account_name || !account_type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Use user's branch ID if not admin, or provided branch_id if admin
    const effectiveBranchId =
      user.role === "admin" || user.role === "Admin"
        ? branch_id || user.branchId
        : user.branchId;

    if (!effectiveBranchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Check if account code already exists for this branch
    const existing = await sql`
      SELECT id FROM gl_accounts 
      WHERE code = ${account_code} AND branch_id = ${effectiveBranchId}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Account code already exists for this branch",
        },
        { status: 400 }
      );
    }

    // Create new account with UUID generation
    const result = await sql`
      INSERT INTO gl_accounts (
        id,
        code, 
        name, 
        type, 
        parent_id, 
        is_active, 
        balance,
        branch_id,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${account_code}, 
        ${account_name}, 
        ${account_type}, 
        ${parent_id || null}, 
        ${is_active}, 
        0,
        ${effectiveBranchId},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      account: result[0],
      message: "GL account created successfully",
    });
  } catch (error) {
    console.error("Error creating GL account:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create GL account",
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
