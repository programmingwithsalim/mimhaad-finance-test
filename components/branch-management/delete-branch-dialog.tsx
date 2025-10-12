"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Branch } from "@/hooks/use-branches"

interface DeleteBranchDialogProps {
  branch: Branch | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  isSubmitting: boolean
}

export function DeleteBranchDialog({ branch, open, onOpenChange, onConfirm, isSubmitting }: DeleteBranchDialogProps) {
  if (!branch) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this branch?</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to delete the branch <strong>{branch.name}</strong> ({branch.code}). This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <div className="rounded-lg border p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Branch Name:</div>
              <div>{branch.name}</div>
              <div className="font-medium">Branch Code:</div>
              <div>{branch.code}</div>
              <div className="font-medium">Location:</div>
              <div>{branch.location}</div>
              <div className="font-medium">Manager:</div>
              <div>{branch.manager}</div>
              <div className="font-medium">Status:</div>
              <div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    branch.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {branch.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Branch"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
