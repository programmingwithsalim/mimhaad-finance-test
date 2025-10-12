import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// GET - Calculate settlement amount based on collections since last settlement
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isAdmin = user.role === "Admin" || user.role === "admin";
    const userBranchId = user.branchId;
    const searchBranchId = branchId || userBranchId;

    console.log(
      "Settlement calculator - searching for branch:",
      searchBranchId
    );

    // First, let's see what transactions exist
    const allTransactions = await sql`
      SELECT transaction_type, amount, status, created_at 
      FROM jumia_transactions 
      WHERE branch_id = ${searchBranchId}
      ORDER BY created_at DESC
    `;
    console.log("All transactions found:", allTransactions);

    // Get the last settlement date for this branch
    const lastSettlement = await sql`
      SELECT created_at 
      FROM jumia_transactions 
      WHERE transaction_type = 'settlement' 
      AND branch_id = ${searchBranchId}
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    const lastSettlementDate =
      lastSettlement.length > 0 ? lastSettlement[0].created_at : null;

    console.log("Last settlement date:", lastSettlementDate);

    // Calculate total collections since last settlement
    let collectionsQuery;
    if (lastSettlementDate) {
      collectionsQuery = sql`
        SELECT 
          COUNT(*) as collection_count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM jumia_transactions 
        WHERE transaction_type = 'pod_collection' 
        AND branch_id = ${searchBranchId}
        AND created_at > ${lastSettlementDate}
        AND status != 'reversed'
      `;
    } else {
      // If no previous settlement, get all collections
      collectionsQuery = sql`
        SELECT 
          COUNT(*) as collection_count,
          COALESCE(SUM(amount), 0) as total_amount
        FROM jumia_transactions 
        WHERE transaction_type = 'pod_collection' 
        AND branch_id = ${searchBranchId}
        AND status != 'reversed'
      `;
    }

    const collectionsResult = await collectionsQuery;
    const totalAmount = Number(collectionsResult[0]?.total_amount || 0);
    const collectionCount = Number(collectionsResult[0]?.collection_count || 0);

    console.log("Collections result:", collectionsResult);
    console.log("Total amount from transactions:", totalAmount);
    console.log("Collection count:", collectionCount);

    // Alternative: Get amount from Jumia float account balance
    const jumiaFloatBalance = await sql`
      SELECT current_balance 
      FROM float_accounts 
      WHERE branch_id = ${searchBranchId} 
      AND account_type = 'jumia' 
      AND is_active = true 
      LIMIT 1
    `;

    const floatBalance =
      jumiaFloatBalance.length > 0
        ? Number(jumiaFloatBalance[0].current_balance || 0)
        : 0;
    console.log("Jumia float balance:", floatBalance);

    // Get unsettled packages count
    const unsettledPackages = await sql`
      SELECT COUNT(*) as count
      FROM jumia_packages 
      WHERE branch_id = ${searchBranchId}
      AND status = 'delivered'
    `;

    const unsettledCount = Number(unsettledPackages[0]?.count || 0);

    // Use float balance if transaction amount is 0 but float has balance
    const finalSettlementAmount = totalAmount > 0 ? totalAmount : floatBalance;

    console.log("Final settlement amount:", finalSettlementAmount);

    return NextResponse.json({
      success: true,
      data: {
        settlementAmount: finalSettlementAmount,
        collectionCount,
        unsettledPackageCount: unsettledCount,
        lastSettlementDate,
        fromDate: lastSettlementDate || "All time",
        toDate: new Date().toISOString(),
        debug: {
          transactionAmount: totalAmount,
          floatBalance: floatBalance,
          allTransactions: allTransactions,
        },
      },
    });
  } catch (error) {
    console.error("Error calculating settlement amount:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate settlement amount",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
