import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

/**
 * Initialize the entire database with all required tables
 */
export async function initializeDatabase(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.log("Starting database initialization...");

    // Initialize core tables
    await initializeBranchTables();
    await initializeUserTables();
    await initializeFloatTables();
    await initializeGLTables();
    await initializeTransactionTables();
    await initializeCommissionTables();
    await initializeExpenseTables();
    await initializeAuditTables();
    await initializeSettingsTables();

    console.log("Database initialization completed successfully");
    return {
      success: true,
      message: "Database initialized successfully",
    };
  } catch (error) {
    console.error("Error initializing database:", error);
    return {
      success: false,
      message: `Database initialization failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

async function initializeBranchTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      manager VARCHAR(255),
      contact_number VARCHAR(50),
      email VARCHAR(255),
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function initializeUserTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      primary_branch_id UUID REFERENCES branches(id),
      phone VARCHAR(50),
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
      avatar TEXT,
      last_login TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function initializeFloatTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS float_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id UUID NOT NULL REFERENCES branches(id),
      account_type VARCHAR(100) NOT NULL,
      provider VARCHAR(255),
      account_number VARCHAR(255),
      current_balance DECIMAL(15,2) DEFAULT 0.00,
      min_threshold DECIMAL(15,2) DEFAULT 0.00,
      max_threshold DECIMAL(15,2) DEFAULT 0.00,
      is_active BOOLEAN DEFAULT true,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS float_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES float_accounts(id),
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      reference VARCHAR(255),
      description TEXT,
      status VARCHAR(20) DEFAULT 'completed',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function initializeGLTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS gl_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      parent_id UUID REFERENCES gl_accounts(id),
      balance DECIMAL(15,2) DEFAULT 0.00,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gl_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_module VARCHAR(50) NOT NULL,
      source_transaction_id VARCHAR(255) NOT NULL,
      source_transaction_type VARCHAR(100),
      reference VARCHAR(255),
      description TEXT,
      amount DECIMAL(15,2) NOT NULL,
      transaction_date DATE NOT NULL,
      date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'posted',
      created_by VARCHAR(255) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS gl_journal_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_id UUID NOT NULL REFERENCES gl_transactions(id),
      account_id UUID NOT NULL REFERENCES gl_accounts(id),
      account_code VARCHAR(20) NOT NULL,
      debit DECIMAL(15,2) DEFAULT 0.00,
      credit DECIMAL(15,2) DEFAULT 0.00,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function initializeTransactionTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS momo_transactions (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      fee DECIMAL(15,2) DEFAULT 0.00,
      phone_number VARCHAR(50) NOT NULL,
      reference VARCHAR(255),
      status VARCHAR(20) DEFAULT 'completed',
      date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      branch_id UUID REFERENCES branches(id),
      user_id UUID REFERENCES users(id),
      provider VARCHAR(255),
      customer_name VARCHAR(255),
      float_account_id VARCHAR(255),
      float_account_name VARCHAR(255),
      branch_name VARCHAR(255),
      processed_by VARCHAR(255),
      cash_till_affected DECIMAL(15,2) DEFAULT 0.00,
      float_affected DECIMAL(15,2) DEFAULT 0.00
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS e_zwich_withdrawals (
      id VARCHAR(255) PRIMARY KEY,
      card_number VARCHAR(50),
      amount DECIMAL(15,2) NOT NULL,
      fee_charged DECIMAL(15,2) DEFAULT 0.00,
      customer_name VARCHAR(255),
      reference VARCHAR(255),
      status VARCHAR(20) DEFAULT 'completed',
      date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      branch_id UUID REFERENCES branches(id),
      user_id UUID REFERENCES users(id),
      processed_by VARCHAR(255)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agency_banking_transactions (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      fee DECIMAL(15,2) DEFAULT 0.00,
      account_number VARCHAR(100),
      customer_name VARCHAR(255),
      reference VARCHAR(255),
      status VARCHAR(20) DEFAULT 'completed',
      date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      branch_id UUID REFERENCES branches(id),
      user_id UUID REFERENCES users(id),
      bank_name VARCHAR(255),
      processed_by VARCHAR(255)
    )
  `;
}

async function initializeCommissionTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS commissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source VARCHAR(50) NOT NULL,
      source_name VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
      month DATE NOT NULL,
      reference VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid')),
      gl_account VARCHAR(20),
      gl_account_name VARCHAR(255),
      branch_id UUID REFERENCES branches(id),
      branch_name VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_by UUID NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      updated_by UUID,
      updated_by_name VARCHAR(255)
    )
  `;
}

async function initializeExpenseTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS expense_heads (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      gl_account_code VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'pending',
      branch_id UUID REFERENCES branches(id),
      user_id UUID REFERENCES users(id),
      expense_head_id VARCHAR(255) REFERENCES expense_heads(id),
      approved_by VARCHAR(255),
      approved_at TIMESTAMP WITH TIME ZONE,
      paid_by VARCHAR(255),
      paid_at TIMESTAMP WITH TIME ZONE,
      rejected_by VARCHAR(255),
      rejected_at TIMESTAMP WITH TIME ZONE,
      rejection_reason TEXT,
      receipt_url TEXT
    )
  `;
}

async function initializeAuditTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id VARCHAR(255),
      old_values JSONB,
      new_values JSONB,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function initializeSettingsTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(255) UNIQUE NOT NULL,
      value JSONB,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
}
