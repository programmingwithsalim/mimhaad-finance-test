import { type NextRequest, NextResponse } from "next/server"
import { hasPermission } from "./permissions"
import type { Permission } from "./types"

// Get user from request (this is a placeholder - implement based on your auth system)
async function getUserFromRequest(req: NextRequest) {
  // This is a placeholder - you should implement this based on your auth system
  // For example, you might get the user from a JWT token in the Authorization header
  // or from a session cookie

  // For now, we'll just return a mock user
  return {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin" as const,
  }
}

// Middleware to check if the user has the required permission
export async function rbacMiddleware(req: NextRequest, permission: Permission) {
  try {
    // Get user from request
    const user = await getUserFromRequest(req)

    // If no user, return 401
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has permission
    if (!hasPermission(user.role, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // User has permission, continue
    return null
  } catch (error) {
    console.error("RBAC middleware error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Higher-order function to protect a route handler
export function withPermission(permission: Permission) {
  return async (req: NextRequest) => {
    const middlewareResponse = await rbacMiddleware(req, permission)

    if (middlewareResponse) {
      return middlewareResponse
    }

    // Continue with the request
    // You would implement your actual route handler logic here
    return NextResponse.json({ success: true })
  }
}
