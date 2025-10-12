import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "This endpoint is deprecated. Please use the main float transfer endpoint (POST /api/float-accounts/[id]/recharge) which requires both a source and a target account.",
    },
    { status: 400 }
  );
}
