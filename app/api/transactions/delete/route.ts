import { NextRequest, NextResponse } from "next/server";
import { TransactionManagementService } from "@/lib/services/transaction-management-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sourceModule, processedBy, branchId, reason } = body;

    // Get current user
    const currentUser = getCurrentUser(request);

    // Check if user is admin
    if (currentUser.role !== "admin" && currentUser.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Only admin users can delete transactions" },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!id || !sourceModule || !processedBy || !branchId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate source module
    const validModules = [
      "momo",
      "agency_banking",
      "e_zwich",
      "power",
      "jumia",
    ];
    if (!validModules.includes(sourceModule)) {
      return NextResponse.json(
        { success: false, error: "Invalid source module" },
        { status: 400 }
      );
    }

    const result = await TransactionManagementService.deleteTransaction({
      id,
      sourceModule,
      processedBy,
      branchId,
      reason,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Transaction deleted successfully",
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
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
