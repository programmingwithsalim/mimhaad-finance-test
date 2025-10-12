"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Play, Wrench } from "lucide-react"

interface DiagnosticData {
  gl_tables: string[]
  gl_accounts: any[]
  recent_jumia_transactions: any[]
  gl_posting_errors: string[]
}

export function JumiaGLFixer() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState("")

  const loadDiagnostics = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/debug/test-jumia-gl-posting")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load diagnostics")
      }

      setDiagnostics(data.diagnostics)
    } catch (error) {
      console.error("Error loading diagnostics:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const testGLPosting = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/debug/test-jumia-gl-posting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "test_gl_posting",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "GL posting test failed")
      }

      setTestResults(data)
    } catch (error) {
      console.error("Error testing GL posting:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const retryExistingTransaction = async () => {
    if (!selectedTransaction) {
      setError("Please select a transaction ID")
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/debug/test-jumia-gl-posting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "retry_existing",
          transactionId: selectedTransaction,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "GL posting retry failed")
      }

      setTestResults(data)
    } catch (error) {
      console.error("Error retrying GL posting:", error)
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
          <CardTitle>Jumia-GL Integration Fixer</CardTitle>
          <CardDescription>Diagnose and fix issues with Jumia GL posting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={loadDiagnostics} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Load Diagnostics
            </Button>
            <Button onClick={testGLPosting} disabled={isLoading} variant="outline">
              <Play className="h-4 w-4" />
              Test GL Posting
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {diagnostics && (
        <Tabs defaultValue="status" className="space-y-4">
          <TabsList>
            <TabsTrigger value="status">System Status</TabsTrigger>
            <TabsTrigger value="test">Test GL Posting</TabsTrigger>
            <TabsTrigger value="retry">Retry Existing</TabsTrigger>
            <TabsTrigger value="fix">Fix Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>GL System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.gl_tables.includes("gl_journal_entries"))}
                    <span className="text-sm">Journal Entries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.gl_tables.includes("gl_journal_entry_lines"))}
                    <span className="text-sm">Journal Lines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.gl_tables.includes("gl_accounts"))}
                    <span className="text-sm">GL Accounts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(diagnostics.gl_accounts.length > 0)}
                    <span className="text-sm">Account Data</span>
                  </div>
                </div>

                {diagnostics.gl_posting_errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Issues Found:</strong>
                      <ul className="list-disc list-inside mt-2">
                        {diagnostics.gl_posting_errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {diagnostics.gl_accounts.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Available GL Accounts:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diagnostics.gl_accounts.map((account) => (
                          <TableRow key={account.account_code}>
                            <TableCell className="font-mono">{account.account_code}</TableCell>
                            <TableCell>{account.account_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{account.account_type}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test GL Posting</CardTitle>
                <CardDescription>Create a test transaction and verify GL entries are created</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={testGLPosting} disabled={isLoading}>
                  {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run GL Posting Test
                </Button>

                {testResults && (
                  <div className="space-y-3">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Test Results:</strong> {testResults.message}
                      </AlertDescription>
                    </Alert>

                    {testResults.results && (
                      <div className="border rounded p-3">
                        <h4 className="font-medium mb-2">GL Entries Created:</h4>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(testResults.results, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="retry" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Retry Existing Transaction</CardTitle>
                <CardDescription>Manually create GL entries for an existing Jumia transaction</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Jumia Transaction ID"
                    value={selectedTransaction}
                    onChange={(e) => setSelectedTransaction(e.target.value)}
                  />
                  <Button onClick={retryExistingTransaction} disabled={isLoading || !selectedTransaction}>
                    {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
                    Retry GL Posting
                  </Button>
                </div>

                {diagnostics.recent_jumia_transactions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recent Jumia Transactions:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Transaction ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diagnostics.recent_jumia_transactions.map((tx) => (
                          <TableRow key={tx.transaction_id}>
                            <TableCell className="font-mono text-xs">{tx.transaction_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{tx.transaction_type}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(tx.amount)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedTransaction(tx.transaction_id)}
                              >
                                Select
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {testResults && testResults.transaction && (
                  <div className="space-y-3">
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Retry Results:</strong> {testResults.message}
                      </AlertDescription>
                    </Alert>

                    <div className="border rounded p-3">
                      <h4 className="font-medium mb-2">Transaction Details:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <strong>ID:</strong> {testResults.transaction.transaction_id}
                        </div>
                        <div>
                          <strong>Type:</strong> {testResults.transaction.transaction_type}
                        </div>
                        <div>
                          <strong>Amount:</strong> {formatCurrency(testResults.transaction.amount)}
                        </div>
                        <div>
                          <strong>Status:</strong> {testResults.transaction.status}
                        </div>
                      </div>
                    </div>

                    {testResults.gl_result && (
                      <div className="border rounded p-3">
                        <h4 className="font-medium mb-2">GL Result:</h4>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(testResults.gl_result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fix" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fix Common Issues</CardTitle>
                <CardDescription>Automated fixes for common GL integration problems</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Common Issues and Solutions:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>
                        <strong>GL tables missing:</strong> Run the GL initialization from Admin → GL Initialize
                      </li>
                      <li>
                        <strong>GL accounts missing:</strong> The system should auto-create required accounts
                      </li>
                      <li>
                        <strong>Schema mismatch:</strong> Check if gl_journal_entries has the right columns
                      </li>
                      <li>
                        <strong>Silent failures:</strong> Check audit logs for error details
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" onClick={() => window.open("/dashboard/admin/gl-initialize", "_blank")}>
                    Initialize GL System
                  </Button>
                  <Button variant="outline" onClick={() => window.open("/dashboard/admin/gl-diagnostic", "_blank")}>
                    Run GL Diagnostic
                  </Button>
                  <Button variant="outline" onClick={() => window.open("/dashboard/audit-trail", "_blank")}>
                    Check Audit Logs
                  </Button>
                  <Button variant="outline" onClick={() => window.open("/dashboard/gl-accounting", "_blank")}>
                    View GL Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
