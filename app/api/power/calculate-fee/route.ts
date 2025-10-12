import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { amount, provider, transactionType } = await request.json();

    if (!amount || !provider) {
      return NextResponse.json(
        { success: false, error: "Amount and provider are required" },
        { status: 400 }
      );
    }

    let fee = 0;
    let feeType = "percentage";

    // Calculate fee for power sales
    // Typical structure: 1-2% commission on the transaction amount
    if (transactionType === "sale") {
      const amountNum = Number(amount);

      // Fee structure based on transaction amount
      if (amountNum <= 50) {
        fee = 1.0; // Fixed fee for small amounts
      } else if (amountNum <= 200) {
        fee = amountNum * 0.02; // 2% for medium amounts
      } else {
        fee = amountNum * 0.015; // 1.5% for larger amounts
      }

      feeType = amountNum <= 50 ? "fixed" : "percentage";
    }

    // Ensure minimum fee
    if (fee < 0.5) {
      fee = 0.5;
      feeType = "minimum";
    }

    return NextResponse.json({
      success: true,
      fee: Number(fee.toFixed(2)),
      feeType,
      feeSource: "calculated",
      provider,
    });
  } catch (error) {
    console.error("Error calculating Power fee:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate fee" },
      { status: 500 }
    );
  }
}
