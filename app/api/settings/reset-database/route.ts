import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { getDatabaseSession } from "@/lib/database-session-service";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const session = await getDatabaseSession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin (case-sensitive check)
    if (session.user.role !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    // Get user password for verification
    const userResult = await sql`
      SELECT password_hash FROM users WHERE id = ${session.user.id}
    `;

    if (userResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult[0];

    const { adminPassword } = await request.json();

    if (!adminPassword) {
      return NextResponse.json(
        { success: false, error: "Admin password is required" },
        { status: 400 }
      );
    }

    // Verify admin password
    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      user.password_hash
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid admin password" },
        { status: 400 }
      );
    }

    // Reset database
    await resetDatabase(session.user.id);

    // Verify admin user still exists
    const adminCheck = await sql`
      SELECT id, email FROM users WHERE id = ${session.user.id}
    `;

    if (adminCheck.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Critical error: Admin user was not preserved during reset",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Database reset completed successfully. All data has been cleared except your admin account.",
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset database" },
      { status: 500 }
    );
  }
}

async function resetDatabase(currentAdminId: string) {
  try {
    // Get current admin user info
    const [adminUser] = await sql`
      SELECT * FROM users WHERE id = ${currentAdminId}
    `;
    if (!adminUser) throw new Error("Current admin user not found");

    // Tables to delete (child tables first to avoid FK issues)
    const tablesToDelete = [
      "momo_transactions",
      "agency_banking_transactions",
      "e_zwich_transactions",
      "power_transactions",
      "jumia_transactions",
      "ezwich_transactions",
      "gl_journal_entries",
      "gl_transactions",
      "float_transactions",
      "gl_mappings",
      "gl_account_balances",
      "commissions",
      "expenses",
      "e_zwich_card_issuances",
      "e_zwich_withdrawals",
      "ezwich_card_issuance",
      "ezwich_cards",
      "ezwich_card_batches",
      "e_zwich_partner_accounts",
      "audit_logs",
      "security_events",
      "login_attempts",
      "user_sessions",
      "user_notification_settings",
      "user_branch_assignments",
      "notifications",
      "system_backups",
      "jumia_packages",
      "gl_sync_logs",
      "float_accounts",
      "gl_accounts",
      "fixed_assets",
    ];

    const tablesToKeep = [
      "users",
      "branches",
      "system_config",
      "system_settings",
      "fee_config",
      "partner_banks",
      "permissions",
      "roles",
      "expense_heads",
    ];

    console.log("Starting database reset...");

    // Test database connection and basic query
    try {
      const testResult = await sql`SELECT 1 as test`;
      console.log(`✅ Database connection test: ${testResult[0]?.test}`);
    } catch (err: any) {
      console.log(`❌ Database connection test failed:`, err.message);
      throw err;
    }

    // Get all actual table names from the database
    try {
      const actualTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name NOT IN ('schema_migrations', 'ar_internal_metadata')
        ORDER BY table_name
      `;

      console.log("📋 Actual tables in database:");
      actualTables.forEach((table: any) => {
        console.log(`  - ${table.table_name}`);
      });
    } catch (err: any) {
      console.log(`❌ Could not get table list:`, err.message);
    }

    // Disable constraints
    try {
      await sql.unsafe(`SET session_replication_role = replica`);
      console.log("✓ Constraints disabled");
    } catch (e: any) {
      console.log(
        "⚠ Could not disable constraints (may be fine on Neon):",
        e.message
      );
    }

    // Delete data
    for (const tableName of tablesToDelete) {
      try {
        // First check if table exists
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )
        `;

        if (!tableExists[0]?.exists) {
          console.log(`⚠ Table ${tableName} does not exist, skipping`);
          continue;
        }

        // Check row count - use proper sql template literal
        const result = await sql`SELECT COUNT(*) as count FROM ${sql.unsafe(
          tableName
        )}`;
        console.log("🔍 [RESET DATABASE] Table count result:", result);
        const before = result[0]?.count || "0";
        console.log(`📊 ${tableName}: ${before} rows before delete`);

        if (before === "0") {
          console.log(`✓ ${tableName} already empty, skipping delete`);
          continue;
        }

        // Perform deletion - use proper sql template literal
        const deleteResult = await sql`DELETE FROM ${sql.unsafe(
          tableName
        )} WHERE 1=1`;
        console.log(
          `🗑️ Deleted ${deleteResult.length || 0} rows from ${tableName}`
        );

        // Verify deletion - use proper sql template literal
        const afterResult =
          await sql`SELECT COUNT(*) as count FROM ${sql.unsafe(tableName)}`;
        const after = afterResult[0]?.count || "0";
        console.log(
          after === "0"
            ? `✅ Successfully cleared ${tableName}`
            : `⚠ ${tableName} still has ${after} rows after deletion`
        );
      } catch (err: any) {
        console.log(`❌ Error processing ${tableName}:`, err.message);
      }
    }

    // Re-enable constraints
    try {
      await sql.unsafe(`SET session_replication_role = DEFAULT`);
      console.log("✓ Constraints re-enabled");
    } catch (e: any) {
      console.log("⚠ Could not re-enable constraints:", e.message);
    }

    // Reset sequences (optional)
    const sequencesToReset = [
      "audit_logs_id_seq",
      "fee_config_id_seq",
      "gl_account_balances_id_seq",
      "permissions_id_seq",
      "roles_id_seq",
      "system_config_id_seq",
      "system_settings_id_seq",
    ];

    for (const seq of sequencesToReset) {
      try {
        await sql.unsafe(`ALTER SEQUENCE IF EXISTS "${seq}" RESTART WITH 1`);
        console.log(`🔄 Reset sequence: ${seq}`);
      } catch (err: any) {
        console.log(`⚠ Could not reset sequence ${seq}:`, err.message);
      }
    }

    console.log("✅ Database reset complete. Admin user preserved.");
  } catch (err: any) {
    console.error("❌ Database reset failed:", err.message);
    throw err;
  }
}
