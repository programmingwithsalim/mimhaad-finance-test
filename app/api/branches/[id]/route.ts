import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const result = await sql`
      SELECT * FROM branches WHERE id = ${(await params).id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error(`Error fetching branch with ID ${(await params).id}:`, error)
    return NextResponse.json(
      {
        error: "Failed to fetch branch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const data = await request.json()
    console.log(`Updating branch ${(await params).id} with data:`, data)

    // Build dynamic update query
    const updateFields: string[] = []
    const values: any[] = []

    if (data.name !== undefined) {
      updateFields.push(`name = $${updateFields.length + 1}`)
      values.push(data.name)
    }

    if (data.location !== undefined) {
      updateFields.push(`location = $${updateFields.length + 1}`)
      values.push(data.location)
    }

    if (data.region !== undefined) {
      updateFields.push(`region = $${updateFields.length + 1}`)
      values.push(data.region)
    }

    if (data.code !== undefined) {
      updateFields.push(`code = $${updateFields.length + 1}`)
      values.push(data.code)
    }

    if (data.manager !== undefined) {
      updateFields.push(`manager = $${updateFields.length + 1}`)
      values.push(data.manager)
    }

    if (data.contact_phone !== undefined) {
      updateFields.push(`contact_phone = $${updateFields.length + 1}`)
      values.push(data.contact_phone)
    }

    if (data.email !== undefined) {
      updateFields.push(`email = $${updateFields.length + 1}`)
      values.push(data.email)
    }

    if (data.staff_count !== undefined) {
      updateFields.push(`staff_count = $${updateFields.length + 1}`)
      values.push(data.staff_count)
    }

    if (data.status !== undefined) {
      updateFields.push(`status = $${updateFields.length + 1}`)
      values.push(data.status)
    }

    if (data.address !== undefined) {
      updateFields.push(`address = $${updateFields.length + 1}`)
      values.push(data.address)
    }

    if (data.phone !== undefined) {
      updateFields.push(`phone = $${updateFields.length + 1}`)
      values.push(data.phone)
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`)

    // Add ID parameter
    values.push((await params).id)

    const query = `
      UPDATE branches 
      SET ${updateFields.join(", ")}
      WHERE id = $${values.length}
      RETURNING *
    `

    console.log("Update query:", query)
    console.log("Update values:", values)

    const result = await sql.query(query, values)

    if (result.length === 0) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    console.log("Updated branch:", result[0])
    return NextResponse.json(result[0])
  } catch (error) {
    console.error(`Error updating branch with ID ${(await params).id}:`, error)
    return NextResponse.json(
      {
        error: "Failed to update branch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string  }> }) {
  try {
    console.log(`Deleting branch with ID: ${(await params).id}`)

    const result = await sql`
      DELETE FROM branches WHERE id = ${(await params).id} RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 })
    }

    console.log("Deleted branch:", result[0])
    return NextResponse.json({
      success: true,
      message: "Branch deleted successfully",
      deletedBranch: result[0],
    })
  } catch (error) {
    console.error(`Error deleting branch with ID ${(await params).id}:`, error)
    return NextResponse.json(
      {
        error: "Failed to delete branch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
