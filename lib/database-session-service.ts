import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { devLog } from "@/lib/dev-logger";

const sql = neon(process.env.DATABASE_URL!);

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId?: string;
  branchName?: string;
  phone?: string;
}

export interface DatabaseSession {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  user?: SessionUser;
}

// Generate a secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Create a new session in the database
export async function createDatabaseSession(
  user: SessionUser,
  request?: NextRequest
): Promise<DatabaseSession> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const ipAddress =
    request?.ip || request?.headers.get("x-forwarded-for") || null;
  const userAgent = request?.headers.get("user-agent") || null;

  try {
    const sessions = await sql`
      INSERT INTO user_sessions (
        user_id, 
        session_token, 
        expires_at, 
        ip_address, 
        user_agent
      )
      VALUES (
        ${user.id}, 
        ${sessionToken}, 
        ${expiresAt.toISOString()}, 
        ${ipAddress}, 
        ${userAgent}
      )
      RETURNING 
        id,
        user_id as "userId",
        session_token as "sessionToken",
        expires_at as "expiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        is_active as "isActive"
    `;

    const session = sessions[0] as DatabaseSession;
    session.user = user;

    return session;
  } catch (error) {
    devLog.error("Error creating database session:", error);
    throw error;
  }
}

// Get session from database by token
export async function getDatabaseSession(
  request?: NextRequest
): Promise<DatabaseSession | null> {
  let sessionToken: string | undefined;

  try {
    if (request) {
      sessionToken = request.cookies.get("session_token")?.value;
    } else {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get("session_token")?.value;
    }

    if (!sessionToken) {
      return null;
    }

    const sessions = await sql`
      SELECT 
        s.id,
        s.user_id as "userId",
        s.session_token as "sessionToken",
        s.expires_at as "expiresAt",
        s.created_at as "createdAt",
        s.updated_at as "updatedAt",
        s.ip_address as "ipAddress",
        s.user_agent as "userAgent",
        s.is_active as "isActive",
        u.id as "user_id",
        u.email as "user_email",
        u.first_name as "user_firstName",
        u.last_name as "user_lastName",
        u.role as "user_role",
        u.primary_branch_id as "user_branchId",
        u.phone as "user_phone",
        b.name as "user_branchName"
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN branches b ON u.primary_branch_id = b.id
      WHERE s.session_token = ${sessionToken}
        AND s.expires_at > NOW()
        AND s.is_active = true
        AND u.status = 'active'
      LIMIT 1
    `;

    if (sessions.length === 0) {
      return null;
    }

    const sessionData = sessions[0];
    const session: DatabaseSession = {
      id: sessionData.id,
      userId: sessionData.userId,
      sessionToken: sessionData.sessionToken,
      expiresAt: new Date(sessionData.expiresAt),
      createdAt: new Date(sessionData.createdAt),
      updatedAt: new Date(sessionData.updatedAt),
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      isActive: sessionData.isActive,
      user: {
        id: sessionData.user_id,
        email: sessionData.user_email,
        firstName: sessionData.user_firstName,
        lastName: sessionData.user_lastName,
        role: sessionData.user_role,
        branchId: sessionData.user_branchId,
        branchName: sessionData.user_branchName,
        phone: sessionData.user_phone,
      },
    };

    return session;
  } catch (error) {
    devLog.error("Error getting database session:", error);
    return null;
  }
}

// Update session last activity
export async function updateSessionActivity(
  sessionToken: string
): Promise<void> {
  try {
    await sql`
      UPDATE user_sessions 
      SET updated_at = NOW()
      WHERE session_token = ${sessionToken}
        AND expires_at > NOW()
        AND is_active = true
    `;
  } catch (error) {
    devLog.error("Error updating session activity:", error);
  }
}

// Delete a specific session
export async function deleteDatabaseSession(
  sessionToken?: string
): Promise<void> {
  if (!sessionToken) {
    devLog.info("No session token to delete");
    return;
  }

  try {
    await sql`
      UPDATE user_sessions 
      SET is_active = false, updated_at = NOW()
      WHERE session_token = ${sessionToken}
    `;

    devLog.info("Database session deleted");
  } catch (error) {
    devLog.error("Error deleting database session:", error);
  }
}

// Delete all sessions for a user
export async function deleteAllUserSessions(userId: string): Promise<void> {
  try {
    await sql`
      UPDATE user_sessions 
      SET is_active = false
      WHERE user_id = ${userId}
    `;

    devLog.info("All sessions deleted for user:", userId);
  } catch (error) {
    devLog.error("Error deleting all user sessions:", error);
  }
}

// Get all active sessions for a user
export async function getUserSessions(
  userId: string
): Promise<DatabaseSession[]> {
  try {
    const sessions = await sql`
      SELECT 
        id,
        user_id as "userId",
        session_token as "sessionToken",
        expires_at as "expiresAt",
        created_at as "createdAt",
        updated_at as "updatedAt",
        ip_address as "ipAddress",
        user_agent as "userAgent",
        is_active as "isActive"
      FROM user_sessions
      WHERE user_id = ${userId}
        AND expires_at > NOW()
        AND is_active = true
      ORDER BY updated_at DESC
    `;

    return sessions.map((session) => ({
      ...session,
      expiresAt: new Date(session.expiresAt),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    }));
  } catch (error) {
    devLog.error("Error getting user sessions:", error);
    return [];
  }
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await sql`
      DELETE FROM user_sessions 
      WHERE expires_at < NOW() OR is_active = false
    `;
    devLog.info("Expired sessions cleaned up");
  } catch (error) {
    devLog.error("Error cleaning up expired sessions:", error);
  }
}
