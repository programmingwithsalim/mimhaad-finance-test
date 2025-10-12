import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { BranchStaffService } from "./services/branch-staff-service";

const sql = neon(process.env.DATABASE_URL!);

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  primaryBranchId?: string;
  branchIds?: string[];
  status: string;
  passwordHash?: string;
  lastLogin?: string | null;
  createdAt: string;
  updatedAt: string;
  avatar?: string;
  primaryBranchName?: string;
}

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: string;
  primaryBranchId: string;
  branchIds: string[];
  status: string;
  avatar?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  primaryBranchId?: string;
  branchIds?: string[];
  status?: string;
  avatar?: string;
}

// Get all users with their branch information
export async function getAllUsers(): Promise<User[]> {
  try {
    const users = await sql`
      SELECT 
        u.id,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.phone,
        u.role,
        u.primary_branch_id as "primaryBranchId",
        u.status,
        u.last_login as "lastLogin",
        u.created_at as "createdAt",
        u.updated_at as "updatedAt",
        u.avatar,
        b.name as "primaryBranchName",
        COALESCE(
          ARRAY_AGG(
            DISTINCT uba.branch_id
          ) FILTER (WHERE uba.branch_id IS NOT NULL),
          ARRAY[]::UUID[]
        ) as "branchIds"
      FROM users u
      LEFT JOIN branches b ON u.primary_branch_id = b.id
      LEFT JOIN user_branch_assignments uba ON u.id = uba.user_id
      GROUP BY u.id, b.name
      ORDER BY u.created_at DESC
    `;

    return users.map((user) => ({
      ...user,
      branchIds: user.branchIds || [],
    }));
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Failed to fetch users");
  }
}

// Get user by ID
export async function getUserById(id: string): Promise<User | null> {
  try {
    const users = await sql`
      SELECT 
        u.id,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.phone,
        u.role,
        u.primary_branch_id as "primaryBranchId",
        u.status,
        u.password_hash as "passwordHash",
        u.last_login as "lastLogin",
        u.created_at as "createdAt",
        u.updated_at as "updatedAt",
        u.avatar,
        b.name as "primaryBranchName",
        COALESCE(
          ARRAY_AGG(
            DISTINCT uba.branch_id
          ) FILTER (WHERE uba.branch_id IS NOT NULL),
          ARRAY[]::UUID[]
        ) as "branchIds"
      FROM users u
      LEFT JOIN branches b ON u.primary_branch_id = b.id
      LEFT JOIN user_branch_assignments uba ON u.id = uba.user_id
      WHERE u.id = ${id}
      GROUP BY u.id, b.name
    `;

    if (users.length === 0) return null;

    const user = users[0];
    return {
      ...user,
      branchIds: user.branchIds || [],
    };
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return null;
  }
}

