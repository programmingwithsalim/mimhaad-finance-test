"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/use-current-user"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, DollarSign, ArrowRight, Building2, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PartnerAccount {
  id: string
  bank_name: string
  account_number: string
  account_name: string
  current_balance: number
  provider: string
}

interface EzwichSettlementAccount {
  id: string
  current_balance: number
  account_type: string
}

export function EnhancedSettlementDashboard() {
  const { toast } = useToast()
  const { user } = useCurrentUser()
  const [partnerAccounts, setPartnerAccounts] = useState<PartnerAccount[]>([])
  const [ezwichAccounts, setEzwichAccounts] = useState<EzwichSettlementAccount[]>([])
  const [selectedPartnerAccount, setSelectedPartnerAccount] = useState("")
  const [selectedEzwichAccount, setSelectedEzwichAccount] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [reference, setReference] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isTransferring, setIsTransferring] = useState(false)

  const selectedEzwichAccountData = ezwichAccounts.find((acc) => acc.id === selectedEzwichAccount)
  const availableBalance = selectedEzwichAccountData?.current_balance || 0

  useEffect(() => {
    if (user?.branchId) {
      loadData()
    }
  }, [user?.branchId])

  const loadData = async () => {
    setIsLoading(true)
    await Promise.all([loadPartnerAccounts(), loadEzwichAccounts()])
    setIsLoading(false)
  }

  const loadPartnerAccounts = async () => {
    if (!user?.branchId) return

    try {
      // Load float accounts that are E-Zwich partners
      const response = await fetch(`/api/float-accounts?branchId=${user.branchId}`)
      if (response.ok) {
        const data = await response.json()
        console.log("Float accounts data:", data)

        // Filter for E-Zwich partner accounts (agency banking accounts that are E-Zwich partners)
        const ezwichPartners =
          data.data?.filter((acc: any) => acc.account_type === "agency-banking" && acc.isezwichpartner === true) || []

        console.log("E-Zwich partner accounts:", ezwichPartners)

        setPartnerAccounts(
          ezwichPartners.map((acc: any) => ({
            id: acc.id,
            bank_name: acc.provider || "Unknown Bank",
            account_number: acc.account_number || "",
            account_name: `${acc.provider || "Unknown"} - ${acc.account_number || "N/A"}`,
            current_balance: Number(acc.current_balance || 0),
            provider: acc.provider || "Unknown",
          })),
        )
      }
    } catch (error) {
      console.error("Error loading partner accounts:", error)
      toast({
        title: "Error",
        description: "Failed to load partner accounts",
        variant: "destructive",
      })
    }
  }

  const loadEzwichAccounts = async () => {
    if (!user?.branchId) return

    try {
      const response = await fetch(`/api/float-accounts?branchId=${user.branchId}`)
      if (response.ok) {
        const data = await response.json()
        const ezwichAccounts = data.data?.filter((acc: any) => acc.account_type === "e-zwich") || []

        setEzwichAccounts(
          ezwichAccounts.map((acc: any) => ({
            id: acc.id,
            current_balance: Number(acc.current_balance || 0),
            account_type: acc.account_type,
          })),
        )
      }
    } catch (error) {
      console.error("Error loading E-Zwich accounts:", error)
      toast({
        title: "Error",
        description: "Failed to load E-Zwich accounts",
        variant: "destructive",
      })
    }
  }

  const transferToPartnerAccount = async () => {
    if (!selectedEzwichAccount || !selectedPartnerAccount || !transferAmount) {
      toast({
        title: "Error",
        description: "Please select both accounts and enter transfer amount",
        variant: "destructive",
      })
      return
    }

    const amount = Number(transferAmount)
    if (amount <= 0 || amount > availableBalance) {
      toast({
        title: "Error",
        description: "Invalid transfer amount or insufficient balance",
        variant: "destructive",
      })
      return
    }

    setIsTransferring(true)
    try {
      const response = await fetch("/api/e-zwich/settlement/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromAccountId: selectedEzwichAccount,
          toAccountId: selectedPartnerAccount,
          amount: amount,
          reference: reference || `E-Zwich to Partner transfer ${new Date().toISOString().split("T")[0]}`,
          processedBy: user?.name || user?.email,
          userId: user?.id,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Transfer Successful",
          description: `GHS ${amount.toFixed(2)} transferred successfully`,
        })

        // Refresh data and reset form
        await loadData()
        setTransferAmount("")
        setSelectedEzwichAccount("")
        setSelectedPartnerAccount("")
        setReference("")
      } else {
        toast({
          title: "Transfer Failed",
          description: result.error || "Failed to process transfer",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error processing transfer:", error)
      toast({
        title: "Error",
        description: "Failed to process transfer",
        variant: "destructive",
      })
    } finally {
      setIsTransferring(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading settlement dashboard...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">E-Zwich Settlement Dashboard</h2>
          <p className="text-muted-foreground">Manage E-Zwich account transfers and settlements</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">E-Zwich Balance</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {ezwichAccounts.reduce((sum, acc) => sum + acc.current_balance, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Available for transfer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Banks</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partnerAccounts.length}</div>
            <p className="text-xs text-muted-foreground">Available for settlement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partner Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {partnerAccounts.reduce((sum, acc) => sum + acc.current_balance, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">In partner accounts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manual-transfer" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual-transfer">Manual Transfer</TabsTrigger>
          <TabsTrigger value="settlement-history">Settlement History</TabsTrigger>
        </TabsList>

        <TabsContent value="manual-transfer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transfer E-Zwich Balance to Partner Account</CardTitle>
              <CardDescription>
                Transfer funds from E-Zwich settlement account to agency partner account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {ezwichAccounts.length === 0 && partnerAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No E-Zwich or partner accounts found for this branch</p>
                  <p className="text-sm">Please set up accounts first</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* From Account */}
                    <div className="space-y-2">
                      <Label htmlFor="from-account">From E-Zwich Account *</Label>
                      <Select value={selectedEzwichAccount} onValueChange={setSelectedEzwichAccount}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select E-Zwich account" />
                        </SelectTrigger>
                        <SelectContent>
                          {ezwichAccounts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No E-Zwich accounts found
                            </SelectItem>
                          ) : (
                            ezwichAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                E-Zwich Settlement - GHS {account.current_balance.toFixed(2)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {selectedEzwichAccountData && (
                        <p className="text-sm text-muted-foreground">Available: GHS {availableBalance.toFixed(2)}</p>
                      )}
                    </div>

                    {/* To Account */}
                    <div className="space-y-2">
                      <Label htmlFor="to-account">To Partner Account *</Label>
                      <Select value={selectedPartnerAccount} onValueChange={setSelectedPartnerAccount}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner account" />
                        </SelectTrigger>
                        <SelectContent>
                          {partnerAccounts.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No partner accounts found
                            </SelectItem>
                          ) : (
                            partnerAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <div className="flex flex-col">
                                  <span>{account.account_name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Balance: GHS {account.current_balance.toFixed(2)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ArrowRight className="h-4 w-4" />
                      <span className="text-sm">Transfer</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Amount */}
                    <div className="space-y-2">
                      <Label htmlFor="amount">Transfer Amount (GHS) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        max={availableBalance}
                        placeholder="0.00"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                      />
                      {selectedEzwichAccountData && Number(transferAmount) > availableBalance && (
                        <p className="text-sm text-red-600">Amount exceeds available balance</p>
                      )}
                    </div>

                    {/* Reference */}
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference (Optional)</Label>
                      <Input
                        id="reference"
                        placeholder="Enter transfer reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={transferToPartnerAccount}
                      disabled={
                        !selectedEzwichAccount ||
                        !selectedPartnerAccount ||
                        !transferAmount ||
                        Number(transferAmount) <= 0 ||
                        Number(transferAmount) > availableBalance ||
                        isTransferring
                      }
                      className="w-full"
                      size="lg"
                    >
                      {isTransferring ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Transfer...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Transfer GHS {transferAmount || "0.00"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlement-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settlement History</CardTitle>
              <CardDescription>View all E-Zwich settlement transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Settlement history will be displayed here</p>
                <p className="text-sm">Recent transfers and settlements</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
