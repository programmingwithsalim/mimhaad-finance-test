"use client"

import type { ReactNode } from "react"

interface WithRoleCheckProps {
  children: ReactNode
  allowedRoles: string[]
  fallback?: ReactNode
}

export function WithRoleCheck({ children, allowedRoles, fallback = null }: WithRoleCheckProps) {
  // In a real application, you would get the user's role from your auth context
  // For this demo, we'll assume the user is an admin
  const userRole = "Admin"

  if (allowedRoles.includes(userRole)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
