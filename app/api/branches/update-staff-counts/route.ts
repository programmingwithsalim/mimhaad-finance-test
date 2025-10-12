import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { BranchStaffService } from "@/lib/services/branch-staff-service";

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    console.log("🔄 Starting staff count update for all branches...");

    // First, check if user_branch_assignments table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_branch_assignments'
      ) as exists
    `;

    if (!tableExists[0]?.exists) {
      console.log(
        "📋 user_branch_assignments table does not exist, creating it..."
      );

      // Create the user_branch_assignments table
      await sql`
        CREATE TABLE IF NOT EXISTS user_branch_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
          is_primary BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, branch_id)
        )
      `;

      // Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_user_branch_assignments_user_id ON user_branch_assignments(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_branch_assignments_branch_id ON user_branch_assignments(branch_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_branch_assignments_primary ON user_branch_assignments(is_primary)`;

      console.log("✅ user_branch_assignments table created successfully");
    }

    // Ensure all active users are properly assigned to branches
    console.log("🔍 Checking for users without branch assignments...");

    const usersWithoutAssignments = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.primary_branch_id,
        u.status
      FROM users u
      LEFT JOIN user_branch_assignments uba ON u.id = uba.user_id
      WHERE u.status = 'active'
      AND uba.user_id IS NULL
      AND u.primary_branch_id IS NOT NULL
    `;

    console.log(
      `📊 Found ${usersWithoutAssignments.length} users without branch assignments`
    );

    // Check for users with no branch assignment at all
    const usersWithNoBranch = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.status
      FROM users u
      WHERE u.status = 'active'
      AND u.primary_branch_id IS NULL
      AND u.role != 'admin'
    `;

    console.log(
      `⚠️ Found ${usersWithNoBranch.length} active users with no branch assignment at all`
    );

    if (usersWithNoBranch.length > 0) {
      console.log("👥 Users with no branch assignment:");
      usersWithNoBranch.forEach((user) => {
        console.log(
          `   - ${user.first_name} ${user.last_name} (${user.email}) - ${user.role}`
        );
      });
    }

    // Assign users to branches if they're missing from user_branch_assignments
    for (const user of usersWithoutAssignments) {
      const branchId = user.primary_branch_id;
      if (branchId) {
        try {
          await sql`
            INSERT INTO user_branch_assignments (user_id, branch_id, is_primary)
            VALUES (${user.id}, ${branchId}, true)
            ON CONFLICT (user_id, branch_id) DO NOTHING
          `;
          console.log(`✅ Assigned user ${user.email} to branch ${branchId}`);
        } catch (error) {
          console.warn(
            `⚠️ Failed to assign user ${user.email} to branch ${branchId}:`,
            error
          );
        }
      }
    }

    // Get all active branches
    const branches = await sql`
      SELECT id, name, staff_count FROM branches WHERE status = 'active'
    `;

    console.log(`🏢 Found ${branches.length} active branches to update`);

    const results = {
      totalBranches: branches.length,
      updatedBranches: 0,
      errors: [] as string[],
      branchResults: [] as Array<{
        id: string;
        name: string;
        previousStaffCount: number;
        newStaffCount: number;
        staffDetails: Array<{
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          role: string;
          isPrimary: boolean;
        }>;
      }>,
    };

    // Update staff count for each branch
    for (const branch of branches) {
      try {
        console.log(`🔄 Updating staff count for branch: ${branch.name}`);

        // Get current staff count
        const previousStaffCount = branch.staff_count || 0;

        // Get detailed staff information
        const staffDetails = await sql`
          SELECT 
            u.id,
            u.first_name as "firstName",
            u.last_name as "lastName",
            u.email,
            u.role,
            uba.is_primary as "isPrimary"
          FROM users u
          INNER JOIN user_branch_assignments uba ON u.id = uba.user_id
          WHERE uba.branch_id = ${branch.id}
          AND u.status = 'active'
          ORDER BY uba.is_primary DESC, u.first_name, u.last_name
        `;

        const newStaffCount = staffDetails.length;

        // Update the branch's staff count
        await sql`
          UPDATE branches 
          SET staff_count = ${newStaffCount},
              updated_at = NOW()
          WHERE id = ${branch.id}
        `;

        results.updatedBranches++;
        results.branchResults.push({
          id: branch.id,
          name: branch.name,
          previousStaffCount,
          newStaffCount,
          staffDetails,
        });

        console.log(
          `✅ Updated ${branch.name}: ${previousStaffCount} → ${newStaffCount} staff`
        );

        // Log staff details for debugging
        if (newStaffCount > 0) {
          console.log(`👥 Staff in ${branch.name}:`);
          staffDetails.forEach((staff) => {
            console.log(
              `   - ${staff.firstName} ${staff.lastName} (${staff.email}) - ${
                staff.role
              }${staff.isPrimary ? " [Primary]" : ""}`
            );
          });
        }
      } catch (error) {
        const errorMessage = `Failed to update ${branch.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        results.errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }

    console.log(
      `🎉 Staff count update completed: ${results.updatedBranches}/${results.totalBranches} branches updated`
    );

    // Log summary
    const totalStaff = results.branchResults.reduce(
      (sum, branch) => sum + branch.newStaffCount,
      0
    );
    console.log(`📊 Total staff across all branches: ${totalStaff}`);

    return NextResponse.json({
      success: true,
      message: `Updated staff count for ${results.updatedBranches} out of ${results.totalBranches} branches. Total staff: ${totalStaff}`,
      results,
      summary: {
        totalBranches: results.totalBranches,
        updatedBranches: results.updatedBranches,
        totalStaff,
        usersWithoutAssignments: usersWithoutAssignments.length,
        usersWithNoBranch: usersWithNoBranch.length,
        errors: results.errors.length,
      },
      usersWithNoBranch: usersWithNoBranch.length > 0 ? usersWithNoBranch : [],
    });
  } catch (error) {
    console.error("❌ Error updating staff counts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update staff counts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
