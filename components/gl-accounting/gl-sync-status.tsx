"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface SyncStatus {
  module: string
  lastSyncTime: string
  recordsProcessed: number
  recordsSucceeded: number
  recordsFailed: number
  status: "success" | "failed" | "partial"
  error?: string
}

export function GLSyncStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  // Fetch sync status on component mount
  useEffect(() => {
    fetchSyncStatus()
  }, [])

  // Fetch sync status from API
  const fetchSyncStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/gl/sync/status")

      if (!response.ok) {
        throw new Error("Failed to fetch sync status")
      }

      const data = await response.json()
      setSyncStatus(data.status || [])
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error fetching sync status:", error)
      toast({
        title: "Error",
        description: "Failed to fetch GL sync status",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Trigger manual sync
  const triggerSync = async (module?: string) => {
    try {
      setLoading(true)

      const url = module ? `/api/gl/sync?module=${module}` : "/api/gl/sync"
      const response = await fetch(url, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Failed to sync ${module || "all modules"}`)
      }

      const data = await response.json()

      toast({
        title: "Sync Completed",
        description: `Synced ${data.recordsSucceeded} records successfully`,
        variant: "default",
      })

      // Refresh sync status
      fetchSyncStatus()
    } catch (error) {
      console.error("Error triggering sync:", error)
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync with GL",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>
      case "partial":
        return <Badge className="bg-yellow-500">Partial</Badge>
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>
      default:
        return <Badge>Unknown</Badge>
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>GL Sync Status</span>
          <Button variant="outline" size="sm" onClick={() => fetchSyncStatus()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Status of GL synchronization with transaction modules
          {lastUpdated && <span className="block text-xs mt-1">Last updated: {lastUpdated.toLocaleString()}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {syncStatus.length === 0 && !loading ? (
            <div className="text-center py-4 text-muted-foreground">No sync data available</div>
          ) : (
            syncStatus.map((status) => (
              <div key={status.module} className="flex items-center justify-between border-b pb-3">
                <div>
                  <div className="font-medium">{status.module}</div>
                  <div className="text-sm text-muted-foreground">Last sync: {formatDate(status.lastSyncTime)}</div>
                  <div className="text-sm">
                    {status.recordsSucceeded} of {status.recordsProcessed} records synced
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(status.status)}
                  <Button variant="ghost" size="sm" onClick={() => triggerSync(status.module)} disabled={loading}>
                    Sync
                  </Button>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={() => triggerSync()} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync All Modules
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
