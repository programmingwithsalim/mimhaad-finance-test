"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

export function FloatTransactionsInitializer() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const initializeTable = async () => {
    try {
      setLoading(true)
      setResult(null)

      const response = await fetch("/api/db/init-float-transactions", {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize table")
      }

      setResult({ success: true, message: data.message })
      toast({
        title: "Success",
        description: "Float transactions table initialized successfully",
      })
    } catch (error) {
      console.error("Error initializing table:", error)
      const message = error instanceof Error ? error.message : "Failed to initialize table"
      setResult({ success: false, message })
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Float Transactions Table</CardTitle>
        <CardDescription>Initialize the float_transactions table for transaction logging</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={initializeTable} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing Table...
            </>
          ) : (
            "Initialize Float Transactions Table"
          )}
        </Button>

        {result && (
          <div
            className={`text-sm p-3 rounded-md ${
              result.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="inline-block mr-2 h-4 w-4" />
            ) : (
              <XCircle className="inline-block mr-2 h-4 w-4" />
            )}
            {result.message}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
