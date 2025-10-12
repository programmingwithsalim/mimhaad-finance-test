import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { amount, transactionType } = await request.json();

    if (!amount) {
      return NextResponse.json(
        { success: false, error: "Amount is required" },
        { status: 400 }
      );
    }

    let fee = 0;
    let feeType = "percentage";

    // Calculate fee for Jumia POD collections
    if (transactionType === "pod_collection") {
      const amountNum = Number(amount);

      // Fee structure for Jumia POD collections
      // Typically 2-3% of the POD amount collected
      if (amountNum <= 50) {
        fee = 2.0; // Fixed fee for small amounts
      } else if (amountNum <= 200) {
        fee = amountNum * 0.03; // 3% for medium amounts
      } else {
        fee = amountNum * 0.025; // 2.5% for larger amounts
      }

      feeType = amountNum <= 50 ? "fixed" : "percentage";
    } else if (transactionType === "settlement") {
      // No fee for settlements (internal transfer)
      fee = 0;
      feeType = "none";
    }

    // Ensure minimum fee for POD collections
    if (transactionType === "pod_collection" && fee < 1.0) {
      fee = 1.0;
      feeType = "minimum";
    }

    return NextResponse.json({
      success: true,
      fee: Number(fee.toFixed(2)),
      feeType,
      feeSource: "calculated",
      transactionType,
    });
  } catch (error) {
    console.error("Error calculating Jumia fee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate fee" },
      { status: 500 }
    );
  }
}
