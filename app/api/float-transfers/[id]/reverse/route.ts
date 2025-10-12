import { NextRequest, NextResponse } from "next/server";
import { FloatTransferService } from "@/lib/services/float-transfer-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const session = await getCurrentUser();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: "Reversal reason is required" },
        { status: 400 }
      );
    }

    // Reverse the float transfer
    const success = await FloatTransferService.reverseFloatTransfer(
      (await params).id,
      reason,
      session.user.id,
      session.user.branchId
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Float transfer reversed successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Failed to reverse float transfer" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Float transfer reversal error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reverse float transfer",
      },
      { status: 500 }
    );
  }
}
