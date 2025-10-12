import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getSession } from "@/lib/auth-service";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";
import { NotificationService } from "@/lib/services/notification-service";
import { CustomerNotificationService } from "@/lib/services/customer-notification-service";
import {
  updatePowerTransaction,
  deletePowerTransaction,
} from "@/lib/power-service";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || session.user.branchId;
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const offset = (page - 1) * limit;

    console.log("Fetching power transactions for branch:", branchId);

    // Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS power_transactions (
          id VARCHAR(255) PRIMARY KEY,
          meter_number VARCHAR(100) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(20),
          provider VARCHAR(100) NOT NULL,
          reference VARCHAR(100),
          status VARCHAR(20) DEFAULT 'pending',
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          branch_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          gl_entry_id VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } catch (tableError) {
      console.error("Error creating power_transactions table:", tableError);
    }

    let transactions: any[] = [];
    let total = 0;

    try {
      transactions = await sql`
        SELECT 
          pt.id,
          pt.meter_number,
          pt.amount,
          pt.customer_name,
          pt.customer_phone,
          pt.provider,
          pt.reference,
          pt.status,
          pt.date,
          pt.branch_id,
          pt.user_id,
          pt.gl_entry_id,
          pt.notes,
          pt.payment_method,
          pt.payment_account_id,
          pt.float_account_id,
          pt.created_at,
          pt.updated_at,
          b.name as branch_name
        FROM power_transactions pt
        LEFT JOIN branches b ON pt.branch_id = b.id
        WHERE pt.branch_id = ${branchId}
        ORDER BY pt.created_at DESC 
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      // Get total count for pagination
      const countResult = await sql`
        SELECT COUNT(*)::int as count FROM power_transactions WHERE branch_id = ${branchId}
      `;
      total = countResult[0]?.count || 0;
    } catch (queryError) {
      console.error("Error querying power_transactions:", queryError);
      transactions = [];
      total = 0;
    }

    console.log(
      `Found ${transactions.length} power transactions out of ${total} total`
    );

    // Transform results for consistent format
    const formattedTransactions = transactions.map((tx: any) => ({
      id: tx.id,
      customer_name: tx.customer_name || "N/A",
      phone_number: tx.phone_number || "N/A",
      meter_number: tx.meter_number || "N/A",
      amount: Number(tx.amount) || 0,
      fee: Number(tx.fee) || 0,
      type: tx.type || "N/A",
      status: tx.status || "N/A",
      reference: tx.reference || "N/A",
      provider: tx.provider || "N/A",
      payment_method: tx.payment_method || "cash",
      payment_account_id: tx.payment_account_id || null,
      float_account_id: tx.float_account_id || null,
      created_at: tx.date,
      branch_id: tx.branch_id,
      branch_name: tx.branch_name,
      processed_by: tx.user_id,
      service_type: tx.source_module,
    }));

    // Sort by created_at in descending order (latest first)
    formattedTransactions.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching power transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch power transactions",
        transactions: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("Creating power transaction:", body);

    // Validate required fields
    if (
      !body.meter_number ||
      !body.amount ||
      !body.customer_name ||
      !body.provider ||
      !body.branchId ||
      !body.userId
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate amount (must be positive)
    const amountNum = Number(body.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Amount must be a valid number greater than 0",
        },
        { status: 400 }
      );
    }

    // Validate meter number (min 5 characters)
    if (body.meter_number.length < 5) {
      return NextResponse.json(
        { success: false, error: "Meter number must be at least 5 characters" },
        { status: 400 }
      );
    }

    // Validate customer name (min 3 characters)
    if (body.customer_name.length < 3) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer name must be at least 3 characters",
        },
        { status: 400 }
      );
    }

    // Validate customer phone (if provided, must be at least 10 characters)
    if (body.customer_phone && body.customer_phone.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number must be at least 10 characters",
        },
        { status: 400 }
      );
    }

    // Check if cash-in-till account exists for cash payments
    if (body.payment_method === "cash") {
      const cashInTillAccount = await sql`
        SELECT id FROM float_accounts 
        WHERE branch_id = ${body.branchId}
          AND account_type = 'cash-in-till'
          AND is_active = true
        LIMIT 1
      `;

      if (cashInTillAccount.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No cash-in-till account found for this branch. Please contact your administrator.",
          },
          { status: 400 }
        );
      }
    }

    // Create the transaction record and get the UUID
    const reference = `POWER-${Date.now()}`;
    const insertResult = await sql`
      INSERT INTO power_transactions (
        meter_number, amount, fee, customer_name, customer_phone,
        provider, reference, status, date, branch_id, user_id, notes,
        payment_method, payment_account_id, float_account_id
      ) VALUES (
        ${body.meter_number}, ${body.amount}, ${body.fee || 0}, ${
      body.customer_name
    },
        ${body.customer_phone || null}, ${body.provider}, ${reference},
        'pending', NOW(), ${body.branchId}, ${body.userId}, ${
      body.notes || null
    },
        ${body.payment_method || "cash"}, ${
      body.payment_account_id || null
    }, null
      ) RETURNING id, reference
    `;
    const transactionUUID = insertResult[0]?.id;
    const transactionReference = insertResult[0]?.reference;
    if (!transactionUUID)
      throw new Error("Failed to create power transaction (no UUID returned)");

    // Create GL entries for power transaction (non-blocking)
    try {
      const glResult = await UnifiedGLPostingService.createGLEntries({
        transactionId: transactionUUID,
        sourceModule: "power",
        transactionType: "sale",
        amount: body.amount,
        fee: body.fee || 0,
        customerName: body.customer_name,
        reference: transactionReference,
        processedBy: body.userId,
        branchId: body.branchId,
        metadata: {
          provider: body.provider,
          meterNumber: body.meter_number,
          customerName: body.customer_name,
        },
      });
      if (!glResult.success) {
        throw new Error(glResult.error || "Unified GL posting failed");
      }
      if (glResult.success && glResult.glTransactionId) {
        await sql`
          UPDATE power_transactions 
          SET gl_entry_id = ${glResult.glTransactionId}
          WHERE id = ${transactionUUID}
        `;
        console.log("GL entries created successfully for power transaction");
      }
    } catch (glError) {
      console.error("GL posting error (non-critical):", glError);
      // Optionally: return error to client or continue
    }

    // Handle payment method and fee crediting
    const amount = Number(body.amount);
    const fee = Number(body.fee || 0);

    console.log("🔍 [POWER TRANSACTION] Payment details:", {
      amount,
      fee,
      paymentMethod: body.payment_method,
      paymentAccountId: body.payment_account_id,
      provider: body.provider,
    });

    // First, debit the power provider's float account by the amount
    console.log(
      "🔍 [POWER TRANSACTION] Debiting power provider float account:",
      body.provider
    );
    const powerProviderDebit = await sql`
      UPDATE float_accounts
      SET current_balance = current_balance - ${amount},
          updated_at = NOW()
      WHERE branch_id = ${body.branchId}
        AND account_type = 'power'
        AND provider = ${body.provider}
        AND is_active = true
      RETURNING id, current_balance
    `;

    if (powerProviderDebit.length === 0) {
      throw new Error(
        `No active power float account found for provider: ${body.provider}`
      );
    }

    console.log(
      "🔍 [POWER TRANSACTION] Power provider float debited:",
      powerProviderDebit[0]
    );

    // Then credit the payment method
    if (body.payment_method === "cash") {
      // For cash payments, credit both amount and fee to cash-in-till
      console.log(
        "🔍 [POWER TRANSACTION] Cash payment - crediting amount + fee to cash-in-till"
      );
      await sql`
        UPDATE float_accounts
        SET current_balance = current_balance + ${amount + fee},
            updated_at = NOW()
        WHERE branch_id = ${body.branchId}
          AND account_type = 'cash-in-till'
          AND is_active = true
      `;
    } else {
      // For non-cash payments, credit amount to selected float account and fee to cash-in-till
      if (body.payment_account_id) {
        console.log(
          "🔍 [POWER TRANSACTION] Non-cash payment - crediting amount to payment account:",
          body.payment_account_id
        );
        // Credit amount to the selected payment account
        await sql`
          UPDATE float_accounts
          SET current_balance = current_balance + ${amount},
              updated_at = NOW()
          WHERE id = ${body.payment_account_id}
        `;

        // Credit fee to cash-in-till
        console.log(
          "🔍 [POWER TRANSACTION] Non-cash payment - crediting fee to cash-in-till"
        );
        await sql`
          UPDATE float_accounts
          SET current_balance = current_balance + ${fee},
              updated_at = NOW()
          WHERE branch_id = ${body.branchId}
            AND account_type = 'cash-in-till'
            AND is_active = true
        `;
      }
    }

    // Update the transaction record to store the power provider's float_account_id
    await sql`
      UPDATE power_transactions 
      SET float_account_id = ${powerProviderDebit[0].id}
      WHERE id = ${transactionUUID}
    `;

    // Send customer notification (mandatory - not dependent on user preferences)
    if (body.customer_phone) {
      try {
        await CustomerNotificationService.sendTransactionSuccessNotification(
          body.customer_phone,
          body.customer_name || "Customer",
          {
            amount: body.amount,
            service: "power",
            reference: transactionReference,
            transactionId: transactionUUID,
          }
        );
      } catch (notificationError) {
        console.error(
          "Failed to send customer notification:",
          notificationError
        );
        // Continue with transaction even if notification fails
      }
    }

    // Send user notification (optional - based on user preferences)
    try {
      await NotificationService.sendTransactionAlert(body.userId, {
        type: "power_sale",
        amount: body.amount,
        service: "power",
        reference: transactionReference,
        branchId: body.branchId,
      });
    } catch (notificationError) {
      console.error("Failed to send user notification:", notificationError);
      // Continue with transaction even if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Power transaction created successfully",
      transaction: {
        id: transactionUUID,
        reference: transactionReference,
      },
    });
  } catch (error) {
    console.error("Error creating power transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create power transaction",
      },
      { status: 500 }
    );
  }
}

// PUT - Edit transaction
export async function PUT(request: NextRequest) {
  try {
    const { id, updateData } = await request.json();
    if (!id || !updateData) {
      return NextResponse.json(
        { success: false, error: "Missing id or updateData" },
        { status: 400 }
      );
    }
    const updated = await updatePowerTransaction(id, updateData);
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
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }
    const deleted = await deletePowerTransaction(id);
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
