"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

interface IncomeStatementProps {
  dateRange: { from: Date; to: Date }
  branch: string
}

export function IncomeStatement({ dateRange, branch }: IncomeStatementProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIncomeStatementData()
  }, [dateRange, branch])

  const fetchIncomeStatementData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
        branch: branch,
      })

      const response = await fetch(`/api/reports/income-statement?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || "Failed to fetch income statement data")
      }
    } catch (error) {
      console.error("Error fetching income statement:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading income statement...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Income Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <CardTitle>Income Statement</CardTitle>
            <p className="text-sm text-muted-foreground">
              For the period {format(dateRange.from, "MMM d, yyyy")} to {format(dateRange.to, "MMM d, yyyy")}
              {branch !== "all" && ` • ${branch} Branch`}
            </p>
          </div>
          <Badge variant="outline">{data?.status === "complete" ? "Complete" : "Preliminary"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70%]">Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Revenue Section */}
            <TableRow className="font-semibold bg-muted/50">
              <TableCell colSpan={2}>REVENUE</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">MoMo Transaction Fees</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.momo_fees || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Agency Banking Fees</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.agency_banking_fees || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">E-Zwich Transaction Fees</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.ezwich_fees || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Power Transaction Fees</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.power_fees || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Jumia Transaction Fees</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.jumia_fees || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Commission Revenue</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.commission_revenue || 0)}</TableCell>
            </TableRow>
            <TableRow className="font-semibold border-t">
              <TableCell>Total Revenue</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.revenue?.total || 0)}</TableCell>
            </TableRow>

            {/* Expenses Section */}
            <TableRow className="font-semibold bg-muted/50">
              <TableCell colSpan={2} className="pt-6">
                EXPENSES
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Operating Expenses</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.expenses?.operating || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Transaction Processing Costs</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.expenses?.processing_costs || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Float Management Expenses</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.expenses?.float_management || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Administrative Expenses</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.expenses?.administrative || 0)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Other Expenses</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.expenses?.other || 0)}</TableCell>
            </TableRow>
            <TableRow className="font-semibold border-t">
              <TableCell>Total Expenses</TableCell>
              <TableCell className="text-right">{formatCurrency(data?.expenses?.total || 0)}</TableCell>
            </TableRow>

            {/* Net Income */}
            <TableRow className="font-bold text-lg border-t-2">
              <TableCell className="pt-4">Net Income</TableCell>
              <TableCell
                className={`pt-4 text-right ${(data?.net_income || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                {formatCurrency(data?.net_income || 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Summary Metrics */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Gross Profit Margin</p>
            <p className="text-lg font-semibold">{data?.metrics?.gross_profit_margin?.toFixed(1) || "0.0"}%</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Operating Margin</p>
            <p className="text-lg font-semibold">{data?.metrics?.operating_margin?.toFixed(1) || "0.0"}%</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Net Profit Margin</p>
            <p className="text-lg font-semibold">{data?.metrics?.net_profit_margin?.toFixed(1) || "0.0"}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
