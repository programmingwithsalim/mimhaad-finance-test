"use server";

import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(branchId)) {
      return NextResponse.json(
        { success: false, error: "Invalid branch ID format" },
        { status: 400 }
      );
    }

    // Get cash in till account from float_accounts table
    try {
      const [cashTillAccount] = await sql`
        SELECT 
          id,
          branch_id,
          account_name,
          account_type,
          current_balance,
          min_threshold,
          max_threshold,
          is_active,
          created_at,
          updated_at
        FROM float_accounts 
        WHERE branch_id = ${branchId}::uuid 
        AND account_type = 'cash-in-till'
        AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (cashTillAccount) {
        return NextResponse.json({
          success: true,
          account: {
            ...cashTillAccount,
            current_balance: Number(cashTillAccount.current_balance),
            min_threshold: Number(cashTillAccount.min_threshold || 0),
            max_threshold: Number(cashTillAccount.max_threshold || 0),
          },
        });
      }
    } catch (dbError) {
      console.log("Float accounts table not available, trying cash_till table");

      // Fallback to cash_till table
      const today = new Date().toISOString().split("T")[0];

      try {
        const [cashTill] = await sql`
          SELECT 
            id,
            branch_id,
            date,
            amount as current_balance,
            created_at,
            updated_at
          FROM cash_till 
          WHERE branch_id = ${branchId}::uuid 
          AND date = ${today}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (cashTill) {
          return NextResponse.json({
            success: true,
            account: {
              ...cashTill,
              current_balance: Number(cashTill.current_balance),
              min_threshold: 1000,
              max_threshold: 50000,
              account_name: "Cash in Till",
              account_type: "cash-in-till",
              is_active: true,
            },
          });
        }
      } catch (cashTillError) {
        console.log("Cash till table also not available, using mock data");
      }
    }

    // Return zero balance if no cash-in-till account found
    return NextResponse.json({
      success: true,
      account: null,
      message: "No cash-in-till account found for this branch",
    });
  } catch (error) {
    console.error("Error fetching cash in till:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch cash in till" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: branchId } = await params;
    const body = await request.json();
    const { amount, description } = body;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(branchId)) {
      return NextResponse.json(
        { success: false, error: "Invalid branch ID format" },
        { status: 400 }
      );
    }

    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json(
        { success: false, error: "Valid amount is required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      // Check if record exists for today
      const [existing] = await sql`
        SELECT id, amount FROM cash_till 
        WHERE branch_id = ${branchId}::uuid 
        AND date = ${today}
      `;

      if (existing) {
        // Update existing record
        const [updated] = await sql`
          UPDATE cash_till 
          SET 
            amount = amount + ${Number(amount)},
            updated_at = NOW()
          WHERE branch_id = ${branchId}::uuid 
          AND date = ${today}
          RETURNING *
        `;

        return NextResponse.json({
          success: true,
          cashTill: {
            ...updated,
            current_balance: Number(updated.amount),
          },
        });
      } else {
        // Create new record
        const [created] = await sql`
          INSERT INTO cash_till (branch_id, date, amount, description)
          VALUES (${branchId}::uuid, ${today}, ${Number(amount)}, ${
          description || ""
        })
          RETURNING *
        `;

        return NextResponse.json({
          success: true,
          cashTill: {
            ...created,
            current_balance: Number(created.amount),
          },
        });
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { success: false, error: "Database operation failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error updating cash in till:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update cash in till" },
      { status: 500 }
    );
  }
}
