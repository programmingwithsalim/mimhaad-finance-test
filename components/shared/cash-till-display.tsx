"use client"

import { AlertTriangle, Info, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCashInTill } from "@/hooks/use-cash-in-till"
import { CashTillDepositDialog } from "./cash-till-deposit-dialog"
import { CashTillWithdrawalDialog } from "./cash-till-withdrawal-dialog"
import { CashTillExchangeDialog } from "./cash-till-exchange-dialog"

interface CashTillDisplayProps {
  branchId: string
  error?: string | null | undefined
  refetch?: () => void
}

export function CashTillDisplay({ branchId, error: propError, refetch: propRefetch }: CashTillDisplayProps) {
  const { cashAccount, isLoading, error: hookError, refetch: hookRefetch } = useCashInTill({ branchId })

  const error = propError || (hookError && hookError.message !== "No branch ID provided" ? hookError.message : null)
  const refetch = propRefetch || hookRefetch

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Till</CardTitle>
          <CardDescription>Loading cash till information...</CardDescription>
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

  // Show error only for actual errors, not for missing accounts
  if (error && error !== "No branch ID provided") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-red-600">Cash Till - Error</CardTitle>
          <CardDescription>There was an issue loading the cash till</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If no cash account exists and we're not loading, show informative message
  if (!cashAccount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cash Till</CardTitle>
          <CardDescription>No cash till account found</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Info className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-4">No cash till account has been set up for this branch.</p>
            <CashTillDepositDialog 
              branchId={branchId} 
              currentBalance={0} 
              onDepositSuccess={refetch}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentBalance = cashAccount?.current_balance || 0
  const isLowBalance = currentBalance < (cashAccount?.min_threshold || 1000)
  const isEmpty = currentBalance === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cash Till</CardTitle>
            <CardDescription>Available cash for transactions</CardDescription>
          </div>
          <div className="flex gap-2">
            <CashTillDepositDialog 
              branchId={branchId} 
              currentBalance={currentBalance} 
              onDepositSuccess={refetch}
            />
            <CashTillExchangeDialog 
              branchId={branchId} 
              currentCashBalance={currentBalance} 
              onExchangeSuccess={refetch}
            />
            {currentBalance > 0 && (
              <CashTillWithdrawalDialog 
                branchId={branchId} 
                currentBalance={currentBalance} 
                onWithdrawalSuccess={refetch}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Balance:</span>
            <span className={`text-2xl font-bold ${
              isEmpty ? 'text-red-600' : 
              isLowBalance ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              GHS{" "}
              {currentBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {isEmpty && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-800 font-medium">
                  Cash till is empty! Add money to enable transactions.
                </span>
              </div>
            </div>
          )}

          {isLowBalance && !isEmpty && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  Low balance. Consider adding more cash or exchanging from float accounts.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Threshold:</span>
              <span>
                GHS{" "}
                {(cashAccount?.min_threshold || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Threshold:</span>
              <span>
                GHS{" "}
                {(cashAccount?.max_threshold || 0).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Last Updated:</span>
              <span>{cashAccount?.updated_at ? new Date(cashAccount.updated_at).toLocaleString() : "N/A"}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
