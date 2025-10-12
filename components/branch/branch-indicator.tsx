"use client"

import { Badge } from "@/components/ui/badge"
import { Building2, Globe } from "lucide-react"
import { useCurrentUser } from "@/hooks/use-current-user"

export function BranchIndicator() {
  const { user } = useCurrentUser()

  const canViewAllBranches = user?.role === "ADMIN" || user?.role === "MANAGER"
  const branchName = user?.branchName || user?.branchId || "Unknown Branch"

  if (canViewAllBranches) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
        <Globe className="mr-1 h-3 w-3" />
        All Branches
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
      <Building2 className="mr-1 h-3 w-3" />
      {branchName}
    </Badge>
  )
}
