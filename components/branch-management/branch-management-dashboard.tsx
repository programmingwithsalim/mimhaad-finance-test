"use client";

import type React from "react";
import { useState, useEffect } from "react";
import {
  PlusCircle,
  DownloadCloud,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchTable } from "./branch-table";
import { BranchDetails } from "./branch-details";
import { DeleteBranchDialog } from "./delete-branch-dialog";
import { useBranches, type Branch } from "@/hooks/use-branches";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { CreateBranchForm } from "./create-branch-form";
import { EditBranchForm } from "./edit-branch-form";

interface BranchStatistics {
  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
  totalStaff: number;
  totalManagers: number;
  averageStaffPerBranch: number;
  regionalDistribution: Array<{
    region: string;
    branchCount: number;
    staffCount: number;
  }>;
  staffDistribution: Array<{
    branchName: string;
    staffCount: number;
    manager: string;
  }>;
}

export function BranchManagementDashboard() {
  const {
    branches,
    statistics,
    loading,
    error,
    fetchBranches,
    searchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
  } = useBranches();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openDetailsSheet, setOpenDetailsSheet] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [activeTab, setActiveTab] = useState("all-branches");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [realStatistics, setRealStatistics] = useState<BranchStatistics | null>(
    null
  );
  const [statsLoading, setStatsLoading] = useState(false);
  const [openStaffCountResults, setOpenStaffCountResults] = useState(false);
  const [staffCountResults, setStaffCountResults] = useState<any>(null);

  // Fetch real statistics
  const fetchRealStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch("/api/branches/statistics");
      if (response.ok) {
        const data = await response.json();
        setRealStatistics(data);
      } else {
        console.error("Failed to fetch statistics");
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchRealStatistics();
  }, [branches]); // Refetch when branches change

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchBranches();
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchBranches(searchQuery);
      if (Array.isArray(results) && results.length === 0) {
        toast({
          title: "No results found",
          description: `No branches found matching "${searchQuery}"`,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Error",
        description: "Failed to search branches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleRefresh = async () => {
    try {
      setIsSearching(true);
      await fetchBranches();
      await fetchRealStatistics();
      toast({
        title: "Success",
        description: "Branch data refreshed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh branch data",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpdateStaffCounts = async () => {
    try {
      setIsSearching(true);
      const response = await fetch("/api/branches/update-staff-counts", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        setStaffCountResults(result);
        setOpenStaffCountResults(true);
        await fetchBranches(); // Refresh branch data
        await fetchRealStatistics(); // Refresh statistics
        toast({
          title: "Staff counts updated",
          description: result.message,
        });
      } else {
        throw new Error("Failed to update staff counts");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update staff counts",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddBranch = async (branchData: any) => {
    try {
      await createBranch(branchData);
      setOpenAddDialog(false);
      await fetchRealStatistics(); // Refresh statistics
      toast({
        title: "Branch created",
        description: `Branch "${branchData.name}" has been created successfully.`,
      });
    } catch (error) {
      console.error("Error creating branch:", error);
      toast({
        title: "Error",
        description: "Failed to create branch. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditBranch = (branch: Branch) => {
    setSelectedBranch(branch);
    setOpenEditDialog(true);
  };

  const handleUpdateBranch = async (branchData: any) => {
    if (!selectedBranch) return;

    try {
      setIsSubmitting(true);
      await updateBranch(selectedBranch.id, branchData);
      setOpenEditDialog(false);
      await fetchRealStatistics(); // Refresh statistics
      toast({
        title: "Branch updated",
        description: `Branch "${branchData.name}" has been updated successfully.`,
      });
    } catch (error) {
      console.error("Error updating branch:", error);
      toast({
        title: "Error",
        description: "Failed to update branch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (branch: Branch) => {
    setSelectedBranch(branch);
    setOpenDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBranch) return;

    try {
      setIsSubmitting(true);
      await deleteBranch(selectedBranch.id);
      setOpenDeleteDialog(false);
      await fetchRealStatistics(); // Refresh statistics
      toast({
        title: "Branch deleted",
        description: `Branch "${selectedBranch.name}" has been deleted successfully.`,
      });
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast({
        title: "Error",
        description: "Failed to delete branch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = (branch: Branch) => {
    setSelectedBranch(branch);
    setOpenDetailsSheet(true);
  };

  const safeBranches = Array.isArray(branches) ? branches : [];
  const filteredBranches =
    activeTab === "all-branches"
      ? safeBranches
      : safeBranches.filter((branch) => branch.status === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Branch Management</h2>
        <div className="flex gap-2">
          <Dialog open={openAddDialog} onOpenChange={setOpenAddDialog}>
            <Button
              className="hidden sm:flex"
              onClick={() => setOpenAddDialog(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Branch</DialogTitle>
                <DialogDescription>
                  Fill in the details to add a new branch to your network.
                </DialogDescription>
              </DialogHeader>
              <CreateBranchForm
                onSubmit={handleAddBranch}
                onCancel={() => setOpenAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            className="hidden sm:flex"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="hidden sm:flex"
            onClick={handleUpdateStaffCounts}
            disabled={isSearching}
          >
            <Loader2
              className={`mr-2 h-4 w-4 ${isSearching ? "animate-spin" : ""}`}
            />
            Update Staff Counts
          </Button>
          <Button variant="outline" className="hidden sm:flex">
            <DownloadCloud className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setOpenAddDialog(true)}
          >
            <PlusCircle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={handleUpdateStaffCounts}
            disabled={isSearching}
          >
            <Loader2
              className={`h-5 w-5 ${isSearching ? "animate-spin" : ""}`}
            />
          </Button>
          <Button variant="ghost" size="icon" className="sm:hidden">
            <DownloadCloud className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Display */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                realStatistics?.totalBranches || safeBranches.length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {realStatistics?.activeBranches || 0} active,{" "}
              {realStatistics?.inactiveBranches || 0} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                realStatistics?.totalStaff || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {realStatistics?.averageStaffPerBranch?.toFixed(1) || 0} per
              branch • Auto-calculated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                realStatistics?.totalManagers || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique managers assigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                realStatistics?.regionalDistribution?.length || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Geographic coverage</p>
          </CardContent>
        </Card>
      </div>

      {/* Regional Distribution */}
      {realStatistics?.regionalDistribution &&
        realStatistics.regionalDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Regional Distribution</CardTitle>
              <CardDescription>
                Branches and staff distribution across regions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {realStatistics.regionalDistribution.map((region) => (
                  <div
                    key={region.region}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{region.region}</p>
                      <p className="text-sm text-muted-foreground">
                        {region.branchCount} branch
                        {region.branchCount !== 1 ? "es" : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{region.staffCount}</p>
                      <p className="text-xs text-muted-foreground">staff</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search branches by name, code, location or manager..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          className="h-9 md:w-[300px]"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Searching...
            </>
          ) : (
            "Search"
          )}
        </Button>
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              fetchBranches();
            }}
            disabled={isSearching}
          >
            Clear
          </Button>
        )}
      </div>

      <Tabs
        defaultValue="all-branches"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger value="all-branches">All Branches</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
        <TabsContent value="all-branches">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Branch Network</CardTitle>
              <CardDescription>
                Manage your branch network from this central dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading branches...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Failed to Load Branches
                    </h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={handleRefresh} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-64 text-center">
                  <p className="text-muted-foreground mb-4">
                    No branches found
                  </p>
                  <Button onClick={() => setOpenAddDialog(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Branch
                  </Button>
                </div>
              ) : (
                <BranchTable
                  branches={filteredBranches}
                  onEdit={handleEditBranch}
                  onDelete={handleDeleteClick}
                  onView={handleViewDetails}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="active">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Active Branches</CardTitle>
              <CardDescription>
                All currently operational branches in your network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading branches...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Failed to Load Branches
                    </h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={handleRefresh} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-64 text-center">
                  <p className="text-muted-foreground mb-4">
                    No active branches found
                  </p>
                  <Button onClick={() => setOpenAddDialog(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Branch
                  </Button>
                </div>
              ) : (
                <BranchTable
                  branches={filteredBranches}
                  onEdit={handleEditBranch}
                  onDelete={handleDeleteClick}
                  onView={handleViewDetails}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inactive">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Inactive Branches</CardTitle>
              <CardDescription>
                Temporarily closed or non-operational branches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading branches...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      Failed to Load Branches
                    </h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={handleRefresh} variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-64 text-center">
                  <p className="text-muted-foreground mb-4">
                    No inactive branches found
                  </p>
                  <Button onClick={() => setOpenAddDialog(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Branch
                  </Button>
                </div>
              ) : (
                <BranchTable
                  branches={filteredBranches}
                  onEdit={handleEditBranch}
                  onDelete={handleDeleteClick}
                  onView={handleViewDetails}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Branch Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update the branch details.</DialogDescription>
          </DialogHeader>
          {selectedBranch && (
            <EditBranchForm
              branch={selectedBranch}
              onSubmit={handleUpdateBranch}
              onCancel={() => setOpenEditDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Branch Dialog */}
      <DeleteBranchDialog
        branch={selectedBranch}
        open={openDeleteDialog}
        onOpenChange={setOpenDeleteDialog}
        onConfirm={handleConfirmDelete}
        isSubmitting={isSubmitting}
      />

      {/* Branch Details Sheet */}
      <Sheet open={openDetailsSheet} onOpenChange={setOpenDetailsSheet}>
        <SheetContent className="sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Branch Details</SheetTitle>
            <SheetDescription>
              Detailed information about the branch.
            </SheetDescription>
          </SheetHeader>
          {selectedBranch && (
            <div className="mt-6">
              <BranchDetails branch={selectedBranch} />
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenDetailsSheet(false);
                    setTimeout(() => {
                      handleEditBranch(selectedBranch);
                    }, 300);
                  }}
                >
                  Edit Branch
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setOpenDetailsSheet(false);
                    setTimeout(() => {
                      handleDeleteClick(selectedBranch);
                    }, 300);
                  }}
                >
                  Delete Branch
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Staff Count Results Dialog */}
      {openStaffCountResults && staffCountResults && (
        <Dialog
          open={openStaffCountResults}
          onOpenChange={setOpenStaffCountResults}
        >
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Staff Count Update Results</DialogTitle>
              <DialogDescription>
                Summary of the staff count update process.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Total Branches</p>
                  <p className="text-2xl font-bold">
                    {staffCountResults.summary?.totalBranches || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Updated Branches</p>
                  <p className="text-2xl font-bold text-green-600">
                    {staffCountResults.summary?.updatedBranches || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Total Staff</p>
                  <p className="text-2xl font-bold">
                    {staffCountResults.summary?.totalStaff || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Users Fixed</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {staffCountResults.summary?.usersWithoutAssignments || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Users Without Branch</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {staffCountResults.summary?.usersWithNoBranch || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Errors</p>
                  <p className="text-2xl font-bold text-red-600">
                    {staffCountResults.summary?.errors || 0}
                  </p>
                </div>
              </div>

              {staffCountResults.usersWithNoBranch &&
                staffCountResults.usersWithNoBranch.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-3 text-orange-600">
                      ⚠️ Users Without Branch Assignment
                    </h3>
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-700 mb-2">
                        The following users are active but not assigned to any
                        branch:
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {staffCountResults.usersWithNoBranch.map(
                          (user: any, index: number) => (
                            <div
                              key={index}
                              className="text-sm text-orange-700"
                            >
                              • {user.first_name} {user.last_name} ({user.email}
                              ) - {user.role}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {staffCountResults.results?.branchResults &&
                staffCountResults.results.branchResults.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-3">Branch Details</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {staffCountResults.results.branchResults.map(
                        (branch: any, index: number) => (
                          <div key={index} className="p-3 border rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium">{branch.name}</h4>
                              <div className="text-sm">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    branch.newStaffCount >
                                    branch.previousStaffCount
                                      ? "bg-green-100 text-green-800"
                                      : branch.newStaffCount <
                                        branch.previousStaffCount
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {branch.previousStaffCount} →{" "}
                                  {branch.newStaffCount} staff
                                </span>
                              </div>
                            </div>
                            {branch.staffDetails &&
                              branch.staffDetails.length > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  <p className="mb-1">Staff members:</p>
                                  <ul className="list-disc list-inside space-y-1">
                                    {branch.staffDetails.map(
                                      (staff: any, staffIndex: number) => (
                                        <li key={staffIndex}>
                                          {staff.firstName} {staff.lastName} (
                                          {staff.email}) - {staff.role}
                                          {staff.isPrimary && (
                                            <span className="text-blue-600 ml-1">
                                              [Primary]
                                            </span>
                                          )}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {staffCountResults.results?.errors &&
                staffCountResults.results.errors.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2 text-red-600">
                      Errors
                    </h3>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {staffCountResults.results.errors.map(
                          (error: string, index: number) => (
                            <li key={index}>{error}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setOpenStaffCountResults(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Default export for the component
export default BranchManagementDashboard;
