import { NextRequest, NextResponse } from "next/server";
import { FloatTransferService } from "@/lib/services/float-transfer-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sourceAccountId, destinationAccountId, amount, fee, description } =
      body;

    // Validate required fields
    if (!sourceAccountId || !destinationAccountId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (sourceAccountId === destinationAccountId) {
      return NextResponse.json(
        { error: "Source and destination accounts cannot be the same" },
        { status: 400 }
      );
    }

    // Create float transfer
    const transfer = await FloatTransferService.createFloatTransfer({
      sourceAccountId,
      destinationAccountId,
      amount: Number(amount),
      fee: fee ? Number(fee) : undefined,
      description,
      userId: session.user.id,
      branchId: session.user.branchId,
      branchName: session.user.branchName,
    });

    return NextResponse.json({
      success: true,
      transfer,
      message: "Float transfer created successfully",
    });
  } catch (error) {
    console.error("Float transfer creation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create float transfer",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get float transfers for the user's branch
    const transfers = await FloatTransferService.getFloatTransfers(
      session.user.branchId,
      limit,
      offset
    );

    return NextResponse.json({
      success: true,
      transfers,
    });
  } catch (error) {
    console.error("Float transfers fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch float transfers",
      },
      { status: 500 }
    );
  }
}
