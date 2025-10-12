"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"

interface SessionData {
  id: string
  userId: string
  sessionToken: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  ipAddress?: string
  userAgent?: string
  isActive: boolean
  userEmail: string
  userFirstName: string
  userLastName: string
  userRole: string
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/admin/sessions")
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch sessions",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
      toast({
        title: "Error",
        description: "Failed to fetch sessions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const revokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/revoke`, {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Session revoked successfully",
        })
        fetchSessions() // Refresh the list
      } else {
        toast({
          title: "Error",
          description: "Failed to revoke session",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error revoking session:", error)
      toast({
        title: "Error",
        description: "Failed to revoke session",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div>Loading sessions...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active User Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {session.userFirstName} {session.userLastName}
                    </span>
                    <Badge variant="outline">{session.userRole}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Email: {session.userEmail}</div>
                    <div>IP: {session.ipAddress || "Unknown"}</div>
                    <div>Created: {formatDistanceToNow(new Date(session.createdAt))} ago</div>
                    <div>Last Activity: {formatDistanceToNow(new Date(session.updatedAt))} ago</div>
                    <div>Expires: {formatDistanceToNow(new Date(session.expiresAt))} from now</div>
                  </div>
                  {session.userAgent && (
                    <div className="text-xs text-gray-500 max-w-md truncate">{session.userAgent}</div>
                  )}
                </div>
                <Button variant="destructive" size="sm" onClick={() => revokeSession(session.id)}>
                  Revoke
                </Button>
              </div>
            </div>
          ))}
          {sessions.length === 0 && <div className="text-center text-gray-500 py-8">No active sessions found</div>}
        </div>
      </CardContent>
    </Card>
  )
}
