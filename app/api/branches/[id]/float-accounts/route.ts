import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;

    if (!branchId) {
      return NextResponse.json(
        { error: "Branch ID is required" },
        { status: 400 }
      );
    }

    console.log("Hello 1");

    // RBAC: Allow Admin, Manager, Finance, Cashier, and Operations for their own branch
    const user = await getCurrentUser(request);
    console.log("Current user:", {
      id: user.id,
      role: user.role,
      branchId: user.branchId,
    });

    const isAdmin = user.role === "Admin" || user.role === "admin";
    const isManager = user.role === "Manager" || user.role === "manager";
    const isFinanceOwnBranch =
      (user.role === "Finance" || user.role === "finance") &&
      user.branchId === branchId;
    const isCashierOwnBranch =
      (user.role === "Cashier" || user.role === "cashier") &&
      user.branchId === branchId;
    const isOperationsOwnBranch =
      (user.role === "Operations" || user.role === "operations") &&
      user.branchId === branchId;

    console.log("RBAC check:", {
      isAdmin,
      isManager,
      isFinanceOwnBranch,
      isCashierOwnBranch,
      isOperationsOwnBranch,
      userBranchId: user.branchId,
      requestedBranchId: branchId,
    });

    if (
      !isAdmin &&
      !isManager &&
      !isFinanceOwnBranch &&
      !isCashierOwnBranch &&
      !isOperationsOwnBranch
    ) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to these float accounts." },
        { status: 403 }
      );
    }
    console.log("Hello 2");

    console.log("[API] Fetching float accounts for branch:", branchId);

    // First, check if the branch exists
    const branchCheck = await sql`
      SELECT id, name FROM branches WHERE id = ${branchId}
    `;
    console.log("Branch check result:", branchCheck);

    // Get float accounts for the specific branch
    const accounts = await sql`
    SELECT 
    fa.*,
    b.name as branch_name,
    b.code as branch_code
      FROM float_accounts fa
      LEFT JOIN branches b ON fa.branch_id = b.id
      WHERE fa.branch_id = ${branchId}
      AND fa.is_active = true
      ORDER BY fa.account_type, fa.provider, fa.created_at DESC
      `;

    console.log("Raw float accounts query result:", accounts);
    console.log("Hello 3");

    // Format the response
    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      branch_id: account.branch_id,
      branch_name: account.branch_name || "Unknown Branch",
      account_type: account.account_type,
      provider: account.provider,
      current_balance: Number(account.current_balance || 0),
      min_threshold: Number(account.min_threshold || 0),
      max_threshold: Number(account.max_threshold || 0),
      last_updated: account.updated_at || account.created_at,
      created_at: account.created_at,
      status: account.is_active ? "active" : "inactive",
      account_number: account.account_number,
      is_active: account.is_active,
    }));
    console.log("Hello 4");

    console.log(
      `[API] Found ${formattedAccounts.length} float accounts for branch ${branchId}`
    );
    return NextResponse.json({
      success: true,
      accounts: formattedAccounts,
      branch_id: branchId,
      total: formattedAccounts.length,
    });
  } catch (error) {
    console.error("Error fetching branch float accounts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch float accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
