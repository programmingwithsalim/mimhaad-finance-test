import { type NextRequest, NextResponse } from "next/server";
import { UnifiedTransactionService } from "@/lib/services/unified-transaction-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userId, branchId, processedBy, ...updatedData } = body;

    if (!id || !userId || !branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction ID, userId, and branchId are required",
        },
        { status: 400 }
      );
    }

    const result = await UnifiedTransactionService.editTransaction(
      id,
      "e_zwich",
      updatedData,
      userId,
      branchId,
      processedBy || userId
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
    console.error("Error updating E-Zwich transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { userId, branchId, processedBy, reason } = body;

    // Get current user for admin check
    const currentUser = getCurrentUser(request);

    // Check if user is admin
    if (currentUser.role !== "admin" && currentUser.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Only admin users can delete transactions" },
        { status: 403 }
      );
    }

    if (!id || !userId || !branchId || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction ID, userId, branchId, and reason are required",
        },
        { status: 400 }
      );
    }

    const result = await UnifiedTransactionService.deleteTransaction(
      id,
      "e_zwich",
      reason,
      userId,
      branchId,
      processedBy || userId
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
    console.error("Error deleting E-Zwich transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
