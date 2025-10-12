"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface JournalEntry {
  id: string
  date: string
  sourceModule: string
  sourceTransactionId: string
  sourceTransactionType: string
  description: string
  status: "pending" | "posted" | "reversed"
  entries: {
    accountId: string
    accountCode: string
    debit: number
    credit: number
    description: string
  }[]
}

export function JournalEntriesView() {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchJournalEntries() {
      try {
        setIsLoading(true)
        const response = await fetch("/api/gl/journal-entries")

        if (!response.ok) {
          throw new Error("Failed to fetch journal entries")
        }

        const data = await response.json()
        setJournalEntries(data.journalEntries || [])
      } catch (error) {
        console.error("Error fetching journal entries:", error)
        setError("Failed to load journal entries")
      } finally {
        setIsLoading(false)
      }
    }

    fetchJournalEntries()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
          <CardDescription>Loading journal entries...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Journal Entries</CardTitle>
          <CardDescription>Error loading journal entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">{error}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal Entries</CardTitle>
        <CardDescription>Recent journal entries from transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {journalEntries.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">No journal entries found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {journalEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                  <TableCell>{entry.description}</TableCell>
                  <TableCell>{entry.sourceModule}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.status === "posted" ? "success" : entry.status === "reversed" ? "destructive" : "outline"
                      }
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.entries
                      .filter((e) => e.debit > 0)
                      .reduce((sum, e) => sum + e.debit, 0)
                      .toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.entries
                      .filter((e) => e.credit > 0)
                      .reduce((sum, e) => sum + e.credit, 0)
                      .toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
