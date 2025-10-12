import { NextRequest, NextResponse } from "next/server";
import { OptimizedFloatStatementService } from "@/lib/services/optimized-float-statement-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { devLog } from "@/lib/dev-logger";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user || user.id === "00000000-0000-0000-0000-000000000000") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const floatAccountId = searchParams.get("floatAccountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Number.parseInt(searchParams.get("page") || "1");
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "50");

    if (!floatAccountId) {
      return NextResponse.json(
        { error: "Float account ID is required" },
        { status: 400 }
      );
    }

    devLog.info(
      `📊 Generating optimized statement for float ${floatAccountId}`,
      {
        startDate,
        endDate,
        page,
        pageSize,
      }
    );

    // Generate statement
    const result = await OptimizedFloatStatementService.generateStatement({
      floatAccountId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      pageSize,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to generate statement" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    devLog.error("Error generating optimized float statement:", error);
    return NextResponse.json(
      {
        error: "Failed to generate statement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



