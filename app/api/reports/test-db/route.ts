import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    console.log("🔍 Test DB API called");

    // Test authentication
    let user;
    try {
      user = await getCurrentUser(request);
      console.log("👤 User authenticated:", {
        name: user.name,
        role: user.role,
        branchId: user.branchId,
      });
    } catch (error) {
      console.error("❌ Authentication failed:", error);
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Test database connection
    try {
      const testResult = await sql`SELECT 1 as test`;
      console.log("✅ Database connection successful:", testResult);

      // Test if tables exist
      const tableTest = await sql`
        SELECT 
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agency_banking_transactions') as agency_exists,
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'momo_transactions') as momo_exists,
          EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') as expenses_exists
      `;

      console.log("📋 Table existence check:", tableTest[0]);

      return NextResponse.json({
        success: true,
        data: {
          dbConnection: "OK",
          user: {
            name: user.name,
            role: user.role,
            branchId: user.branchId,
          },
          tables: tableTest[0],
        },
      });
    } catch (dbError) {
      console.error("❌ Database connection failed:", dbError);
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed",
          details:
            dbError instanceof Error
              ? dbError.message
              : "Unknown database error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Test DB API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
