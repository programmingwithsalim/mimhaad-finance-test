import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"

interface BranchFilterIndicatorProps {
  isFiltered: boolean
  branchName?: string
  dataType: string
  className?: string
}

export function BranchFilterIndicator({
  isFiltered,
  branchName,
  dataType,
  className = "",
}: BranchFilterIndicatorProps) {
  if (!isFiltered) return null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Building2 className="h-3 w-3 mr-1" />
        Branch-specific {dataType}
      </Badge>
      {branchName && (
        <span className="text-sm text-muted-foreground">
          Showing data for: <strong>{branchName}</strong>
        </span>
      )}
    </div>
  )
}
