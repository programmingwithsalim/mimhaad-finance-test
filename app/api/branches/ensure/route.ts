import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST(request: Request) {
  try {
    const { branchId } = await request.json()

    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 })
    }

    // Get database connection
    const sql = neon(process.env.DATABASE_URL!)

    // Check if branch exists
    const existingBranch = await sql`
      SELECT * FROM branches WHERE id = ${branchId} LIMIT 1
    `

    if (existingBranch && existingBranch.length > 0) {
      return NextResponse.json({
        success: true,
        branch: existingBranch[0],
        message: "Branch already exists",
      })
    }

    // Create the branch if it doesn't exist
    const result = await sql`
      INSERT INTO branches (
        id, name, code, address, phone, email, manager_name, is_active, created_at, updated_at
      )
      VALUES (
        ${branchId},
        'Main Branch',
        ${branchId.slice(-6).toUpperCase()},
        'Default Address',
        '0000000000',
        'main@branch.com',
        'Branch Manager',
        true,
        NOW(),
        NOW()
      )
      RETURNING *
    `

    if (!result || result.length === 0) {
      throw new Error("Failed to create branch")
    }

    return NextResponse.json({
      success: true,
      branch: result[0],
      message: "Branch created successfully",
    })
  } catch (error) {
    console.error("Error ensuring branch exists:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ensure branch exists" },
      { status: 500 },
    )
  }
}
