import { type NextRequest, NextResponse } from "next/server";
// Note: This endpoint is deprecated. Use /api/expenses?status=approved instead
// import { getExpenseSummary } from "@/lib/expense-service"

export async function GET(request: NextRequest) {
  try {
    // Redirect to main expenses endpoint
    return NextResponse.json(
      {
        message:
          "This endpoint is deprecated. Use /api/expenses?status=approved instead",
      },
      { status: 410 }
    ); // Gone
  } catch (error) {
    console.error("Error in GET /api/expenses/summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch expense summary" },
      { status: 500 }
    );
  }
}
