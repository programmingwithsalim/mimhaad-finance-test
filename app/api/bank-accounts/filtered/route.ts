import { NextResponse } from "next/server";
import { BankAccountFilterService } from "@/lib/services/bank-account-filter-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const branchId = searchParams.get("branchId");

    console.log(
      `Fetching filtered bank accounts - Type: ${type}, Branch: ${branchId}`
    );

    let accounts = [];

    switch (type) {
      case "agency-banking":
        accounts = await BankAccountFilterService.getAgencyBankingAccounts(
          branchId || undefined
        );
        break;
      case "bank-only":
        accounts = await BankAccountFilterService.getBankAccountsOnly(
          branchId || undefined
        );
        break;
      default:
        // Return all non-MoMo accounts by default
        accounts = await BankAccountFilterService.getBankAccountsOnly(
          branchId || undefined
        );
        break;
    }

    console.log(`Found ${accounts.length} filtered accounts`);

    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
      type,
    });
  } catch (error) {
    console.error("Error fetching filtered bank accounts:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch bank accounts",
        message: error instanceof Error ? error.message : "Unknown error",
        accounts: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
