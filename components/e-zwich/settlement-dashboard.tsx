"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/use-current-user"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, DollarSign, Clock, CheckCircle } from "lucide-react"

interface PendingWithdrawal {
  id: string
  amount: number
  customer_name: string
  card_number: string
  created_at: string
}

interface PartnerAccount {
  id: string
  bank_name: string
  account_number: string
  account_name: string
}

export function SettlementDashboard() {
  const { toast } = useToast()
  const { user } = useCurrentUser()
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([])
  const [partnerAccounts, setPartnerAccounts] = useState<PartnerAccount[]>([])
  const [selectedPartnerAccount, setSelectedPartnerAccount] = useState("")
  const [reference, setReference] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const totalPendingAmount = pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0)

  useEffect(() => {
    if (user?.branchId) {
      loadPendingWithdrawals()
      loadPartnerAccounts()
    }
  }, [user?.branchId])

  const loadPendingWithdrawals = async () => {
    if (!user?.branchId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/e-zwich/withdrawals?branchId=${user.branchId}&status=pending`)
      if (response.ok) {
        const data = await response.json()
        setPendingWithdrawals(data.withdrawals || [])
      }
    } catch (error) {
      console.error("Error loading pending withdrawals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPartnerAccounts = async () => {
    if (!user?.branchId) return

    try {
      const response = await fetch(`/api/e-zwich/partner-accounts?branchId=${user.branchId}`)
      if (response.ok) {
        const data = await response.json()
        setPartnerAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error("Error loading partner accounts:", error)
    }
  }

  const processSettlement = async () => {
    if (!selectedPartnerAccount || !user?.branchId || totalPendingAmount <= 0) {
      toast({
        title: "Error",
        description: "Please select a partner account and ensure there are pending withdrawals",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch("/api/e-zwich/settlement/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: user.branchId,
          partnerAccountId: selectedPartnerAccount,
          amount: totalPendingAmount,
          reference: reference || `End-of-day settlement ${new Date().toISOString().split("T")[0]}`,
          processedBy: user.name || user.email,
          userId: user.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Settlement Processed",
          description: result.message,
        })

        // Refresh data
        loadPendingWithdrawals()
        setSelectedPartnerAccount("")
        setReference("")
      } else {
        toast({
          title: "Settlement Failed",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error processing settlement:", error)
      toast({
        title: "Error",
        description: "Failed to process settlement",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">E-Zwich Settlement</h2>
          <p className="text-muted-foreground">Process end-of-day settlements for E-Zwich withdrawals</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingWithdrawals.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting settlement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPendingAmount.toLocaleString("en-GH", { style: "currency", currency: "GHS" })}
            </div>
            <p className="text-xs text-muted-foreground">To be settled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Accounts</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partnerAccounts.length}</div>
            <p className="text-xs text-muted-foreground">Available for settlement</p>
          </CardContent>
        </Card>
      </div>

      {/* Settlement Form */}
      {totalPendingAmount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Process Settlement</CardTitle>
            <CardDescription>
              Select a partner account to settle {pendingWithdrawals.length} pending withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Partner Account *</label>
                <Select value={selectedPartnerAccount} onValueChange={setSelectedPartnerAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner account" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bank_name} - {account.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Settlement Amount</label>
                <Input value={totalPendingAmount.toFixed(2)} disabled className="bg-gray-50" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Reference (Optional)</label>
              <Textarea
                placeholder="Enter settlement reference or notes"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              onClick={processSettlement}
              disabled={!selectedPartnerAccount || isProcessing || totalPendingAmount <= 0}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Settlement...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Process Settlement ({totalPendingAmount.toFixed(2)} GHS)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Withdrawals List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Withdrawals</CardTitle>
          <CardDescription>E-Zwich withdrawals awaiting settlement</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading withdrawals...</span>
            </div>
          ) : pendingWithdrawals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No pending withdrawals found</div>
          ) : (
            <div className="space-y-2">
              {pendingWithdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{withdrawal.customer_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Card: {withdrawal.card_number} • {new Date(withdrawal.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {Number(withdrawal.amount).toLocaleString("en-GH", { style: "currency", currency: "GHS" })}
                    </div>
                    <Badge variant="outline">Pending</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
