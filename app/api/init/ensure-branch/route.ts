import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not configured",
          branch: null,
        },
        { status: 500 },
      )
    }

    const sql = neon(process.env.DATABASE_URL)

    // Check if branches table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'branches'
      ) as table_exists
    `

    if (!tableCheck[0]?.table_exists) {
      console.log("Branches table does not exist")

      // Return a mock branch with proper UUID format
      const mockBranch = {
        id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
        name: "Main Branch",
        code: "MAIN001",
        location: "Accra",
        region: "Greater Accra",
        manager: "System Admin",
        email: "admin@branch.com",
        phone: "+233123456789",
        address: "123 Main Street, Accra",
        status: "active",
        staff_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      return NextResponse.json({
        success: true,
        branch: mockBranch,
        message: "Using mock branch - database table not available",
        fallback: true,
      })
    }

    // Check if any branches exist
    const existingBranches = await sql`
      SELECT * FROM branches WHERE status = 'active' LIMIT 1
    `

    if (existingBranches.length > 0) {
      return NextResponse.json({
        success: true,
        branch: existingBranches[0],
        message: "Using existing branch",
      })
    }

    // Create a default branch if none exist
    try {
      const newBranch = await sql`
        INSERT INTO branches (
          name, code, location, region, manager, email, phone, address, status, staff_count
        ) VALUES (
          'Main Branch', 'MAIN001', 'Accra', 'Greater Accra', 'System Admin',
          'admin@branch.com', '+233123456789', '123 Main Street, Accra', 'active', 5
        )
        RETURNING *
      `

      if (newBranch.length > 0) {
        return NextResponse.json({
          success: true,
          branch: newBranch[0],
          message: "Created new default branch",
        })
      }
    } catch (createError) {
      console.error("Error creating default branch:", createError)

      // Return a mock branch with proper UUID format as fallback
      const mockBranch = {
        id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
        name: "Main Branch",
        code: "MAIN001",
        location: "Accra",
        region: "Greater Accra",
        manager: "System Admin",
        email: "admin@branch.com",
        phone: "+233123456789",
        address: "123 Main Street, Accra",
        status: "active",
        staff_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      return NextResponse.json({
        success: true,
        branch: mockBranch,
        message: "Using mock branch - failed to create in database",
        fallback: true,
      })
    }

    // Fallback if everything fails
    const mockBranch = {
      id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
      name: "Main Branch",
      code: "MAIN001",
      location: "Accra",
      region: "Greater Accra",
      manager: "System Admin",
      email: "admin@branch.com",
      phone: "+233123456789",
      address: "123 Main Street, Accra",
      status: "active",
      staff_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      branch: mockBranch,
      message: "Using mock branch as final fallback",
      fallback: true,
    })
  } catch (error) {
    console.error("Error ensuring branch exists:", error)

    // Return a mock branch with proper UUID format as final fallback
    const mockBranch = {
      id: "550e8400-e29b-41d4-a716-446655440000", // Valid UUID
      name: "Main Branch",
      code: "MAIN001",
      location: "Accra",
      region: "Greater Accra",
      manager: "System Admin",
      email: "admin@branch.com",
      phone: "+233123456789",
      address: "123 Main Street, Accra",
      status: "active",
      staff_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      branch: mockBranch,
      message: "Using mock branch due to error",
      fallback: true,
    })
  }
}
