import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

// Mock partner banks data
const mockPartnerBanks = [
  {
    id: "gcb-001",
    name: "Ghana Commercial Bank",
    code: "GCB",
    transferFee: 0.01,
    minFee: 5,
    maxFee: 50,
    status: "active",
    currentBalance: Math.floor(Math.random() * 15000) + 5000,
    minThreshold: 5000,
    maxThreshold: 200000,
    floatAccountId: null,
  },
  {
    id: "eco-001",
    name: "Ecobank Ghana",
    code: "ECO",
    transferFee: 0.015,
    minFee: 3,
    maxFee: 45,
    status: "active",
    currentBalance: Math.floor(Math.random() * 15000) + 5000,
    minThreshold: 5000,
    maxThreshold: 200000,
    floatAccountId: null,
  },
  {
    id: "stb-001",
    name: "Stanbic Bank",
    code: "STB",
    transferFee: 0.012,
    minFee: 4,
    maxFee: 40,
    status: "active",
    currentBalance: Math.floor(Math.random() * 15000) + 5000,
    minThreshold: 5000,
    maxThreshold: 200000,
    floatAccountId: null,
  },
  {
    id: "cal-001",
    name: "Cal Bank",
    code: "CAL",
    transferFee: 0.01,
    minFee: 5,
    maxFee: 50,
    status: "active",
    currentBalance: Math.floor(Math.random() * 15000) + 5000,
    minThreshold: 5000,
    maxThreshold: 200000,
    floatAccountId: null,
  },
  {
    id: "zen-001",
    name: "Zenith Bank",
    code: "ZEN",
    transferFee: 0.013,
    minFee: 4,
    maxFee: 45,
    status: "active",
    currentBalance: Math.floor(Math.random() * 15000) + 5000,
    minThreshold: 5000,
    maxThreshold: 200000,
    floatAccountId: null,
  },
]

export async function GET(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: branchId } = await params

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    if (!process.env.DATABASE_URL) {
      // Return mock data if no database connection
      return NextResponse.json(mockPartnerBanks)
    }

    const sql = neon(process.env.DATABASE_URL)

    try {
      // Fetch partner banks from float accounts table for this branch
      const floatAccounts = await sql`
        SELECT 
          id, 
          provider, 
          account_number,
          current_balance, 
          min_threshold,
          max_threshold,
          is_active
        FROM 
          float_accounts 
        WHERE 
          account_type = 'agency-banking' 
          AND branch_id = ${branchId}
          AND provider IS NOT NULL
          AND provider != 'agency'
          AND is_active = true
        ORDER BY 
          provider ASC
      `

      // If we have float accounts, map them to partner banks
      if (floatAccounts && floatAccounts.length > 0) {
        const partnerBanks = floatAccounts.map((account) => {
          // Get bank name from provider code
          const bankNames: Record<string, string> = {
            GCB: "Ghana Commercial Bank",
            ECO: "Ecobank Ghana",
            STB: "Stanbic Bank",
            CAL: "Cal Bank",
            ZEN: "Zenith Bank",
          }

          const bankName = bankNames[account.provider] || account.provider

          return {
            id: account.id,
            name: bankName,
            code: account.provider,
            transferFee: 0.01,
            minFee: 5,
            maxFee: 50,
            status: account.is_active ? "active" : "inactive",
            currentBalance: Number(account.current_balance) || 0,
            minThreshold: Number(account.min_threshold) || 0,
            maxThreshold: Number(account.max_threshold) || 0,
            floatAccountId: account.id,
          }
        })

        return NextResponse.json(partnerBanks)
      }
    } catch (dbError) {
      console.error("Database error, falling back to mock data:", dbError)
    }

    // Return mock data if no database results or on error
    return NextResponse.json(mockPartnerBanks)
  } catch (error) {
    console.error(`Error fetching partner banks for branch ${(await params).id}:`, error)
    // Return mock data on any error
    return NextResponse.json(mockPartnerBanks)
  }
}
