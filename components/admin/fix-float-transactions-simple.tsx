"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, Database, CheckCircle } from "lucide-react"

export function FixFloatTransactionsSimple() {
  const [isFixing, setIsFixing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const fixSchema = async () => {
    setIsFixing(true)
    setResult(null)

    try {
      const response = await fetch("/api/debug/fix-float-transactions-simple", {
        method: "POST",
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        toast({
          title: "Schema Fixed",
          description: "Float transactions table updated successfully",
        })
      } else {
        toast({
          title: "Fix Failed",
          description: data.error || "Failed to fix schema",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fixing schema:", error)
      toast({
        title: "Error",
        description: "Failed to fix float transactions schema",
        variant: "destructive",
      })
    } finally {
      setIsFixing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-500" />
          Fix Float Transactions Schema
        </CardTitle>
        <CardDescription>
          Add missing columns (balance_before, balance_after, updated_at) to float_transactions table
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={fixSchema} disabled={isFixing} className="w-full">
          {isFixing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Fixing Schema...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Fix Float Transactions Schema
            </>
          )}
        </Button>

        {result && (
          <div className="mt-4 p-4 rounded-lg bg-muted">
            <h4 className="font-medium mb-2">{result.success ? "✅ Success" : "❌ Error"}</h4>
            <p className="text-sm mb-2">{result.message || result.error}</p>
            {result.columns && (
              <div>
                <p className="text-sm font-medium mb-1">Current Columns:</p>
                <ul className="text-xs space-y-1">
                  {result.columns.map((col: any, index: number) => (
                    <li key={index} className="font-mono">
                      {col.column_name} ({col.data_type})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
