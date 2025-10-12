import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { randomUUID } from "crypto"

const sql = neon(process.env.CONNECTION_STRING!)

export async function POST() {
  try {
    console.log("Initializing GL accounts system...")

    // First, check if we can connect to the database
    try {
      await sql`SELECT 1 as test`
      console.log("Database connection successful")
    } catch (error) {
      console.error("Database connection failed:", error)
      throw new Error("Cannot connect to database")
    }

    // Drop and recreate the table to ensure clean state
    console.log("Setting up GL accounts table...")

    // Drop existing table if it exists (be careful in production!)
    await sql`DROP TABLE IF EXISTS gl_journal_entries CASCADE`
    await sql`DROP TABLE IF EXISTS gl_transactions CASCADE`
    await sql`DROP TABLE IF EXISTS float_gl_mapping CASCADE`
    await sql`DROP TABLE IF EXISTS gl_sync_logs CASCADE`
    await sql`DROP TABLE IF EXISTS gl_accounts CASCADE`

    // Create the GL accounts table with explicit UUID handling
    await sql`
      CREATE TABLE gl_accounts (
        id UUID PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
        parent_id UUID REFERENCES gl_accounts(id),
        balance DECIMAL(15,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    console.log("GL accounts table created successfully")

    // Create indexes
    await sql`CREATE INDEX idx_gl_accounts_code ON gl_accounts(code)`
    await sql`CREATE INDEX idx_gl_accounts_type ON gl_accounts(type)`
    await sql`CREATE INDEX idx_gl_accounts_parent ON gl_accounts(parent_id)`

    // Define the chart of accounts - we'll insert in phases to handle parent-child relationships
    const rootAccounts = [
      { code: "1000", name: "ASSETS", type: "Asset" },
      { code: "2000", name: "LIABILITIES", type: "Liability" },
      { code: "3000", name: "EQUITY", type: "Equity" },
      { code: "4000", name: "REVENUE", type: "Revenue" },
      { code: "5000", name: "EXPENSES", type: "Expense" },
    ]

    const childAccounts = [
      // ASSETS (1000-1999)
      { code: "1001", name: "Cash", type: "Asset", parentCode: "1000" },
      { code: "1002", name: "E-Zwich Settlement Account", type: "Asset", parentCode: "1000" },
      { code: "1003", name: "MoMo Float Account", type: "Asset", parentCode: "1000" },
      { code: "1004", name: "Power Float Account", type: "Asset", parentCode: "1000" },
      { code: "1005", name: "Agency Banking Float", type: "Asset", parentCode: "1000" },
      { code: "1006", name: "Jumia Float Account", type: "Asset", parentCode: "1000" },
      { code: "1010", name: "Accounts Receivable", type: "Asset", parentCode: "1000" },
      { code: "1020", name: "Inventory - E-Zwich Cards", type: "Asset", parentCode: "1000" },

      // LIABILITIES (2000-2999)
      { code: "2001", name: "Customer Deposits", type: "Liability", parentCode: "2000" },
      { code: "2002", name: "Merchant Payables", type: "Liability", parentCode: "2000" },
      { code: "2003", name: "Bank Partner Liabilities", type: "Liability", parentCode: "2000" },
      { code: "2004", name: "Commission Payables", type: "Liability", parentCode: "2000" },
      { code: "2010", name: "Accounts Payable", type: "Liability", parentCode: "2000" },

      // EQUITY (3000-3999)
      { code: "3001", name: "Owner's Equity", type: "Equity", parentCode: "3000" },
      { code: "3002", name: "Retained Earnings", type: "Equity", parentCode: "3000" },

      // REVENUE (4000-4999)
      { code: "4001", name: "MoMo Commission Revenue", type: "Revenue", parentCode: "4000" },
      { code: "4002", name: "Agency Banking Revenue", type: "Revenue", parentCode: "4000" },
      { code: "4003", name: "Transaction Fee Income", type: "Revenue", parentCode: "4000" },
      { code: "4004", name: "Power Commission Revenue", type: "Revenue", parentCode: "4000" },
      { code: "4005", name: "Jumia Commission Revenue", type: "Revenue", parentCode: "4000" },
      { code: "4006", name: "E-Zwich Card Sales Revenue", type: "Revenue", parentCode: "4000" },
      { code: "4010", name: "Other Income", type: "Revenue", parentCode: "4000" },

      // EXPENSES (5000-5999)
      { code: "5001", name: "General Expenses", type: "Expense", parentCode: "5000" },
      { code: "5002", name: "Staff Salaries", type: "Expense", parentCode: "5000" },
      { code: "5003", name: "Rent Expense", type: "Expense", parentCode: "5000" },
      { code: "5004", name: "Utilities Expense", type: "Expense", parentCode: "5000" },
      { code: "5005", name: "Marketing Expense", type: "Expense", parentCode: "5000" },
      { code: "5006", name: "Bank Charges", type: "Expense", parentCode: "5000" },
      { code: "5007", name: "System Maintenance", type: "Expense", parentCode: "5000" },
    ]

    let created = 0

    // First, insert root accounts (no parents) with explicit UUIDs
    console.log("Creating root accounts...")
    for (const account of rootAccounts) {
      try {
        const accountId = randomUUID()
        console.log(`Creating root account ${account.code} with ID: ${accountId}`)

        await sql`
          INSERT INTO gl_accounts (id, code, name, type, balance, is_active)
          VALUES (${accountId}, ${account.code}, ${account.name}, ${account.type}, 0, true)
        `
        created++
        console.log(`✓ Created root account: ${account.code} - ${account.name}`)
      } catch (error) {
        console.error(`✗ Error creating root account ${account.code}:`, error)
        throw error
      }
    }

    // Then, insert child accounts (with parents)
    console.log("Creating child accounts...")
    for (const account of childAccounts) {
      try {
        // Get parent ID
        const parent = await sql`
          SELECT id FROM gl_accounts WHERE code = ${account.parentCode}
        `

        if (parent.length === 0) {
          console.error(`Parent account ${account.parentCode} not found for ${account.code}`)
          continue
        }

        const parentId = parent[0].id
        const accountId = randomUUID()
        console.log(`Creating child account ${account.code} with ID: ${accountId}, parent: ${parentId}`)

        await sql`
          INSERT INTO gl_accounts (id, code, name, type, parent_id, balance, is_active)
          VALUES (${accountId}, ${account.code}, ${account.name}, ${account.type}, ${parentId}, 0, true)
        `
        created++
        console.log(`✓ Created child account: ${account.code} - ${account.name}`)
      } catch (error) {
        console.error(`✗ Error creating child account ${account.code}:`, error)
        throw error
      }
    }

    // Create supporting tables
    console.log("Creating supporting tables...")

    // GL transactions table
    await sql`
      CREATE TABLE gl_transactions (
        id UUID PRIMARY KEY,
        date DATE NOT NULL,
        source_module VARCHAR(50) NOT NULL,
        source_transaction_id VARCHAR(255) NOT NULL,
        source_transaction_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'reversed')),
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        posted_by VARCHAR(255),
        posted_at TIMESTAMP WITH TIME ZONE,
        reversed_by VARCHAR(255),
        reversed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB
      )
    `

    // Create GL journal entries table
    await sql`
      CREATE TABLE gl_journal_entries (
        id UUID PRIMARY KEY,
        transaction_id UUID NOT NULL REFERENCES gl_transactions(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES gl_accounts(id),
        account_code VARCHAR(20) NOT NULL,
        debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
        credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CHECK (debit > 0 OR credit > 0),
        CHECK (NOT (debit > 0 AND credit > 0))
      )
    `

    // Create sync logs table
    await sql`
      CREATE TABLE gl_sync_logs (
        id UUID PRIMARY KEY,
        module VARCHAR(50) NOT NULL,
        operation VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
        details TEXT,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    // Create float-GL mapping table
    await sql`
      CREATE TABLE float_gl_mapping (
        id UUID PRIMARY KEY,
        float_account_id UUID NOT NULL,
        gl_account_id UUID NOT NULL REFERENCES gl_accounts(id),
        mapping_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(float_account_id, mapping_type)
      )
    `

    // Create indexes for performance
    await sql`CREATE INDEX idx_gl_transactions_source ON gl_transactions(source_transaction_id)`
    await sql`CREATE INDEX idx_gl_transactions_date ON gl_transactions(date)`
    await sql`CREATE INDEX idx_gl_transactions_status ON gl_transactions(status)`
    await sql`CREATE INDEX idx_gl_journal_entries_transaction ON gl_journal_entries(transaction_id)`
    await sql`CREATE INDEX idx_gl_journal_entries_account ON gl_journal_entries(account_id)`
    await sql`CREATE INDEX idx_gl_journal_entries_account_code ON gl_journal_entries(account_code)`
    await sql`CREATE INDEX idx_float_gl_mapping_float ON float_gl_mapping(float_account_id)`
    await sql`CREATE INDEX idx_float_gl_mapping_gl ON float_gl_mapping(gl_account_id)`
    await sql`CREATE INDEX idx_gl_sync_logs_module ON gl_sync_logs(module)`
    await sql`CREATE INDEX idx_gl_sync_logs_created ON gl_sync_logs(created_at)`

    console.log(`GL system initialized successfully: ${created} accounts created`)

    // Verify the accounts were created
    const totalAccounts = await sql`SELECT COUNT(*) as count FROM gl_accounts WHERE is_active = true`
    const accountsByType = await sql`
      SELECT type, COUNT(*) as count 
      FROM gl_accounts 
      WHERE is_active = true 
      GROUP BY type 
      ORDER BY type
    `

    // Get a sample of created accounts for verification
    const sampleAccounts = await sql`
      SELECT code, name, type, parent_id IS NOT NULL as has_parent
      FROM gl_accounts 
      WHERE is_active = true 
      ORDER BY code 
      LIMIT 10
    `

    console.log("Sample accounts created:", sampleAccounts)

    return NextResponse.json({
      success: true,
      message: "GL accounts system initialized successfully",
      summary: {
        accountsCreated: created,
        accountsUpdated: 0,
        totalAccounts: Number.parseInt(totalAccounts[0].count),
        accountsByType: accountsByType.reduce((acc, row) => {
          acc[row.type] = Number.parseInt(row.count)
          return acc
        }, {}),
        sampleAccounts: sampleAccounts,
      },
    })
  } catch (error) {
    console.error("Error initializing GL accounts:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initialize GL accounts",
        details: error.stack,
      },
      { status: 500 },
    )
  }
}

// Add a GET method to check current state
export async function GET() {
  try {
    const accounts = await sql`
      SELECT COUNT(*) as count FROM gl_accounts WHERE is_active = true
    `

    const accountsByType = await sql`
      SELECT type, COUNT(*) as count 
      FROM gl_accounts 
      WHERE is_active = true 
      GROUP BY type 
      ORDER BY type
    `

    return NextResponse.json({
      success: true,
      totalAccounts: Number.parseInt(accounts[0].count),
      accountsByType: accountsByType.reduce((acc, row) => {
        acc[row.type] = Number.parseInt(row.count)
        return acc
      }, {}),
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    })
  }
}
