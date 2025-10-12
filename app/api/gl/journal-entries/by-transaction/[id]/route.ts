import { NextResponse } from "next/server";
import { getJournalEntriesByTransactionId } from "@/lib/gl-journal-service";
// Note: Account details now included in journal entries response

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params;

    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get journal entries for the transaction
    const journalEntries = await getJournalEntriesByTransactionId(
      transactionId
    );

    // Account names are now included in the response by default
    const enhancedEntries = journalEntries;

    return NextResponse.json({
      success: true,
      journalEntries: enhancedEntries,
    });
  } catch (error) {
    console.error("Error getting journal entries by transaction ID:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get journal entries",
      },
      { status: 500 }
    );
  }
}
