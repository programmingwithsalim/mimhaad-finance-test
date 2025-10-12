"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import type { CommissionStatistics } from "@/lib/commission-types"
import { TrendingUp, Clock, DollarSign, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CommissionStatisticsCardsProps {
  statistics: CommissionStatistics | null
  isLoading?: boolean
  error?: string | null
}

export function CommissionStatisticsCards({
  statistics,
  isLoading = false,
  error = null,
}: CommissionStatisticsCardsProps) {
  console.log("CommissionStatisticsCards render:", { statistics, isLoading, error })

  // If there's an error, show error state
  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load commission statistics: {error}</AlertDescription>
      </Alert>
    )
  }

  // If loading, show skeleton UI
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-5 w-[120px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[100px] mb-2" />
              <Skeleton className="h-4 w-[140px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Default values for statistics
  const {
    totalAmount = 0,
    totalCount = 0,
    pendingAmount = 0,
    pendingCount = 0,
    paidAmount = 0,
    paidCount = 0,
  } = statistics || {}

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {totalCount} commission record{totalCount !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {pendingCount} pending commission{pendingCount !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Paid</CardTitle>
          <DollarSign className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(paidAmount)}</div>
          <p className="text-xs text-muted-foreground">
            {paidCount} paid commission{paidCount !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
