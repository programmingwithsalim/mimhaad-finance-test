"use client"

import type React from "react"

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

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
}

let confirmResolver: ((value: boolean) => void) | null = null

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolver = resolve
    setConfirmDialog({
      isOpen: true,
      ...options,
    })
  })
}

let setConfirmDialog: (dialog: { isOpen: boolean } & ConfirmOptions) => void

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<{ isOpen: boolean } & ConfirmOptions>({
    isOpen: false,
    title: "",
    description: "",
  })

  setConfirmDialog = setDialog

  const handleConfirm = () => {
    confirmResolver?.(true)
    setDialog({ ...dialog, isOpen: false })
  }

  const handleCancel = () => {
    confirmResolver?.(false)
    setDialog({ ...dialog, isOpen: false })
  }

  return (
    <>
      {children}
      <AlertDialog open={dialog.isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>{dialog.cancelText || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{dialog.confirmText || "Confirm"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
