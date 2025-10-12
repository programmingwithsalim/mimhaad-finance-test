"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface Commission {
  id: string
  source: string
  sourceName: string
  reference: string
  month: string
  amount: number
  status: string
  description?: string
  notes?: string
}

interface EditCommissionDialogProps {
  commission: Commission | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditCommissionDialog({ commission, open, onOpenChange, onSuccess }: EditCommissionDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    amount: 0,
    description: "",
    notes: "",
  })

  useEffect(() => {
    if (commission) {
      setFormData({
        amount: commission.amount,
        description: commission.description || "",
        notes: commission.notes || "",
      })
    }
  }, [commission])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commission) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/commissions/${commission.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to update commission")
      }

      toast({
        title: "Commission Updated",
        description: "Commission has been updated successfully.",
      })

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update commission.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Commission</DialogTitle>
          <DialogDescription>Update commission details for {commission?.reference}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: Number.parseFloat(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
