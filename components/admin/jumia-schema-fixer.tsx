"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle, Database, RefreshCw } from "lucide-react"

export function JumiaSchemaFixer() {
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const { toast } = useToast()

  const fixSchema = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/db/fix-jumia-schema", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Schema Fixed",
          description: data.message,
        })
      } else {
        throw new Error(data.error || "Failed to fix schema")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fix schema",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const seedData = async () => {
    try {
      setSeedLoading(true)
      const response = await fetch("/api/jumia/seed", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Data Seeded",
          description: `Seeded ${data.data.transactions} transactions and ${data.data.liability_records} liability records`,
        })
      } else {
        throw new Error(data.error || "Failed to seed data")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to seed data",
        variant: "destructive",
      })
    } finally {
      setSeedLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Jumia Schema Fixer
        </CardTitle>
        <CardDescription>
          Fix missing float_account_id column in jumia_transactions table and seed sample data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Schema Issue Detected</p>
            <p className="text-sm text-yellow-700">
              The jumia_transactions table is missing the float_account_id column required for settlements.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={fixSchema} disabled={loading} className="w-full">
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Fixing Schema...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Fix Schema
              </>
            )}
          </Button>

          <Button onClick={seedData} disabled={seedLoading} variant="outline" className="w-full">
            {seedLoading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Seeding Data...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Seed Sample Data
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>1. First click "Fix Schema" to add the missing column</p>
          <p>2. Then click "Seed Sample Data" to populate with test data</p>
          <p>3. Navigate to /dashboard/jumia to test the functionality</p>
        </div>
      </CardContent>
    </Card>
  )
}
