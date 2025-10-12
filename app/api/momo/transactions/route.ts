"use server";

import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";
import { NotificationService } from "@/lib/services/notification-service";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Normalize field names (handle both snake_case and camelCase)
    const normalizedData = {
      customer_name: body.customer_name || body.customerName,
      customer_phone:
        body.customer_phone || body.phoneNumber || body.phone_number,
      amount: Number(body.amount),
      fee: Number(body.fee || 0),
      provider: body.provider,
      type: body.type || body.transactionType,
      reference: body.reference,
      notes: body.notes || "",
    };

    // Validate required fields
    if (!normalizedData.customer_name) {
      return NextResponse.json(
        { success: false, error: "Customer name is required" },
        { status: 400 }
      );
    }

    if (!normalizedData.customer_phone) {
      return NextResponse.json(
        { success: false, error: "Customer phone number is required" },
        { status: 400 }
      );
    }

    // Validate phone number format - must be exactly 10 digits with no letters
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(normalizedData.customer_phone)) {
      return NextResponse.json(
        {
          success: false,
          error: "Phone number must be exactly 10 digits (e.g., 0241234567)",
        },
        { status: 400 }
      );
    }

    if (!normalizedData.amount || normalizedData.amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid amount is required" },
        { status: 400 }
      );
    }

    if (!normalizedData.provider) {
      return NextResponse.json(
        { success: false, error: "Provider is required" },
        { status: 400 }
      );
    }

    if (
      !normalizedData.type ||
      !["cash-in", "cash-out"].includes(normalizedData.type)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid transaction type is required (cash-in or cash-out)",
        },
        { status: 400 }
      );
    }

    // Get user info from headers or session
    const branchId = request.headers.get("x-branch-id") || body.branchId;
    const userId = request.headers.get("x-user-id") || body.userId;

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Find the appropriate float account
    const floatAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId}
      AND provider = ${normalizedData.provider}
      AND account_type = 'momo'
      AND is_active = true
      LIMIT 1
    `;

    if (floatAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No active MoMo float account found for provider: ${normalizedData.provider}`,
        },
        { status: 400 }
      );
    }

    const account = floatAccount[0];

    // Check if sufficient balance for cash-out
    if (
      normalizedData.type === "cash-out" &&
      account.current_balance < normalizedData.amount
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient float balance for this transaction",
        },
        { status: 400 }
      );
    }

    // Calculate new balances for float and cash in till
    let newFloatBalance = Number(account.current_balance);
    let cashTillChange = 0;
    let floatChange = 0;

    if (normalizedData.type === "cash-in") {
      // Cash in: Customer gives us cash + fee, we lose only the amount from MoMo float
      // We receive: amount + fee (goes to cash till)
      // We lose: amount (from MoMo float)
      cashTillChange = normalizedData.amount + normalizedData.fee;
      floatChange = -normalizedData.amount; // Only the amount, not the fee
      newFloatBalance = Number(account.current_balance) - normalizedData.amount;
    } else {
      // Cash out: Customer withdraws cash, we receive amount to MoMo float
      // We lose: amount (from cash till)
      // We receive: amount (to MoMo float)
      // Fee is kept in cash till as revenue
      cashTillChange = -normalizedData.amount + normalizedData.fee; // We pay amount in cash but keep fee
      floatChange = normalizedData.amount; // Only the amount, not the fee
      newFloatBalance = Number(account.current_balance) + normalizedData.amount;
    }

    // Create the transaction
    const transaction = await sql`
      INSERT INTO momo_transactions (
        branch_id,
        user_id,
        float_account_id,
        customer_name,
        phone_number,
        amount,
        fee,
        type,
        provider,
        reference,
        status,
        cash_till_affected,
        float_affected
      ) VALUES (
        ${branchId},
        ${userId || "system"},
        ${account.id},
        ${normalizedData.customer_name},
        ${normalizedData.customer_phone},
        ${normalizedData.amount},
        ${normalizedData.fee},
        ${normalizedData.type},
        ${normalizedData.provider},
        ${normalizedData.reference || `MOMO-${Date.now()}`},
        'completed',
        ${cashTillChange},
        ${floatChange}
      )
      RETURNING *
    `;

    // Update float account balance (MoMo float)
    await sql`
      UPDATE float_accounts 
      SET 
        current_balance = ${newFloatBalance},
        updated_at = NOW()
      WHERE id = ${account.id}
    `;

    // Update cash in till balance and get ID for GL posting
    let cashTillAccountId = null;
    const cashTillAccount = await sql`
      SELECT * FROM float_accounts 
      WHERE branch_id = ${branchId}
      AND account_type = 'cash-in-till'
      AND is_active = true
      LIMIT 1
    `;

    if (cashTillAccount.length > 0) {
      const cashTill = cashTillAccount[0];
      cashTillAccountId = cashTill.id;
      const newCashTillBalance =
        Number(cashTill.current_balance) + cashTillChange;

      await sql`
        UPDATE float_accounts 
        SET 
          current_balance = ${newCashTillBalance},
          updated_at = NOW()
        WHERE id = ${cashTill.id}
      `;
    }

    // Create GL entries
    try {
      await UnifiedGLPostingService.createGLEntries({
        transactionId: transaction[0].id,
        sourceModule: "momo",
        transactionType: normalizedData.type,
        amount: normalizedData.amount,
        fee: normalizedData.fee,
        customerName: normalizedData.customer_name,
        reference: normalizedData.reference || `MOMO-${Date.now()}`,
        processedBy: userId || "system",
        branchId: branchId,
        metadata: {
          provider: normalizedData.provider,
          phoneNumber: normalizedData.customer_phone,
          cashTillChange: cashTillChange,
          cashTillAffected: cashTillChange,
          floatChange: floatChange,
          floatAffected: floatChange,
          cashTillAccountId: cashTillAccountId,
          floatAccountId: account.id,
        },
      });
    } catch (glError) {
      console.error("GL posting failed for MoMo transaction:", glError);
      // Continue with transaction even if GL posting fails
    }

    // Send SMS notification to customer
    if (normalizedData.customer_phone) {
      try {
        await NotificationService.sendNotification({
          type: "transaction",
          title: "MoMo Transaction Successful",
          message: `Thank you for using our service! Your MoMo ${
            normalizedData.type
          } transaction of GHS ${
            normalizedData.amount
          } was successful. Reference: ${
            normalizedData.reference || transaction[0].id
          }`,
          phone: normalizedData.customer_phone,
          userId: userId || "system",
          branchId: branchId,
          metadata: {
            transactionId: transaction[0].id,
            type: normalizedData.type,
            amount: normalizedData.amount,
            fee: normalizedData.fee,
            provider: normalizedData.provider,
            reference: normalizedData.reference || transaction[0].id,
          },
          priority: "medium",
        });
      } catch (notificationError) {
        console.error("Failed to send SMS notification:", notificationError);
        // Continue with transaction even if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      transaction: transaction[0],
      message: `MoMo ${normalizedData.type} transaction processed successfully`,
    });
  } catch (error) {
    console.error("Error processing MoMo transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process transaction",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const offset = (page - 1) * limit;

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }
    // Query transactions
    const transactions = await sql`
      SELECT * FROM momo_transactions
      WHERE branch_id = ${branchId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    // Get total count
    const countResult = await sql`
      SELECT COUNT(*)::int as count FROM momo_transactions WHERE branch_id = ${branchId}
    `;

    const totalCount = countResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        customer_name: transaction.customer_name,
        customer_phone: transaction.phone_number,
        customerName: transaction.customer_name, // Keep for backward compatibility
        phoneNumber: transaction.phone_number, // Keep for backward compatibility
        amount: transaction.amount,
        fee: transaction.fee,
        type: transaction.type,
        provider: transaction.provider,
        reference: transaction.reference,
        status: transaction.status,
        created_at: transaction.created_at,
        date: transaction.created_at, // Keep for backward compatibility
        branchName: "Branch",
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        page,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching MoMo transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}
