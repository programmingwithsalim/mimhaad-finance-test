import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { ensureEZwichTables } from "@/lib/e-zwich-service"

const sql = neon(process.env.DATABASE_URL!)

export async function POST() {
  try {
    // Ensure E-Zwich tables exist
    await ensureEZwichTables()

    // Ensure default branch exists
    const defaultBranchId = "635844ab-029a-43f8-8523-d7882915266a"

    const existingBranch = await sql`
      SELECT id FROM branches WHERE id = ${defaultBranchId}
    `

    if (existingBranch.length === 0) {
      // Create default branch
      await sql`
        INSERT INTO branches (id, name, code, address, phone, email, status)
        VALUES (
          ${defaultBranchId},
          'Main Branch',
          'MAIN001',
          'Accra, Ghana',
          '+233123456789',
          'main@branch.com',
          'active'
        )
        ON CONFLICT (id) DO NOTHING
      `
    }

    return NextResponse.json({
      success: true,
      message: "E-Zwich system initialized successfully",
    })
  } catch (error) {
    console.error("Error initializing E-Zwich system:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize E-Zwich system",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
