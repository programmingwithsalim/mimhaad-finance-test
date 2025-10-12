import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.CONNECTION_STRING!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const account = await sql`
      SELECT * FROM gl_accounts WHERE id = ${(await params).id}
    `;

    if (account.length === 0) {
      return NextResponse.json(
        { error: `Account with ID ${(await params).id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ account: account[0] });
  } catch (error) {
    console.error(`Error in GET /api/gl/accounts/${(await params).id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch GL account" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const body = await request.json();
    const {
      account_code,
      account_name,
      account_type,
      parent_id,
      is_active,
      branch_id,
    } = body;

    // Check if account exists
    const existing = await sql`
      SELECT id FROM gl_accounts WHERE id = ${(await params).id}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: `Account with ID ${(await params).id} not found` },
        { status: 404 }
      );
    }

    // Check if new account code conflicts with existing accounts (excluding current account)
    if (account_code) {
      const codeConflict = await sql`
        SELECT id FROM gl_accounts WHERE code = ${account_code} AND id != ${(await params).id}
      `;

      if (codeConflict.length > 0) {
        return NextResponse.json(
          { error: "Account code already exists" },
          { status: 400 }
        );
      }
    }

    // Update the account - only use columns that exist
    const result = await sql`
      UPDATE gl_accounts 
      SET 
        code = ${account_code},
        name = ${account_name},
        type = ${account_type},
        parent_id = ${parent_id || null},
        is_active = ${is_active},
        branch_id = ${branch_id},
        updated_at = NOW()
      WHERE id = ${(await params).id}
      RETURNING *
    `;

    return NextResponse.json({ success: true, account: result[0] });
  } catch (error) {
    console.error(`Error in PUT /api/gl/accounts/${(await params).id}:`, error);
    return NextResponse.json(
      { error: "Failed to update GL account" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    // Check if account exists
    const existing = await sql`
      SELECT id, name FROM gl_accounts WHERE id = ${(await params).id}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: `Account with ID ${(await params).id} not found` },
        { status: 404 }
      );
    }

    // Check for child accounts (accounts that have this account as parent)
    const childAccounts = await sql`
      SELECT COUNT(*) as count FROM gl_accounts 
      WHERE parent_id = ${(await params).id}
    `;

    if (childAccounts[0].count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete account "${existing[0].name}": ${childAccounts[0].count} child account(s) depend on it. Please delete or reassign child accounts first.`,
        },
        { status: 400 }
      );
    }

    // Check if gl_journal_entries table exists and has the right columns
    const journalTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gl_journal_entries'
      )
    `;

    if (journalTableExists[0].exists) {
      // Check what columns exist in the journal entries table
      const journalColumns = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'gl_journal_entries'
      `;

      const columnNames = journalColumns.map((col) => col.column_name);

      // Check for entries using available column names
      let hasEntries = false;
      if (
        columnNames.includes("debit_account_id") &&
        columnNames.includes("credit_account_id")
      ) {
        const entries = await sql`
          SELECT COUNT(*) as count FROM gl_journal_entries 
          WHERE debit_account_id = ${(await params).id} OR credit_account_id = ${(await params).id}
        `;
        hasEntries = entries[0].count > 0;
      } else if (columnNames.includes("account_id")) {
        const entries = await sql`
          SELECT COUNT(*) as count FROM gl_journal_entries 
          WHERE account_id = ${(await params).id}
        `;
        hasEntries = entries[0].count > 0;
      }

      if (hasEntries) {
        return NextResponse.json(
          {
            error:
              "Cannot delete account with existing journal entries. Deactivate instead.",
          },
          { status: 400 }
        );
      }
    }

    // Delete the account
    await sql`
      DELETE FROM gl_accounts WHERE id = ${(await params).id}
    `;

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error(`Error in DELETE /api/gl/accounts/${(await params).id}:`, error);

    // Handle foreign key constraint errors
    if (error.message.includes("foreign key constraint")) {
      return NextResponse.json(
        {
          error:
            "Cannot delete account: it is referenced by other records. Please remove all references first or deactivate the account instead.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete GL account" },
      { status: 500 }
    );
  }
}
