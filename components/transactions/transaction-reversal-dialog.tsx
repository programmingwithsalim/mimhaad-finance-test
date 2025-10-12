"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useCurrentUser } from "@/hooks/use-current-user"

interface TransactionReversalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: {
    id: string
    amount?: number
    fee?: number
    customer_name?: string
    phone_number?: string
    service_type?: string
    branch_id?: string
  } | null
  onSuccess?: () => void
}

export function TransactionReversalDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: TransactionReversalDialogProps) {
  const { toast } = useToast()
  const { user } = useCurrentUser()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    reversal_type: "",
    reason: "",
    additional_notes: "",
  })

  // Check if user has permission to request reversals - case insensitive
  const userRole = user?.role?.toLowerCase() || ""
  const canRequestReversals = userRole === "admin" || userRole === "manager" || userRole === "finance"

  console.log("User role:", user?.role, "Normalized:", userRole, "Can request reversals:", canRequestReversals)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canRequestReversals) {
      toast({
        title: "Permission Denied",
        description: "You do not have permission to request transaction reversals.",
        variant: "destructive",
      })
      return
    }

    if (!formData.reversal_type || !formData.reason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    if (!transaction?.id) {
      toast({
        title: "Error",
        description: "No transaction selected for reversal.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/transactions/reversals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: transaction.id,
          service_type: safeTransaction.service_type,
          reversal_type: formData.reversal_type,
          reason: formData.reason,
          additional_notes: formData.additional_notes,
          requested_by: user?.id || "current-user",
          branch_id: transaction.branch_id || user?.branchId || "default-branch",
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Reversal Requested",
          description: "Transaction reversal request has been submitted successfully.",
        })

        // Reset form
        setFormData({
          reversal_type: "",
          reason: "",
          additional_notes: "",
        })

        onOpenChange(false)
        onSuccess?.()
      } else {
        throw new Error(result.error || "Failed to submit reversal request")
      }
    } catch (error) {
      console.error("Error submitting reversal request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit reversal request",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Safe access to transaction properties with proper null checks
  const safeTransaction = {
    id: transaction?.id || "N/A",
    amount: Number(transaction?.amount || 0),
    fee: Number(transaction?.fee || 0),
    customer_name: transaction?.customer_name || "Unknown",
    phone_number: transaction?.phone_number || "N/A",
    service_type: transaction?.service_type || "momo",
    branch_id: transaction?.branch_id || "N/A",
  }

  // Safe string formatting function
  const formatServiceType = (serviceType: string): string => {
    if (!serviceType || typeof serviceType !== "string") {
      return "TRANSACTION"
    }
    return serviceType.toUpperCase()
  }

  // Early return if no transaction
  if (!transaction) {
    return null
  }

  if (!canRequestReversals) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Permission Denied
            </DialogTitle>
            <DialogDescription>
              You do not have permission to request transaction reversals. Please contact your administrator.
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Current role: {user?.role || "Unknown"} | Required: Admin, Manager, or Finance
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request Transaction Reversal</DialogTitle>
          <DialogDescription>
            Submit a request to reverse this {formatServiceType(safeTransaction.service_type)} transaction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction Details */}
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="font-medium">Transaction Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">ID:</span> {safeTransaction.id}
              </div>
              <div>
                <span className="text-muted-foreground">Service:</span>{" "}
                {formatServiceType(safeTransaction.service_type)}
              </div>
              <div>
                <span className="text-muted-foreground">Amount:</span> GHS {safeTransaction.amount.toFixed(2)}
              </div>
              <div>
                <span className="text-muted-foreground">Customer:</span> {safeTransaction.customer_name}
              </div>
            </div>
          </div>

          {/* Reversal Type */}
          <div className="space-y-2">
            <Label htmlFor="reversal_type">
              Reversal Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.reversal_type}
              onValueChange={(value) => setFormData({ ...formData, reversal_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reversal type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Reversal</SelectItem>
                <SelectItem value="partial">Partial Reversal</SelectItem>
                <SelectItem value="fee_only">Fee Only Reversal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for Reversal <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer_request">Customer Request</SelectItem>
                <SelectItem value="system_error">System Error</SelectItem>
                <SelectItem value="duplicate_transaction">Duplicate Transaction</SelectItem>
                <SelectItem value="incorrect_amount">Incorrect Amount</SelectItem>
                <SelectItem value="fraud_prevention">Fraud Prevention</SelectItem>
                <SelectItem value="technical_issue">Technical Issue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="additional_notes">Additional Notes</Label>
            <Textarea
              id="additional_notes"
              placeholder="Provide additional details about the reversal request..."
              value={formData.additional_notes}
              onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
