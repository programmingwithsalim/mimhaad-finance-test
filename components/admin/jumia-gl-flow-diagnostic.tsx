"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react"

interface FlowData {
  jumia_transaction: any
  gl_entries: any[]
  recent_jumia_transactions: any[]
  recent_gl_entries: any[]
  jumia_related_gl_entries: any[]
  gl_tables_status: string[]
  gl_schema_info: any[]
  audit_logs: any[]
  flow_explanation: Record<string, string>
  troubleshooting_info: {
    schema_available: boolean
    jumia_table_accessible: boolean
    gl_tables_accessible: boolean
    potential_issues: string[]
  }
}

export function JumiaGLFlowDiagnostic() {
  const [flowData, setFlowData] = useState<FlowData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [transactionId, setTransactionId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const fetchFlowData = async (txId?: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (txId) {
        params.append("transactionId", txId)
      }

      const response = await fetch(`/api/debug/jumia-gl-flow?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch flow data")
      }

      setFlowData(data.data)
    } catch (error) {
      console.error("Error fetching flow data:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    fetchFlowData(transactionId)
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

  const safeSubstring = (str: any, start: number, end?: number) => {
    if (!str || typeof str !== "string") return "N/A"
    return end ? str.substring(start, end) : str.substring(start)
  }

  const formatDate = (dateStr: any) => {
    if (!dateStr) return "N/A"
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return "Invalid Date"
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Jumia-GL Integration Flow Diagnostic</CardTitle>
          <CardDescription>
            Understand how Jumia transactions integrate with the GL system and troubleshoot issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Jumia Transaction ID (optional)"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {transactionId ? "Search" : "Load Overview"}
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

      {flowData && (
        <>
          {/* Flow Explanation */}
          <Card>
            <CardHeader>
              <CardTitle>How Jumia-GL Integration Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(flowData.flow_explanation).map(([step, description]) => (
                  <div key={step} className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">
                      {step.replace("step", "Step ")}
                    </Badge>
                    <p className="text-sm">{description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>GL System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.gl_tables_status.includes("gl_journal_entries"))}
                  <span className="text-sm">Journal Entries Table</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.gl_tables_status.includes("gl_journal_entry_lines"))}
                  <span className="text-sm">Journal Lines Table</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.gl_tables_status.includes("gl_accounts"))}
                  <span className="text-sm">GL Accounts Table</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.gl_tables_status.includes("gl_account_balances"))}
                  <span className="text-sm">Account Balances Table</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GL Schema Information */}
          <Card>
            <CardHeader>
              <CardTitle>GL Database Schema</CardTitle>
              <CardDescription>Available columns in gl_journal_entries table</CardDescription>
            </CardHeader>
            <CardContent>
              {flowData.gl_schema_info && flowData.gl_schema_info.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {flowData.gl_schema_info.map((col) => (
                    <div key={col.column_name} className="flex items-center gap-2">
                      <Badge variant="outline">{col.column_name}</Badge>
                      <span className="text-xs text-muted-foreground">{col.data_type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Could not access GL schema information. This might indicate database connectivity issues.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Troubleshooting Information */}
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.troubleshooting_info.schema_available)}
                  <span>GL Schema Accessible</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.troubleshooting_info.jumia_table_accessible)}
                  <span>Jumia Table Accessible</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(flowData.troubleshooting_info.gl_tables_accessible)}
                  <span>GL Tables Accessible</span>
                </div>

                {flowData.troubleshooting_info.potential_issues &&
                  flowData.troubleshooting_info.potential_issues.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Potential Issues:</strong>
                        <ul className="list-disc list-inside mt-2">
                          {flowData.troubleshooting_info.potential_issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Specific Transaction Analysis */}
          {flowData.jumia_transaction && (
            <Card>
              <CardHeader>
                <CardTitle>Transaction Analysis: {flowData.jumia_transaction.transaction_id || "Unknown ID"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium">Type</p>
                    <Badge>{flowData.jumia_transaction.transaction_type || "Unknown"}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Amount</p>
                    <p>{formatCurrency(flowData.jumia_transaction.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant="outline">{flowData.jumia_transaction.status || "Unknown"}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">GL Posted</p>
                    {getStatusIcon(flowData.gl_entries && flowData.gl_entries.length > 0)}
                  </div>
                </div>

                {flowData.gl_entries && flowData.gl_entries.length > 0 ? (
                  <div>
                    <h4 className="font-medium mb-2">GL Entries Created:</h4>
                    {flowData.gl_entries.map((entry, index) => (
                      <div key={index} className="border rounded p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Reference: {entry.reference_number || "N/A"}</span>
                          <Badge>{entry.status || "Unknown"}</Badge>
                        </div>
                        <div className="space-y-1">
                          {entry.line_items &&
                            entry.line_items.map((line: any, lineIndex: number) => (
                              <div key={lineIndex} className="flex justify-between text-sm">
                                <span>
                                  {line.account_code || "N/A"} - {line.account_name || "N/A"}
                                </span>
                                <span>
                                  {line.debit_amount > 0 && `Dr: ${formatCurrency(line.debit_amount)}`}
                                  {line.credit_amount > 0 && `Cr: ${formatCurrency(line.credit_amount)}`}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No GL entries found for this transaction. This could indicate:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>GL posting failed during transaction creation</li>
                        <li>Transaction type doesn't require GL posting (package receipt)</li>
                        <li>GL schema issues preventing posting</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Jumia Transactions</CardTitle>
                <CardDescription>Last 10 Jumia transactions</CardDescription>
              </CardHeader>
              <CardContent>
                {flowData.recent_jumia_transactions && flowData.recent_jumia_transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flowData.recent_jumia_transactions.map((tx) => (
                        <TableRow key={tx.id || Math.random()}>
                          <TableCell className="font-mono text-xs">
                            {safeSubstring(tx.transaction_id, 0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.transaction_type || "Unknown"}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(tx.amount)}</TableCell>
                          <TableCell>{formatDate(tx.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>No Jumia transactions found in the database.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent GL Entries (All)</CardTitle>
                <CardDescription>Last 10 GL entries from all sources</CardDescription>
              </CardHeader>
              <CardContent>
                {flowData.recent_gl_entries && flowData.recent_gl_entries.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flowData.recent_gl_entries.map((entry) => (
                        <TableRow key={entry.id || Math.random()}>
                          <TableCell className="font-mono text-xs">
                            {safeSubstring(entry.reference_number, 0, 12)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{safeSubstring(entry.description, 0, 30)}</TableCell>
                          <TableCell>
                            <Badge>{entry.status || "Unknown"}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(entry.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>No GL entries found. This indicates GL posting is not working.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Jumia-Related GL Entries */}
          {flowData.jumia_related_gl_entries && flowData.jumia_related_gl_entries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Jumia-Related GL Entries Found</CardTitle>
                <CardDescription>GL entries that might be related to Jumia transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {flowData.jumia_related_gl_entries.map((entry, index) => (
                    <div key={index} className="border rounded p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Reference: {entry.reference_number || "N/A"}</span>
                        <Badge>{entry.status || "unknown"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.description || "No description"}</p>
                      {entry.line_items && entry.line_items.length > 0 && (
                        <div className="space-y-1">
                          {entry.line_items.map((line: any, lineIndex: number) => (
                            <div key={lineIndex} className="flex justify-between text-sm">
                              <span>
                                {line.account_code || "N/A"} - {line.account_name || "N/A"}
                              </span>
                              <span>
                                {line.debit_amount > 0 && `Dr: ${formatCurrency(line.debit_amount)}`}
                                {line.credit_amount > 0 && `Cr: ${formatCurrency(line.credit_amount)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit Logs */}
          {flowData.audit_logs && flowData.audit_logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Audit Logs (Jumia Related)</CardTitle>
                <CardDescription>Recent audit logs related to Jumia transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flowData.audit_logs.map((log) => (
                      <TableRow key={log.id || Math.random()}>
                        <TableCell>{log.action || "Unknown"}</TableCell>
                        <TableCell className="font-mono text-xs">{safeSubstring(log.entity_id, 0, 8)}...</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.details ? JSON.stringify(log.details) : "No details"}
                        </TableCell>
                        <TableCell>{formatDate(log.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
