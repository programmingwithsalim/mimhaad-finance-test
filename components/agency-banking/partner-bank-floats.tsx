"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAgencyFloatAccounts } from "@/hooks/use-agency-float-accounts"
import { formatCurrency } from "@/lib/currency"

interface PartnerBank {
  id: string
  name: string
  code: string
  logo?: string
  interestRate: number
  transferFee: number
  minFee: number
  maxFee: number
  status: "active" | "inactive"
}

interface PartnerBankFloatsProps {
  banks: PartnerBank[]
  branchId: string
  userId: string
}

export function PartnerBankFloats({ banks, branchId, userId }: PartnerBankFloatsProps) {
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch agency banking float accounts only (excluding MoMo)
  const { accounts: floatAccounts, isLoading, refresh } = useAgencyFloatAccounts()

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
    toast({
      title: "Balances Refreshed",
      description: "Float balances have been refreshed.",
    })
  }

  // Handle float request with enhanced logging
  const handleFloatRequest = async (bankCode: string) => {
    try {
      const requestAmount = 10000 // Default request amount
      const bankName = banks.find((b) => b.code === bankCode)?.name || "partner bank"

      // Create float request with audit logging
      const response = await fetch("/api/agency-banking/transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionType: "float-request",
          amount: requestAmount,
          bankCode,
          bankName,
          userId,
          branchId,
          description: `Float request for ${bankName}`,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Float Request Submitted",
          description: `Request for ${formatCurrency(requestAmount)} has been submitted for approval for ${bankName}`,
        })

        // Refresh balances
        await refresh()
      } else {
        throw new Error(result.error || "Failed to submit float request")
      }
    } catch (error) {
      console.error("Error submitting float request:", error)
      toast({
        title: "Request Failed",
        description: error instanceof Error ? error.message : "Failed to submit float request",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Partner Bank Floats</h2>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          {isRefreshing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh Balances
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          // Loading state
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={`loading-${index}`} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-6 w-3/4 bg-muted rounded"></div>
                <div className="h-4 w-1/2 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-1/2 bg-muted rounded mb-4"></div>
                <div className="h-8 w-full bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))
        ) : floatAccounts.length === 0 ? (
          // No accounts state
          <div className="col-span-full flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <h3 className="text-lg font-medium">No Agency Banking Accounts Found</h3>
            <p className="text-muted-foreground mt-2">
              No agency banking float accounts are available for this branch. MoMo accounts are excluded from this view.
            </p>
          </div>
        ) : (
          // Map through banks and find corresponding float accounts (excluding MoMo)
          banks
            .filter((bank) => bank.status === "active")
            .map((bank) => {
              // Find the float account for this bank (excluding MoMo providers)
              const bankAccount = floatAccounts.find(
                (account) =>
                  account.provider === bank.code &&
                  account.service_type === "agency-banking" &&
                  !["mtn", "vodafone", "airteltigo", "telecel"].includes(account.provider.toLowerCase()),
              )

              return (
                <Card key={bank.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle>{bank.name}</CardTitle>
                      <Badge variant="outline">{bank.code}</Badge>
                    </div>
                    <CardDescription>
                      {bankAccount ? `Account: ${bankAccount.account_number || "N/A"}` : "No float account"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-2xl font-bold">{formatCurrency(bankAccount?.current_balance ?? 0)}</div>
                      {bankAccount && bankAccount.current_balance !== undefined && (
                        <div>
                          {(bankAccount.current_balance ?? 0) < (bankAccount.min_threshold ?? 0) ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 flex items-center">
                              <TrendingDown className="mr-1 h-3 w-3" /> Low
                            </Badge>
                          ) : (bankAccount.current_balance ?? 0) >
                            (bankAccount.max_threshold ?? Number.POSITIVE_INFINITY) ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 flex items-center">
                              <TrendingUp className="mr-1 h-3 w-3" /> Excess
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Optimal
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleFloatRequest(bank.code)}
                    >
                      Request Float
                    </Button>
                  </CardContent>
                </Card>
              )
            })
        )}
      </div>
    </div>
  )
}
