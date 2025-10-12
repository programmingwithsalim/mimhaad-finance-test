"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react"

interface StepResult {
  step: string
  success: boolean
  error?: string
  data?: any
}

interface FixResult {
  success: boolean
  message: string
  results: StepResult[]
  summary: {
    total: number
    successful: number
    failed: number
  }
}

export function FixFloatConstraints() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FixResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFixConstraints = async (endpoint = "/api/db/fix-float-constraints") => {
    try {
      setLoading(true)
      setError(null)
      setResult(null)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fix constraints")
      }

      setResult(data)
    } catch (err) {
      console.error("Error fixing constraints:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Fix Float Account Constraints</CardTitle>
        <CardDescription>
          This utility fixes database constraints to allow multiple MoMo and Agency Banking accounts with different
          providers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert
            className={`mb-4 ${result.success ? "border-green-500 text-green-700" : "border-amber-500 text-amber-700"}`}
          >
            {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{result.success ? "Success" : "Partial Success"}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <p>This utility will update the database constraints for float accounts to properly handle:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Single account types (cash-in-till, e-zwich, power) - one per branch</li>
            <li>Multiple account types (momo, agency-banking) - multiple per branch with different providers</li>
          </ul>
          <p className="text-amber-600">
            <strong>Note:</strong> This is a one-time fix for the database schema. Try different approaches if one
            fails.
          </p>
        </div>

        {result && (
          <div className="mt-6">
            <h4 className="font-medium mb-3">Execution Results:</h4>
            <div className="space-y-2">
              {result.results.map((step, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex items-center space-x-2">
                    {step.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">{step.step}</span>
                  </div>
                  <Badge variant={step.success ? "default" : "destructive"}>
                    {step.success ? "Success" : "Failed"}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-muted rounded-md">
              <div className="text-sm">
                <strong>Summary:</strong> {result.summary.successful}/{result.summary.total} steps completed
                successfully
              </div>
            </div>

            {result.results.some((r) => r.data) && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium">View Detailed Data</summary>
                <div className="mt-2 p-4 bg-muted rounded-md overflow-auto max-h-60">
                  <pre className="text-xs">
                    {JSON.stringify(
                      result.results.filter((r) => r.data),
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button onClick={() => handleFixConstraints()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fixing...
            </>
          ) : (
            "Fix Constraints (Method 1)"
          )}
        </Button>
        <Button
          onClick={() => handleFixConstraints("/api/db/fix-float-constraints-simple")}
          disabled={loading}
          variant="outline"
        >
          Simple Fix (Method 2)
        </Button>
        <Button
          onClick={() => handleFixConstraints("/api/db/manual-constraint-fix")}
          disabled={loading}
          variant="outline"
        >
          Manual Fix (Method 3)
        </Button>
      </CardFooter>
    </Card>
  )
}
