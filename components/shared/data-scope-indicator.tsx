import { Badge } from "@/components/ui/badge"
import { Globe, Building2, Shield } from "lucide-react"

interface DataScopeIndicatorProps {
  canViewAllBranches: boolean
  isFiltered: boolean
  totalCount?: number
  branchCount?: number
  dataType: string
}

export function DataScopeIndicator({
  canViewAllBranches,
  isFiltered,
  totalCount,
  branchCount,
  dataType,
}: DataScopeIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {canViewAllBranches ? (
        <div className="flex items-center gap-1">
          <Globe className="h-4 w-4" />
          <span>All branches</span>
          {totalCount !== undefined && (
            <Badge variant="secondary" className="ml-1">
              {totalCount} {dataType}
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Building2 className="h-4 w-4" />
          <span>Your branch only</span>
          {branchCount !== undefined && (
            <Badge variant="secondary" className="ml-1">
              {branchCount} {dataType}
            </Badge>
          )}
        </div>
      )}

      {!canViewAllBranches && (
        <div className="flex items-center gap-1 text-xs">
          <Shield className="h-3 w-3" />
          <span>Access restricted</span>
        </div>
      )}
    </div>
  )
}
