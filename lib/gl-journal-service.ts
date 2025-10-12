/**
 * GL Journal Service
 *
 * This module provides services for creating and managing journal entries
 * based on transactions from various sources in the system.
 */

import { neon } from "@neondatabase/serverless"
import { initJournalEntriesFile, readJsonFile, writeJsonFile, JOURNAL_ENTRIES_FILE_PATH } from "./utils/file-utils"

const sql = neon(process.env.DATABASE_URL!)

// Journal Entry interfaces
export interface JournalEntryLine {
  accountId: string
  debit?: number
  credit?: number
  description: string
}

export interface JournalEntry {
  id: string
  transactionId: string
  transactionSource: string
  transactionType: string
  date: string
  entries: JournalEntryLine[]
  description: string
  status: "pending" | "posted" | "reversed"
  createdBy: string
  createdAt: string
  postedBy?: string
  postedAt?: string
  reversedBy?: string
  reversedAt?: string
  metadata?: Record<string, any>
}

export interface TransactionData {
  id: string
  type: string
  amount: number
  date: string
  source: string
  branchId?: string
  userId: string
  reference?: string
  metadata?: Record<string, any>
}

export type TransactionSource =
  | "momo"
  | "agency-banking"
  | "e-zwich"
  | "power"
  | "jumia"
  | "float"
  | "expenses"
  | "manual"

/**
 * Create a journal entry from a transaction
 */
export async function createJournalEntryFromTransaction(
  transaction: TransactionData,
  userId: string,
): Promise<JournalEntry | null> {
  try {
    // Generate basic journal entry (simplified for now)
    const journalEntry: JournalEntry = {
      id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      transactionId: transaction.id,
      transactionSource: transaction.source as TransactionSource,
      transactionType: transaction.type,
      date: transaction.date,
      entries: [
        {
          accountId: "cash-account",
          debit: transaction.amount,
          description: `${transaction.type} transaction`,
        },
        {
          accountId: "revenue-account",
          credit: transaction.amount,
          description: `${transaction.type} transaction`,
        },
      ],
      description: `Journal entry for ${transaction.type}`,
      status: "pending",
      createdBy: userId,
      createdAt: new Date().toISOString(),
      metadata: transaction.metadata,
    }

    // Try to save to database
    try {
      await sql`
        INSERT INTO gl_journal_entries (
          id, transaction_id, transaction_source, transaction_type, date,
          description, status, created_by, created_at
        ) VALUES (
          ${journalEntry.id}, ${journalEntry.transactionId}, ${journalEntry.transactionSource},
          ${journalEntry.transactionType}, ${journalEntry.date}, ${journalEntry.description},
          ${journalEntry.status}, ${journalEntry.createdBy}, ${journalEntry.createdAt}
        )
      `
    } catch (dbError) {
      console.log("Database not available for GL entries")
    }

    return journalEntry
  } catch (error) {
    console.error("Error creating journal entry from transaction:", error)
    return null
  }
}

/**
 * Get all journal entries
 */
export async function getJournalEntries(filters?: {
  status?: "pending" | "posted" | "reversed"
  transactionSource?: TransactionSource
  transactionType?: string
  startDate?: string
  endDate?: string
  createdBy?: string
}): Promise<JournalEntry[]> {
  try {
    // Try database first
    try {
      const entries = await sql`
        SELECT * FROM gl_journal_entries ORDER BY created_at DESC
      `

      return entries.map((e) => ({
        id: e.id,
        transactionId: e.transaction_id,
        transactionSource: e.transaction_source,
        transactionType: e.transaction_type,
        date: e.date,
        entries: [], // Would need to join with entries table
        description: e.description,
        status: e.status,
        createdBy: e.created_by,
        createdAt: e.created_at,
        postedBy: e.posted_by,
        postedAt: e.posted_at,
        reversedBy: e.reversed_by,
        reversedAt: e.reversed_at,
        metadata: {},
      }))
    } catch (dbError) {
      console.log("Database not available, returning empty array")
    }

    return []
  } catch (error) {
    console.error("Error getting journal entries:", error)
    return []
  }
}

/**
 * Get a journal entry by ID
 * @param id ID of the journal entry to get
 * @returns The journal entry or null if not found
 */
export async function getJournalEntryById(id: string): Promise<JournalEntry | null> {
  try {
    await initJournalEntriesFile()

    const data = await readJsonFile<{ journalEntries: JournalEntry[] }>(JOURNAL_ENTRIES_FILE_PATH)
    const journalEntries = data.journalEntries || []

    const journalEntry = journalEntries.find((entry) => entry.id === id)

    return journalEntry || null
  } catch (error) {
    console.error("Error getting journal entry by ID:", error)
    return null
  }
}

/**
 * Post a journal entry
 * @param id ID of the journal entry to post
 * @param userId ID of the user posting the journal entry
 * @returns The posted journal entry or null if posting failed
 */
