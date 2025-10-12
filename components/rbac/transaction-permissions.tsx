"use client"

import type React from "react"

import { useRBAC } from "@/hooks/use-rbac"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, LockIcon } from "lucide-react"

interface TransactionPermissionsProps {
  children: React.ReactNode
  transactionType?: string
}

export function TransactionPermissions({ children, transactionType = "transaction" }: TransactionPermissionsProps) {
  const { can, role } = useRBAC()

  const canCreate = can("create_transaction")
  const canView = can("view_transactions")

  if (!canView) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <LockIcon className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          You don't have permission to view {transactionType}s.
        </AlertDescription>
      </Alert>
    )
  }

  if (!canCreate && role === "cashier") {
    return (
      <div className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <InfoIcon className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            As a cashier, you can view {transactionType}s but cannot create or modify them. Contact operations or
            management for transaction processing.
          </AlertDescription>
        </Alert>
        {children}
      </div>
    )
  }

  return <>{children}</>
}
