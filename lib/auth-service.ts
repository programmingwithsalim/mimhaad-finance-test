import { neon } from "@neondatabase/serverless";
import { hashPassword, verifyPassword } from "./password-utils";
import { getDatabaseSession } from "./database-session-service";
import type { NextRequest } from "next/server";

const sql = neon(process.env.DATABASE_URL!);

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId?: string;
  branchName?: string;
}

/**
 * Authenticate user with email and password
 */
export async function authenticate(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  try {

    // Get user from database
    const users = await sql`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.password_hash,
        u.role,
        u.status,
        u.primary_branch_id,
        b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.primary_branch_id = b.id
      WHERE u.email = ${email.toLowerCase()}
        AND u.status = 'active'
      LIMIT 1
    `;

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      branchId: user.primary_branch_id,
      branchName: user.branch_name,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get session from request (alias for getDatabaseSession)
 */
export async function getSession(
  request?: NextRequest
): Promise<{ user: AuthenticatedUser } | null> {
  try {
    const session = await getDatabaseSession(request);
    if (!session || !session.user) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        role: session.user.role,
        branchId: session.user.branchId,
        branchName: session.user.branchName,
      },
    };
  } catch (error) {
    return null;
  }
}

// Re-export password functions
export { hashPassword, verifyPassword };
