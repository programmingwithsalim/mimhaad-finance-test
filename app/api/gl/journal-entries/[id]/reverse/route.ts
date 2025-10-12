import { type NextRequest, NextResponse } from "next/server"
import { reverseJournalEntry } from "@/lib/gl-journal-service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: id } = await params
    const body = await request.json()
    const { userId, reason } = body

    // Validate required fields
    if (!userId || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Reverse the journal entry
    const journalEntry = await reverseJournalEntry(id, userId, reason)

    if (!journalEntry) {
      return NextResponse.json({ error: "Failed to reverse journal entry" }, { status: 500 })
    }

    return NextResponse.json({ journalEntry })
  } catch (error) {
    console.error(`Error in POST /api/gl/journal-entries/${(await params).id}/reverse:`, error)
    return NextResponse.json({ error: "Failed to reverse journal entry" }, { status: 500 })
  }
}
