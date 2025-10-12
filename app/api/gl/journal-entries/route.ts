import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

// Mock journal entries data
const mockJournalEntries = {
  journalEntries: [
    {
      id: "je-001",
      date: new Date().toISOString(),
      reference: "MOMO-DEP-001",
      description: "Mobile Money Deposit",
      totalDebit: 500,
      totalCredit: 500,
      status: "posted",
      entries: [
        {
          accountCode: "1001",
          accountName: "Cash in Till",
          debit: 500,
          credit: 0,
        },
        {
          accountCode: "2001",
          accountName: "Mobile Money Liability",
          debit: 0,
          credit: 500,
        },
      ],
    },
    {
      id: "je-002",
      date: new Date(Date.now() - 86400000).toISOString(),
      reference: "AGENCY-WD-001",
      description: "Agency Banking Withdrawal",
      totalDebit: 300,
      totalCredit: 300,
      status: "posted",
      entries: [
        {
          accountCode: "2002",
          accountName: "Agency Banking Liability",
          debit: 300,
          credit: 0,
        },
        {
          accountCode: "1001",
          accountName: "Cash in Till",
          debit: 0,
          credit: 300,
        },
      ],
    },
  ],
}

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      // Return mock data if no database connection
      return NextResponse.json(mockJournalEntries)
    }

    const sql = neon(process.env.DATABASE_URL)

    try {
      // Try to fetch from database
      const journalEntries = await sql`
        SELECT 
          id,
          reference,
          description,
          transaction_date as date,
          total_amount,
          status,
          created_at
        FROM gl_journal_entries
        ORDER BY created_at DESC
        LIMIT 50
      `

      if (journalEntries.length > 0) {
        const formattedEntries = journalEntries.map((entry) => ({
          id: entry.id,
          date: entry.date,
          reference: entry.reference,
          description: entry.description,
          totalDebit: Number(entry.total_amount),
          totalCredit: Number(entry.total_amount),
          status: entry.status,
          entries: [], // Would need to fetch line items separately
        }))

        return NextResponse.json({ journalEntries: formattedEntries })
      }
    } catch (dbError) {
      console.error("Database error, falling back to mock data:", dbError)
    }

    // Return mock data if no database results or on error
    return NextResponse.json(mockJournalEntries)
  } catch (error) {
    console.error("Error getting journal entries:", error)
    return NextResponse.json(mockJournalEntries)
  }
}