export async function postJournalEntry(id: string, userId: string): Promise<JournalEntry | null> {
  try {
    await initJournalEntriesFile()

    const data = await readJsonFile<{ journalEntries: JournalEntry[] }>(JOURNAL_ENTRIES_FILE_PATH)
    const journalEntries = data.journalEntries || []

    const entryIndex = journalEntries.findIndex((entry) => entry.id === id)

    if (entryIndex === -1) {
      console.error("Journal entry not found:", id)
      return null
    }

    const journalEntry = journalEntries[entryIndex]

    if (journalEntry.status !== "pending") {
      console.error("Journal entry is not in pending status:", journalEntry)
      return null
    }

    // Update the journal entry status
    journalEntry.status = "posted"
    journalEntry.postedBy = userId
    journalEntry.postedAt = new Date().toISOString()

    journalEntries[entryIndex] = journalEntry

    await writeJsonFile(JOURNAL_ENTRIES_FILE_PATH, { journalEntries })

    // In a real application, this would also update account balances
    // For now, we'll just return the updated journal entry

    return journalEntry
  } catch (error) {
    console.error("Error posting journal entry:", error)
    return null
  }
}

/**
 * Reverse a journal entry
 * @param id ID of the journal entry to reverse
 * @param userId ID of the user reversing the journal entry
 * @param reason Reason for reversing the journal entry
 * @returns The reversed journal entry or null if reversal failed
 */
export async function reverseJournalEntry(id: string, userId: string, reason: string): Promise<JournalEntry | null> {
  try {
    await initJournalEntriesFile()

    const data = await readJsonFile<{ journalEntries: JournalEntry[] }>(JOURNAL_ENTRIES_FILE_PATH)
    const journalEntries = data.journalEntries || []

    const entryIndex = journalEntries.findIndex((entry) => entry.id === id)

    if (entryIndex === -1) {
      console.error("Journal entry not found:", id)
      return null
    }

    const journalEntry = journalEntries[entryIndex]

    if (journalEntry.status !== "posted") {
      console.error("Journal entry is not in posted status:", journalEntry)
      return null
    }

    // Create a reversal journal entry
    const reversalEntries: JournalEntryLine[] = journalEntry.entries.map((line) => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
      description: `Reversal: ${line.description}`,
    }))

    const reversalEntry: JournalEntry = {
      id: `je-reversal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      transactionId: `reversal-${journalEntry.transactionId}`,
      transactionSource: "manual",
      transactionType: "reversal",
      date: new Date().toISOString().split("T")[0],
      entries: reversalEntries,
      description: `Reversal of ${journalEntry.id}: ${reason}`,
      status: "pending",
      createdBy: userId,
      createdAt: new Date().toISOString(),
      metadata: {
        originalJournalEntryId: journalEntry.id,
        reason,
      },
    }

    // Update the original journal entry
    journalEntry.status = "reversed"
    journalEntry.reversedBy = userId
    journalEntry.reversedAt = new Date().toISOString()
    journalEntry.metadata = {
      ...journalEntry.metadata,
      reversalReason: reason,
      reversalJournalEntryId: reversalEntry.id,
    }

    journalEntries[entryIndex] = journalEntry

    // Add the reversal entry
    journalEntries.push(reversalEntry)

    await writeJsonFile(JOURNAL_ENTRIES_FILE_PATH, { journalEntries })

    // In a real application, this would also update account balances
    // For now, we'll just return the reversal entry

    return reversalEntry
  } catch (error) {
    console.error("Error reversing journal entry:", error)
    return null
  }
}

/**
 * Get journal entries for a specific transaction
 * @param transactionId ID of the transaction
 * @returns Array of journal entries for the transaction
 */
export async function getJournalEntriesByTransactionId(transactionId: string): Promise<JournalEntry[]> {
  try {
    await initJournalEntriesFile()

    const data = await readJsonFile<{ journalEntries: JournalEntry[] }>(JOURNAL_ENTRIES_FILE_PATH)
    const journalEntries = data.journalEntries || []

    return journalEntries.filter((entry) => entry.transactionId === transactionId)
  } catch (error) {
    console.error("Error getting journal entries by transaction ID:", error)
    return []
  }
}

/**
 * Get journal entries for a specific account
 * @param accountId ID of the account
 * @returns Array of journal entries that affect the account
 */
export async function getJournalEntriesByAccountId(accountId: string): Promise<JournalEntry[]> {
  try {
    await initJournalEntriesFile()

    const data = await readJsonFile<{ journalEntries: JournalEntry[] }>(JOURNAL_ENTRIES_FILE_PATH)
    const journalEntries = data.journalEntries || []

    return journalEntries.filter((entry) => entry.entries.some((line) => line.accountId === accountId))
  } catch (error) {
    console.error("Error getting journal entries by account ID:", error)
    return []
  }
}
