import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    // Check if GL tables exist
    const glTableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gl_transactions'
      );
    `

    if (!glTableCheck[0].exists) {
      return NextResponse.json({
        totalTransactions: 0,
        postedTransactions: 0,
        pendingTransactions: 0,
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: true,
        recentActivity: [],
        message: "GL tables not found",
      })
    }

    // Get transaction counts by status
    const statusCounts = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM gl_transactions
      GROUP BY status
    `

    // Get total debits and credits
    const totals = await sql`
      SELECT 
        SUM(debit) as total_debits,
        SUM(credit) as total_credits
      FROM gl_journal_entries
    `

    // Get recent activity by module
    const recentActivity = await sql`
      SELECT 
        source_module,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN gte.debit > 0 THEN gte.debit ELSE 0 END) as total_debits,
        SUM(CASE WHEN gte.credit > 0 THEN gte.credit ELSE 0 END) as total_credits,
        MAX(gt.created_at) as last_activity
      FROM gl_transactions gt
      JOIN gl_journal_entries gte ON gt.id = gte.transaction_id
      WHERE gt.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY source_module
      ORDER BY transaction_count DESC
      LIMIT 5
    `

    // Calculate summary
    const totalTransactions = statusCounts.reduce((sum, row) => sum + Number(row.count), 0)
    const postedTransactions = statusCounts.find((row) => row.status === "posted")?.count || 0
    const pendingTransactions = statusCounts.find((row) => row.status === "pending")?.count || 0

    const totalDebits = Number(totals[0]?.total_debits || 0)
    const totalCredits = Number(totals[0]?.total_credits || 0)
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

    return NextResponse.json({
      totalTransactions,
      postedTransactions: Number(postedTransactions),
      pendingTransactions: Number(pendingTransactions),
      totalDebits,
      totalCredits,
      isBalanced,
      recentActivity: recentActivity.map((activity) => ({
        module: activity.source_module,
        transactionCount: Number(activity.transaction_count),
        totalDebits: Number(activity.total_debits),
        totalCredits: Number(activity.total_credits),
        lastActivity: activity.last_activity,
      })),
    })
  } catch (error) {
    console.error("Error fetching GL transaction summary:", error)

    return NextResponse.json({
      totalTransactions: 0,
      postedTransactions: 0,
      pendingTransactions: 0,
      totalDebits: 0,
      totalCredits: 0,
      isBalanced: true,
      recentActivity: [],
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
