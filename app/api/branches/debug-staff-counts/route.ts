import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    console.log("Debugging staff count issues...");

    // Check if user_branch_assignments table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_branch_assignments'
      ) as exists
    `;

    // Get all active users
    const activeUsers = await sql`
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        primary_branch_id,
        status
      FROM users 
      WHERE status = 'active'
      ORDER BY first_name, last_name
    `;

    // Get all branches
    const branches = await sql`
      SELECT 
        id,
        name,
        staff_count
      FROM branches 
      WHERE status = 'active'
      ORDER BY name
    `;

    // Get user branch assignments
    const userBranchAssignments = await sql`
      SELECT 
        uba.user_id,
        uba.branch_id,
        uba.is_primary,
        u.first_name,
        u.last_name,
        u.email,
        b.name as branch_name
      FROM user_branch_assignments uba
      JOIN users u ON uba.user_id = u.id
      JOIN branches b ON uba.branch_id = b.id
      WHERE u.status = 'active'
      ORDER BY b.name, u.first_name
    `;

    // Count users per branch
    const usersPerBranch = await sql`
      SELECT 
        b.id,
        b.name,
        b.staff_count as current_staff_count,
        COUNT(u.id) as actual_user_count
      FROM branches b
      LEFT JOIN user_branch_assignments uba ON b.id = uba.branch_id
      LEFT JOIN users u ON uba.user_id = u.id AND u.status = 'active'
      WHERE b.status = 'active'
      GROUP BY b.id, b.name, b.staff_count
      ORDER BY b.name
    `;

    const debugInfo = {
      tableExists: tableExists[0]?.exists || false,
      totalActiveUsers: activeUsers.length,
      totalBranches: branches.length,
      totalUserBranchAssignments: userBranchAssignments.length,
      activeUsers: activeUsers,
      branches: branches,
      userBranchAssignments: userBranchAssignments,
      usersPerBranch: usersPerBranch,
    };

    console.log("Debug info:", debugInfo);

    return NextResponse.json({
      success: true,
      debugInfo,
    });
  } catch (error) {
    console.error("Error debugging staff counts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to debug staff counts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
