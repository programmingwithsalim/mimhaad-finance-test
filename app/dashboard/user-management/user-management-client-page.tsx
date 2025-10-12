"use client"

import { Suspense } from "react"
import { UserManagementDashboard } from "@/components/user-management/user-management-dashboard"
import { UserManagementSkeleton } from "@/components/user-management/user-management-skeleton"
import { ErrorBoundary } from "@/components/error-boundary"

// Simple type definitions
type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  branch: string
  status: string
  createdAt: string
}

type Branch = {
  id: string
  name: string
  location: string
  manager: string
}

export default function UserManagementClientPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Manage users, roles, and branch assignments in the system.</p>
      </div>

      <ErrorBoundary>
        <Suspense fallback={<UserManagementSkeleton />}>
          <UserManagementDashboard />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
