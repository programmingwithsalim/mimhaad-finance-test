import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export class BranchStaffService {
  /**
   * Update the staff count for a specific branch
   */
  static async updateBranchStaffCount(branchId: string): Promise<number> {
    try {
      // Count active users assigned to this branch
      const result = await sql`
        SELECT COUNT(DISTINCT u.id) as staff_count
        FROM users u
        INNER JOIN user_branch_assignments uba ON u.id = uba.user_id
        WHERE uba.branch_id = ${branchId}
        AND u.status = 'active'
      `;

      const staffCount = result[0]?.staff_count || 0;

      // Update the branch's staff count
      await sql`
        UPDATE branches 
        SET staff_count = ${staffCount},
            updated_at = NOW()
        WHERE id = ${branchId}
      `;

      console.log(`Updated staff count for branch ${branchId}: ${staffCount}`);
      return staffCount;
    } catch (error) {
      console.error("Error updating branch staff count:", error);
      throw new Error("Failed to update branch staff count");
    }
  }

  /**
   * Update staff counts for all branches
   */
  static async updateAllBranchStaffCounts(): Promise<void> {
    try {
      // Get all branches
      const branches = await sql`
        SELECT id FROM branches WHERE status = 'active'
      `;

      // Update staff count for each branch
      for (const branch of branches) {
        await this.updateBranchStaffCount(branch.id);
      }

      console.log(`Updated staff counts for ${branches.length} branches`);
    } catch (error) {
      console.error("Error updating all branch staff counts:", error);
      throw new Error("Failed to update all branch staff counts");
    }
  }

  /**
   * Get staff count for a specific branch
   */
  static async getBranchStaffCount(branchId: string): Promise<number> {
    try {
      const result = await sql`
        SELECT staff_count 
        FROM branches 
        WHERE id = ${branchId}
      `;

      return result[0]?.staff_count || 0;
    } catch (error) {
      console.error("Error getting branch staff count:", error);
      return 0;
    }
  }

  /**
   * Get detailed staff information for a branch
   */
  static async getBranchStaffDetails(branchId: string): Promise<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      status: string;
      isPrimary: boolean;
    }>
  > {
    try {
      const staff = await sql`
        SELECT 
          u.id,
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.email,
          u.role,
          u.status,
          uba.is_primary as "isPrimary"
        FROM users u
        INNER JOIN user_branch_assignments uba ON u.id = uba.user_id
        WHERE uba.branch_id = ${branchId}
        ORDER BY uba.is_primary DESC, u.first_name, u.last_name
      `;

      return staff;
    } catch (error) {
      console.error("Error getting branch staff details:", error);
      return [];
    }
  }
}
