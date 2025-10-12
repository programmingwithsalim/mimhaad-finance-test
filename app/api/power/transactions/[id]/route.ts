import { NextResponse } from "next/server";
import { UnifiedTransactionService } from "@/lib/services/unified-transaction-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const currentUser = getCurrentUser(request as any);
    const { id } = params;
    const body = await request.json();

    if (!currentUser?.id || !currentUser?.branchId) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    const result = await UnifiedTransactionService.editTransaction(
      id,
      "power",
      body,
      currentUser.id,
      currentUser.branchId,
      currentUser.name || currentUser.username
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        transaction: result.transaction,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating power transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const currentUser = getCurrentUser(request as any);
    const { id } = params;
    const body = await request.json();
    const reason = body?.reason || "User requested deletion";

    if (!currentUser?.id || !currentUser?.branchId) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    const result = await UnifiedTransactionService.deleteTransaction(
      id,
      "power",
      reason,
      currentUser.id,
      currentUser.branchId,
      currentUser.name || currentUser.username
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error deleting power transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
