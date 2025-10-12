import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          error: "Branch ID is required",
          accounts: [],
        },
        { status: 400 },
      )
    }

    // Get E-Zwich settlement accounts (not partner accounts)
    const accounts = await sql`
      SELECT 
        id,
        branch_id,
        account_type,
        provider,
        account_number,
        current_balance,
        min_threshold,
        max_threshold,
        is_active,
        isEzwichPartner,
        created_at,
        updated_at
      FROM float_accounts 
      WHERE branch_id = ${branchId}
      AND account_type = 'e-zwich'
      AND (isEzwichPartner = false OR isEzwichPartner IS NULL)
      ORDER BY created_at DESC
    `

    const formattedAccounts = accounts.map((account) => ({
      id: account.id,
      branch_id: account.branch_id,
      account_type: account.account_type,
      provider: account.provider || "E-Zwich Settlement",
      account_number: account.account_number,
      current_balance: Number.parseFloat(account.current_balance || "0"),
      min_threshold: Number.parseFloat(account.min_threshold || "0"),
      max_threshold: Number.parseFloat(account.max_threshold || "0"),
      is_active: account.is_active,
      isEzwichPartner: account.isEzwichPartner || false,
      created_at: account.created_at,
      updated_at: account.updated_at,
    }))

    return NextResponse.json({
      success: true,
      accounts: formattedAccounts,
    })
  } catch (error) {
    console.error("Error fetching E-Zwich accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch E-Zwich accounts",
        accounts: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      branchId,
      accountNumber,
      currentBalance = 0,
      minThreshold = 1000,
      maxThreshold = 100000,
      isEzwichPartner = false,
    } = body

    if (!branchId || !accountNumber) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: branchId, accountNumber",
        },
        { status: 400 },
      )
    }

    // Check if account already exists
    const existingAccount = await sql`
      SELECT id FROM float_accounts 
      WHERE branch_id = ${branchId} 
      AND account_number = ${accountNumber}
      AND account_type = 'e-zwich'
    `

    if (existingAccount.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "E-Zwich account with this account number already exists for this branch",
        },
        { status: 400 },
      )
    }

    // Create the E-Zwich settlement account
    const newAccount = await sql`
      INSERT INTO float_accounts (
        branch_id,
        account_type,
        provider,
        account_number,
        current_balance,
        min_threshold,
        max_threshold,
        is_active,
        isEzwichPartner,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        ${branchId},
        'e-zwich',
        'E-Zwich Settlement',
        ${accountNumber},
        ${currentBalance},
        ${minThreshold},
        ${maxThreshold},
        true,
        ${isEzwichPartner},
        'system',
        NOW(),
        NOW()
      )
      RETURNING *
    `

    const formattedAccount = {
      id: newAccount[0].id,
      branch_id: newAccount[0].branch_id,
      account_type: newAccount[0].account_type,
      provider: newAccount[0].provider,
      account_number: newAccount[0].account_number,
      current_balance: Number.parseFloat(newAccount[0].current_balance),
      min_threshold: Number.parseFloat(newAccount[0].min_threshold),
      max_threshold: Number.parseFloat(newAccount[0].max_threshold),
      is_active: newAccount[0].is_active,
      isEzwichPartner: newAccount[0].isEzwichPartner,
      created_at: newAccount[0].created_at,
      updated_at: newAccount[0].updated_at,
    }

    return NextResponse.json({
      success: true,
      account: formattedAccount,
      message: "E-Zwich settlement account created successfully",
    })
  } catch (error) {
    console.error("Error creating E-Zwich account:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create E-Zwich account",
      },
      { status: 500 },
    )
  }
}
