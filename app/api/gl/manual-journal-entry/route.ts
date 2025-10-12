import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branch_id");

    // Fetch all GL accounts with calculated balances from journal entries
    let accounts;
    if (branchId) {
      accounts = await sql`
        SELECT 
          a.id, 
          a.code, 
          a.name, 
          a.type,
          a.branch_id,
          COALESCE(
            CASE 
              WHEN a.type IN ('Asset', 'Expense') 
                THEN SUM(COALESCE(je.debit, 0)) - SUM(COALESCE(je.credit, 0))
              WHEN a.type IN ('Liability', 'Equity', 'Revenue') 
                THEN SUM(COALESCE(je.credit, 0)) - SUM(COALESCE(je.debit, 0))
              ELSE 0
            END, 
            0
          ) as current_balance
        FROM gl_accounts a
        LEFT JOIN gl_journal_entries je ON a.id = je.account_id
        LEFT JOIN gl_transactions gt ON je.transaction_id = gt.id AND gt.status = 'posted'
        WHERE a.is_active = true AND a.branch_id = ${branchId}
        GROUP BY a.id, a.code, a.name, a.type, a.branch_id
        ORDER BY a.code
      `;
    } else {
      accounts = await sql`
        SELECT 
          a.id, 
          a.code, 
          a.name, 
          a.type,
          a.branch_id,
          COALESCE(
            CASE 
              WHEN a.type IN ('Asset', 'Expense') 
                THEN SUM(COALESCE(je.debit, 0)) - SUM(COALESCE(je.credit, 0))
              WHEN a.type IN ('Liability', 'Equity', 'Revenue') 
                THEN SUM(COALESCE(je.credit, 0)) - SUM(COALESCE(je.debit, 0))
              ELSE 0
            END, 
            0
          ) as current_balance
        FROM gl_accounts a
        LEFT JOIN gl_journal_entries je ON a.id = je.account_id
        LEFT JOIN gl_transactions gt ON je.transaction_id = gt.id AND gt.status = 'posted'
        WHERE a.is_active = true
        GROUP BY a.id, a.code, a.name, a.type, a.branch_id
        ORDER BY a.code
      `;
    }

    return NextResponse.json({ accounts: accounts || [] });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      {
        accounts: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch accounts",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, description, reference, source, entries, branch_id } = body;

    // Validate required fields
    if (!date || !description || !entries || entries.length < 2 || !branch_id) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: date, description, branch_id, and at least 2 entries",
        },
        { status: 400 }
      );
    }

    // Validate that debits equal credits
    const totalDebits = entries.reduce(
      (sum: number, entry: any) =>
        sum + (entry.type === "debit" ? entry.amount : 0),
      0
    );
    const totalCredits = entries.reduce(
      (sum: number, entry: any) =>
        sum + (entry.type === "credit" ? entry.amount : 0),
      0
    );

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: "Total debits must equal total credits" },
        { status: 400 }
      );
    }

    // Ensure gl_transactions table has branch_id column
    await sql`
      CREATE TABLE IF NOT EXISTS gl_transactions (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        reference_number VARCHAR(100) UNIQUE,
        source_module VARCHAR(50) DEFAULT 'manual',
        source_transaction_type VARCHAR(50),
        source_transaction_id VARCHAR(100),
        status VARCHAR(20) DEFAULT 'posted',
        branch_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100),
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS gl_transaction_entries (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER REFERENCES gl_transactions(id),
        account_id VARCHAR(50) NOT NULL,
        description TEXT,
        debit DECIMAL(15,2) DEFAULT 0,
        credit DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Generate reference number if not provided
    const refNumber = reference || `MJE-${Date.now()}`;

    // Insert the main transaction
    const transactionResult = await sql`
      INSERT INTO gl_transactions (
        date, description, reference_number, source_module, 
        source_transaction_type, status, branch_id
      )
      VALUES (
        ${date}, ${description}, ${refNumber}, ${source || "manual"}, 
        'manual_entry', 'posted', ${branch_id}
      )
      RETURNING id, reference_number
    `;

    const transactionId = transactionResult[0].id;

    // Insert transaction entries
    for (const entry of entries) {
      const debit = entry.type === "debit" ? entry.amount : 0;
      const credit = entry.type === "credit" ? entry.amount : 0;

      await sql`
        INSERT INTO gl_transaction_entries (
          transaction_id, account_id, description, debit, credit
        )
        VALUES (
          ${transactionId}, ${entry.accountId}, ${
        entry.description || description
      }, 
          ${debit}, ${credit}
        )
      `;
    }

    return NextResponse.json({
      success: true,
      message: "Journal entry saved successfully",
      journalEntry: {
        id: transactionId,
        reference_number: transactionResult[0].reference_number,
      },
    });
  } catch (error) {
    console.error("Error saving journal entry:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save journal entry",
      },
      { status: 500 }
    );
  }
}
