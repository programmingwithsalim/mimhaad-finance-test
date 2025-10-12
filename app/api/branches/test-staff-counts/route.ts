import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    console.log("🧪 Testing staff count functionality...");

    // 1. Check if user_branch_assignments table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_branch_assignments'
      ) as exists
    `;

    console.log("Table exists:", tableExists[0]?.exists);

    // 2. Get all active users
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

    console.log("Active users:", activeUsers.length);

    // 3. Get all branches
    const branches = await sql`
      SELECT 
        id,
        name,
        staff_count
      FROM branches 
      WHERE status = 'active'
      ORDER BY name
    `;

    console.log("Active branches:", branches.length);

    // 4. Get current user branch assignments
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

    console.log("User branch assignments:", userBranchAssignments.length);

    // 5. Manually update staff counts for each branch
    const updateResults = [];
    for (const branch of branches) {
      const staffCount = await sql`
        SELECT COUNT(DISTINCT u.id) as staff_count
        FROM users u
        INNER JOIN user_branch_assignments uba ON u.id = uba.user_id
        WHERE uba.branch_id = ${branch.id}
        AND u.status = 'active'
      `;

      const count = staffCount[0]?.staff_count || 0;

      await sql`
        UPDATE branches 
        SET staff_count = ${count},
            updated_at = NOW()
        WHERE id = ${branch.id}
      `;

      updateResults.push({
        branchId: branch.id,
        branchName: branch.name,
        previousCount: branch.staff_count || 0,
        newCount: count,
      });

      console.log(
        `Updated ${branch.name}: ${branch.staff_count || 0} → ${count} staff`
      );
    }

    // 6. Get updated branches
    const updatedBranches = await sql`
      SELECT 
        id,
        name,
        staff_count
      FROM branches 
      WHERE status = 'active'
      ORDER BY name
    `;

    return NextResponse.json({
      success: true,
      testResults: {
        tableExists: tableExists[0]?.exists,
        activeUsers: activeUsers.length,
        activeBranches: branches.length,
        userBranchAssignments: userBranchAssignments.length,
        updateResults,
        updatedBranches,
      },
    });
  } catch (error) {
    console.error("❌ Error testing staff counts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to test staff counts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
