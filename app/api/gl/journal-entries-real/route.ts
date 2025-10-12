import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Get journal entries from all transaction tables with correct column names
    const journalEntries = await sql`
      WITH all_transactions AS (
        -- MoMo Transactions
        SELECT 
          id::text as source_id,
          'momo' as source_module,
          type as transaction_type,
          amount,
          fee,
          customer_name,
          provider,
          branch_id::text,
          user_id,
          date as transaction_date,
          status,
          'MoMo ' || type || ' - ' || customer_name || ' (' || provider || ')' as description
        FROM momo_transactions
        WHERE status = 'completed'
        
        UNION ALL
        
        -- Agency Banking Transactions  
        SELECT 
          id::text as source_id,
          'agency_banking' as source_module,
          type as transaction_type,
          amount,
          fee,
          customer_name,
          partner_bank as provider,
          branch_id,
          user_id,
          date as transaction_date,
          status,
          'Agency Banking ' || type || ' - ' || customer_name || ' (' || partner_bank || ')' as description
        FROM agency_banking_transactions
        WHERE status = 'completed'
        
        UNION ALL
        
        -- E-Zwich Transactions
        SELECT 
          id::text as source_id,
          'ezwich' as source_module,
          transaction_type::text,
          transaction_amount as amount,
          fee_amount as fee,
          customer_name,
          'E-Zwich' as provider,
          branch_id::text,
          processed_by as user_id,
          transaction_date::date as transaction_date,
          status::text,
          'E-Zwich ' || transaction_type || ' - ' || customer_name as description
        FROM ezwich_transactions
        WHERE status = 'completed'
        
        UNION ALL
        
        -- Power Transactions
        SELECT 
          id::text as source_id,
          'power' as source_module,
          type as transaction_type,
          amount,
          commission as fee,
          COALESCE(customer_name, 'Power Sale') as customer_name,
          provider,
          branch_id::text,
          user_id::text,
          created_at::date as transaction_date,
          status,
          'Power ' || type || ' - ' || provider || ' (Meter: ' || meter_number || ')' as description
        FROM power_transactions
        WHERE status = 'completed'
        
        UNION ALL
        
        -- Jumia Transactions
        SELECT 
          id::text as source_id,
          'jumia' as source_module,
          transaction_type,
          amount,
          0 as fee,
          COALESCE(customer_name, 'Jumia Transaction') as customer_name,
          'Jumia' as provider,
          branch_id,
          user_id,
          created_at::date as transaction_date,
          status,
          'Jumia ' || transaction_type || CASE 
            WHEN customer_name IS NOT NULL THEN ' - ' || customer_name 
            ELSE '' 
          END as description
        FROM jumia_transactions
        WHERE status IN ('completed', 'settled')
        
        UNION ALL
        
        -- Commissions
        SELECT 
          id::text as source_id,
          'commissions' as source_module,
          'commission' as transaction_type,
          amount,
          0 as fee,
          source_name as customer_name,
          source as provider,
          'system' as branch_id,
          created_by_id as user_id,
          created_at::date as transaction_date,
          status,
          'Commission - ' || source_name || ' (' || TO_CHAR(month, 'Mon YYYY') || ')' as description
        FROM commissions
        WHERE status IN ('approved', 'paid')
        
        UNION ALL
        
        -- Expenses
        SELECT 
          id::text as source_id,
          'expenses' as source_module,
          'expense' as transaction_type,
          amount,
          0 as fee,
          'Expense' as customer_name,
          'Internal' as provider,
          branch_id::text,
          created_by::text as user_id,
          expense_date as transaction_date,
          status,
          'Expense - ' || description as description
        FROM expenses
        WHERE status IN ('approved', 'paid')
      )
      SELECT 
        at.*,
        b.name as branch_name,
        CASE 
          WHEN at.source_module = 'momo' THEN 'Mobile Money'
          WHEN at.source_module = 'agency_banking' THEN 'Agency Banking'
          WHEN at.source_module = 'ezwich' THEN 'E-Zwich'
          WHEN at.source_module = 'power' THEN 'Power'
          WHEN at.source_module = 'jumia' THEN 'Jumia'
          WHEN at.source_module = 'commissions' THEN 'Commissions'
          WHEN at.source_module = 'expenses' THEN 'Expenses'
          ELSE at.source_module
        END as module_name,
        -- Generate GL entries based on transaction type
        CASE 
          WHEN at.source_module = 'momo' AND at.transaction_type = 'cash-in' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '4001', 'account_name', 'MoMo Revenue', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'momo' AND at.transaction_type = 'cash-out' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '4001', 'account_name', 'MoMo Revenue', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'agency_banking' AND at.transaction_type = 'deposit' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '4002', 'account_name', 'Agency Banking Revenue', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'agency_banking' AND at.transaction_type = 'withdrawal' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '4002', 'account_name', 'Agency Banking Revenue', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'ezwich' AND at.transaction_type = 'withdrawal' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '4003', 'account_name', 'E-Zwich Revenue', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'power' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '4004', 'account_name', 'Power Revenue', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'commissions' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '4005', 'account_name', 'Commission Revenue', 'debit', 0, 'credit', at.amount)
            )
          WHEN at.source_module = 'expenses' THEN 
            jsonb_build_array(
              jsonb_build_object('account', '5001', 'account_name', 'Expenses', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', 0, 'credit', at.amount)
            )
          ELSE 
            jsonb_build_array(
              jsonb_build_object('account', '1001', 'account_name', 'Cash in Till', 'debit', at.amount, 'credit', 0),
              jsonb_build_object('account', '9999', 'account_name', 'Other Revenue', 'debit', 0, 'credit', at.amount)
            )
        END as gl_entries
      FROM all_transactions at
      LEFT JOIN branches b ON at.branch_id = b.id
      ORDER BY at.transaction_date DESC, at.source_id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count for pagination
    const totalCount = await sql`
      WITH all_transactions AS (
        SELECT id FROM momo_transactions WHERE status = 'completed'
        UNION ALL
        SELECT id FROM agency_banking_transactions WHERE status = 'completed'
        UNION ALL
        SELECT id FROM ezwich_transactions WHERE status = 'completed'
        UNION ALL
        SELECT id FROM power_transactions WHERE status = 'completed'
        UNION ALL
        SELECT id FROM jumia_transactions WHERE status IN ('completed', 'settled')
        UNION ALL
        SELECT id FROM commissions WHERE status IN ('approved', 'paid')
        UNION ALL
        SELECT id FROM expenses WHERE status IN ('approved', 'paid')
      )
      SELECT COUNT(*) as total
      FROM all_transactions
    `;

    const total = totalCount[0]?.total || 0;

    return NextResponse.json({
      data: journalEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}
