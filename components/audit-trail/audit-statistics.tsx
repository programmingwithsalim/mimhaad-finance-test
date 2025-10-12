"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Activity,
  AlertCircle,
  Shield,
  User,
  TrendingUp,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import type { AuditStatistics as AuditStatisticsType } from "./types";

interface AuditStatisticsProps {
  statistics: AuditStatisticsType | null;
  loading: boolean;
}

export function AuditStatistics({ statistics, loading }: AuditStatisticsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  const getActionIcon = (actionType: string) => {
    if (actionType.includes("login") || actionType.includes("logout")) {
      return <User className="h-4 w-4" />;
    }
    if (actionType.includes("transaction")) {
      return <Activity className="h-4 w-4" />;
    }
    if (actionType.includes("float")) {
      return <TrendingUp className="h-4 w-4" />;
    }
    return <Shield className="h-4 w-4" />;
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline",
    } as const;

    return (
      <Badge
        variant={variants[severity as keyof typeof variants] || "outline"}
        className="capitalize"
      >
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge
        variant={status === "success" ? "default" : "destructive"}
        className="capitalize"
      >
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalLogs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Critical Events
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics.criticalEvents}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Failed Actions
            </CardTitle>
            <Shield className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {statistics.failedActions}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Users (24h)
            </CardTitle>
            <User className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.activeUsers}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Severity Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Severity Breakdown</CardTitle>
            <CardDescription>
              Distribution of log entries by severity level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(statistics.severityBreakdown).map(
              ([severity, count]) => {
                const total = Object.values(
                  statistics.severityBreakdown
                ).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={severity} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="capitalize font-medium">{severity}</span>
                      <span className="text-sm text-muted-foreground">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              }
            )}
          </CardContent>
        </Card>

        {/* Top Action Types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Action Types</CardTitle>
            <CardDescription>
              Most frequent actions in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statistics.actionTypeBreakdown)
                .slice(0, 5)
                .map(([actionType, count]) => {
                  const total = Object.values(
                    statistics.actionTypeBreakdown
                  ).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div
                      key={actionType}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        {getActionIcon(actionType)}
                        <span className="capitalize font-medium">
                          {actionType.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{count}</div>
                        <div className="text-xs text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {statistics.recentActivity && statistics.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <Clock className="mr-2 h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {statistics.recentActivity.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {activity.username?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getActionIcon(activity.actionType)}
                      <span className="font-medium">{activity.username}</span>
                      <span className="text-sm text-muted-foreground">
                        {activity.actionType.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {activity.description}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getSeverityBadge(activity.severity)}
                    {getStatusBadge(activity.status)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(activity.timestamp), "HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
