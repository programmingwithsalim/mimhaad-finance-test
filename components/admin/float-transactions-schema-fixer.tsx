"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react"

export function FloatTransactionsSchemaFixer() {
  const [isFixing, setIsFixing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const fixSchema = async () => {
    setIsFixing(true)
    setResult(null)

    try {
      const response = await fetch("/api/db/fix-float-transactions-schema", {
        method: "POST",
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        toast({
          title: "Schema Fixed",
          description: "Float transactions schema has been updated successfully",
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
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Fix Float Transactions Schema
        </CardTitle>
        <CardDescription>
          Fix missing columns in the float_transactions table (balance_before, balance_after, updated_at)
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
            <h4 className="font-medium mb-2">Result:</h4>
            <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
