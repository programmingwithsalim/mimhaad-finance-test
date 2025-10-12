"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import type { AuditLog } from "./types"

interface AuditLogDetailsProps {
  log: AuditLog
}

export function AuditLogDetails({ log }: AuditLogDetailsProps) {
  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    } as const

    return (
      <Badge variant={variants[severity as keyof typeof variants] || "outline"} className="capitalize">
        {severity}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "success" ? "default" : "destructive"} className="capitalize">
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Audit Log #{log.id}</h3>
          <p className="text-sm text-muted-foreground">
            {format(new Date(log.timestamp), "PPP 'at' HH:mm:ss")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getSeverityBadge(log.severity)}
          {getStatusBadge(log.status)}
        </div>
      </div>

      <Separator />

      {/* User Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <p className="text-sm">{log.username}</p>
            </div>
            {log.userId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">User ID</label>
                <p className="text-sm">{log.userId}</p>
              </div>
            )}
            {log.ipAddress && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                <p className="text-sm font-mono">{log.ipAddress}</p>
              </div>
            )}
            {log.branchName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Branch</label>
                <p className="text-sm">{log.branchName}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Action Type</label>
              <p className="text-sm capitalize">{log.actionType.replace("_", " ")}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Entity Type</label>
              <p className="text-sm capitalize">{log.entityType.replace("_", " ")}</p>
            </div>
            {log.entityId && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Entity ID</label>
                <p className="text-sm font-mono">{log.entityId}</p>
              </div>
            )}
            {log.userAgent && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                <p className="text-sm text-xs truncate">{log.userAgent}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{log.description}</p>
        </CardContent>
      </Card>

      {/* Additional Details */}
      {log.details && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Details</CardTitle>
            <CardDescription>Structured data associated with this action</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {log.errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base text-red-800">Error Message</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">{log.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Related Entities */}
      {log.relatedEntities && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related Entities</CardTitle>
            <CardDescription>Other entities affected by this action</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {JSON.stringify(log.relatedEntities, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {log.metadata && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metadata</CardTitle>
            <CardDescription>Additional system metadata</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 