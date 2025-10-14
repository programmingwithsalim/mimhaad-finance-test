import { NextRequest, NextResponse } from "next/server";
import { EnhancedFloatStatementService } from "@/lib/services/enhanced-float-statement-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    // Get current user for authentication
    let user;
    try {
      user = await getCurrentUser(request);
      if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } catch (authError) {
      console.warn("Authentication failed:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const floatAccountId = searchParams.get("floatAccountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!floatAccountId) {
      return NextResponse.json(
        { error: "Float account ID is required" },
        { status: 400 }
      );
    }

    // Build filters object - always include GL entries
    const filters = {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeGL: true, // Always include GL entries
    };

    console.log("[ENHANCED FLOAT STATEMENT] Generating statement:", {
      floatAccountId,
      filters,
      userRole: user.role,
      userBranchId: user.branchId,
    });

    // Generate the enhanced float statement
    const result = await EnhancedFloatStatementService.generateFloatStatement(
      floatAccountId,
      filters,
      user
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to generate statement" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error generating float statement:", error);
    return NextResponse.json(
      { error: "Failed to generate statement" },
      { status: 500 }
    );
  }
}
