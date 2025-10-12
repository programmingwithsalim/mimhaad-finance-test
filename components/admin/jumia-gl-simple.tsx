"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle, Database, TestTube, Wrench } from "lucide-react"

interface DiagnosticsData {
  glTransactionsStructure: {
    success: boolean
    columns?: any[]
    error?: string
  }
  entriesTableExists: boolean
  jumiaTransactions: any[]
}

export function JumiaGLSimple() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const loadDiagnostics = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/debug/jumia-gl-simple")
      const data = await response.json()

      if (data.success !== false) {
        setDiagnostics(data)
      } else {
        setMessage({ type: "error", text: data.error || "Failed to load diagnostics" })
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to load diagnostics" })
    } finally {
      setLoading(false)
    }
  }

  const performAction = async (action: string, actionName: string) => {
    setActionLoading(action)
    setMessage(null)

    try {
      const response = await fetch("/api/debug/jumia-gl-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: "success", text: `${actionName} completed successfully!` })
        // Reload diagnostics after successful action
        await loadDiagnostics()
      } else {
        setMessage({ type: "error", text: result.error || `${actionName} failed` })
      }
    } catch (error) {
      setMessage({ type: "error", text: `Failed to ${actionName.toLowerCase()}` })
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    loadDiagnostics()
  }, [])

  const hasIdDefault = diagnostics?.glTransactionsStructure?.columns
    ?.find((col) => col.column_name === "id")
    ?.column_default?.includes("gen_random_uuid")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jumia GL Diagnostics & Fix</h1>
          <p className="text-muted-foreground">Diagnose and fix Jumia GL posting issues</p>
        </div>
        <Button onClick={loadDiagnostics} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
      </div>

      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6">
          {/* GL Transactions Table Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                GL Transactions Table Structure
              </CardTitle>
              <CardDescription>Check if the table has proper UUID generation</CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics?.glTransactionsStructure?.success ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {hasIdDefault ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span>ID Column UUID Generation: {hasIdDefault ? "Configured" : "Missing"}</span>
                  </div>

                  {!hasIdDefault && (
                    <Button
                      onClick={() => performAction("fix-gl-table", "Fix GL Table")}
                      disabled={actionLoading === "fix-gl-table"}
                      variant="outline"
                    >
                      {actionLoading === "fix-gl-table" ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Wrench className="h-4 w-4 mr-2" />
                      )}
                      Fix GL Transactions Table
                    </Button>
                  )}

                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Table Columns:</h4>
                    <div className="grid gap-2">
                      {diagnostics.glTransactionsStructure.columns?.map((col, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">{col.column_name}</Badge>
                          <span>{col.data_type}</span>
                          {col.column_default && <Badge variant="secondary">Default: {col.column_default}</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500">
                  <XCircle className="h-5 w-5" />
                  <span>Failed to check table structure</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* GL Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                GL Transaction Entries Table
              </CardTitle>
              <CardDescription>Required for storing transaction details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                {diagnostics?.entriesTableExists ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>GL Entries Table: {diagnostics?.entriesTableExists ? "Exists" : "Missing"}</span>
              </div>

              {!diagnostics?.entriesTableExists && (
                <Button
                  onClick={() => performAction("create-entries-table", "Create Entries Table")}
                  disabled={actionLoading === "create-entries-table"}
                  variant="outline"
                >
                  {actionLoading === "create-entries-table" ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Database className="h-4 w-4 mr-2" />
                  )}
                  Create GL Entries Table
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Test GL Posting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test GL Posting
              </CardTitle>
              <CardDescription>Test if GL posting works correctly</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => performAction("test-posting", "Test GL Posting")}
                disabled={actionLoading === "test-posting" || !diagnostics?.entriesTableExists || !hasIdDefault}
                variant="outline"
              >
                {actionLoading === "test-posting" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test GL Posting
              </Button>

              {(!diagnostics?.entriesTableExists || !hasIdDefault) && (
                <p className="text-sm text-muted-foreground mt-2">Fix the tables above before testing GL posting</p>
              )}
            </CardContent>
          </Card>

          {/* Existing Jumia GL Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Jumia GL Transactions</CardTitle>
              <CardDescription>
                Found {diagnostics?.jumiaTransactions?.length || 0} Jumia GL transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diagnostics?.jumiaTransactions && diagnostics.jumiaTransactions.length > 0 ? (
                <div className="space-y-2">
                  {diagnostics.jumiaTransactions.map((transaction, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.source_transaction_id} • {transaction.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">Entries: {transaction.entry_count}</div>
                        <div className="text-sm text-muted-foreground">
                          Dr: {transaction.total_debit} Cr: {transaction.total_credit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No Jumia GL transactions found</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
