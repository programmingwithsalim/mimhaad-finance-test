import { type NextRequest, NextResponse } from "next/server";
import {
  createJumiaTransaction,
  getJumiaTransactions,
  getAllJumiaTransactions,
} from "@/lib/jumia-service";
import { TransactionService } from "@/lib/services/transaction-service-unified";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to generate unique transaction ID
function generateTransactionId(type: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const prefix = type.toUpperCase().substring(0, 3);
  return `${prefix}_${timestamp}_${random}`;
}

// GET - Get transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const limit = Number.parseInt(searchParams.get("limit") || "50");
    const transactionType = searchParams.get("transactionType");
    const page = Number.parseInt(searchParams.get("page") || "1");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const type = searchParams.get("type") || "";

    console.log(
      "GET transactions request - branchId:",
      branchId,
      "limit:",
      limit,
      "transactionType:",
      transactionType,
      "page:",
      page,
      "search:",
      search
    );

    console.log("[JUMIA API] Fetching transactions for branchId:", branchId);

    let transactions;
    if (branchId) {
      transactions = await getJumiaTransactions(branchId, limit);
    } else {
      transactions = await getAllJumiaTransactions(limit);
    }

    console.log(
      "[JUMIA API] Raw transactions from service:",
      transactions?.length || 0,
      "transactions"
    );

    // Filter by transaction type if specified
    if (transactionType) {
      transactions = transactions.filter(
        (tx) => tx.transaction_type === transactionType
      );
    }

    // Filter by search term if specified
    if (search) {
      const searchLower = search.toLowerCase();
      transactions = transactions.filter(
        (tx) =>
          tx.customer_name?.toLowerCase().includes(searchLower) ||
          tx.tracking_id?.toLowerCase().includes(searchLower) ||
          tx.reference?.toLowerCase().includes(searchLower) ||
          tx.package_id?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status if specified
    if (status && status !== "all") {
      transactions = transactions.filter((tx) => tx.status === status);
    }

    // Filter by type if specified
    if (type && type !== "all") {
      transactions = transactions.filter((tx) => tx.transaction_type === type);
    }

    // Sort transactions by created_at in descending order (latest first)
    transactions.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    // Apply pagination
    const total = transactions.length;
    const offset = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(offset, offset + limit);

    console.log(
      `Returning ${paginatedTransactions.length} transactions out of ${total}`
    );

    return NextResponse.json({
      success: true,
      data: paginatedTransactions.map((tx) => ({
        ...tx,
        payment_method: tx.payment_method || null,
      })),
      transactions: paginatedTransactions.map((tx) => ({
        ...tx,
        payment_method: tx.payment_method || null,
      })), // Keep for backward compatibility
      total: total,
      page: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error getting Jumia transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST - Create transaction
export async function POST(request: NextRequest) {
  try {
    const transactionData = await request.json();
    console.log("POST transaction request:", transactionData);

    // Validate required fields based on transaction type
    if (
      !transactionData.transaction_type ||
      !transactionData.branch_id ||
      !transactionData.user_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: transaction_type, branch_id, user_id",
        },
        { status: 400 }
      );
    }

    // Validate based on transaction type
    if (transactionData.transaction_type === "pod_collection") {
      if (!transactionData.tracking_id || !transactionData.customer_name) {
        return NextResponse.json(
          {
            success: false,
            error: "POD collection requires tracking_id and customer_name",
          },
          { status: 400 }
        );
      }

      // Validate amount only if it's a POD package
      const isPod = transactionData.is_pod !== false; // Default to true if not specified
      if (isPod) {
        if (!transactionData.amount || Number(transactionData.amount) <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: "POD packages require a valid amount greater than 0",
            },
            { status: 400 }
          );
        }
      }

      // Check if package exists and is in 'received' status
      const packageCheck = await sql`
        SELECT id, status FROM jumia_packages 
        WHERE tracking_id = ${transactionData.tracking_id} 
        AND branch_id = ${transactionData.branch_id}
      `;

      if (packageCheck.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Package with this tracking ID not found. Please record the package first.",
          },
          { status: 400 }
        );
      }

      if (packageCheck[0].status !== "received") {
        return NextResponse.json(
          {
            success: false,
            error: `Package is in '${packageCheck[0].status}' status. Cannot collect payment.`,
          },
          { status: 400 }
        );
      }

      // Check if a collection already exists for this package
      const existingCollection = await sql`
        SELECT id FROM jumia_transactions 
        WHERE tracking_id = ${transactionData.tracking_id} 
        AND branch_id = ${transactionData.branch_id}
        AND transaction_type = 'pod_collection'
        AND status != 'deleted'
      `;

      if (existingCollection.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A collection already exists for this package. Cannot create duplicate collection.",
          },
          { status: 400 }
        );
      }
    } else if (transactionData.transaction_type === "settlement") {
      if (
        !transactionData.amount ||
        !transactionData.settlement_reference ||
        !transactionData.float_account_id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Settlement requires amount, settlement_reference, and float_account_id",
          },
          { status: 400 }
        );
      }

      // Validate amount (must be positive)
      const amountNum = Number(transactionData.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Amount must be a valid number greater than 0",
          },
          { status: 400 }
        );
      }
    }

    // Check if cash-in-till account exists for this branch
    const cashInTillAccount = await sql`
      SELECT id FROM float_accounts 
      WHERE branch_id = ${transactionData.branch_id}
        AND account_type = 'cash-in-till'
        AND is_active = true
      LIMIT 1
    `;

    if (cashInTillAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active cash-in-till account found for this branch. Please contact your administrator.",
        },
        { status: 400 }
      );
    }

    // For POD collections, check if Jumia float account exists
    if (transactionData.transaction_type === "pod_collection") {
      const jumiaFloatAccount = await sql`
        SELECT id FROM float_accounts 
        WHERE branch_id = ${transactionData.branch_id}
          AND account_type = 'jumia'
          AND is_active = true
        LIMIT 1
      `;

      if (jumiaFloatAccount.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No active Jumia float account found for this branch. Please create a Jumia float account to record liability for POD collections.",
          },
          { status: 400 }
        );
      }
    }

    // Generate unique transaction ID based on type
    const transactionId = generateTransactionId(
      transactionData.transaction_type || "JUMIA"
    );

    // 1. Create the Jumia transaction (handles all GL posting via unified service)
    const newTransaction = await createJumiaTransaction({
      ...transactionData,
      transaction_id: transactionId,
      payment_method: transactionData.payment_method,
      status:
        transactionData.transaction_type === "pod_collection"
          ? "completed"
          : transactionData.status || "active",
    });

    console.log("Created new transaction:", newTransaction);

    // 2. Update package status if this is a POD collection
    if (transactionData.transaction_type === "pod_collection") {
      await sql`
        UPDATE jumia_packages 
        SET 
          status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
        WHERE tracking_id = ${transactionData.tracking_id} 
        AND branch_id = ${transactionData.branch_id}
      `;
    }

    // 3. Update package status if this is a settlement
    if (
      transactionData.transaction_type === "settlement" &&
      transactionData.tracking_id
    ) {
      await sql`
        UPDATE jumia_packages 
        SET 
          status = 'settled',
          settled_at = NOW(),
          updated_at = NOW()
        WHERE tracking_id = ${transactionData.tracking_id} 
        AND branch_id = ${transactionData.branch_id}
      `;
    }

    return NextResponse.json({
      success: true,
      data: newTransaction,
    });
  } catch (error) {
    console.error("Error creating Jumia transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create transaction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT - Edit transaction
export async function PUT(request: NextRequest) {
  try {
    const { transaction_id, updateData } = await request.json();
    if (!transaction_id || !updateData) {
      return NextResponse.json(
        { success: false, error: "Missing transaction_id or updateData" },
        { status: 400 }
      );
    }
    const updated = await (
      await import("@/lib/jumia-service")
    ).updateJumiaTransaction(transaction_id, updateData);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete transaction
export async function DELETE(request: NextRequest) {
  try {
    const { transaction_id } = await request.json();
    if (!transaction_id) {
      return NextResponse.json(
        { success: false, error: "Missing transaction_id" },
        { status: 400 }
      );
    }
    const deleted = await (
      await import("@/lib/jumia-service")
    ).deleteJumiaTransaction(transaction_id);
    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
