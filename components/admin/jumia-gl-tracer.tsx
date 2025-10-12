"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Play, Database } from "lucide-react"

interface DiagnosticData {
  tables: Record<string, Array<{ column: string; type: string }>>
  gl_accounts: any[]
  gl_transactions: any[]
  jumia_transactions: any[]
  recent_activity: any[]
}

export function JumiaGLTracer() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDiagnostics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/debug/jumia-gl-trace")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load diagnostics")
      }

      setDiagnostics(data.diagnostics)
      setSummary(data.summary)
    } catch (error) {
      console.error("Error loading diagnostics:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const testManualGLPosting = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/debug/jumia-gl-trace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "test_manual_gl_posting",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Manual GL posting test failed")
      }

      setTestResults(data)
      // Reload diagnostics to see the new entry
      await loadDiagnostics()
    } catch (error) {
      console.error("Error testing manual GL posting:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0)
  }

  const getStatusIcon = (condition: boolean) => {
    return condition ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jumia GL Integration Tracer</CardTitle>
          <CardDescription>Deep dive into GL posting issues and trace the entire flow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={loadDiagnostics} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Load Full Diagnostics
            </Button>
            <Button onClick={testManualGLPosting} disabled={isLoading} variant="outline">
              <Play className="h-4 w-4" />
              Test Manual GL Posting
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {testResults && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Manual Test Results:</strong> {testResults.message}
                <br />
                <strong>GL Transaction ID:</strong> {testResults.gl_transaction_id}
                <br />
                <strong>Source Transaction ID:</strong> {testResults.source_transaction_id}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {diagnostics && summary && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="tables">Table Structure</TabsTrigger>
            <TabsTrigger value="accounts">GL Accounts</TabsTrigger>
            <TabsTrigger value="transactions">GL Transactions</TabsTrigger>
            <TabsTrigger value="entries">GL Entries</TabsTrigger>
            <TabsTrigger value="jumia">Jumia Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(summary.tables_found > 0)}
                    <div>
                      <div className="text-sm font-medium">GL Tables</div>
                      <div className="text-2xl font-bold">{summary.tables_found}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(summary.gl_accounts_count > 0)}
                    <div>
                      <div className="text-sm font-medium">GL Accounts</div>
                      <div className="text-2xl font-bold">{summary.gl_accounts_count}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(summary.gl_transactions_count > 0)}
                    <div>
                      <div className="text-sm font-medium">GL Transactions</div>
                      <div className="text-2xl font-bold">{summary.gl_transactions_count}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(summary.jumia_transactions_count > 0)}
                    <div>
                      <div className="text-sm font-medium">Jumia Transactions</div>
                      <div className="text-2xl font-bold">{summary.jumia_transactions_count}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(summary.recent_gl_entries > 0)}
                    <div>
                      <div className="text-sm font-medium">GL Entries</div>
                      <div className="text-2xl font-bold">{summary.recent_gl_entries}</div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Key Issue:</strong> If you have Jumia transactions but no GL transactions, the GL posting is
                    failing silently. Check the other tabs for details.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tables" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GL Table Structure</CardTitle>
                <CardDescription>Verify that all required tables and columns exist</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(diagnostics.tables).map(([tableName, columns]) => (
                  <div key={tableName} className="mb-4">
                    <h4 className="font-medium mb-2">{tableName}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Column</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {columns.map((col, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{col.column}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{col.type}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GL Accounts</CardTitle>
                <CardDescription>Required accounts for Jumia transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {Array.isArray(diagnostics.gl_accounts) ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnostics.gl_accounts.map((account, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{account.code}</TableCell>
                          <TableCell>{account.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{account.type}</Badge>
                          </TableCell>
                          <TableCell>{account.is_active ? "✓" : "✗"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{diagnostics.gl_accounts[0]}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GL Transactions</CardTitle>
                <CardDescription>Recent GL transactions from Jumia</CardDescription>
              </CardHeader>
              <CardContent>
                {Array.isArray(diagnostics.gl_transactions) && diagnostics.gl_transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source Transaction</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnostics.gl_transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{transaction.source_transaction_id}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{transaction.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(transaction.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No GL transactions found for Jumia. This indicates GL posting is not working.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GL Transaction Entries</CardTitle>
                <CardDescription>Detailed GL entries for Jumia transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {Array.isArray(diagnostics.recent_activity) && diagnostics.recent_activity.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source Transaction</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnostics.recent_activity.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{entry.source_transaction_id}</TableCell>
                          <TableCell className="font-mono">{entry.account_code}</TableCell>
                          <TableCell>{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</TableCell>
                          <TableCell>{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</TableCell>
                          <TableCell>{entry.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No GL entries found for Jumia transactions. GL posting is definitely not working.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jumia" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Jumia Transactions</CardTitle>
                <CardDescription>Recent Jumia transactions that should have GL entries</CardDescription>
              </CardHeader>
              <CardContent>
                {Array.isArray(diagnostics.jumia_transactions) && diagnostics.jumia_transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diagnostics.jumia_transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{transaction.transaction_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{transaction.transaction_type}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{transaction.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(transaction.created_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>No recent Jumia transactions found to test with.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
