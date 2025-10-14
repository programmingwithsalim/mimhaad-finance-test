import { type NextRequest, NextResponse } from "next/server";
import { deleteDatabaseSession } from "@/lib/database-session-service";

export async function POST(request: NextRequest) {
  try {
    console.log("Processing logout request");

    // Get session token from cookies
    const sessionToken = request.cookies.get("session_token")?.value;

    if (sessionToken) {
      try {
        // Invalidate session in database using the proper service
        await deleteDatabaseSession(sessionToken);
        console.log("Session invalidated in database");
      } catch (dbError) {
        console.error("⚠️ Error invalidating session in database:", dbError);
        // Continue with logout even if DB update fails
      }
    }

    // Create response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear all auth-related cookies
    response.cookies.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    response.cookies.set("user-data", "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    console.log("Logout successful, cookies cleared");
    return response;
  } catch (error) {
    console.error("Logout error:", error);

    // Even if there's an error, clear cookies and return success
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    response.cookies.set("user-data", "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  }
}
