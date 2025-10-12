"use client"

import { AlertTriangle, Info, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/currency"

interface BranchFloatDisplayProps {
  title: string
  description: string
  serviceType: string // "momo", "agency-banking", "e-zwich", "power", "cash-in-till", etc.
  accounts: any[]
  selectedAccount?: any
  isLoading: boolean
  error?: string | null
  onRefresh?: () => void
  branchName?: string
}

export function BranchFloatDisplay({
  title,
  description,
  serviceType,
  accounts,
  selectedAccount,
  isLoading,
  error,
  onRefresh,
  branchName,
}: BranchFloatDisplayProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show error only for actual API errors
  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-600">{title} - Error</CardTitle>
          <CardDescription>There was an issue loading the float information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-2">{error}</p>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show informative message when no accounts exist for this branch
  if (!accounts || accounts.length === 0) {
    const serviceNames = {
      momo: "Mobile Money",
      "agency-banking": "Agency Banking",
      "e-zwich": "E-Zwich",
      power: "Power",
      jumia: "Jumia",
      "cash-in-till": "Cash in Till",
    }

    const serviceName = serviceNames[serviceType] || serviceType

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Info className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              There is no {serviceName} float information available for {branchName || "this branch"}.
            </p>
            <p className="text-xs text-muted-foreground">
              Please contact your administrator to set up {serviceName} float accounts.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show selected account or first account
  const accountToShow = selectedAccount || accounts[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Balance:</span>
            <span className="text-2xl font-bold text-green-600">
              {formatCurrency(accountToShow?.current_balance || accountToShow?.currentBalance || 0)}
            </span>
          </div>

          {onRefresh && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Threshold:</span>
              <span>{formatCurrency(accountToShow?.min_threshold || accountToShow?.minThreshold || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Threshold:</span>
              <span>{formatCurrency(accountToShow?.max_threshold || accountToShow?.maxThreshold || 0)}</span>
            </div>
          </div>

          {accounts.length > 1 && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground mb-2">All {serviceType} accounts:</div>
              {accounts.map((account, index) => (
                <div key={account.id || index} className="flex justify-between text-xs">
                  <span>{account.provider || account.account_number || `Account ${index + 1}`}:</span>
                  <span>{formatCurrency(account.current_balance || account.currentBalance || 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Branch:</span>
              <span>{branchName || "Current Branch"}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last Updated:</span>
              <span>{accountToShow?.updated_at ? new Date(accountToShow.updated_at).toLocaleString() : "N/A"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
