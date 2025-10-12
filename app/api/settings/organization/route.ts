import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const organization = await sql`
      SELECT * FROM organization_profile 
      ORDER BY created_at DESC 
      LIMIT 1
    `

    return NextResponse.json({
      success: true,
      data: organization[0] || null,
    })
  } catch (error) {
    console.error("Error fetching organization profile:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch organization profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json()
    const { updated_by, ...organizationData } = data

    // Check if organization profile exists
    const existing = await sql`SELECT id FROM organization_profile LIMIT 1`

    let result
    if (existing.length > 0) {
      // Update existing
      result = await sql`
        UPDATE organization_profile SET
          name = ${organizationData.name || null},
          legal_name = ${organizationData.legal_name || null},
          registration_number = ${organizationData.registration_number || null},
          tax_id = ${organizationData.tax_id || null},
          industry = ${organizationData.industry || null},
          website = ${organizationData.website || null},
          email = ${organizationData.email || null},
          phone = ${organizationData.phone || null},
          address_line1 = ${organizationData.address_line1 || null},
          address_line2 = ${organizationData.address_line2 || null},
          city = ${organizationData.city || null},
          state = ${organizationData.state || null},
          postal_code = ${organizationData.postal_code || null},
          country = ${organizationData.country || null},
          logo_url = ${organizationData.logo_url || null},
          timezone = ${organizationData.timezone || null},
          currency = ${organizationData.currency || null},
          date_format = ${organizationData.date_format || null},
          time_format = ${organizationData.time_format || null},
          fiscal_year_start = ${organizationData.fiscal_year_start || null},
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ${updated_by || null}
        WHERE id = ${existing[0].id}
        RETURNING *
      `
    } else {
      // Create new
      result = await sql`
        INSERT INTO organization_profile (
          name, legal_name, registration_number, tax_id, industry, website, email, phone,
          address_line1, address_line2, city, state, postal_code, country, logo_url,
          timezone, currency, date_format, time_format, fiscal_year_start, updated_by
        ) VALUES (
          ${organizationData.name || null}, ${organizationData.legal_name || null}, 
          ${organizationData.registration_number || null}, ${organizationData.tax_id || null},
          ${organizationData.industry || null}, ${organizationData.website || null},
          ${organizationData.email || null}, ${organizationData.phone || null},
          ${organizationData.address_line1 || null}, ${organizationData.address_line2 || null},
          ${organizationData.city || null}, ${organizationData.state || null},
          ${organizationData.postal_code || null}, ${organizationData.country || null},
          ${organizationData.logo_url || null}, ${organizationData.timezone || null},
          ${organizationData.currency || null}, ${organizationData.date_format || null},
          ${organizationData.time_format || null}, ${organizationData.fiscal_year_start || null},
          ${updated_by || null}
        )
        RETURNING *
      `
    }

    // Log the change
    await sql`
      INSERT INTO audit_logs (user_id, username, action_type, entity_type, description, severity, status)
      VALUES (${updated_by || null}, 'admin', 'UPDATE', 'organization_profile', 'Updated organization profile', 'medium', 'success')
    `

    return NextResponse.json({
      success: true,
      message: "Organization profile updated successfully",
      data: result[0],
    })
  } catch (error) {
    console.error("Error updating organization profile:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update organization profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
