"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AuditLog, PaginationInfo } from "./types";

interface AuditLogTableProps {
  logs: AuditLog[];
  loading: boolean;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onLogClick: (log: AuditLog) => void;
  selectedLog: AuditLog | null;
}

export function AuditLogTable({
  logs,
  loading,
  pagination,
  onPageChange,
  onLogClick,
  selectedLog,
}: AuditLogTableProps) {
  const [pageSize, setPageSize] = useState(pagination.limit);

  const getActionIcon = (actionType: string) => {
    if (actionType.includes("login") || actionType.includes("logout")) {
      return (
        <AvatarFallback className="bg-blue-100 text-blue-600">A</AvatarFallback>
      );
    }
    if (actionType.includes("transaction")) {
      return (
        <AvatarFallback className="bg-green-100 text-green-600">
          T
        </AvatarFallback>
      );
    }
    if (actionType.includes("float")) {
      return (
        <AvatarFallback className="bg-purple-100 text-purple-600">
          F
        </AvatarFallback>
      );
    }
    return (
      <AvatarFallback className="bg-gray-100 text-gray-600">S</AvatarFallback>
    );
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

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: format(date, "MMM dd, yyyy"),
      time: format(date, "HH:mm:ss"),
    };
  };

  // Ensure logs is always an array
  const safeLogs = Array.isArray(logs) ? logs : [];

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (safeLogs.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No audit logs found</h3>
        <p className="mt-2 text-muted-foreground">
          No audit logs have been recorded yet or match your current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User & Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeLogs.map((log) => {
              const { date, time } = formatTimestamp(log.timestamp);
              return (
                <TableRow key={log.id} className="hover:bg-muted/50 group">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        {getActionIcon(log.actionType)}
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {log.username}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {date}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {time}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium capitalize">
                        {log.actionType.replace("_", " ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {log.entityType.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="text-sm truncate">{log.description}</p>
                      {log.branchName && (
                        <p className="text-xs text-muted-foreground">
                          Branch: {log.branchName}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => onLogClick(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Rows per page:
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} entries
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
