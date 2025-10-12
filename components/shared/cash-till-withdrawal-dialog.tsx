"use client"

import { useState } from "react"
import { Minus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { logger, LogCategory } from "@/lib/logger"

interface CashTillWithdrawalDialogProps {
  branchId: string
  currentBalance: number
  onWithdrawalSuccess: () => void
}

export function CashTillWithdrawalDialog({ branchId, currentBalance, onWithdrawalSuccess }: CashTillWithdrawalDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleWithdrawal = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      })
      return
    }

    const withdrawalAmount = Number(amount)
    if (withdrawalAmount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: `Cannot withdraw GHS ${withdrawalAmount.toLocaleString()}. Available: GHS ${currentBalance.toLocaleString()}`,
        variant: "destructive",
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for the withdrawal",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      await logger.info(LogCategory.TRANSACTION, "Starting cash till withdrawal", {
        branchId,
        amount: withdrawalAmount,
        currentBalance,
        reason,
      })

      const response = await fetch(`/api/branches/${branchId}/cash-in-till/withdrawal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: withdrawalAmount,
          reason: reason.trim(),
          userId: "system", // Will be replaced with actual user ID
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        await logger.info(LogCategory.TRANSACTION, "Cash till withdrawal successful", {
          branchId,
          amount: withdrawalAmount,
          newBalance: data.cashTill?.current_balance,
          reason,
        })

        toast({
          title: "Withdrawal Successful",
          description: `Successfully withdrew GHS ${withdrawalAmount.toLocaleString()} from cash till`,
        })

        setIsOpen(false)
        setAmount("")
        setReason("")
        onWithdrawalSuccess()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to withdraw")
      }
    } catch (error) {
      await logger.error(LogCategory.TRANSACTION, "Cash till withdrawal failed", error as Error, {
        branchId,
        amount: withdrawalAmount,
        reason,
      })

      toast({
        title: "Withdrawal Failed",
        description: error instanceof Error ? error.message : "Failed to withdraw money",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleWithdrawal()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50">
          <Minus className="h-4 w-4" />
          Withdraw
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Money from Cash Till</DialogTitle>
          <DialogDescription>
            Withdraw money from the cash till. Current balance: GHS {currentBalance.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdrawal-amount">Amount (GHS)</Label>
            <Input
              id="withdrawal-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyPress={handleKeyPress}
              min="0"
              max={currentBalance}
              step="0.01"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Maximum: GHS {currentBalance.toLocaleString()}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="withdrawal-reason">Reason *</Label>
            <Textarea
              id="withdrawal-reason"
              placeholder="Reason for withdrawal (required)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-800">
              Withdrawals are logged for audit purposes. Please provide a clear reason.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleWithdrawal} 
            disabled={isLoading || !amount || !reason.trim() || Number(amount) > currentBalance}
            variant="destructive"
          >
            {isLoading ? "Withdrawing..." : "Withdraw Money"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 