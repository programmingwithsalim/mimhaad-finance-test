import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const accountId = searchParams.get("accountId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const transactionType = searchParams.get("transactionType");
    const limit = Number.parseInt(searchParams.get("limit") || "50");
    const offset = Number.parseInt(searchParams.get("offset") || "0");

    console.log("API received filters:", {
      accountId,
      dateFrom,
      dateTo,
      transactionType,
      limit,
      offset,
    });

    // Check if GL tables exist
    const glTableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gl_transactions'
      );
    `;

    if (!glTableCheck[0].exists) {
      return NextResponse.json({
        transactions: [
          {
            id: "sample-1",
            date: new Date().toISOString().split("T")[0],
            description:
              "GL System not initialized - Create some manual journal entries to see data here",
            source_module: "system",
            source_transaction_type: "info",
            debit: 0,
            credit: 0,
            balance: 0,
            account_name: "System Message",
            transaction_id: "INIT-001",
            status: "pending",
            reference_number: "INIT-001",
          },
        ],
        total: 1,
        hasMore: false,
        message:
          "GL tables not found. Please create some manual journal entries first.",
      });
    }

    // Build WHERE conditions dynamically
    const whereConditions = [];

    if (accountId && accountId !== "all") {
      whereConditions.push(`gte.account_id = '${accountId}'`);
    }

    if (dateFrom) {
      whereConditions.push(`gt.date >= '${dateFrom}'`);
    }

    if (dateTo) {
      whereConditions.push(`gt.date <= '${dateTo}'`);
    }

    if (transactionType && transactionType !== "all") {
      whereConditions.push(`gt.source_transaction_type = '${transactionType}'`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    console.log("WHERE clause:", whereClause);

    // Get transactions with filters
    const transactions = await sql`
      SELECT 
        gt.id,
        gt.date,
        gt.description,
        gt.source_module,
        gt.source_transaction_type,
        gt.status,
        gt.created_by,
        gt.posted_at,
        gt.source_transaction_id as reference_number,
        gte.debit,
        gte.credit,
        COALESCE(ga.name, 'Unknown Account') as account_name,
        COALESCE(ga.balance, 0) as balance,
        gt.id as transaction_id
      FROM gl_transactions gt
      JOIN gl_journal_entries gte ON gt.id = gte.transaction_id
      LEFT JOIN gl_accounts ga ON gte.account_id = ga.id
      ${whereClause ? sql.unsafe(whereClause) : sql``}
      ORDER BY gt.date DESC, gt.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `.catch(async (error) => {
      console.error("Query error, trying simpler approach:", error);

      // Fallback to simpler query without complex WHERE
      return await sql`
        SELECT 
          gt.id,
          gt.date,
          gt.description,
          gt.source_module,
          gt.source_transaction_type,
          gt.status,
          gt.created_by,
          gt.posted_at,
          gt.source_transaction_id as reference_number,
          gte.debit,
          gte.credit,
          COALESCE(ga.name, 'Unknown Account') as account_name,
          COALESCE(ga.balance, 0) as balance,
          gt.id as transaction_id
        FROM gl_transactions gt
        JOIN gl_journal_entries gte ON gt.id = gte.transaction_id
        LEFT JOIN gl_accounts ga ON gte.account_id = ga.id
        ORDER BY gt.date DESC, gt.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    });

    // Get count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM gl_transactions gt
      JOIN gl_journal_entries gte ON gt.id = gte.transaction_id
      ${whereClause ? sql.unsafe(whereClause) : sql``}
    `.catch(async () => {
      // Fallback count
      return await sql`
        SELECT COUNT(*) as total
        FROM gl_transactions gt
        JOIN gl_journal_entries gte ON gt.id = gte.transaction_id
      `;
    });

    const total = Number.parseInt(countResult[0]?.total || "0");
    const hasMore = offset + limit < total;

    console.log("Query results:", {
      transactionCount: transactions.length,
      total,
      hasMore,
    });

    // If no transactions found, show helpful message
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({
        transactions: [
          {
            id: "empty-1",
            date: new Date().toISOString().split("T")[0],
            description:
              "No GL transactions found with the current filters. Try adjusting your search criteria or process some MoMo transactions.",
            source_module: "system",
            source_transaction_type: "info",
            debit: 0,
            credit: 0,
            balance: 0,
            account_name: "System Message",
            transaction_id: "EMPTY-001",
            status: "pending",
            reference_number: "EMPTY-001",
          },
        ],
        total: 1,
        hasMore: false,
        message: "No transactions found with current filters.",
      });
    }

    return NextResponse.json({
      transactions: Array.isArray(transactions) ? transactions : [],
      total,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching transaction history:", error);

    return NextResponse.json({
      transactions: [
        {
          id: "error-1",
          date: new Date().toISOString().split("T")[0],
          description: `Database error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          source_module: "system",
          source_transaction_type: "error",
          debit: 0,
          credit: 0,
          balance: 0,
          account_name: "System Error",
          transaction_id: "ERROR-001",
          status: "error",
          reference_number: "ERROR-001",
        },
      ],
      total: 1,
      hasMore: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
