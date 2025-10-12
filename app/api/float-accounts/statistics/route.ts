import { NextResponse } from "next/server";
// Note: This endpoint is deprecated. Use /api/float-accounts instead

export async function GET() {
  try {
    return NextResponse.json(
      {
        message:
          "This endpoint is deprecated. Use /api/float-accounts for float statistics",
      },
      { status: 410 }
    );
  } catch (error) {
    console.error("API: Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
