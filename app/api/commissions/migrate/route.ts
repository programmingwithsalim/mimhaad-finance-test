import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    console.log("Starting commission table migration...");

    // Add missing columns for approval workflow
    await sql`
      ALTER TABLE commissions 
      ADD COLUMN IF NOT EXISTS approved_by UUID,
      ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS approval_comments TEXT
    `;

    console.log("✓ Added approval columns");

    // Update status CHECK constraint to include 'approved' and 'rejected'
    await sql`
      ALTER TABLE commissions 
      DROP CONSTRAINT IF EXISTS commissions_status_check
    `;

    await sql`
      ALTER TABLE commissions 
      ADD CONSTRAINT commissions_status_check 
      CHECK (status IN ('pending', 'approved', 'rejected', 'paid'))
    `;

    console.log("✓ Updated status constraint");

    // Change default status from 'paid' to 'pending' for new commissions
    await sql`
      ALTER TABLE commissions 
      ALTER COLUMN status SET DEFAULT 'pending'
    `;

    console.log("✓ Changed default status to 'pending'");

    return NextResponse.json({
      success: true,
      message: "Commission table migration completed successfully",
      changes: [
        "Added approved_by column",
        "Added approved_by_name column",
        "Added approved_at column",
        "Added approval_comments column",
        "Updated status constraint to include 'approved' and 'rejected'",
        "Changed default status to 'pending'",
      ],
    });
  } catch (error) {
    console.error("Error migrating commission table:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to migrate commission table",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
