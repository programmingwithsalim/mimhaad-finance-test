"use client";

import { useState } from "react";
import {
  Plus,
  Package,
  RefreshCw,
  ArrowLeft,
  Edit,
  Trash2,
  Loader2,
  Building,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCardBatches } from "@/hooks/use-e-zwich";
import { EZwichAddStockForm } from "@/components/inventory/e-zwich-add-stock-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { EZwichEditBatchForm } from "@/components/inventory/e-zwich-edit-batch-form";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InventoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const {
    batches,
    loading: batchesLoading,
    error: batchesError,
    fetchBatches,
    deleteBatch,
  } = useCardBatches();

  const [addStockOpen, setAddStockOpen] = useState(false);
  const [editStockOpen, setEditStockOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<any[]>([]);

  // Calculate inventory metrics
  const totalBatches = batches?.length || 0;
  const totalCardsReceived =
    batches?.reduce((sum, batch) => sum + batch.quantity_received, 0) || 0;
  const totalCardsAvailable =
    batches?.reduce((sum, batch) => sum + batch.quantity_available, 0) || 0;

  // Calculate low stock batches (less than 10% remaining)
  const lowStockBatches =
    batches?.filter((batch) => {
      const utilization =
        (batch.quantity_received - batch.quantity_available) /
        batch.quantity_received;
      return utilization > 0.9 && batch.quantity_available > 0;
    }) || [];

  // Fetch branches for admin users
  const fetchBranches = async () => {
    if (user?.role !== "Admin") return;

    try {
      const response = await fetch("/api/branches");
      const data = await response.json();
      if (data.success) {
        setBranches(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  // Load branches on component mount for admin users
  useState(() => {
    if (user?.role === "Admin") {
      fetchBranches();
    }
  });

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await fetchBatches();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditBatch = (batch: any) => {
    setSelectedBatch(batch);
    setEditStockOpen(true);
  };

  const handleDeleteBatch = (batch: any) => {
    setSelectedBatch(batch);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBatch = async () => {
    if (!selectedBatch) return;

    setIsDeleting(true);
    try {
      await deleteBatch(selectedBatch.id);
      toast({
        title: "Success",
        description: "Card batch deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedBatch(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete batch",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "low_stock":
        return <Badge variant="secondary">Low Stock</Badge>;
      case "depleted":
        return <Badge variant="destructive">Depleted</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "inactive":
        return <Badge variant="outline">Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter batches by selected branch (admin only)
  const filteredBatches =
    user?.role === "Admin" && selectedBranch && selectedBranch !== "all"
      ? batches?.filter((batch) => batch.branch_id === selectedBranch) || []
      : batches || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground">
              Manage inventory batches and track stock levels
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshAll}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Inventory Batch</DialogTitle>
                <DialogDescription>
                  Add a new batch of inventory items (E-Zwich cards, SIM cards,
                  paper rollers, etc.)
                </DialogDescription>
              </DialogHeader>
              <EZwichAddStockForm onSuccess={() => setAddStockOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button onClick={() => setAddStockOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Batch
          </Button>
        </div>
      </div>

      {/* Branch Filter for Admin Users */}
      {user?.role === "Admin" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Branch Filter
            </CardTitle>
            <CardDescription>
              Select a branch to filter batches (leave empty to see all)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {batchesLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : batchesError ? (
              <div className="text-sm text-red-600">Error loading</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {totalBatches.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {user?.role === "Admin" ? "All branches" : "Your branch"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cards Received
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {batchesLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : batchesError ? (
              <div className="text-sm text-red-600">Error loading</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {totalCardsReceived.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total cards received
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cards Available
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {batchesLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : batchesError ? (
              <div className="text-sm text-red-600">Error loading</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {totalCardsAvailable.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Available for issuance
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error States */}
      {batchesError && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center">
              <Loader2 className="h-5 w-5 mr-2" />
              Data Loading Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm text-red-700">Batches: {batchesError}</div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="mt-2"
            >
              Retry Loading
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alerts */}
      {lowStockBatches.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center">
              <Loader2 className="h-5 w-5 mr-2" />
              Low Stock Alert
            </CardTitle>
            <CardDescription className="text-orange-700">
              The following batches are running low on stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg"
                >
                  <div>
                    <div className="font-medium">{batch.batch_code}</div>
                    <div className="text-sm text-muted-foreground">
                      {batch.quantity_available} of {batch.quantity_received}{" "}
                      remaining
                      {user?.role === "Admin" && batch.branch_name && (
                        <span className="ml-2 text-blue-600">
                          • {batch.branch_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-orange-600 border-orange-600"
                  >
                    {Math.round(
                      (batch.quantity_available / batch.quantity_received) * 100
                    )}
                    % left
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Batches</CardTitle>
          <CardDescription>
            Manage and track all inventory batches
            {user?.role === "Admin" &&
              selectedBranch &&
              selectedBranch !== "all" && (
                <span className="ml-2 text-blue-600">
                  • Filtered by{" "}
                  {branches.find((b) => b.id === selectedBranch)?.name}
                </span>
              )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batchesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : batchesError ? (
            <div className="text-center py-8 text-red-600">
              Error loading batches: {batchesError}
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No card batches found
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {user?.role === "Admin" &&
                selectedBranch &&
                selectedBranch !== "all"
                  ? `No batches found for ${
                      branches.find((b) => b.id === selectedBranch)?.name
                    }`
                  : "Get started by adding your first batch of E-Zwich cards"}
              </p>
              {(!user?.role === "Admin" ||
                !selectedBranch ||
                selectedBranch === "all") && (
                <Button onClick={() => setAddStockOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Batch
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch Code</TableHead>
                    <TableHead>Type</TableHead>
                    {user?.role === "Admin" && <TableHead>Branch</TableHead>}
                    <TableHead>Received</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {batch.batch_code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {batch.inventory_type === "e-zwich" &&
                            "E-Zwich Cards"}
                          {batch.inventory_type === "sim" && "SIM Cards"}
                          {batch.inventory_type === "rollers" &&
                            "Paper Rollers"}
                          {batch.inventory_type === "other" && "Other"}
                          {!batch.inventory_type && "E-Zwich Cards"}
                        </Badge>
                      </TableCell>
                      {user?.role === "Admin" && (
                        <TableCell>
                          <Badge variant="outline">
                            {batch.branch_name || "Unknown Branch"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        {batch.quantity_received.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {batch.quantity_available.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-blue-600">
                        {(
                          batch.quantity_received - batch.quantity_available
                        ).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      <TableCell>
                        {batch.expiry_date
                          ? format(new Date(batch.expiry_date), "MMM dd, yyyy")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(batch.created_at), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditBatch(batch)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteBatch(batch)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Batch Dialog */}
      <Dialog open={editStockOpen} onOpenChange={setEditStockOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Inventory Batch</DialogTitle>
            <DialogDescription>
              Update the details of the selected inventory batch
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <EZwichEditBatchForm
              batch={selectedBatch}
              onSuccess={() => {
                setEditStockOpen(false);
                setSelectedBatch(null);
              }}
              onCancel={() => {
                setEditStockOpen(false);
                setSelectedBatch(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-destructive" />
              Delete Inventory Batch
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the batch "
              {selectedBatch?.batch_code}"?
              {selectedBatch &&
                selectedBatch.quantity_received -
                  selectedBatch.quantity_available >
                  0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-red-600" />
                      <span className="text-red-800 font-medium">Warning</span>
                    </div>
                    <p className="text-red-700 text-sm mt-1">
                      This batch has{" "}
                      {selectedBatch.quantity_received -
                        selectedBatch.quantity_available}{" "}
                      cards already issued. Deleting this batch may affect your
                      inventory records.
                    </p>
                  </div>
                )}
              <p className="mt-2 text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBatch}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Batch"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
