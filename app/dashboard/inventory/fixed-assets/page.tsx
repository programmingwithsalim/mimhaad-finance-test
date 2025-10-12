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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Plus,
  Calculator,
  Building2,
  Calendar,
  DollarSign,
  TrendingDown,
  FileText,
  Edit,
  Trash2,
  Eye,
} from "lucide-react";

interface FixedAsset {
  id: string;
  name: string;
  description: string;
  category: string;
  purchaseDate: string;
  purchaseCost: number;
  salvageValue: number;
  usefulLife: number;
  depreciationMethod: string;
  currentValue: number;
  accumulatedDepreciation: number;
  branchId: string;
  branchName: string;
  status: "active" | "disposed" | "under-maintenance";
  location: string;
  serialNumber?: string;
  supplier?: string;
  warrantyExpiry?: string;
  paymentSource?: string;
  paymentAccountId?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  createdAt: string;
  updatedAt: string;
}

interface DepreciationCalculation {
  year: number;
  beginningValue: number;
  depreciationExpense: number;
  accumulatedDepreciation: number;
  endingValue: number;
}

export default function FixedAssetsPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDepreciationDialog, setShowDepreciationDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [depreciationSchedule, setDepreciationSchedule] = useState<
    DepreciationCalculation[]
  >([]);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    purchaseDate: "",
    purchaseCost: "",
    salvageValue: "",
    usefulLife: "",
    depreciationMethod: "straight-line",
    location: "",
    serialNumber: "",
    supplier: "",
    warrantyExpiry: "",
    paymentSource: "cash", // Add payment source field
    paymentAccountId: "", // Add payment account ID field
  });

  const assetCategories = [
    "Buildings",
    "Machinery & Equipment",
    "Vehicles",
    "Furniture & Fixtures",
    "Computer Equipment",
    "Office Equipment",
    "Land",
    "Intangible Assets",
    "Other",
  ];

  const depreciationMethods = [
    { value: "straight-line", label: "Straight Line" },
    { value: "declining-balance", label: "Declining Balance" },
    { value: "sum-of-years", label: "Sum of Years Digits" },
    { value: "units-of-production", label: "Units of Production" },
  ];

  const [floatAccounts, setFloatAccounts] = useState<any[]>([]);
  const [loadingFloatAccounts, setLoadingFloatAccounts] = useState(false);

  const paymentSources = [
    { value: "cash", label: "Cash", icon: "💵" },
    { value: "momo", label: "Mobile Money", icon: "📱" },
    { value: "bank", label: "Bank Transfer", icon: "🏦" },
  ];

  useEffect(() => {
    fetchAssets();
    fetchFloatAccounts();
  }, []);

  // Debug logging for user and branch information
  useEffect(() => {
    console.log("Fixed Assets - User info:", {
      role: user?.role,
      branchId: user?.branchId,
      branchName: user?.branchName,
      isAdmin: user?.role?.toLowerCase() === "admin",
    });
  }, [user]);

  const fetchFloatAccounts = async () => {
    try {
      setLoadingFloatAccounts(true);

      // For admin users, don't filter by branch to show all accounts
      // For non-admin users, filter by their branch
      const isAdmin = user?.role?.toLowerCase() === "admin";
      const url = isAdmin
        ? "/api/float-accounts"
        : `/api/float-accounts?branchId=${user?.branchId}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched float accounts:", data.accounts);
        setFloatAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error fetching float accounts:", error);
    } finally {
      setLoadingFloatAccounts(false);
    }
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/fixed-assets");
      if (response.ok) {
        const data = await response.json();
        const assetsData = data.assets || [];
        setAssets(assetsData);
      } else {
        throw new Error("Failed to fetch assets");
      }
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: "Failed to fetch fixed assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDepreciation = (
    asset: FixedAsset
  ): DepreciationCalculation[] => {
    const schedule: DepreciationCalculation[] = [];
    const cost = asset.purchaseCost;
    const salvage = asset.salvageValue;
    const life = asset.usefulLife;
    let accumulatedDepreciation = 0;

    for (let year = 1; year <= life; year++) {
      let depreciationExpense = 0;

      switch (asset.depreciationMethod) {
        case "straight-line":
          depreciationExpense = (cost - salvage) / life;
          break;
        case "declining-balance":
          const rate = 2 / life; // Double declining balance
          depreciationExpense = (cost - accumulatedDepreciation) * rate;
          break;
        case "sum-of-years":
          const remainingLife = life - year + 1;
          const sumOfYears = (life * (life + 1)) / 2;
          depreciationExpense = ((cost - salvage) * remainingLife) / sumOfYears;
          break;
        default:
          depreciationExpense = (cost - salvage) / life;
      }

      // Ensure we don't depreciate below salvage value
      if (cost - accumulatedDepreciation - depreciationExpense < salvage) {
        depreciationExpense = cost - accumulatedDepreciation - salvage;
      }

      accumulatedDepreciation += depreciationExpense;

      schedule.push({
        year,
        beginningValue: cost - (accumulatedDepreciation - depreciationExpense),
        depreciationExpense,
        accumulatedDepreciation,
        endingValue: cost - accumulatedDepreciation,
      });
    }

    return schedule;
  };

  const handleAddAsset = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Asset name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.purchaseDate) {
      toast({
        title: "Validation Error",
        description: "Purchase date is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.purchaseCost || Number(formData.purchaseCost) <= 0) {
      toast({
        title: "Validation Error",
        description: "Purchase cost must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.usefulLife || Number(formData.usefulLife) <= 0) {
      toast({
        title: "Validation Error",
        description: "Useful life must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.paymentSource) {
      toast({
        title: "Validation Error",
        description: "Payment source is required",
        variant: "destructive",
      });
      return;
    }

    // Validate payment account for non-cash payments
    if (formData.paymentSource !== "cash" && !formData.paymentAccountId) {
      toast({
        title: "Validation Error",
        description: "Payment account is required for non-cash payments",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/fixed-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          purchaseCost: Number(formData.purchaseCost),
          salvageValue: Number(formData.salvageValue || 0),
          usefulLife: Number(formData.usefulLife),
          branchId: user?.branchId,
          paymentSource: formData.paymentSource,
          paymentAccountId: formData.paymentAccountId || null,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Fixed asset added successfully",
        });
        setShowAddDialog(false);
        setFormData({
          name: "",
          description: "",
          category: "",
          purchaseDate: "",
          purchaseCost: "",
          salvageValue: "",
          usefulLife: "",
          depreciationMethod: "straight-line",
          location: "",
          serialNumber: "",
          supplier: "",
          warrantyExpiry: "",
          paymentSource: "cash",
          paymentAccountId: "",
        });
        fetchAssets();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add asset");
      }
    } catch (error) {
      console.error("Error adding asset:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add fixed asset",
        variant: "destructive",
      });
    }
  };

  const handleViewDepreciation = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    const schedule = calculateDepreciation(asset);
    setDepreciationSchedule(schedule);
    setShowDepreciationDialog(true);
  };

  const handleViewAsset = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setShowViewDialog(true);
  };

  const handleEditAsset = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: asset.description || "",
      category: asset.category,
      purchaseDate: asset.purchaseDate,
      purchaseCost: asset.purchaseCost.toString(),
      salvageValue: asset.salvageValue.toString(),
      usefulLife: asset.usefulLife.toString(),
      depreciationMethod: asset.depreciationMethod,
      location: asset.location || "",
      serialNumber: asset.serialNumber || "",
      supplier: asset.supplier || "",
      warrantyExpiry: asset.warrantyExpiry || "",
      paymentSource: asset.paymentSource || "cash",
      paymentAccountId: asset.paymentAccountId || "",
    });
    setShowEditDialog(true);
  };

  const handleDeleteAsset = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setShowDeleteDialog(true);
  };

  const handleUpdateAsset = async () => {
    if (!editingAsset) return;

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Asset name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Validation Error",
        description: "Category is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.purchaseDate) {
      toast({
        title: "Validation Error",
        description: "Purchase date is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.purchaseCost || Number(formData.purchaseCost) <= 0) {
      toast({
        title: "Validation Error",
        description: "Purchase cost must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.usefulLife || Number(formData.usefulLife) <= 0) {
      toast({
        title: "Validation Error",
        description: "Useful life must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/fixed-assets/${editingAsset.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          purchaseCost: Number(formData.purchaseCost),
          salvageValue: Number(formData.salvageValue || 0),
          usefulLife: Number(formData.usefulLife),
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Fixed asset updated successfully",
        });
        setShowEditDialog(false);
        setEditingAsset(null);
        setFormData({
          name: "",
          description: "",
          category: "",
          purchaseDate: "",
          purchaseCost: "",
          salvageValue: "",
          usefulLife: "",
          depreciationMethod: "straight-line",
          location: "",
          serialNumber: "",
          supplier: "",
          warrantyExpiry: "",
          paymentSource: "cash",
          paymentAccountId: "",
        });
        fetchAssets();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update asset");
      }
    } catch (error) {
      console.error("Error updating asset:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update fixed asset",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedAsset) return;

    try {
      const response = await fetch(`/api/fixed-assets/${selectedAsset.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Fixed asset deleted successfully",
        });
        setShowDeleteDialog(false);
        setSelectedAsset(null);
        fetchAssets();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete asset");
      }
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete fixed asset",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "disposed":
        return <Badge variant="destructive">Disposed</Badge>;
      case "under-maintenance":
        return <Badge variant="secondary">Under Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalAssets = assets.reduce((sum, asset) => {
    const cost = Number(asset.purchaseCost) || 0;
    return sum + cost;
  }, 0);
  const totalDepreciation = assets.reduce((sum, asset) => {
    const dep = Number(asset.accumulatedDepreciation) || 0;
    return sum + dep;
  }, 0);
  const netBookValue = totalAssets - totalDepreciation;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Fixed Assets Register
          </h1>
          <p className="text-muted-foreground">
            Manage and track fixed assets with depreciation calculations
            {user?.role?.toLowerCase() !== "admin" && user?.branchName && (
              <span className="ml-2 text-blue-600 font-medium">
                • {user.branchName}
              </span>
            )}
            {user?.role?.toLowerCase() === "admin" && (
              <span className="ml-2 text-green-600 font-medium">
                • All Branches
              </span>
            )}
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Fixed Asset</DialogTitle>
              <DialogDescription>
                Enter the details of the fixed asset to add to the register.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Office Building"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {assetCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Detailed description of the asset"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchaseDate">Purchase Date *</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="purchaseCost">Purchase Cost (₵) *</Label>
                  <Input
                    id="purchaseCost"
                    type="number"
                    step="0.01"
                    value={formData.purchaseCost}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseCost: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="salvageValue">Salvage Value (₵) *</Label>
                  <Input
                    id="salvageValue"
                    type="number"
                    step="0.01"
                    value={formData.salvageValue}
                    onChange={(e) =>
                      setFormData({ ...formData, salvageValue: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="usefulLife">Useful Life (Years) *</Label>
                  <Input
                    id="usefulLife"
                    type="number"
                    value={formData.usefulLife}
                    onChange={(e) =>
                      setFormData({ ...formData, usefulLife: e.target.value })
                    }
                    placeholder="5"
                  />
                </div>
                <div>
                  <Label htmlFor="depreciationMethod">
                    Depreciation Method *
                  </Label>
                  <Select
                    value={formData.depreciationMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, depreciationMethod: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {depreciationMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="e.g., Main Office, Floor 2"
                  />
                </div>
                <div>
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, serialNumber: e.target.value })
                    }
                    placeholder="SN123456789"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    value={formData.supplier}
                    onChange={(e) =>
                      setFormData({ ...formData, supplier: e.target.value })
                    }
                    placeholder="Supplier name"
                  />
                </div>
                <div>
                  <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                  <Input
                    id="warrantyExpiry"
                    type="date"
                    value={formData.warrantyExpiry}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        warrantyExpiry: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Payment Source Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Payment Information</h3>
                  {user?.role?.toLowerCase() === "admin" && (
                    <Badge variant="outline" className="text-xs">
                      Viewing All Branches
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentSource">Payment Source *</Label>
                    <Select
                      value={formData.paymentSource}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          paymentSource: value,
                          paymentAccountId: "",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment source" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentSources.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            <span className="flex items-center gap-2">
                              <span>{source.icon}</span>
                              <span>{source.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.paymentSource !== "cash" && (
                    <div>
                      <Label htmlFor="paymentAccountId">
                        Payment Account *
                      </Label>
                      <Select
                        value={formData.paymentAccountId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, paymentAccountId: value })
                        }
                        disabled={loadingFloatAccounts}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment account" />
                        </SelectTrigger>
                        <SelectContent>
                          {floatAccounts
                            .filter((account) => {
                              if (formData.paymentSource === "momo") {
                                return account.account_type === "momo";
                              } else if (formData.paymentSource === "bank") {
                                return (
                                  account.account_type === "agency-banking"
                                );
                              }
                              return false;
                            })
                            .map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                <span className="flex items-center justify-between w-full">
                                  <div className="flex flex-col">
                                    <span>
                                      {account.provider || account.account_name}
                                    </span>
                                    {user?.role?.toLowerCase() === "admin" &&
                                      account.branch_name && (
                                        <span className="text-xs text-muted-foreground">
                                          {account.branch_name}
                                        </span>
                                      )}
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {formatCurrency(account.current_balance)}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {formData.paymentSource !== "cash" &&
                  formData.paymentAccountId && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>Selected Account:</strong>{" "}
                        {floatAccounts.find(
                          (acc) => acc.id === formData.paymentAccountId
                        )?.provider ||
                          floatAccounts.find(
                            (acc) => acc.id === formData.paymentAccountId
                          )?.account_name}
                        {user?.role?.toLowerCase() === "admin" &&
                          floatAccounts.find(
                            (acc) => acc.id === formData.paymentAccountId
                          )?.branch_name && (
                            <span className="text-blue-600 ml-2">
                              (
                              {
                                floatAccounts.find(
                                  (acc) => acc.id === formData.paymentAccountId
                                )?.branch_name
                              }
                              )
                            </span>
                          )}
                      </p>
                      <p className="text-sm text-blue-600">
                        <strong>Current Balance:</strong>{" "}
                        {formatCurrency(
                          floatAccounts.find(
                            (acc) => acc.id === formData.paymentAccountId
                          )?.current_balance || 0
                        )}
                      </p>
                      <p className="text-sm text-blue-600">
                        <strong>After Purchase:</strong>{" "}
                        {formatCurrency(
                          (floatAccounts.find(
                            (acc) => acc.id === formData.paymentAccountId
                          )?.current_balance || 0) -
                            Number(formData.purchaseCost || 0)
                        )}
                      </p>
                    </div>
                  )}
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAsset}>Add Asset</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalAssets)}
            </div>
            <p className="text-xs text-muted-foreground">
              {assets.length} assets registered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Accumulated Depreciation
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalDepreciation)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total depreciation to date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Book Value
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(netBookValue)}
            </div>
            <p className="text-xs text-muted-foreground">Current asset value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assets</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assets.filter((a) => a.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">Currently in use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Branch Context
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {user?.role?.toLowerCase() === "admin"
                ? "All Branches"
                : user?.branchName || "Unknown Branch"}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role?.toLowerCase() === "admin"
                ? "Viewing assets from all branches"
                : `Viewing assets for ${user?.branchName || "your branch"}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Fixed Assets</CardTitle>
          <CardDescription>
            Complete list of all fixed assets with their current values
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading assets...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Purchase Cost</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead>Depreciation</TableHead>
                  <TableHead>Payment Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {asset.serialNumber && `SN: ${asset.serialNumber}`}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{asset.category}</TableCell>
                    <TableCell>{formatCurrency(asset.purchaseCost)}</TableCell>
                    <TableCell>{formatCurrency(asset.currentValue)}</TableCell>
                    <TableCell>
                      {formatCurrency(asset.accumulatedDepreciation)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {asset.paymentSource || "Cash"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDepreciation(asset)}
                          title="View Depreciation"
                        >
                          <Calculator className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAsset(asset)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAsset(asset)}
                          title="Edit Asset"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAsset(asset)}
                          title="Delete Asset"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Depreciation Schedule Dialog */}
      <Dialog
        open={showDepreciationDialog}
        onOpenChange={setShowDepreciationDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Depreciation Schedule - {selectedAsset?.name}
            </DialogTitle>
            <DialogDescription>
              Complete depreciation schedule for the selected asset
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Purchase Cost:</span>{" "}
                {formatCurrency(selectedAsset?.purchaseCost || 0)}
              </div>
              <div>
                <span className="font-medium">Salvage Value:</span>{" "}
                {formatCurrency(selectedAsset?.salvageValue || 0)}
              </div>
              <div>
                <span className="font-medium">Useful Life:</span>{" "}
                {selectedAsset?.usefulLife || 0} years
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Beginning Value</TableHead>
                  <TableHead>Depreciation Expense</TableHead>
                  <TableHead>Accumulated Depreciation</TableHead>
                  <TableHead>Ending Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {depreciationSchedule.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell>{row.year}</TableCell>
                    <TableCell>{formatCurrency(row.beginningValue)}</TableCell>
                    <TableCell>
                      {formatCurrency(row.depreciationExpense)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(row.accumulatedDepreciation)}
                    </TableCell>
                    <TableCell>{formatCurrency(row.endingValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Asset Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asset Details - {selectedAsset?.name}</DialogTitle>
            <DialogDescription>
              Complete details of the selected fixed asset
            </DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Asset Name</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.name}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Category</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.category}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Purchase Date</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedAsset.purchaseDate)}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Purchase Cost</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedAsset.purchaseCost)}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Current Value</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedAsset.currentValue)}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">
                    Accumulated Depreciation
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(selectedAsset.accumulatedDepreciation)}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Useful Life</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.usefulLife} years
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Depreciation Method</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.depreciationMethod}
                  </p>
                </div>
                <div>
                  <Label className="font-medium">Status</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedAsset.status)}
                  </div>
                </div>
                <div>
                  <Label className="font-medium">Branch</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.branchName}
                  </p>
                </div>
              </div>

              {selectedAsset.description && (
                <div>
                  <Label className="font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedAsset.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedAsset.location && (
                  <div>
                    <Label className="font-medium">Location</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedAsset.location}
                    </p>
                  </div>
                )}
                {selectedAsset.serialNumber && (
                  <div>
                    <Label className="font-medium">Serial Number</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedAsset.serialNumber}
                    </p>
                  </div>
                )}
                {selectedAsset.supplier && (
                  <div>
                    <Label className="font-medium">Supplier</Label>
                    <p className="text-sm text-muted-foreground">
                      {selectedAsset.supplier}
                    </p>
                  </div>
                )}
                {selectedAsset.warrantyExpiry && (
                  <div>
                    <Label className="font-medium">Warranty Expiry</Label>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(selectedAsset.warrantyExpiry)}
                    </p>
                  </div>
                )}
                {selectedAsset.paymentSource && (
                  <div>
                    <Label className="font-medium">Payment Source</Label>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedAsset.paymentSource}
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Information Section */}
              {selectedAsset.paymentSource &&
                selectedAsset.paymentSource !== "cash" && (
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold mb-2">
                      Payment Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="font-medium">Payment Method</Label>
                        <p className="text-sm text-muted-foreground capitalize">
                          {selectedAsset.paymentSource}
                        </p>
                      </div>
                      <div>
                        <Label className="font-medium">
                          Payment Account ID
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {selectedAsset.paymentAccountId || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Fixed Asset</DialogTitle>
            <DialogDescription>
              Update the details of the selected fixed asset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Asset Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Office Building"
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Detailed description of the asset"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-purchaseDate">Purchase Date *</Label>
                <Input
                  id="edit-purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) =>
                    setFormData({ ...formData, purchaseDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-purchaseCost">Purchase Cost (₵) *</Label>
                <Input
                  id="edit-purchaseCost"
                  type="number"
                  step="0.01"
                  value={formData.purchaseCost}
                  onChange={(e) =>
                    setFormData({ ...formData, purchaseCost: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-salvageValue">Salvage Value (₵)</Label>
                <Input
                  id="edit-salvageValue"
                  type="number"
                  step="0.01"
                  value={formData.salvageValue}
                  onChange={(e) =>
                    setFormData({ ...formData, salvageValue: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="edit-usefulLife">Useful Life (Years) *</Label>
                <Input
                  id="edit-usefulLife"
                  type="number"
                  value={formData.usefulLife}
                  onChange={(e) =>
                    setFormData({ ...formData, usefulLife: e.target.value })
                  }
                  placeholder="5"
                />
              </div>
              <div>
                <Label htmlFor="edit-depreciationMethod">
                  Depreciation Method
                </Label>
                <Select
                  value={formData.depreciationMethod}
                  onValueChange={(value) =>
                    setFormData({ ...formData, depreciationMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {depreciationMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="e.g., Main Office, Floor 2"
                />
              </div>
              <div>
                <Label htmlFor="edit-serialNumber">Serial Number</Label>
                <Input
                  id="edit-serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, serialNumber: e.target.value })
                  }
                  placeholder="SN123456789"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-supplier">Supplier</Label>
                <Input
                  id="edit-supplier"
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <Label htmlFor="edit-warrantyExpiry">Warranty Expiry</Label>
                <Input
                  id="edit-warrantyExpiry"
                  type="date"
                  value={formData.warrantyExpiry}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      warrantyExpiry: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAsset}>Update Asset</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Fixed Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedAsset?.name}"? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
