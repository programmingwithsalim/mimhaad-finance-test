import { type NextRequest, NextResponse } from "next/server";
// Note: This endpoint is deprecated. GL-Float integration is now automatic via UnifiedGLPostingService

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      {
        message:
          "This endpoint is deprecated. GL-Float integration is now automatic.",
      },
      { status: 410 }
    );
  } catch (error) {
    console.error("GL Float Integration API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GL float integration data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "sync":
        await syncFloatBalancesToGLServer();
        return NextResponse.json({
          success: true,
          message: "Float balances synced successfully",
        });

      case "enhance":
        await enhanceExistingGLWithFloatAccounts();
        return NextResponse.json({
          success: true,
          message: "GL enhancement completed successfully",
        });

      default:
        return NextResponse.json(
          { error: "Invalid action parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("GL Float Integration API Error:", error);
    return NextResponse.json(
      { error: "Failed to process GL float integration request" },
      { status: 500 }
    );
  }
}
