import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// In-memory storage as fallback
const cashTillData = {
  branches: [
    {
      id: "branch-1",
      name: "Main Branch",
      modules: [
        { name: "momo", balance: 3000 },
        { name: "agency-banking", balance: 2000 },
        { name: "e-zwich", balance: 1500 },
        { name: "jumia", balance: 1000 },
        { name: "power", balance: 1200 },
      ],
    },
    {
      id: "branch-2",
      name: "Downtown Branch",
      modules: [
        { name: "momo", balance: 2000 },
        { name: "agency-banking", balance: 1500 },
        { name: "e-zwich", balance: 1000 },
        { name: "jumia", balance: 800 },
        { name: "power", balance: 1000 },
      ],
    },
  ],
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get("branchId")
    const serviceModule = searchParams.get("serviceModule")

    console.log("Fetching cash till with params:", { branchId, serviceModule })

    let balance = 0

    // Try database first
    try {
      if (branchId && serviceModule) {
        const result = await sql`
          SELECT balance FROM cash_till 
          WHERE branch_id = ${branchId} AND service_module = ${serviceModule}
        `

        if (result.length > 0) {
          balance = Number(result[0].balance || 0)
        }
      }
    } catch (dbError) {
      console.log("Database not available, using in-memory data")

      // Fallback to in-memory data
      if (branchId && serviceModule) {
        const branch = cashTillData.branches.find((b) => b.id === branchId)
        if (branch) {
          const module = branch.modules.find((m) => m.name === serviceModule)
          if (module) {
            balance = module.balance || 0
          }
        }
      }
    }

    console.log(`Returning cash balance: ${balance} for branch ${branchId} and module ${serviceModule}`)

    return NextResponse.json({ balance })
  } catch (error) {
    console.error("Error in GET /api/cash-till:", error)
    return NextResponse.json({ error: "Failed to fetch cash till data", balance: 0 }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    if (!data.branchId || !data.serviceModule || data.amount === undefined) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 })
    }

    let newBalance = 0

    // Try database first
    try {
      // Get current balance
      const currentResult = await sql`
        SELECT balance FROM cash_till 
        WHERE branch_id = ${data.branchId} AND service_module = ${data.serviceModule}
      `

      const currentBalance = currentResult.length > 0 ? Number(currentResult[0].balance) : 0
      newBalance = currentBalance + data.amount

      // Update or insert
      await sql`
        INSERT INTO cash_till (branch_id, service_module, balance)
        VALUES (${data.branchId}, ${data.serviceModule}, ${newBalance})
        ON CONFLICT (branch_id, service_module)
        DO UPDATE SET balance = ${newBalance}, updated_at = NOW()
      `
    } catch (dbError) {
      console.log("Database not available, using in-memory data")

      // Fallback to in-memory data
      let branch = cashTillData.branches.find((b) => b.id === data.branchId)
      if (!branch) {
        branch = {
          id: data.branchId,
          name: `Branch ${data.branchId}`,
          modules: [],
        }
        cashTillData.branches.push(branch)
      }

      let module = branch.modules.find((m) => m.name === data.serviceModule)
      if (!module) {
        module = { name: data.serviceModule, balance: 0 }
        branch.modules.push(module)
      }

      const currentBalance = module.balance || 0
      newBalance = currentBalance + data.amount
      module.balance = newBalance
    }

    return NextResponse.json({
      success: true,
      message: "Cash till updated successfully",
      balance: newBalance,
    })
  } catch (error) {
    console.error("Error in POST /api/cash-till:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update cash till", error: String(error) },
      { status: 500 },
    )
  }
}
