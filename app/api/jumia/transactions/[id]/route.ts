import { type NextRequest, NextResponse } from "next/server";
import {
  getJumiaTransactionById,
  updateJumiaTransaction,
  deleteJumiaTransaction,
} from "@/lib/jumia-service";
import { getCurrentUser } from "@/lib/auth-utils";

// GET - Get specific transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: transactionId } = await params;
    console.log("GET request for transaction ID:", transactionId);

    const transaction = await getJumiaTransactionById(transactionId);

    if (!transaction) {
      console.log("Transaction not found with ID:", transactionId);
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    console.log("Found transaction:", transaction);
    return NextResponse.json({
      success: true,
      data: { ...transaction, payment_method: transaction.payment_method || null },
    });
  } catch (error) {
    console.error("Error getting Jumia transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT - Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const currentUser = getCurrentUser(request as any);

    if (!currentUser?.id || !currentUser?.branchId) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    console.log(
      "PUT request for transaction ID:",
      transactionId,
      "with data:",
      body
    );

    // Accept payment_method in the request body for updates
    const {
      tracking_id,
      customer_name,
      customer_phone,
      amount,
      status,
      delivery_status,
      notes,
      float_account_id,
      payment_method,
    } = body;

    // Prepare update data
    const updateData = {
      tracking_id,
      customer_name,
      customer_phone,
      amount,
      status,
      delivery_status,
      notes,
      float_account_id,
      payment_method,
      user_id: currentUser.id,
      branch_id: currentUser.branchId,
    };

    const result = await updateJumiaTransaction(transactionId, updateData);

    console.log("Updated transaction:", result);
    return NextResponse.json({
      success: true,
      data: result,
      message: "Transaction updated successfully",
    });
  } catch (error) {
    console.error("Error updating Jumia transaction:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

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

// DELETE - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: transactionId } = await params;
    const body = await request.json();
    const currentUser = getCurrentUser(request as any);
    const reason = body?.reason || "User requested deletion";

    if (!currentUser?.id || !currentUser?.branchId) {
      return NextResponse.json(
        { success: false, error: "User authentication required" },
        { status: 401 }
      );
    }

    console.log("🗑️ Deleting jumia transaction:", transactionId);

    const deletedTransaction = await deleteJumiaTransaction(transactionId);

    console.log("✅ Deleted transaction successfully:", deletedTransaction);
    return NextResponse.json({
      success: true,
      message: `Transaction deleted successfully. Reason: ${reason}`,
      data: deletedTransaction,
    });
  } catch (error) {
    console.error("Error deleting Jumia transaction:", error);

    const { id: transactionId } = await params;
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          success: false,
          error: "Transaction not found",
          details: `Transaction with ID ${transactionId} does not exist`,
        },
        { status: 404 }
      );
    }

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
