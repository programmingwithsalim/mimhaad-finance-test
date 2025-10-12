import { type NextRequest, NextResponse } from "next/server"
import { postJournalEntry } from "@/lib/gl-journal-service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id: id } = await params
    const body = await request.json()
    const { userId } = body

    // Validate required fields
    if (!userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Post the journal entry
    const journalEntry = await postJournalEntry(id, userId)

    if (!journalEntry) {
      return NextResponse.json({ error: "Failed to post journal entry" }, { status: 500 })
    }

    return NextResponse.json({ journalEntry })
  } catch (error) {
    console.error(`Error in POST /api/gl/journal-entries/${(await params).id}/post:`, error)
    return NextResponse.json({ error: "Failed to post journal entry" }, { status: 500 })
  }
}
