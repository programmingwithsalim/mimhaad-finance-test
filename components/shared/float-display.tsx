"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, AlertTriangle } from "lucide-react"
import { useState } from "react"

interface FloatDisplayProps {
  branchId?: string
  serviceType?: string
  provider?: string
  userId?: string
  title?: string
  description?: string
  showTransactions?: boolean
  onRequestFloat?: () => void
  overrideBalance?: number | null
  isLoading?: boolean
  noBalanceSelected?: boolean // New prop to indicate no bank is selected
}

// Utility function to safely format currency
const formatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return "0.00"
  }
  return Number(value).toFixed(2)
}

// Utility function to safely format float type
const formatFloatType = (type: string | undefined): string => {
  if (!type) return "Float"

  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function FloatDisplay({
  branchId,
  serviceType,
  provider,
  userId,
  title,
  description,
  showTransactions = false,
  onRequestFloat,
  overrideBalance,
  isLoading = false,
  noBalanceSelected = false, // Default to false
}: FloatDisplayProps) {
  const [localIsLoading, setLocalIsLoading] = useState(isLoading)
  const [floatBalance, setFloatBalance] = useState<number | null>(null)
  const [isLowFloat, setIsLowFloat] = useState(false)

  // Format the title and description
  const displayTitle =
    title ||
    (provider
      ? `${provider} Float Balance`
      : serviceType
        ? `${formatFloatType(serviceType)} Float Balance`
        : "Float Balance")

  const displayDescription =
    description ||
    (provider
      ? `Available float for ${provider} transactions`
      : serviceType
        ? `Available float for ${formatFloatType(serviceType)} transactions`
        : "Available float for transactions")

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>{displayTitle}</span>
          {isLowFloat && <AlertCircle className="h-4 w-4 text-amber-500" />}
        </CardTitle>
        <CardDescription>{displayDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {noBalanceSelected ? (
          // Show a message when no bank is selected
          <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 text-yellow-500" />
            <p>Please select a partner bank to view the float balance</p>
            <p className="text-sm mt-2">Each bank has its own float balance for transactions</p>
          </div>
        ) : (
          // Show the balance when a bank is selected
          <div className="flex flex-col space-y-2">
            <div className="text-2xl font-bold">
              {localIsLoading || isLoading ? (
                <div className="flex items-center">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                `GHS ${formatCurrency(overrideBalance !== undefined ? overrideBalance : floatBalance)}`
              )}
            </div>
            {onRequestFloat && (
              <Button onClick={onRequestFloat} variant="outline" size="sm" className="mt-2">
                Request More Float
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
