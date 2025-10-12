import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

// Define types
interface PartnerBank {
  id: string;
  name: string;
  code: string;
  transferFee: number;
  minFee: number;
  maxFee: number;
  status: string;
  floatAccountId?: string;
  currentBalance?: number;
}

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    console.log("🏦 Fetching partner banks with filters:", {
      branchId,
      status,
      search,
    });

    // Build WHERE conditions
    const conditions = [];
    const params = [];

    if (branchId && branchId !== "all") {
      conditions.push("branch_id = $1");
      params.push(branchId);
    }

    if (status && status !== "all") {
      conditions.push("status = $2");
      params.push(status);
    }

    if (search) {
      conditions.push("(bank_name ILIKE $3 OR account_number ILIKE $3)");
      params.push(`%${search}%`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get partner banks
    const banksQuery = `
      SELECT 
        id,
        bank_name,
        account_number,
        account_type,
        branch_id,
        status,
        current_balance,
        created_at,
        updated_at
      FROM partner_banks
      ${whereClause}
      ORDER BY bank_name, account_number
    `;

    const banks = await sql.unsafe(banksQuery, params);

    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_banks,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_banks,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_banks,
        COALESCE(SUM(current_balance), 0) as total_balance
      FROM partner_banks
      ${whereClause}
    `;

    const statsResult = await sql.unsafe(statsQuery, params);
    const stats = statsResult[0] || {};

    // Get branch information for each bank
    const banksWithBranchInfo = await Promise.all(
      banks.map(async (bank: any) => {
        try {
          const branchResult = await sql`
            SELECT name as branch_name
            FROM branches
            WHERE id = ${bank.branch_id}
          `;
          return {
            ...bank,
            branch_name: branchResult[0]?.branch_name || "Unknown Branch",
            current_balance: Number(bank.current_balance || 0),
          };
        } catch (error) {
          return {
            ...bank,
            branch_name: "Unknown Branch",
            current_balance: Number(bank.current_balance || 0),
          };
        }
      })
    );

    const result = {
      banks: banksWithBranchInfo,
      statistics: {
        totalBanks: Number(stats.total_banks || 0),
        activeBanks: Number(stats.active_banks || 0),
        inactiveBanks: Number(stats.inactive_banks || 0),
        totalBalance: Number(stats.total_balance || 0),
      },
    };

    console.log("✅ Partner banks fetched successfully");

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("❌ Error fetching partner banks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch partner banks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bank_name,
      account_number,
      account_type,
      branch_id,
      status = "active",
    } = body;

    console.log("🏦 Creating partner bank:", {
      bank_name,
      account_number,
      account_type,
      branch_id,
    });

    // Validate required fields
    if (!bank_name || !account_number || !account_type || !branch_id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: bank_name, account_number, account_type, branch_id",
        },
        { status: 400 }
      );
    }

    // Check if account number already exists
    const existingBank = await sql`
      SELECT id FROM partner_banks WHERE account_number = ${account_number}
    `;

    if (existingBank.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Account number already exists",
        },
        { status: 409 }
      );
    }

    // Create new partner bank
    const newBank = await sql`
      INSERT INTO partner_banks (
        bank_name,
        account_number,
        account_type,
        branch_id,
        status,
        current_balance
      ) VALUES (
        ${bank_name},
        ${account_number},
        ${account_type},
        ${branch_id},
        ${status},
        0.00
      )
      RETURNING *
    `;

    console.log("✅ Partner bank created successfully");

    return NextResponse.json({
      success: true,
      data: newBank[0],
    });
  } catch (error) {
    console.error("❌ Error creating partner bank:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create partner bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
