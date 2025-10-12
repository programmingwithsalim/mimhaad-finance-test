"use client"

import type { ReactNode } from "react"
import { useRBAC } from "@/hooks/use-rbac"

interface WithPermissionProps {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}

export function WithPermission({ permission, children, fallback = null }: WithPermissionProps) {
  const { hasPermission, loading } = useRBAC()

  if (loading) {
    return <div className="text-sm text-muted-foreground">Checking permissions...</div>
  }

  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>
}
