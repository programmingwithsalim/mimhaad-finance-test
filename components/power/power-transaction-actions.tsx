"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

interface PowerTransaction {
  id: string
  reference: string
  meterNumber: string
  provider: string
  amount: number
  customerName?: string
  customerPhone?: string
  status: string
  createdAt: string
}

interface PowerTransactionActionsProps {
  transaction: PowerTransaction
  onEdit: (transaction: PowerTransaction) => void
  onDelete: (transactionId: string) => void
  onView: (transaction: PowerTransaction) => void
}

export function PowerTransactionActions({ transaction, onEdit, onDelete, onView }: PowerTransactionActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit(transaction)
  }

  const handleView = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onView(transaction)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/power/transactions/${transaction.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete transaction")
      }

      toast({
        title: "Transaction Deleted",
        description: `Power transaction ${transaction.reference} has been deleted successfully.`,
      })

      onDelete(transaction.id)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error("Error deleting transaction:", error)
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete transaction",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleView}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Transaction
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDeleteClick} className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Transaction
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Power Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this power transaction? This action cannot be undone.
              <br />
              <br />
              <strong>Transaction Details:</strong>
              <br />
              Reference: {transaction.reference}
              <br />
              Meter: {transaction.meterNumber}
              <br />
              Amount: GHS {transaction.amount.toFixed(2)}
              <br />
              Customer: {transaction.customerName || "N/A"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
