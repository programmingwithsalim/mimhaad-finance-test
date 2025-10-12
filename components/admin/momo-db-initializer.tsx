"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Database, AlertCircle, Loader2, Info, ExternalLink } from "lucide-react"
import Link from "next/link"

interface InitializationResult {
  success: boolean
  message?: string
  error?: string
  details?: {
    tablesCreated?: string[]
    indexesCreated?: number
    triggersCreated?: number
    sampleAccountsCreated?: number
    sampleTransactionsCreated?: number
    branchesTableExists?: boolean
    floatAccountsTableExists?: boolean
  }
}

export function MoMoDbInitializer() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [result, setResult] = useState<InitializationResult | null>(null)

  const initializeDatabase = async () => {
    setIsInitializing(true)
    setResult(null)

    try {
      const response = await fetch("/api/db/init-momo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
      })
    } finally {
      setIsInitializing(false)
    }
  }

  const resetResult = () => {
    setResult(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            MoMo Database Initialization
          </CardTitle>
          <CardDescription>
            Set up the MoMo transaction database schema and create sample data for branch ID:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">635844ab-029a-43f8-8523-d7882915266a</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Prerequisites</AlertTitle>
              <AlertDescription>
                This initialization requires the <code>branches</code> and <code>float_accounts</code> tables to exist.
                If they don't exist, only the MoMo transactions table will be created.
              </AlertDescription>
            </Alert>

            <div className="rounded-md bg-muted p-4">
              <h3 className="mb-3 font-medium">Initialization Steps:</h3>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  Create <code>momo_transactions</code> table with proper schema
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Set up database indexes for optimal performance
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500" />
                  Create triggers for automatic timestamp updates
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  Create sample MoMo float accounts (MTN, Vodafone, AirtelTigo)
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  Add sample transactions for testing
                </div>
              </div>
            </div>

            {result && (
              <Alert variant={result.success ? "default" : "destructive"}>
                <div className="flex items-center gap-2">
                  {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{result.success ? "Initialization Complete" : "Initialization Failed"}</AlertTitle>
                </div>
                <AlertDescription className="mt-2 space-y-3">
                  <p>
                    {result.message ||
                      result.error ||
                      (result.success ? "Database initialized successfully" : "Failed to initialize database")}
                  </p>

                  {result.success && result.details && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {result.details.tablesCreated && result.details.tablesCreated.length > 0 && (
                          <Badge variant="secondary">{result.details.tablesCreated.length} table(s) created</Badge>
                        )}
                        {result.details.indexesCreated && result.details.indexesCreated > 0 && (
                          <Badge variant="secondary">{result.details.indexesCreated} indexes created</Badge>
                        )}
                        {result.details.triggersCreated && result.details.triggersCreated > 0 && (
                          <Badge variant="secondary">{result.details.triggersCreated} triggers created</Badge>
                        )}
                        {result.details.sampleAccountsCreated && result.details.sampleAccountsCreated > 0 && (
                          <Badge variant="outline">{result.details.sampleAccountsCreated} sample accounts</Badge>
                        )}
                        {result.details.sampleTransactionsCreated && result.details.sampleTransactionsCreated > 0 && (
                          <Badge variant="outline">
                            {result.details.sampleTransactionsCreated} sample transactions
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        <p>Dependencies:</p>
                        <ul className="ml-4 list-disc">
                          <li>
                            Branches table:{" "}
                            <span className={result.details.branchesTableExists ? "text-green-600" : "text-red-600"}>
                              {result.details.branchesTableExists ? "✓ Available" : "✗ Not found"}
                            </span>
                          </li>
                          <li>
                            Float accounts table:{" "}
                            <span
                              className={result.details.floatAccountsTableExists ? "text-green-600" : "text-red-600"}
                            >
                              {result.details.floatAccountsTableExists ? "✓ Available" : "✗ Not found"}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {result.error && (
                    <div className="mt-2 text-xs">
                      <details className="cursor-pointer">
                        <summary className="font-medium">Error Details</summary>
                        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{result.error}</pre>
                      </details>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={initializeDatabase} disabled={isInitializing}>
            {isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initializing Database...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Initialize MoMo Database
              </>
            )}
          </Button>

          {result && (
            <Button variant="outline" onClick={resetResult}>
              Reset
            </Button>
          )}

          {result?.success && (
            <Button variant="outline" asChild>
              <Link href="/dashboard/transactions/momo">
                <ExternalLink className="mr-2 h-4 w-4" />
                Go to MoMo Page
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {result?.success && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p>Your MoMo database has been successfully initialized! Here's what you can do next:</p>
              <ul className="ml-6 list-disc space-y-1">
                <li>
                  <Link href="/dashboard/transactions/momo" className="text-blue-600 hover:underline">
                    Visit the MoMo transactions page
                  </Link>{" "}
                  to see the system in action
                </li>
                <li>Test creating new cash-in and cash-out transactions</li>
                <li>View transaction history and statistics</li>
                <li>Export transaction data for reporting</li>
                <li>Monitor float account balances and thresholds</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
