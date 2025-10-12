"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { format } from "date-fns"

interface GLEntry {
  id: string
  transactionId: string
  date: string
  description: string
  status: "pending" | "posted" | "reversed"
  entries: {
    accountId: string
    accountName: string
    debit?: number
    credit?: number
  }[]
}

interface GLEntriesViewProps {
  transactionId: string
}

export function GLEntriesView({ transactionId }: GLEntriesViewProps) {
  const [glEntries, setGlEntries] = useState<GLEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGLEntries = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/gl/journal-entries?transactionId=${transactionId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch GL entries")
      }

      const data = await response.json()
      setGlEntries(data.journalEntries || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      console.error("Error fetching GL entries:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (transactionId) {
      fetchGLEntries()
    }
  }, [transactionId])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            Pending
          </Badge>
        )
      case "posted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Posted
          </Badge>
        )
      case "reversed":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            Reversed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>GL Journal Entries</CardTitle>
          <CardDescription>General Ledger entries generated for this transaction</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGLEntries} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : glEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No GL entries found for this transaction.</div>
        ) : (
          <div className="space-y-6">
            {glEntries.map((entry) => (
              <div key={entry.id} className="rounded-md border">
                <div className="bg-muted/50 p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{entry.description}</h4>
                    <p className="text-sm text-muted-foreground">
                      {entry.id} • {format(new Date(entry.date), "MMM d, yyyy")}
                    </p>
                  </div>
                  {getStatusBadge(entry.status)}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.entries.map((line, index) => (
                      <TableRow key={`${entry.id}-line-${index}`}>
                        <TableCell className="font-medium">{line.accountName || line.accountId}</TableCell>
                        <TableCell className="text-right">{line.debit ? line.debit.toFixed(2) : ""}</TableCell>
                        <TableCell className="text-right">{line.credit ? line.credit.toFixed(2) : ""}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {entry.entries.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {entry.entries.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
