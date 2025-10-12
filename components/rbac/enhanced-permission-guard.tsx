"use client"

import type React from "react"

import type { PERMISSIONS } from "@/lib/rbac-enhanced.ts"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { useEffect } from "react"

interface EnhancedPermissionGuardProps {
  children: React.ReactNode
  requiredPermissions: PERMISSIONS[]
  redirectTo?: string
}

const EnhancedPermissionGuard: React.FC<EnhancedPermissionGuardProps> = ({
  children,
  requiredPermissions,
  redirectTo = "/unauthorized",
}) => {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return // Wait for session to load

    if (status === "unauthenticated") {
      router.push("/api/auth/signin?callbackUrl=" + encodeURIComponent(router.asPath))
      return
    }

    if (session && session.user && session.user.permissions) {
      const userPermissions = session.user.permissions as PERMISSIONS[]
      const hasRequiredPermissions = requiredPermissions.every((permission) => userPermissions.includes(permission))

      if (!hasRequiredPermissions) {
        router.push(redirectTo)
      }
    } else {
      // Handle the case where session or user or permissions are undefined
      // Possibly redirect to an error page or login
      router.push("/api/auth/signin?callbackUrl=" + encodeURIComponent(router.asPath))
    }
  }, [session, status, router, requiredPermissions, redirectTo])

  // Show a loading indicator while checking permissions
  if (status === "loading") {
    return <div>Loading...</div>
  }

  return <>{children}</>
}

export default EnhancedPermissionGuard
