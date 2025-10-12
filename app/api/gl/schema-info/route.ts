import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    console.log("=== RETRIEVING DATABASE SCHEMA ===")

    // Get schema information for all transaction tables
    const schemaInfo = await sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'momo_transactions',
        'agency_banking_transactions', 
        'ezwich_transactions',
        'power_transactions',
        'jumia_transactions',
        'commissions',
        'expenses',
        'float_accounts',
        'branches'
      )
      ORDER BY table_name, ordinal_position
    `

    // Group by table for easier reading
    const schemaByTable = schemaInfo.reduce((acc, row) => {
      if (!acc[row.table_name]) {
        acc[row.table_name] = []
      }
      acc[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        default: row.column_default,
        position: row.ordinal_position,
      })
      return acc
    }, {})

    // Also get sample data from each table to understand the structure
    const sampleData = {}

    for (const tableName of Object.keys(schemaByTable)) {
      try {
        const sample = await sql`
          SELECT * FROM ${sql(tableName)} LIMIT 1
        `
        sampleData[tableName] = sample[0] || null
      } catch (error) {
        sampleData[tableName] = `Error: ${error.message}`
      }
    }

    console.log("Schema retrieved successfully")
    console.log("Tables found:", Object.keys(schemaByTable))

    return NextResponse.json({
      success: true,
      schema: schemaByTable,
      sampleData,
      tableCount: Object.keys(schemaByTable).length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error retrieving schema:", error)
    return NextResponse.json(
      {
        error: "Failed to retrieve schema",
        details: error.message,
        schema: {},
        sampleData: {},
      },
      { status: 500 },
    )
  }
}
