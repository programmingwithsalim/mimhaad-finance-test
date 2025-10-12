"use client"

import { createContext, useContext, type ReactNode } from "react"

// Available roles in the system
type Role = "admin" | "cashier" | "operations" | "manager" | "finance"

// Permissions mapping by role
const rolePermissions: Record<Role, string[]> = {
  admin: ["*"], // Wildcard for all permissions
  cashier: [
    "momo:process",
    "agency-banking:process",
    "e-zwich:process",
    "payments:process",
    "receipts:process",
    "till:view",
    "cash:view",
  ],
  operations: [
    "transactions:initiate",
    "transactions:verify",
    "customers:verify",
    "transactions:view",
    "transfers:small", // Under certain limit
    "float:request",
  ],
  manager: [
    "transactions:approve",
    "transfers:large",
    "transfers:approve",
    "funds:transfer",
    "wallets:transfer",
    "banks:transfer",
    "operations:override",
    "float:approve",
    "users:manage",
  ],
  finance: [
    "reports:all",
    "accounts:reconcile",
    "audit:access",
    "gl:manage",
    "financial:reports",
    "reconciliation:all",
    "statements:generate",
  ],
}

interface RBACContextType {
  hasPermission: (permission: string) => boolean
  userRole: Role | null
}

const RBACContext = createContext<RBACContextType>({
  hasPermission: () => false,
  userRole: null,
})

export function RBACProvider({
  children,
  role,
}: {
  children: ReactNode
  role: Role | null
}) {
  // Check if the user has the required permission
  const hasPermission = (permission: string): boolean => {
    if (!role) return false

    const permissions = rolePermissions[role]

    // Admin has all permissions
    if (permissions.includes("*")) return true

    // Check if the user has the specific permission
    return permissions.includes(permission)
  }

  return <RBACContext.Provider value={{ hasPermission, userRole: role }}>{children}</RBACContext.Provider>
}

export function useRBAC() {
  return useContext(RBACContext)
}

interface ProtectedProps {
  children: ReactNode
  requiredPermission: string
  fallback?: ReactNode
}

export function Protected({ children, requiredPermission, fallback }: ProtectedProps) {
  const { hasPermission } = useRBAC()

  if (!hasPermission(requiredPermission)) {
    return fallback || null
  }

  return <>{children}</>
}
