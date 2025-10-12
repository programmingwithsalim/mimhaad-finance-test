"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import CommissionForm from "./commission-form"

interface AddCommissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddCommissionDialog({ open, onOpenChange, onSuccess }: AddCommissionDialogProps) {

  const handleSuccess = () => {
    onOpenChange(false)
    if (onSuccess) {
      onSuccess()
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    console.log("Dialog open change:", newOpen)
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Commission</DialogTitle>
          <DialogDescription>Create a new commission entry for partner transactions</DialogDescription>
        </DialogHeader>
        <CommissionForm onSuccess={handleSuccess} />
      </DialogContent>
    </Dialog>
  )
}
