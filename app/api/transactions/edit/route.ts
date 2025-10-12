import { NextRequest, NextResponse } from "next/server";
import { TransactionManagementService } from "@/lib/services/transaction-management-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, sourceModule, amount, fee, customerName, reference, metadata } =
      body;

    // Validate required fields
    if (!id || !sourceModule || amount === undefined || fee === undefined) {
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

    // Validate amounts
    if (amount < 0 || fee < 0) {
      return NextResponse.json(
        { success: false, error: "Amount and fee must be non-negative" },
        { status: 400 }
      );
    }

    const result = await TransactionManagementService.editTransaction({
      id,
      sourceModule,
      amount: Number(amount),
      fee: Number(fee),
      customerName,
      reference,
      metadata,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Transaction updated successfully",
        updatedTransaction: result.updatedTransaction,
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
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
