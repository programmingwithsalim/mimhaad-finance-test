"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, Building } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface UserStatisticsProps {
  refreshTrigger?: number
}

interface StatisticsData {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  roleCounts: Record<string, number>
  branchCounts: Record<string, number>
}

export function UserStatistics({ refreshTrigger = 0 }: UserStatisticsProps) {
  const [statistics, setStatistics] = useState<StatisticsData>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    roleCounts: {},
    branchCounts: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStatistics() {
      setLoading(true)
      setError(null)

      try {
        // Add a timestamp to prevent caching
        const response = await fetch(`/api/users/statistics?t=${Date.now()}`)

        if (!response.ok) {
          console.error("Statistics API response not OK:", response.status, response.statusText)
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        setStatistics(data)
      } catch (err) {
        console.error("Error fetching user statistics:", err)
        setError("Failed to load statistics. Using default values.")
        // Keep using the default values set in useState
      } finally {
        setLoading(false)
      }
    }

    fetchStatistics()
  }, [refreshTrigger]) // Re-fetch when refreshTrigger changes

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
    <>
      {error && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.activeUsers} active, {statistics.inactiveUsers} inactive
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.totalUsers > 0 ? Math.round((statistics.activeUsers / statistics.totalUsers) * 100) : 0}% of
              total users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Role</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {Object.entries(statistics.roleCounts || {}).length > 0
                ? Object.entries(statistics.roleCounts)
                    .sort((a, b) => b[1] - a[1])[0]?.[0]
                    ?.replace("-", " ") || "None"
                : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              {Object.entries(statistics.roleCounts || {}).length > 0
                ? Object.entries(statistics.roleCounts).sort((a, b) => b[1] - a[1])[0]?.[1] || 0
                : 0}{" "}
              users
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Branch Distribution</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(statistics.branchCounts || {}).length || 0}</div>
            <p className="text-xs text-muted-foreground">Branches with assigned users</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
