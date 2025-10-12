import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/auth-service"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId") || session.user.branchId

    console.log("Fetching E-Zwich partner accounts for branch:", branchId)

    // Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS e_zwich_partner_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_name VARCHAR(255) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          account_name VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    } catch (tableError) {
      console.error("Error creating e_zwich_partner_accounts table:", tableError)
    }

    let accounts = []

    try {
      accounts = await sql`
        SELECT 
          id,
          bank_name,
          account_number,
          account_name,
          branch_id,
          is_active,
          created_at
        FROM e_zwich_partner_accounts 
        WHERE branch_id = ${branchId} AND is_active = true
        ORDER BY bank_name ASC
      `

      // If no accounts found, create some default ones
      if (accounts.length === 0) {
        console.log("No partner accounts found, creating default ones...")

        const defaultAccounts = [
          {
            bank_name: "GCB Bank",
            account_number: "1234567890",
            account_name: "E-Zwich Settlement Account",
          },
          {
            bank_name: "Ecobank Ghana",
            account_number: "0987654321",
            account_name: "E-Zwich Partner Account",
          },
          {
            bank_name: "Standard Chartered",
            account_number: "1122334455",
            account_name: "E-Zwich Operations Account",
          },
        ]

        for (const account of defaultAccounts) {
          await sql`
            INSERT INTO e_zwich_partner_accounts (
              bank_name, account_number, account_name, branch_id, is_active
            ) VALUES (
              ${account.bank_name},
              ${account.account_number},
              ${account.account_name},
              ${branchId},
              true
            )
          `
        }

        // Fetch the newly created accounts
        accounts = await sql`
          SELECT 
            id,
            bank_name,
            account_number,
            account_name,
            branch_id,
            is_active,
            created_at
          FROM e_zwich_partner_accounts 
          WHERE branch_id = ${branchId} AND is_active = true
          ORDER BY bank_name ASC
        `
      }
    } catch (queryError) {
      console.error("Error querying e_zwich_partner_accounts:", queryError)
      accounts = []
    }

    console.log(`Found ${accounts.length} E-Zwich partner accounts`)

    return NextResponse.json({
      success: true,
      accounts,
    })
  } catch (error) {
    console.error("Error fetching E-Zwich partner accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch E-Zwich partner accounts",
        accounts: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { bank_name, account_number, account_name } = body

    // Validate required fields
    if (!bank_name || !account_number || !account_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { user } = session

    // Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS e_zwich_partner_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bank_name VARCHAR(255) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          account_name VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
    } catch (tableError) {
      console.error("Error creating e_zwich_partner_accounts table:", tableError)
    }

    // Insert partner account
    const result = await sql`
      INSERT INTO e_zwich_partner_accounts (
        bank_name, account_number, account_name, branch_id, is_active
      ) VALUES (
        ${bank_name},
        ${account_number},
        ${account_name},
        ${user.branchId},
        true
      ) RETURNING *
    `

    const account = result[0]

    return NextResponse.json({
      success: true,
      account,
      message: "E-Zwich partner account created successfully",
    })
  } catch (error) {
    console.error("Error creating E-Zwich partner account:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
