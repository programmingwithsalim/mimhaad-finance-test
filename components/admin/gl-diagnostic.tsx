"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, XCircle, RefreshCw, Database } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function GLDiagnostic() {
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const runDiagnostic = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/debug/gl-diagnostic")
      const data = await response.json()

      if (data.success) {
        setDiagnosticResult(data)
        setSuccess("Diagnostic completed successfully")
      } else {
        setError(data.error || "Failed to run diagnostic")
      }
    } catch (err) {
      setError("Error running diagnostic: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  const createGLSchema = async () => {
    setCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/debug/gl-diagnostic", {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        setSuccess("GL schema created successfully")
        // Run diagnostic again to see the changes
        await runDiagnostic()
      } else {
        setError(data.error || "Failed to create GL schema")
      }
    } catch (err) {
      setError("Error creating GL schema: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCreating(false)
    }
  }

  const testGLPosting = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/debug/test-gl-posting", {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        setSuccess("Test GL posting completed successfully")
      } else {
        setError(data.error || "Failed to test GL posting")
      }
    } catch (err) {
      setError("Error testing GL posting: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  const renderTableStatus = () => {
    if (!diagnosticResult?.tableStatus) return null

    return (
      <div className="space-y-4 mt-4">
        <h3 className="text-lg font-medium">GL Tables Status</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(diagnosticResult.tableStatus).map(([table, exists]) => (
            <div key={table} className="flex items-center justify-between p-3 border rounded-md">
              <span className="font-mono text-sm">{table}</span>
              {exists ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderColumnStatus = () => {
    if (!diagnosticResult?.columnStatus) return null

    return (
      <div className="space-y-4 mt-6">
        <h3 className="text-lg font-medium">Table Columns</h3>
        {Object.entries(diagnosticResult.columnStatus).map(([table, columns]) => (
          <div key={table} className="space-y-2">
            <h4 className="font-medium">{table}</h4>
            <div className="bg-muted p-3 rounded-md overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium p-2">Column</th>
                    <th className="text-left font-medium p-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(columns) &&
                    columns.map((col: any, i: number) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-muted/50" : ""}>
                        <td className="p-2 font-mono">{col.column_name}</td>
                        <td className="p-2 font-mono">{col.data_type}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>GL System Diagnostic</CardTitle>
        <CardDescription>Check and fix GL schema issues to ensure proper transaction posting</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Button onClick={runDiagnostic} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Diagnostic...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Run GL Diagnostic
                </>
              )}
            </Button>

            <Button onClick={createGLSchema} disabled={creating} variant="outline" className="w-full">
              {creating ? (
                <>
                  <Database className="mr-2 h-4 w-4 animate-pulse" />
                  Creating GL Schema...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Create/Fix GL Schema
                </>
              )}
            </Button>

            <Button onClick={testGLPosting} disabled={loading} variant="secondary" className="w-full">
              Test GL Posting
            </Button>
          </div>

          {diagnosticResult && (
            <>
              <Separator />

              <div>
                <h3 className="text-lg font-medium">Summary</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="p-3 border rounded-md">
                    <div className="text-sm text-muted-foreground">GL Accounts</div>
                    <div className="text-2xl font-bold">{diagnosticResult.accountCount}</div>
                  </div>
                  <div className="p-3 border rounded-md">
                    <div className="text-sm text-muted-foreground">Tables Ready</div>
                    <div className="text-2xl font-bold">
                      {Object.values(diagnosticResult.tableStatus).filter(Boolean).length}/
                      {Object.values(diagnosticResult.tableStatus).length}
                    </div>
                  </div>
                </div>
              </div>

              {renderTableStatus()}
              {renderColumnStatus()}
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-xs text-muted-foreground">
          {diagnosticResult?.timestamp
            ? `Last checked: ${new Date(diagnosticResult.timestamp).toLocaleString()}`
            : "Not checked yet"}
        </div>
      </CardFooter>
    </Card>
  )
}
