import { NextRequest, NextResponse } from "next/server";
import { UnifiedTransactionService } from "@/lib/services/unified-transaction-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: id } = await params;
    const body = await request.json();
    const { sourceModule, userId, branchId, processedBy, ...updatedData } =
      body;

    if (!id || !sourceModule || !userId || !branchId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction ID, sourceModule, userId, and branchId are required",
        },
        { status: 400 }
      );
    }

    const result = await UnifiedTransactionService.editTransaction(
      id,
      sourceModule,
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
    console.error("Error editing transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to edit transaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: id } = await params;
    const body = await request.json();
    const { sourceModule, userId, branchId, processedBy, reason } = body;

    if (!id || !sourceModule || !userId || !branchId || !reason) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction ID, sourceModule, userId, branchId, and reason are required",
        },
        { status: 400 }
      );
    }

    const result = await UnifiedTransactionService.deleteTransaction(
      id,
      sourceModule,
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
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
}
