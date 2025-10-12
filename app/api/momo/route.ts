import { NextResponse } from "next/server";
import {
  createMoMoTransaction,
  getAllMoMoTransactions,
  getMoMoTransactions,
} from "@/lib/momo-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const provider = searchParams.get("provider");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    const filters = {
      ...(status && { status }),
      ...(type && { type }),
      ...(provider && { provider }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(branchId && { branchId }),
    };

    const transactions =
      Object.keys(filters).length > 0
        ? await getMoMoTransactions(filters)
        : await getAllMoMoTransactions();

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching MoMo transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const transaction = await createMoMoTransaction(data, request);

    if (!transaction) {
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Error creating MoMo transaction:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to create transaction";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
