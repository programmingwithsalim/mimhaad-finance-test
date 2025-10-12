import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Ensure roles table exists with correct structure
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        permissions TEXT[],
        is_default BOOLEAN DEFAULT FALSE,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        updated_by INTEGER
      )
    `;

    // Insert default roles if they don't exist - using proper case-sensitive names
    await sql`
      INSERT INTO roles (name, description, permissions, is_system)
      VALUES 
        ('Admin', 'Full access to all system functions', ARRAY['all'], true),
        ('Manager', 'Approve high-value transactions, transfer funds, override operations', ARRAY['transactions:approve', 'transfers:manage', 'operations:override', 'user_management', 'branch_management', 'reports_access'], true),
        ('Finance', 'Access all reports, reconcile accounts, view audit trails', ARRAY['reports:all', 'accounts:reconcile', 'audit:view', 'financial_management', 'expense_management', 'commission_management'], true),
        ('Operations', 'Initiate transactions, verify customer requests', ARRAY['transactions:initiate', 'transactions:verify', 'customers:view', 'basic_reports'], true),
        ('Supervisor', 'Supervise transactions and approve within limits', ARRAY['transactions:initiate', 'transactions:approve', 'transactions:verify', 'customers:view', 'basic_reports'], true),
        ('Cashier', 'Process payments and receipts, view till balance', ARRAY['transactions:process', 'transactions:view', 'balance:view', 'transaction_processing'], true)
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        permissions = EXCLUDED.permissions,
        is_system = EXCLUDED.is_system
    `;

    const roles = await sql`
      SELECT 
        id,
        name,
        description,
        permissions,
        is_system,
        created_at,
        updated_at
      FROM roles 
      ORDER BY name
    `;

    return NextResponse.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch roles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { roleId, permissions, updatedBy } = await request.json();

    await sql`
      UPDATE roles 
      SET 
        permissions = ${permissions},
        updated_at = NOW(),
        updated_by = ${updatedBy || 1}
      WHERE id = ${roleId}
    `;

    return NextResponse.json({
      success: true,
      message: "Role permissions updated successfully",
    });
  } catch (error) {
    console.error("Error updating role permissions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update role permissions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
