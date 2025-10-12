"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface Commission {
  id: string
  reference: string
  amount: number
}

interface DeleteCommissionDialogProps {
  commission: Commission | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function DeleteCommissionDialog({ commission, open, onOpenChange, onSuccess }: DeleteCommissionDialogProps) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!commission) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/commissions/${commission.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete commission")
      }

      toast({
        title: "Commission Deleted",
        description: `Commission ${commission.reference} has been deleted.`,
      })

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete commission.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Commission</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete commission {commission?.reference}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
