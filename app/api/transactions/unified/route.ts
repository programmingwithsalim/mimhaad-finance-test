import { NextRequest, NextResponse } from "next/server";
import { UnifiedTransactionService } from "@/lib/services/unified-transaction-service";
import { getCurrentUser } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    // Get current user
    let user;
    try {
      user = getCurrentUser(request);
    } catch (authError) {
      console.warn("Authentication failed, using fallback:", authError);
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        name: "System User",
        username: "system",
        role: "admin",
        branchId: "635844ab-029a-43f8-8523-d7882915266a",
        branchName: "Main Branch",
      };
    }

    const data = await request.json();

    // Validate required fields
    if (
      !data.serviceType ||
      !data.transactionType ||
      !data.amount ||
      !data.customerName
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare transaction data
    const transactionData = {
      serviceType: data.serviceType,
      transactionType: data.transactionType,
      amount: Number(data.amount),
      fee: Number(data.fee) || 0,
      customerName: data.customerName,
      phoneNumber: data.phoneNumber,
      accountNumber: data.accountNumber,
      provider: data.provider,
      floatAccountId: data.floatAccountId, // Add this for specific account selection
      reference: data.reference,
      notes: data.notes,
      branchId: data.branchId || user.branchId,
      userId: data.userId || user.id,
      processedBy: data.processedBy || user.name || user.username,
      metadata: data.metadata || {},
    };

    console.log(`Processing ${transactionData.serviceType} transaction:`, {
      type: transactionData.transactionType,
      amount: transactionData.amount,
      customer: transactionData.customerName,
      branch: transactionData.branchId,
    });

    // Process transaction using unified service
    const result = await UnifiedTransactionService.processTransaction(
      transactionData
    );

    if (result.success) {
      console.log(
        `${transactionData.serviceType} transaction processed successfully:`,
        result.transaction?.id
      );

      return NextResponse.json({
        success: true,
        transaction: result.transaction,
        message: result.message,
      });
    } else {
      console.error(
        `${transactionData.serviceType} transaction failed:`,
        result.error
      );

      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in unified transactions API:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// New endpoints for transaction management
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      transactionId,
      sourceModule,
      reason,
      userId,
      branchId,
      processedBy,
      updatedData,
    } = body;

    // Get current user for admin check
    const currentUser = getCurrentUser(request);

    switch (action) {
      case "reverse":
        const reverseResult =
          await UnifiedTransactionService.reverseTransaction(
            transactionId,
            sourceModule,
            reason,
            userId,
            branchId,
            processedBy || userId
          );
        return NextResponse.json(reverseResult);

      case "edit":
        const editResult = await UnifiedTransactionService.editTransaction(
          transactionId,
          sourceModule,
          updatedData,
          userId,
          branchId,
          processedBy || userId
        );
        return NextResponse.json(editResult);

      case "delete":
        // Check if user is admin for delete action
        if (currentUser.role !== "admin" && currentUser.role !== "Admin") {
          return NextResponse.json(
            {
              success: false,
              error: "Only admin users can delete transactions",
            },
            { status: 403 }
          );
        }

        const deleteResult = await UnifiedTransactionService.deleteTransaction(
          transactionId,
          sourceModule,
          reason,
          userId,
          branchId,
          processedBy || userId
        );
        return NextResponse.json(deleteResult);

      case "complete":
        // Complete Power and Jumia transactions (pending -> completed)
        if (sourceModule !== "power" && sourceModule !== "jumia") {
          return NextResponse.json(
            {
              success: false,
              error:
                "Complete action only available for Power and Jumia transactions",
            },
            { status: 400 }
          );
        }
        const completeResult =
          await UnifiedTransactionService.completeTransaction(
            transactionId,
            sourceModule,
            userId,
            branchId,
            processedBy || userId
          );
        return NextResponse.json(completeResult);

      case "deliver":
        // Deliver Jumia transactions (completed -> delivered)
        if (sourceModule !== "jumia") {
          return NextResponse.json(
            {
              success: false,
              error: "Deliver action only available for Jumia transactions",
            },
            { status: 400 }
          );
        }
        const deliverResult =
          await UnifiedTransactionService.deliverTransaction(
            transactionId,
            sourceModule,
            userId,
            branchId,
            processedBy || userId
          );
        return NextResponse.json(deliverResult);

      case "disburse":
        const disburseResult =
          await UnifiedTransactionService.disburseTransaction(
            transactionId,
            sourceModule,
            userId,
            branchId,
            processedBy || userId
          );
        return NextResponse.json(disburseResult);

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Transaction management failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const transactionId = searchParams.get("transactionId");
    const sourceModule = searchParams.get("sourceModule");
    const branchName = searchParams.get("branchName") || "Branch";

    // Handle receipt generation
    if (action === "receipt" && transactionId && sourceModule) {
      const receiptResult = await UnifiedTransactionService.generateReceipt(
        transactionId,
        sourceModule,
        branchName
      );
      return NextResponse.json(receiptResult);
    }

    // Handle statistics
    if (action === "statistics") {
      const branchId = searchParams.get("branchId");
      const serviceType = searchParams.get("serviceType");

      if (!branchId) {
        return NextResponse.json(
          { success: false, error: "Branch ID is required" },
          { status: 400 }
        );
      }

      const statisticsResult = await UnifiedTransactionService.getStatistics({
        branchId,
        serviceType,
      });

      if (statisticsResult.success) {
        return NextResponse.json({
          success: true,
          statistics: statisticsResult.statistics,
        });
      } else {
        return NextResponse.json(
          { success: false, error: statisticsResult.error },
          { status: 400 }
        );
      }
    }

    // Handle transaction fetching
    const branchId = searchParams.get("branchId");
    const serviceType = searchParams.get("serviceType");
    const provider = searchParams.get("provider");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Fetch transactions using unified service
    const result = await UnifiedTransactionService.getTransactions({
      branchId,
      serviceType,
      provider,
      limit,
      offset,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        transactions: result.transactions,
        pagination: result.pagination,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Transaction fetching failed:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
