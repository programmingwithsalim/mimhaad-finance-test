"use client"

import { useState } from "react"
import { Search, Calendar, AlertCircle, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { mockActivityLogs } from "@/components/user-management/mock-data"

interface UserActivityLogsProps {
  userId: string
}

export function UserActivityLogs({ userId }: UserActivityLogsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activityFilter, setActivityFilter] = useState<string>("")

  // Get user activity logs
  const userLogs = mockActivityLogs.filter((log) => log.userId === userId)

  // Apply filters
  const filteredLogs = userLogs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.module.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesActivityType = !activityFilter || log.activityType === activityFilter

    return matchesSearch && matchesActivityType
  })

  // Get unique activity types for filter
  const uniqueActivityTypes = [...new Set(userLogs.map((log) => log.activityType))]

  // Get activity type badge
  const getActivityTypeBadge = (type: string) => {
    switch (type) {
      case "LOGIN":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
            Login
          </Badge>
        )
      case "TRANSACTION":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
            Transaction
          </Badge>
        )
      case "CONFIGURATION":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-50">
            Configuration
          </Badge>
        )
      case "USER_MANAGEMENT":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 hover:bg-amber-50">
            User Management
          </Badge>
        )
      case "ERROR":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
            Error
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  // No logs message
  if (userLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Activity Logs Found</h3>
        <p className="text-muted-foreground mt-2">This user has no recorded activity in the system.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activity logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All activities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activities</SelectItem>
            {uniqueActivityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            setSearchQuery("")
            setActivityFilter("")
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="border-b px-4 py-2 text-left text-sm font-medium">Timestamp</th>
                <th className="border-b px-4 py-2 text-left text-sm font-medium">Module</th>
                <th className="border-b px-4 py-2 text-left text-sm font-medium">Activity</th>
                <th className="border-b px-4 py-2 text-left text-sm font-medium">Description</th>
                <th className="border-b px-4 py-2 text-left text-sm font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">{log.module}</td>
                    <td className="px-4 py-2 text-sm">{getActivityTypeBadge(log.activityType)}</td>
                    <td className="px-4 py-2 text-sm">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">
                              {log.description.length > 50 ? `${log.description.substring(0, 50)}...` : log.description}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{log.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="px-4 py-2 text-sm">{log.ipAddress}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="h-32 text-center text-muted-foreground">
                    No matching activity logs found. Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filteredLogs.length} of {userLogs.length} activities
      </div>
    </div>
  )
}
