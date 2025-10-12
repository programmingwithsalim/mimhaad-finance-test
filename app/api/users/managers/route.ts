import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const managers = await sql`
      SELECT 
        id,
        first_name as "firstName",
        last_name as "lastName",
        CONCAT(first_name, ' ', last_name) as name,
        email,
        role,
        primary_branch_id as "branchId",
        status,
        created_at as "createdAt"
      FROM users 
      WHERE role IN ('Manager')
      AND status = 'active'
      ORDER BY role, first_name
    `

    console.log("Managers data received:", managers)  

    return NextResponse.json({
      success: true,
      managers: managers.map((manager) => ({
        ...manager,
        name: manager.name || `${manager.firstName || ""} ${manager.lastName || ""}`.trim() || "Unknown User",
      })),
    })
  } catch (error) {
    console.error("Error fetching managers:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch managers",
        managers: [],
      },
      { status: 500 },
    )
  }
}