// Create a new user
export async function createUser(userData: CreateUserData): Promise<User> {
  try {
    // Set default password
    const tempPassword = "Password123!";
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Insert user first
    const newUsers = await sql`
      INSERT INTO users (
        first_name,
        last_name,
        email,
        phone,
        role,
        primary_branch_id,
        status,
        password_hash,
        password_reset_required,
        avatar
      ) VALUES (
        ${userData.firstName},
        ${userData.lastName},
        ${userData.email},
        ${userData.phone || null},
        ${userData.role},
        ${userData.primaryBranchId},
        ${userData.status},
        ${passwordHash},
        true,
        ${userData.avatar || "/placeholder.svg"}
      )
      RETURNING 
        id,
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        role,
        primary_branch_id as "primaryBranchId",
        status,
        created_at as "createdAt",
        updated_at as "updatedAt",
        avatar
    `;

    const newUser = newUsers[0];
    if (!newUser) {
      throw new Error("Failed to create user");
    }

    // Insert branch assignments
    if (userData.branchIds && userData.branchIds.length > 0) {
      for (const branchId of userData.branchIds) {
        try {
          await sql`
            INSERT INTO user_branch_assignments (
              user_id,
              branch_id,
              is_primary
            ) VALUES (
              ${newUser.id},
              ${branchId},
              ${branchId === userData.primaryBranchId}
            )
            ON CONFLICT (user_id, branch_id) DO UPDATE SET
              is_primary = ${branchId === userData.primaryBranchId},
              updated_at = CURRENT_TIMESTAMP
          `;
        } catch (branchError) {
          console.warn(
            `Failed to assign branch ${branchId} to user ${newUser.id}:`,
            branchError
          );
          // Continue with other branches even if one fails
        }
      }

      // Update staff count for all assigned branches
      try {
        for (const branchId of userData.branchIds) {
          await BranchStaffService.updateBranchStaffCount(branchId);
        }
      } catch (staffCountError) {
        console.warn("Failed to update staff count:", staffCountError);
        // Don't fail user creation if staff count update fails
      }
    }

    console.log("User created successfully:", newUser.id);

    // Return the created user with branch information
    const createdUser = await getUserById(newUser.id);
    if (!createdUser) {
      throw new Error("Failed to retrieve created user");
    }

    return createdUser;
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error(
      `Failed to create user: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Update an existing user
export async function updateUser(
  id: string,
  userData: UpdateUserData
): Promise<User | null> {
  try {
    // Update user using tagged template literals
    const updatedUsers = await sql`
      UPDATE users SET
        first_name = COALESCE(${userData.firstName}, first_name),
        last_name = COALESCE(${userData.lastName}, last_name),
        email = COALESCE(${userData.email}, email),
        phone = COALESCE(${userData.phone}, phone),
        role = COALESCE(${userData.role}, role),
        primary_branch_id = COALESCE(${userData.primaryBranchId}, primary_branch_id),
        status = COALESCE(${userData.status}, status),
        avatar = COALESCE(${userData.avatar}, avatar),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING 
        id,
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        role,
        primary_branch_id as "primaryBranchId",
        status,
        avatar,
        updated_at as "updatedAt"
    `;

    if (updatedUsers.length === 0) {
      throw new Error("User not found");
    }

    // Update branch assignments if provided
    if (userData.branchIds !== undefined) {
      // Get current branch assignments before updating
      const currentAssignments = await sql`
        SELECT branch_id FROM user_branch_assignments WHERE user_id = ${id}
      `;
      const currentBranchIds = currentAssignments.map(
        (row: any) => row.branch_id
      );

      // Delete existing assignments
      await sql`
        DELETE FROM user_branch_assignments 
        WHERE user_id = ${id}
      `;

      // Insert new assignments
      if (userData.branchIds.length > 0) {
        for (const branchId of userData.branchIds) {
          try {
            await sql`
              INSERT INTO user_branch_assignments (
                user_id,
                branch_id,
                is_primary
              ) VALUES (
                ${id},
                ${branchId},
                ${branchId === userData.primaryBranchId}
              )
            `;
          } catch (branchError) {
            console.warn(
              `Failed to assign branch ${branchId} to user ${id}:`,
              branchError
            );
            // Continue with other branches even if one fails
          }
        }
      }

      // Update staff count for affected branches
      try {
        const allAffectedBranches = [
          ...new Set([...currentBranchIds, ...userData.branchIds]),
        ];
        for (const branchId of allAffectedBranches) {
          await BranchStaffService.updateBranchStaffCount(branchId);
        }
      } catch (staffCountError) {
        console.warn("Failed to update staff count:", staffCountError);
        // Don't fail user update if staff count update fails
      }
    }

    console.log("User updated successfully:", id);

    // Return the updated user with branch information
    const updatedUser = await getUserById(id);
    return updatedUser;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error(
      `Failed to update user: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Delete a user
export async function deleteUser(id: string): Promise<boolean> {
  try {
    // Delete branch assignments first
    await sql`
      DELETE FROM user_branch_assignments 
      WHERE user_id = ${id}
    `;

    // Delete user
    const result = await sql`
      DELETE FROM users 
      WHERE id = ${id}
    `;

    if (result.count === 0) {
      throw new Error("User not found");
    }

    console.log("User deleted successfully:", id);
    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    return false;
  }
}

// Reset user password
export async function resetUserPassword(
  id: string,
  newPassword?: string
): Promise<{ password: string; success: boolean }> {
  try {
    // Use default password if not provided
    const password = newPassword || "Password123!";
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await sql`
      UPDATE users SET
        password_hash = ${passwordHash},
        password_reset_required = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    if (result.count === 0) {
      throw new Error("User not found");
    }

    console.log("Password reset successfully for user:", id);
    return { password, success: true };
  } catch (error) {
    console.error("Error resetting password:", error);
    throw new Error(
      `Failed to reset password: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Change user password with current password verification
export async function changeUserPassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    // Get user with password hash
    const users = await sql`
      SELECT password_hash
      FROM users
      WHERE id = ${id}
    `;

    if (users.length === 0) {
      throw new Error("User not found");
    }

    const user = users[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );
    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    const result = await sql`
      UPDATE users SET
        password_hash = ${newPasswordHash},
        password_reset_required = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    if (result.count === 0) {
      throw new Error("Failed to update password");
    }

    console.log("Password changed successfully for user:", id);
    return true;
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
}

// Update user avatar
export async function updateUserAvatar(
  id: string,
  avatarUrl: string
): Promise<User | null> {
  try {
    const updatedUsers = await sql`
      UPDATE users SET
        avatar = ${avatarUrl},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING 
        id,
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        role,
        primary_branch_id as "primaryBranchId",
        status,
        avatar,
        updated_at as "updatedAt"
    `;

    if (updatedUsers.length === 0) {
      throw new Error("User not found");
    }

    console.log("Avatar updated successfully for user:", id);

    // Return the updated user with branch information
    const updatedUser = await getUserById(id);
    return updatedUser;
  } catch (error) {
    console.error("Error updating avatar:", error);
    throw new Error(
      `Failed to update avatar: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// Get user statistics
export async function getUserStatistics() {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE role = 'Admin') as admins,
        COUNT(*) FILTER (WHERE role = 'Manager') as managers,
        COUNT(*) FILTER (WHERE role = 'Cashier') as cashiers
      FROM users
    `;

    const result = stats[0];
    return {
      total: Number.parseInt(result.total),
      active: Number.parseInt(result.active),
      inactive: Number.parseInt(result.inactive),
      admins: Number.parseInt(result.admins),
      managers: Number.parseInt(result.managers),
      cashiers: Number.parseInt(result.cashiers),
    };
  } catch (error) {
    console.error("Error fetching user statistics:", error);
    throw new Error("Failed to fetch user statistics");
  }
}

// Sync all branches with user data (utility function)
export async function syncAllBranchesWithUserData(): Promise<boolean> {
  try {
    // This function can be used to ensure data consistency
    // For now, it's a placeholder that returns true
    console.log("Syncing branches with user data...");
    return true;
  } catch (error) {
    console.error("Error syncing branches with user data:", error);
    return false;
  }
}
