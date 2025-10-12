"use client"

import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/hooks/use-current-user"

export function BranchIndicator() {
  const { user } = useCurrentUser()

  if (!user?.branchName) {
    return null
  }

  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
      {user.branchName}
    </Badge>
  )
}

export default BranchIndicator
