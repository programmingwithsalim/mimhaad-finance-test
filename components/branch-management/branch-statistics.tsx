"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Users, MapPin, AlertCircle } from "lucide-react"

interface BranchStatistics {
  totalBranches: number
  activeBranches: number
  inactiveBranches: number
  regionCounts: Record<string, number>
  totalStaff: number
}

interface BranchStatisticsProps {
  refreshTrigger?: number
}

export function BranchStatistics({ refreshTrigger = 0 }: BranchStatisticsProps) {
  const [statistics, setStatistics] = useState<BranchStatistics>({
    totalBranches: 0,
    activeBranches: 0,
    inactiveBranches: 0,
    regionCounts: {},
    totalStaff: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStatistics() {
      setLoading(true)
      setError(null)

      try {
        // Mock data for demonstration
        // In a real app, this would be an API call
        const mockStatistics = {
          totalBranches: 5,
          activeBranches: 4,
          inactiveBranches: 1,
          regionCounts: {
            "greater-accra": 2,
            ashanti: 1,
            western: 1,
            northern: 1,
          },
          totalStaff: 45,
        }

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500))

        setStatistics(mockStatistics)
      } catch (err) {
        console.error("Error fetching branch statistics:", err)
        setError("Failed to load statistics. Using default values.")
        // Use default values on error
        setStatistics({
          totalBranches: 0,
          activeBranches: 0,
          inactiveBranches: 0,
          regionCounts: {},
          totalStaff: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [refreshTrigger]) // Re-fetch when refreshTrigger changes

  // Find top region
  const topRegion =
    Object.entries(statistics.regionCounts || {}).length > 0
      ? Object.entries(statistics.regionCounts).sort((a, b) => b[1] - a[1])[0]
      : ["none", 0]

  // Calculate average staff per branch
  const avgStaffPerBranch =
    statistics.totalBranches > 0 ? Math.round((statistics.totalStaff / statistics.totalBranches) * 10) / 10 : 0

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {error && (
        <Card className="md:col-span-2 lg:col-span-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="flex items-center justify-center p-4">
            <AlertCircle className="mr-2 h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-600 dark:text-yellow-400">{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
          <Building className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.totalBranches}</div>
          <p className="text-xs text-muted-foreground">
            {statistics.activeBranches} active, {statistics.inactiveBranches} inactive
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
          <p className="text-xs text-muted-foreground">Across all branches</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Region</CardTitle>
          <MapPin className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold capitalize">
            {topRegion[0] === "none" ? "None" : topRegion[0].replace("-", " ")}
          </div>
          <p className="text-xs text-muted-foreground">{topRegion[1]} branches</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg. Staff per Branch</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgStaffPerBranch}</div>
          <p className="text-xs text-muted-foreground">Staff distribution</p>
        </CardContent>
      </Card>
    </div>
  )
}
