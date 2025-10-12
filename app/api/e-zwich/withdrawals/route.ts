import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { NotificationService } from "@/lib/services/notification-service";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Ensure withdrawals table exists
    await sql`
      CREATE TABLE IF NOT EXISTS ezwich_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_number VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        transaction_type VARCHAR(50) DEFAULT 'withdrawal',
        status VARCHAR(20) DEFAULT 'completed',
        processed_by VARCHAR(100) NOT NULL,
        branch_id VARCHAR(100) NOT NULL,
        transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const withdrawals = await sql`
      SELECT 
        id,
        card_number,
        amount,
        transaction_type,
        status,
        processed_by,
        branch_id,
        transaction_date,
        created_at
      FROM ezwich_withdrawals 
      WHERE branch_id = ${branchId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch withdrawals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      card_number,
      amount,
      transaction_type,
      status,
      processed_by,
      branch_id,
    } = body;

    if (!card_number || !amount || !processed_by || !branch_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS ezwich_withdrawals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_number VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        transaction_type VARCHAR(50) DEFAULT 'withdrawal',
        status VARCHAR(20) DEFAULT 'completed',
        processed_by VARCHAR(100) NOT NULL,
        branch_id VARCHAR(100) NOT NULL,
        transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const result = await sql`
      INSERT INTO ezwich_withdrawals (
        card_number,
        amount,
        transaction_type,
        status,
        processed_by,
        branch_id
      ) VALUES (
        ${card_number},
        ${amount},
        ${transaction_type || "withdrawal"},
        ${status || "completed"},
        ${processed_by},
        ${branch_id}
      )
      RETURNING *
    `;

    // Send SMS notification to customer (if phone number is provided)
    if (body.customer_phone) {
      try {
        await NotificationService.sendNotification({
          type: "transaction",
          title: "E-Zwich Withdrawal Successful",
          message: `Thank you for using our service! Your E-Zwich withdrawal of GHS ${amount} was successful. Card: ${card_number}`,
          phone: body.customer_phone,
          userId: processed_by,
          branchId: branch_id,
          metadata: {
            transactionId: result[0].id,
            type: transaction_type || "withdrawal",
            amount,
            cardNumber: card_number,
            reference: result[0].id,
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
      data: result[0],
      message: "Withdrawal transaction created successfully",
    });
  } catch (error) {
    console.error("Error creating withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create withdrawal" },
      { status: 500 }
    );
  }
}
