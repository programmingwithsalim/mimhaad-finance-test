import { JournalEntriesView } from "@/components/gl-accounting/journal-entries-view"

export default function JournalEntriesPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">GL Journal Entries</h1>
      <JournalEntriesView />
    </div>
  )
}
