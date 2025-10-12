"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Users, MapPin, AlertCircle, UserCheck, TrendingUp } from "lucide-react"

interface BranchStatistics {
  total: number
  active: number
  inactive: number
  totalStaff: number
  uniqueManagers: number
  totalRegions: number
  avgStaffPerBranch: number
  topRegion: {
    name: string
    branchCount: number
    staffCount: number
  } | null
  regionDistribution: Array<{
    name: string
    branchCount: number
    staffCount: number
  }>
  staffDistribution: Array<{
    branchName: string
    staffCount: number
    manager: string
  }>
}

interface BranchStatisticsProps {
  refreshTrigger?: number
}

export function BranchStatisticsEnhanced({ refreshTrigger = 0 }: BranchStatisticsProps) {
  const [statistics, setStatistics] = useState<BranchStatistics>({
    total: 0,
    active: 0,
    inactive: 0,
    totalStaff: 0,
    uniqueManagers: 0,
    totalRegions: 0,
    avgStaffPerBranch: 0,
    topRegion: null,
    regionDistribution: [],
    staffDistribution: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStatistics() {
      setLoading(true)
      setError(null)

      try {
        console.log("Fetching enhanced branch statistics...")
        const response = await fetch("/api/branches/statistics")

        if (!response.ok) {
          throw new Error(`Failed to fetch statistics: ${response.statusText}`)
        }

        const result = await response.json()
        console.log("Enhanced branch statistics:", result)

        if (result.success) {
          setStatistics(result.data)
        } else {
          throw new Error(result.error || "Failed to fetch statistics")
        }
      } catch (err) {
        console.error("Error fetching branch statistics:", err)
        setError(err instanceof Error ? err.message : "Failed to load statistics")
        // Keep default values on error
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [refreshTrigger])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              <div className="h-4 w-4 rounded-full bg-muted"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 rounded bg-muted"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="flex items-center justify-center p-4">
            <AlertCircle className="mr-2 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-600 dark:text-yellow-400">{error}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.active} active, {statistics.inactive} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalStaff}</div>
            <p className="text-xs text-muted-foreground">Across {statistics.active} active branches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Managers</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.uniqueManagers}</div>
            <p className="text-xs text-muted-foreground">Managing {statistics.active} branches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Staff per Branch</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.avgStaffPerBranch}</div>
            <p className="text-xs text-muted-foreground">Staff distribution average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Region</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{statistics.topRegion?.name || "None"}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.topRegion?.branchCount || 0} branches, {statistics.topRegion?.staffCount || 0} staff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Regions</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalRegions}</div>
            <p className="text-xs text-muted-foreground">Geographic coverage</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Distribution Details */}
      {statistics.staffDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Staff Distribution by Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.staffDistribution.slice(0, 5).map((branch, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <div>
                    <span className="font-medium">{branch.branchName}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      Manager: {branch.manager || "Not assigned"}
                    </span>
                  </div>
                  <span className="font-bold">{branch.staffCount} staff</span>
                </div>
              ))}
              {statistics.staffDistribution.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {statistics.staffDistribution.length - 5} more branches...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Region Distribution Details */}
      {statistics.regionDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Regional Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.regionDistribution.map((region, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="font-medium capitalize">{region.name}</span>
                  <div className="text-right">
                    <div className="font-bold">{region.branchCount} branches</div>
                    <div className="text-sm text-muted-foreground">{region.staffCount} staff</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
