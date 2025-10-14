"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Plus,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCommissions } from "@/hooks/use-commissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BranchIndicator } from "@/components/branch/branch-indicator";
import { CommissionTable } from "./commission-table";
import { AddCommissionDialog } from "./add-commission-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditCommissionDialog } from "./edit-commission-dialog";
import { ProviderCommissionsChart } from "./provider-commissions-chart";
import { Skeleton } from "@/components/ui/skeleton";

export function CommissionDashboard() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<any>(null);

  // Filter states for client-side filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const commissionsPerPage = 20;

  // Use the commissions hook - fetch all without filters
  const {
    commissions: allCommissionsData,
    statistics: hookStatistics,
    isLoading,
    error,
    refetch: refreshCommissions,
    updateCommission,
    deleteCommission,
    canViewAllBranches,
  } = useCommissions({});

  // Client-side filtering
  const filteredCommissions = (allCommissionsData || []).filter(
    (commission: any) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          commission.sourceName?.toLowerCase().includes(search) ||
          commission.reference?.toLowerCase().includes(search) ||
          commission.description?.toLowerCase().includes(search) ||
          commission.amount?.toString().includes(search) ||
          commission.source?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Source filter
      if (filterSource !== "all" && commission.source !== filterSource) {
        return false;
      }

      // Status filter
      if (filterStatus !== "all" && commission.status !== filterStatus) {
        return false;
      }

      // Date range filter
      if (filterStartDate && commission.month) {
        const commissionDate = new Date(commission.month);
        const startDate = new Date(filterStartDate);
        if (commissionDate < startDate) return false;
      }

      if (filterEndDate && commission.month) {
        const commissionDate = new Date(commission.month);
        const endDate = new Date(filterEndDate);
        if (commissionDate > endDate) return false;
      }

      return true;
    }
  );

  // Calculate local statistics from filtered data
  const localStatistics = {
    totalAmount:
      filteredCommissions?.reduce(
        (sum, c) => sum + (Number(c.amount) || 0),
        0
      ) || 0,
    totalCount: filteredCommissions?.length || 0,
    paidAmount:
      filteredCommissions
        ?.filter((c) => c.status === "paid")
        ?.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0,
    paidCount:
      filteredCommissions?.filter((c) => c.status === "paid")?.length || 0,
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredCommissions.length / commissionsPerPage);
  const startIndex = (currentPage - 1) * commissionsPerPage;
  const endIndex = startIndex + commissionsPerPage;
  const paginatedCommissions = filteredCommissions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSource, filterStatus, filterStartDate, filterEndDate]);

  const handleAddCommission = async () => {
    try {
      console.log("[COMMISSION] Refreshing commission data...");
      // The commission form already handles the API call, so we just need to refresh the data
      await refreshCommissions();
      console.log("[COMMISSION] Commission data refreshed successfully");
      setShowAddDialog(false);
      toast({
        title: "Commission Added",
        description: "Commission has been successfully created.",
      });
    } catch (error) {
      console.error("[COMMISSION] Error in handleAddCommission:", error);
      console.error("[COMMISSION] Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : "No stack trace",
      });
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add commission",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    try {
      console.log("[COMMISSION] Refreshing commission data from table...");
      await refreshCommissions();
      console.log("[COMMISSION] Commission data refreshed successfully");
    } catch (error) {
      console.error("[COMMISSION] Error refreshing commissions:", error);
      toast({
        title: "Error",
        description: "Failed to refresh commission data",
        variant: "destructive",
      });
    }
  };

  const handleEditCommission = (commission: any) => {
    setSelectedCommission(commission);
    setShowEditDialog(true);
  };

  const handleEditCommissionSubmit = async () => {
    setShowEditDialog(false);
    setSelectedCommission(null);
    await handleRefresh();
  };

  const handleDeleteCommission = async (commission: any) => {
    try {
      await deleteCommission(commission.id);
      toast({
        title: "Commission Deleted",
        description: "Commission has been successfully deleted.",
      });
    } catch (error) {
      console.error("Error deleting commission:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete commission",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Commission Management
            </h1>
            <p className="text-muted-foreground">
              Track and manage partner commissions
            </p>
          </div>
          <BranchIndicator />
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">
              Error Loading Commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-red-700">
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={refreshCommissions}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Commission Management
          </h1>
          <p className="text-muted-foreground">
            {canViewAllBranches
              ? "Track and manage partner commissions across all branches"
              : "Track and manage partner commissions for your branch"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BranchIndicator />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshCommissions}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Commission
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Commissions
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(localStatistics.totalAmount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {localStatistics.totalCount} entries
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(localStatistics.paidAmount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {localStatistics.paidCount} paid
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {localStatistics.totalCount > 0
                    ? Math.round(
                        (localStatistics.paidCount /
                          localStatistics.totalCount) *
                          100
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">
                  Payment completion
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Commission History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <ProviderCommissionsChart className="w-full" />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search & Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <Input
                    id="search"
                    placeholder="Search commissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Source Filter */}
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select value={filterSource} onValueChange={setFilterSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {Array.from(
                        new Set(
                          (allCommissionsData || []).map((c: any) => c.source)
                        )
                      )
                        .filter(Boolean)
                        .map((source: any) => (
                          <SelectItem key={source} value={source}>
                            {source}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                  />
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Clear Filters Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterSource("all");
                    setFilterStatus("all");
                    setFilterStartDate("");
                    setFilterEndDate("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, filteredCommissions.length)} of{" "}
            {filteredCommissions.length} commissions
            {filteredCommissions.length !==
              (allCommissionsData || []).length && (
              <span>
                {" "}
                (filtered from {(allCommissionsData || []).length} total)
              </span>
            )}
          </div>

          <CommissionTable
            commissions={paginatedCommissions}
            isLoading={isLoading}
            onRefresh={handleRefresh}
            onEdit={handleEditCommission}
            onDelete={handleDeleteCommission}
          />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Commission Dialog */}
      <AddCommissionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={handleAddCommission}
      />

      {/* Edit Commission Dialog */}
      <EditCommissionDialog
        commission={selectedCommission}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditCommissionSubmit}
      />
    </div>
  );
}
