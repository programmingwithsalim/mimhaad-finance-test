"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Database, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function JumiaGLWorking() {
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [glStructure, setGLStructure] = useState<any>(null)
  const [existingTransactions, setExistingTransactions] = useState<any[]>([])
  const { toast } = useToast()

  const checkGLStructure = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/debug/check-actual-gl-structure")
      const data = await response.json()
      setGLStructure(data)

      if (data.success) {
        toast({
          title: "GL Structure Checked",
          description: `Found ${data.allTables.length} GL-related tables`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check GL structure",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const testGLPosting = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/debug/jumia-gl-working", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          userId: "test-user",
          branchId: "test-branch",
        }),
      })
      const data = await response.json()
      setTestResult(data)

      if (data.success) {
        toast({
          title: "Test Successful",
          description: `GL transaction created: ${data.glTransactionId}`,
        })
      } else {
        toast({
          title: "Test Failed",
          description: data.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test GL posting",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getExistingTransactions = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/debug/jumia-gl-working")
      const data = await response.json()
      setExistingTransactions(data.transactions || [])

      toast({
        title: "Transactions Loaded",
        description: `Found ${data.count} Jumia GL transactions`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Jumia GL - Working Pattern</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button onClick={checkGLStructure} disabled={loading} variant="outline">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Check GL Structure
        </Button>

        <Button onClick={testGLPosting} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Test GL Posting
        </Button>

        <Button onClick={getExistingTransactions} disabled={loading} variant="secondary">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Load Existing Transactions
        </Button>
      </div>

      {/* GL Structure Results */}
      {glStructure && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Your Current GL Structure</span>
            </CardTitle>
            <CardDescription>
              This shows what GL tables you actually have and how other services are using them
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">GL Tables Found:</h4>
              <div className="flex flex-wrap gap-2">
                {glStructure.allTables.map((table: string) => (
                  <Badge key={table} variant="outline">
                    {table}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Working Services:</h4>
              <div className="flex flex-wrap gap-2">
                {glStructure.existingGLTransactions.map((service: any) => (
                  <Badge key={`${service.source_module}-${service.source_transaction_type}`} variant="secondary">
                    {service.source_module} ({service.count} transactions)
                  </Badge>
                ))}
              </div>
            </div>

            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm">
                <strong>Analysis:</strong> You have {glStructure.analysis.hasGLTransactions ? "✅" : "❌"}{" "}
                gl_transactions table,
                {glStructure.analysis.hasJournalEntries ? " ✅" : " ❌"} journal entries table. Working services:{" "}
                {glStructure.analysis.workingServices.join(", ") || "None"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span>Test Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-3 rounded-md overflow-x-auto">
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Transactions */}
      {existingTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Existing Jumia GL Transactions</CardTitle>
            <CardDescription>These are Jumia transactions already in your GL</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {existingTransactions.map((transaction) => (
                <div key={transaction.id} className="border p-3 rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.source_transaction_type} • {transaction.date}
                      </p>
                    </div>
                    <Badge variant={transaction.status === "posted" ? "default" : "secondary"}>
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
