"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useCommissions } from "@/hooks/use-commissions"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Commission } from "@/lib/commission-types"
import { formatCurrency } from "@/lib/utils"

interface BulkDeleteDialogProps {
  selectedCommissions: Commission[]
  onSuccess: () => void
  disabled?: boolean
}

export function BulkDeleteDialog({ selectedCommissions, onSuccess, disabled = false }: BulkDeleteDialogProps) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const { deleteCommission } = useCommissions()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      // Process each commission deletion sequentially
      const results = await Promise.all(selectedCommissions.map((commission) => deleteCommission(commission.id)))

      const successCount = results.filter(Boolean).length

      toast({
        title: "Bulk delete successful",
        description: `Deleted ${successCount} of ${selectedCommissions.length} commissions.`,
      })

      setOpen(false)
      onSuccess()
    } catch (error) {
      console.error("Error in bulk delete:", error)
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "There was an error deleting the commissions.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Calculate total amount
  const totalAmount = selectedCommissions.reduce((sum, commission) => sum + commission.amount, 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          disabled={disabled || selectedCommissions.length === 0}
          onClick={() => setOpen(true)}
        >
          <Trash className="mr-2 h-4 w-4" />
          Bulk Delete ({selectedCommissions.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Bulk Delete Commissions</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-2">
            Are you sure you want to delete these {selectedCommissions.length} commissions? This action cannot be
            undone.
          </p>

          <div className="bg-muted p-3 rounded-md mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Total Amount:</span>
              <span className="text-sm font-bold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <ScrollArea className="h-[200px] rounded-md border p-2 mb-4">
            <div className="space-y-2">
              {selectedCommissions.map((commission) => (
                <div key={commission.id} className="text-sm border-b pb-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{commission.reference}</span>
                    <span>{formatCurrency(commission.amount)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{commission.source}</span>
                    <span className="capitalize">{commission.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : `Delete ${selectedCommissions.length} Commissions`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
