"use client"

import { useState } from "react"
import { Exchange, AlertCircle, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { logger, LogCategory } from "@/lib/logger"

interface CashTillExchangeDialogProps {
  branchId: string
  currentCashBalance: number
  onExchangeSuccess: () => void
}

interface FloatAccount {
  id: string
  account_name: string
  account_type: string
  provider: string
  current_balance: number
}

export function CashTillExchangeDialog({ branchId, currentCashBalance, onExchangeSuccess }: CashTillExchangeDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [selectedFloatAccount, setSelectedFloatAccount] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const { toast } = useToast()

  const loadFloatAccounts = async () => {
    if (!branchId) return

    setLoadingAccounts(true)
    try {
      const response = await fetch(`/api/float-accounts?branchId=${branchId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setFloatAccounts(data.accounts || [])
        }
      }
    } catch (error) {
      console.error("Error loading float accounts:", error)
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    loadFloatAccounts()
  }

  const handleExchange = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      })
      return
    }

    if (!selectedFloatAccount) {
      toast({
        title: "Select Float Account",
        description: "Please select a float account to exchange from",
        variant: "destructive",
      })
      return
    }

    const exchangeAmount = Number(amount)
    const selectedAccount = floatAccounts.find(acc => acc.id === selectedFloatAccount)

    if (selectedAccount && exchangeAmount > selectedAccount.current_balance) {
      toast({
        title: "Insufficient Balance",
        description: `Cannot exchange GHS ${exchangeAmount.toLocaleString()}. Available: GHS ${selectedAccount.current_balance.toLocaleString()}`,
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      await logger.info(LogCategory.TRANSACTION, "Starting cash till exchange", {
        branchId,
        amount: exchangeAmount,
        floatAccountId: selectedFloatAccount,
        description,
      })

      const response = await fetch(`/api/branches/${branchId}/cash-in-till/exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: exchangeAmount,
          floatAccountId: selectedFloatAccount,
          description: description || "Float to cash exchange",
          userId: "system", // Will be replaced with actual user ID
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        await logger.info(LogCategory.TRANSACTION, "Cash till exchange successful", {
          branchId,
          amount: exchangeAmount,
          newCashBalance: data.cashTill?.current_balance,
          newFloatBalance: data.floatAccount?.current_balance,
        })

        toast({
          title: "Exchange Successful",
          description: `Successfully exchanged GHS ${exchangeAmount.toLocaleString()} from ${selectedAccount?.account_name} to cash till`,
        })

        setIsOpen(false)
        setAmount("")
        setSelectedFloatAccount("")
        setDescription("")
        onExchangeSuccess()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to exchange")
      }
    } catch (error) {
      await logger.error(LogCategory.TRANSACTION, "Cash till exchange failed", error as Error, {
        branchId,
        amount: exchangeAmount,
        floatAccountId: selectedFloatAccount,
      })

      toast({
        title: "Exchange Failed",
        description: error instanceof Error ? error.message : "Failed to exchange float for cash",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleExchange()
    }
  }

  const selectedAccount = floatAccounts.find(acc => acc.id === selectedFloatAccount)
  const exchangeAmount = Number(amount) || 0

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Exchange className="h-4 w-4" />
          Exchange Float
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exchange Float for Cash</DialogTitle>
          <DialogDescription>
            Exchange money from float accounts to cash till. Current cash balance: GHS {currentCashBalance.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="float-account">Float Account</Label>
            <Select value={selectedFloatAccount} onValueChange={setSelectedFloatAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select float account" />
              </SelectTrigger>
              <SelectContent>
                {loadingAccounts ? (
                  <SelectItem value="" disabled>Loading accounts...</SelectItem>
                ) : (
                  floatAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{account.account_name}</span>
                        <span className="text-sm text-muted-foreground">
                          GHS {account.current_balance.toLocaleString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exchange-amount">Amount (GHS)</Label>
            <Input
              id="exchange-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyPress={handleKeyPress}
              min="0"
              step="0.01"
              disabled={isLoading}
            />
            {selectedAccount && (
              <p className="text-xs text-muted-foreground">
                Available: GHS {selectedAccount.current_balance.toLocaleString()}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="exchange-description">Description (Optional)</Label>
            <Textarea
              id="exchange-description"
              placeholder="Reason for exchange..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {selectedAccount && exchangeAmount > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-blue-600" />
                <div className="text-sm">
                  <div className="font-medium text-blue-800">Exchange Summary</div>
                  <div className="text-blue-700">
                    From: {selectedAccount.account_name} (GHS {selectedAccount.current_balance.toLocaleString()})
                  </div>
                  <div className="text-blue-700">
                    To: Cash Till (GHS {currentCashBalance.toLocaleString()})
                  </div>
                  <div className="text-blue-700 font-medium">
                    Amount: GHS {exchangeAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              This will reduce the float account balance and increase cash till balance.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleExchange} 
            disabled={isLoading || !amount || !selectedFloatAccount || exchangeAmount <= 0}
          >
            {isLoading ? "Exchanging..." : "Exchange"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 