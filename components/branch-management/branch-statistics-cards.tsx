import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BranchStatistics } from "@/hooks/use-branches"
import { Skeleton } from "@/components/ui/skeleton"

interface BranchStatisticsCardsProps {
  statistics: BranchStatistics
  loading: boolean
}

export function BranchStatisticsCards({ statistics, loading }: BranchStatisticsCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Get the total number of regions
  const regionCount = Object.keys(statistics.byRegion).length

  // Calculate the percentage of active branches
  const activePercentage = statistics.total > 0 ? Math.round((statistics.active / statistics.total) * 100) : 0

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.total}</div>
          <p className="text-xs text-muted-foreground">
            Across {regionCount} {regionCount === 1 ? "region" : "regions"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Active Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.active}</div>
          <p className="text-xs text-muted-foreground">{activePercentage}% of total branches</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Inactive Branches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.inactive}</div>
          <p className="text-xs text-muted-foreground">
            {statistics.total > 0 ? Math.round((statistics.inactive / statistics.total) * 100) : 0}% of total branches
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Largest Region</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(statistics.byRegion).length > 0 ? (
            <>
              <div className="text-2xl font-bold">
                {Object.entries(statistics.byRegion).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {Object.entries(statistics.byRegion).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} branches
              </p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">N/A</div>
              <p className="text-xs text-muted-foreground">No regions defined</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
