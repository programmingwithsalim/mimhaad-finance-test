"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, FileText } from "lucide-react"

interface GLSummary {
  totalTransactions: number
  totalDebits: number
  totalCredits: number
  pendingTransactions: number
  postedTransactions: number
  recentActivity: {
    module: string
    count: number
    amount: number
  }[]
}

export function GLTransactionSummary() {
  const [summary, setSummary] = useState<GLSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/gl/transaction-summary")

      if (!response.ok) {
        throw new Error(`Failed to fetch summary: ${response.statusText}`)
      }

      const data = await response.json()
      setSummary(data)
    } catch (error) {
      console.error("Error fetching GL summary:", error)
      setError(error instanceof Error ? error.message : "Failed to load summary")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GL Transaction Summary</CardTitle>
          <CardDescription className="text-red-500">{error || "Failed to load summary"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchSummary} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">GL Transaction Summary</h3>
        <Button onClick={fetchSummary} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {summary.pendingTransactions} pending, {summary.postedTransactions} posted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debits</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalDebits)}</div>
            <p className="text-xs text-muted-foreground">All debit entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalCredits)}</div>
            <p className="text-xs text-muted-foreground">All credit entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Check</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                Math.abs(summary.totalDebits - summary.totalCredits) < 0.01 ? "text-green-600" : "text-red-600"
              }`}
            >
              {Math.abs(summary.totalDebits - summary.totalCredits) < 0.01 ? "✓ Balanced" : "⚠ Unbalanced"}
            </div>
            <p className="text-xs text-muted-foreground">
              Difference: {formatCurrency(Math.abs(summary.totalDebits - summary.totalCredits))}
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Activity by Module</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recentActivity.map((activity) => (
                <div key={activity.module} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{activity.module}</Badge>
                    <span className="text-sm">{activity.count} transactions</span>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(activity.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
