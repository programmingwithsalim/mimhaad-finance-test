"use client"

import { useState } from "react"
import { Plus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { logger, LogCategory } from "@/lib/logger"

interface CashTillDepositDialogProps {
  branchId: string
  currentBalance: number
  onDepositSuccess: () => void
}

export function CashTillDepositDialog({ branchId, currentBalance, onDepositSuccess }: CashTillDepositDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleDeposit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      await logger.info(LogCategory.TRANSACTION, "Starting cash till deposit", {
        branchId,
        amount: Number(amount),
        currentBalance,
      })

      // Try the float accounts approach first
      const response = await fetch(`/api/branches/${branchId}/cash-in-till/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(amount),
          description: description || "Cash deposit",
          userId: "system", // Will be replaced with actual user ID
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        await logger.info(LogCategory.TRANSACTION, "Cash till deposit successful", {
          branchId,
          amount: Number(amount),
          newBalance: data.cashTill?.current_balance,
        })

        toast({
          title: "Deposit Successful",
          description: `Successfully added GHS ${Number(amount).toLocaleString()} to cash till`,
        })

        setIsOpen(false)
        setAmount("")
        setDescription("")
        onDepositSuccess()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to deposit")
      }
    } catch (error) {
      await logger.error(LogCategory.TRANSACTION, "Cash till deposit failed", error as Error, {
        branchId,
        amount: Number(amount),
      })

      toast({
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Failed to deposit money",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleDeposit()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Money
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Money to Cash Till</DialogTitle>
          <DialogDescription>
            Add money to the cash till for transactions. Current balance: GHS {currentBalance.toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (GHS)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyPress={handleKeyPress}
              min="0"
              step="0.01"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Reason for deposit..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {currentBalance === 0 && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Cash till is empty. Adding money will enable transactions.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleDeposit} disabled={isLoading || !amount}>
            {isLoading ? "Adding..." : "Add Money"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 