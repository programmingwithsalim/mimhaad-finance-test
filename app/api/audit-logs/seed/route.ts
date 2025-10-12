import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST() {
  try {
    // First ensure the audit_logs table exists
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        username VARCHAR(255) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255),
        description TEXT NOT NULL,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        branch_id VARCHAR(255),
        branch_name VARCHAR(255),
        status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure')),
        error_message TEXT,
        related_entities JSONB,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type)`
    await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`

    // Check if we already have audit logs
    const existingLogs = await sql`SELECT COUNT(*) as count FROM audit_logs`
    const logCount = Number.parseInt(existingLogs[0]?.count || "0")

    if (logCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Audit logs table already contains ${logCount} entries`,
        count: logCount,
      })
    }

    // Sample audit log entries
    const sampleLogs = [
      {
        user_id: "user_001",
        username: "admin",
        action_type: "login",
        entity_type: "auth",
        entity_id: "session_123456",
        description: "User login successful",
        details: JSON.stringify({ loginMethod: "password", deviceType: "desktop" }),
        ip_address: "192.168.1.100",
        user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        severity: "low",
        branch_id: "branch_001",
        branch_name: "Head Office",
        status: "success",
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      },
      {
        user_id: "user_002",
        username: "cashier_1",
        action_type: "transaction_deposit",
        entity_type: "transaction",
        entity_id: "TXN001234",
        description: "Cash deposit transaction processed",
        details: JSON.stringify({
          amount: 5000.0,
          currency: "GHS",
          customerName: "John Doe",
          transactionType: "deposit",
        }),
        ip_address: "192.168.1.101",
        severity: "medium",
        branch_id: "branch_002",
        branch_name: "Downtown Branch",
        status: "success",
        created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      },
      {
        user_id: "user_003",
        username: "float_manager",
        action_type: "float_allocation",
        entity_type: "float_account",
        entity_id: "float_acc_001",
        description: "Float allocated to branch",
        details: JSON.stringify({
          amount: 25000.0,
          currency: "GHS",
          floatType: "MoMo",
          provider: "MTN",
        }),
        ip_address: "192.168.1.102",
        severity: "high",
        branch_id: "branch_001",
        branch_name: "Head Office",
        status: "success",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      },
      {
        user_id: "user_002",
        username: "cashier_1",
        action_type: "failed_login_attempt",
        entity_type: "auth",
        entity_id: "session_attempt_789",
        description: "Failed login attempt - invalid password",
        details: JSON.stringify({ reason: "Invalid password", attemptCount: 2 }),
        ip_address: "192.168.1.103",
        severity: "medium",
        branch_id: "branch_002",
        branch_name: "Downtown Branch",
        status: "failure",
        error_message: "Invalid credentials provided",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      },
      {
        user_id: "user_001",
        username: "admin",
        action_type: "create",
        entity_type: "user",
        entity_id: "user_004",
        description: "New user account created",
        details: JSON.stringify({
          newUser: {
            username: "new_teller",
            role: "Teller",
            branch: "Westside Branch",
          },
        }),
        ip_address: "192.168.1.100",
        severity: "medium",
        branch_id: "branch_001",
        branch_name: "Head Office",
        status: "success",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
      },
      {
        user_id: "user_003",
        username: "float_manager",
        action_type: "export_report",
        entity_type: "report",
        entity_id: "monthly_float_report",
        description: "Monthly float report exported",
        details: JSON.stringify({
          reportType: "Monthly Float Summary",
          format: "PDF",
          period: "November 2024",
          recordCount: 1250,
        }),
        ip_address: "192.168.1.102",
        severity: "low",
        branch_id: "branch_001",
        branch_name: "Head Office",
        status: "success",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      },
      {
        user_id: "system",
        username: "system",
        action_type: "system_error",
        entity_type: "system",
        entity_id: "database_connection",
        description: "Database connection timeout",
        details: JSON.stringify({
          errorCode: "DB_TIMEOUT",
          component: "Database Server",
          attempts: 3,
        }),
        ip_address: "127.0.0.1",
        severity: "critical",
        status: "failure",
        error_message: "Connection to database timed out after 30 seconds",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
      },
    ]

    // Insert sample logs
    let insertedCount = 0
    for (const log of sampleLogs) {
      try {
        await sql`
          INSERT INTO audit_logs (
            user_id, username, action_type, entity_type, entity_id,
            description, details, ip_address, user_agent, severity,
            branch_id, branch_name, status, error_message, created_at
          ) VALUES (
            ${log.user_id}, ${log.username}, ${log.action_type},
            ${log.entity_type}, ${log.entity_id}, ${log.description},
            ${log.details}, ${log.ip_address}, ${log.user_agent || null},
            ${log.severity}, ${log.branch_id || null}, ${log.branch_name || null},
            ${log.status}, ${log.error_message || null}, ${log.created_at}
          )
        `
        insertedCount++
      } catch (error) {
        console.error("Error inserting audit log:", error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${insertedCount} audit log entries`,
      count: insertedCount,
    })
  } catch (error) {
    console.error("Error seeding audit logs:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed audit logs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
