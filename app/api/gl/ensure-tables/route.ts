import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST() {
  try {
    // Create gl_accounts table
    await sql`
      CREATE TABLE IF NOT EXISTS gl_accounts (
        id VARCHAR(255) PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        parent_id VARCHAR(255),
        balance DECIMAL(15,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create gl_transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS gl_transactions (
        id VARCHAR(255) PRIMARY KEY,
        date DATE NOT NULL,
        source_module VARCHAR(100) NOT NULL,
        source_transaction_id VARCHAR(255) NOT NULL,
        source_transaction_type VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        posted_by VARCHAR(255),
        posted_at TIMESTAMP WITH TIME ZONE,
        reversed_by VARCHAR(255),
        reversed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB
      )
    `

    // Create gl_journal_entries table
    await sql`
      CREATE TABLE IF NOT EXISTS gl_journal_entries (
        id VARCHAR(255) PRIMARY KEY,
        transaction_id VARCHAR(255) NOT NULL,
        account_id VARCHAR(255) NOT NULL,
        account_code VARCHAR(50) NOT NULL,
        debit DECIMAL(15,2) DEFAULT 0,
        credit DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES gl_transactions(id),
        FOREIGN KEY (account_id) REFERENCES gl_accounts(id)
      )
    `

    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_gl_transactions_source ON gl_transactions(source_module, source_transaction_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_gl_journal_entries_transaction ON gl_journal_entries(transaction_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_gl_journal_entries_account ON gl_journal_entries(account_id)
    `

    return NextResponse.json({ success: true, message: "GL tables created successfully" })
  } catch (error) {
    console.error("Error creating GL tables:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
