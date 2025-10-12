"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function AgencyBankingInitializer() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTables, setCreatedTables] = useState<string[]>([])
  const { toast } = useToast()

  const initializeAgencyBanking = async () => {
    try {
      setIsInitializing(true)
      setError(null)
      setIsSuccess(false)
      setCreatedTables([])

      const response = await fetch("/api/db/init-agency-banking", {
        method: "POST",
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to initialize agency banking schema")
      }

      setIsSuccess(true)
      if (result.tables) {
        setCreatedTables(result.tables)
      }

      toast({
        title: "Success",
        description: "Agency banking schema initialized successfully",
      })
    } catch (err) {
      console.error("Error initializing agency banking schema:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize agency banking schema"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initialize Agency Banking Schema</CardTitle>
        <CardDescription>Set up the database tables required for agency banking transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">This will create the following tables in your database:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>agency_banking_transactions</li>
          <li>partner_banks</li>
          <li>branch_partner_banks</li>
          <li>agency_transaction_receipts</li>
        </ul>

        {isSuccess && (
          <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
            <div className="flex items-center mb-2">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              <span>Agency banking schema initialized successfully!</span>
            </div>
            {createdTables.length > 0 && (
              <div>
                <p className="font-semibold">Created tables:</p>
                <ul className="list-disc pl-5 mt-1">
                  {createdTables.map((table) => (
                    <li key={table}>{table}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <div className="flex items-center">
              <AlertCircle className="mr-2 h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={initializeAgencyBanking} disabled={isInitializing}>
          {isInitializing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </>
          ) : (
            "Initialize Schema"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
