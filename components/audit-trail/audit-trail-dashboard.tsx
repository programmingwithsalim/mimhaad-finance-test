"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Download, Filter, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/gl-accounting/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";

import { AuditLogTable } from "./audit-trail-table";
import { AuditStatistics } from "./audit-statistics";
import { AuditFilters } from "./audit-filters";
import { AuditLogDetails } from "./audit-log-details";
import type {
  AuditLog,
  AuditStatistics as AuditStatisticsType,
  AuditLogFilters,
  PaginationInfo,
} from "./types";

interface AuditTrailDashboardProps {
  initialFilters?: AuditLogFilters;
  showStatistics?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
}

export function AuditTrailDashboard({
  initialFilters = {},
  showStatistics = true,
  showFilters = true,
  showExport = true,
}: AuditTrailDashboardProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();

  // State management
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [statistics, setStatistics] = useState<AuditStatisticsType | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Pagination
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Filters
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 50,
    ...initialFilters,
  });

  // Fetch audit logs
  const fetchAuditLogs = async (newFilters?: AuditLogFilters) => {
    try {
      setLoading(true);
      const currentFilters = newFilters || filters;
      const queryParams = new URLSearchParams({
        page: currentFilters.page?.toString() || "1",
        limit: currentFilters.limit?.toString() || "50",
      });
      // Add filters to query params
      if (currentFilters.userId?.length) {
        queryParams.set("userId", currentFilters.userId.join(","));
      }
      if (currentFilters.actionType?.length) {
        queryParams.set("actionType", currentFilters.actionType.join(","));
      }
      if (currentFilters.entityType?.length) {
        queryParams.set("entityType", currentFilters.entityType.join(","));
      }
      if (currentFilters.severity?.length) {
        queryParams.set("severity", currentFilters.severity.join(","));
      }
      if (currentFilters.status?.length) {
        queryParams.set("status", currentFilters.status.join(","));
      }
      // Branch filtering logic
      let branchIdToSend = undefined;
      if (user) {
        if (user.role !== "Admin") {
          branchIdToSend = user.branchId;
        } else if (
          Array.isArray(currentFilters.branchId) &&
          currentFilters.branchId.length === 1
        ) {
          branchIdToSend = currentFilters.branchId[0];
        } else if (
          typeof currentFilters.branchId === "string" &&
          currentFilters.branchId
        ) {
          branchIdToSend = currentFilters.branchId;
        }
      }
      if (branchIdToSend) {
        queryParams.set("branchId", branchIdToSend);
      }
      console.log("[AuditTrail] Fetching logs with branchId:", branchIdToSend);
      if (searchTerm.trim()) {
        queryParams.set("searchTerm", searchTerm.trim());
      }
      if (dateRange?.from) {
        queryParams.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        queryParams.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
      }
      const response = await fetch(`/api/audit-logs?${queryParams}`);
      const data = await response.json();
      if (data.success && data.data) {
        setAuditLogs(data.data.logs || []);
        setPagination(data.data.pagination);
      } else {
        console.error("Failed to fetch audit logs:", data.error);
        toast({
          title: "Error",
          description: data.error || "Failed to fetch audit logs",
          variant: "destructive",
        });
        setAuditLogs([]);
        setPagination((prev) => ({ ...prev, total: 0, pages: 0 }));
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      });
      setAuditLogs([]);
      setPagination((prev) => ({ ...prev, total: 0, pages: 0 }));
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    if (!showStatistics) return;
    try {
      setLoadingStats(true);
      console.log("[AuditTrail] Starting to fetch statistics...");

      let statsUrl = "/api/audit-logs/statistics";
      let branchIdToSend = undefined;
      if (user) {
        if (user.role !== "Admin") {
          branchIdToSend = user.branchId;
        } else if (
          Array.isArray(filters.branchId) &&
          filters.branchId.length === 1
        ) {
          branchIdToSend = filters.branchId[0];
        } else if (typeof filters.branchId === "string" && filters.branchId) {
          branchIdToSend = filters.branchId;
        }
      }
      if (branchIdToSend) {
        statsUrl += `?branchId=${encodeURIComponent(branchIdToSend)}`;
      }
      console.log("[AuditTrail] Fetching stats with URL:", statsUrl);
      console.log("[AuditTrail] Branch ID to send:", branchIdToSend);

      const response = await fetch(statsUrl);
      const data = await response.json();

      console.log("[AuditTrail] Statistics response:", data);

      if (data.success) {
        console.log("[AuditTrail] Setting statistics:", data.data);
        setStatistics(data.data);
      } else {
        console.error("Failed to fetch statistics:", data.error);
        toast({
          title: "Warning",
          description: "Failed to load statistics",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
      toast({
        title: "Warning",
        description: "Failed to load statistics",
        variant: "destructive",
      });
    } finally {
      setLoadingStats(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    console.log("[AuditTrail] Initial useEffect triggered");
    fetchAuditLogs();
    fetchStatistics();
  }, []);

  useEffect(() => {
    console.log("[AuditTrail] User useEffect triggered, user:", user);
    fetchAuditLogs();
    fetchStatistics();
  }, [user]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<AuditLogFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);
    fetchAuditLogs(updatedFilters);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    const updatedFilters = { ...filters, page };
    setFilters(updatedFilters);
    fetchAuditLogs(updatedFilters);
  };

  // Handle search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    const updatedFilters = { ...filters, page: 1 };
    setFilters(updatedFilters);
    fetchAuditLogs(updatedFilters);
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    const updatedFilters = { ...filters, page: 1 };
    setFilters(updatedFilters);
    fetchAuditLogs(updatedFilters);
  };

  // Refresh data
  const refreshData = async () => {
    await Promise.all([fetchAuditLogs(), fetchStatistics()]);
    toast({
      title: "Success",
      description: "Audit trail data refreshed",
    });
  };

  // Export functionality
  const handleExport = async () => {
    try {
      const response = await fetch("/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", filters }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Export Started",
          description:
            "Your export is being prepared. You'll receive a notification when it's ready.",
        });
      } else {
        toast({
          title: "Export Failed",
          description: data.error || "Failed to start export",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to start export",
        variant: "destructive",
      });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters = { page: 1, limit: 50 };
    setFilters(clearedFilters);
    setSearchTerm("");
    setDateRange(undefined);
    fetchAuditLogs(clearedFilters);
  };

  const hasActiveFilters = () => {
    return (
      searchTerm.trim() ||
      dateRange?.from ||
      dateRange?.to ||
      filters.userId?.length ||
      filters.actionType?.length ||
      filters.entityType?.length ||
      filters.severity?.length ||
      filters.status?.length ||
      filters.branchId?.length
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit Trail</h2>
          <p className="text-muted-foreground">
            Monitor system activities and user actions for security and
            compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showFilters && (
            <Button
              variant="outline"
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters() && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
            </Button>
          )}
          {showExport && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          <Button onClick={refreshData} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {showStatistics && (
        <AuditStatistics statistics={statistics} loading={loadingStats} />
      )}

      {/* Filters Panel */}
      {showFilters && showFiltersPanel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Filters</span>
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              searchTerm={searchTerm}
              onSearchChange={handleSearch}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              showBranchFilter={user?.role === "Admin"}
            />
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>
            Showing {auditLogs.length} of {pagination.total} logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogTable
            logs={auditLogs}
            loading={loading}
            pagination={pagination}
            onPageChange={handlePageChange}
            onLogClick={setSelectedLog}
            selectedLog={selectedLog}
          />
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {selectedLog && <AuditLogDetails log={selectedLog} />}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
