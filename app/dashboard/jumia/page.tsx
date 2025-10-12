"use client";

import type React from "react";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useServiceStatistics } from "@/hooks/use-service-statistics";
import { useDynamicFee } from "@/hooks/use-dynamic-fee";
import { DynamicFloatDisplay } from "@/components/shared/dynamic-float-display";
import {
  Package,
  TrendingUp,
  DollarSign,
  Users,
  RefreshCw,
  Plus,
  Download,
  AlertTriangle,
  Edit,
  Trash2,
  Printer,
  Eye,
  AlertCircle,
  Loader2,
  Search,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TransactionActions } from "@/components/transactions/transaction-actions";
import {
  TransactionReceipt,
  TransactionReceiptData,
} from "@/components/shared/transaction-receipt";
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

export default function JumiaPage() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const {
    statistics,
    floatAlerts,
    isLoading: statsLoading,
    refreshStatistics,
  } = useServiceStatistics("jumia");

  const [submitting, setSubmitting] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [floatAccounts, setFloatAccounts] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingFloats, setLoadingFloats] = useState(false);
  const [activeTab, setActiveTab] = useState("package_delivery");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [transactionsPerPage] = useState(20);

  const [packageForm, setPackageForm] = useState({
    tracking_id: "",
    customer_name: "",
    customer_phone: "",
    notes: "",
  });

  const [podForm, setPodForm] = useState({
    tracking_id: "",
    amount: "",
    fee: 0,
    customer_name: "",
    customer_phone: "",
    delivery_status: "delivered",
    payment_method: "cash",
    float_account_id: "",
    notes: "",
    is_pod: true, // New field to indicate if it's a POD package
  });

  const [settlementForm, setSettlementForm] = useState({
    amount: "",
    reference: "",
    float_account_id: "none",
    tracking_id: "",
    notes: "",
  });

  const [settlementCalculator, setSettlementCalculator] = useState({
    settlementAmount: 0,
    collectionCount: 0,
    unsettledPackageCount: 0,
    lastSettlementDate: null,
    fromDate: "",
    toDate: "",
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSettlementFloat, setSelectedSettlementFloat] =
    useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [receiptData, setReceiptData] = useState<TransactionReceiptData | null>(
    null
  );
  const [showReceipt, setShowReceipt] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount || 0);
  };

  const loadTransactions = async (page = 1) => {
    if (!user?.branchId) return;

    try {
      setLoadingTransactions(true);
      const params = new URLSearchParams({
        branchId: user.branchId,
        limit: transactionsPerPage.toString(),
        page: page.toString(),
      });

      // Add filters if they exist
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter && statusFilter !== "all")
        params.append("status", statusFilter);
      if (typeFilter && typeFilter !== "all") params.append("type", typeFilter);

      const response = await fetch(
        `/api/jumia/transactions?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setTransactions(data.data);
          setTotalPages(data.totalPages || 1);
          setTotalTransactions(data.total || 0);
          setCurrentPage(page);
        } else {
          setTransactions([]);
          setTotalPages(1);
          setTotalTransactions(0);
        }
      } else {
        setTransactions([]);
        setTotalPages(1);
        setTotalTransactions(0);
      }
    } catch (error) {
      console.error("Error loading Jumia transactions:", error);
      setTransactions([]);
      setTotalPages(1);
      setTotalTransactions(0);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadPackages = async () => {
    if (!user?.branchId) return;

    try {
      setLoadingPackages(true);
      const response = await fetch(
        `/api/jumia/packages?branchId=${user.branchId}&limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setPackages(data.data);
        } else {
          setPackages([]);
        }
      } else {
        setPackages([]);
      }
    } catch (error) {
      console.error("Error loading Jumia packages:", error);
      setPackages([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const loadFloatAccounts = async () => {
    if (!user?.branchId) return;

    try {
      setLoadingFloats(true);
      const response = await fetch(
        `/api/float-accounts?branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.accounts)) {
          setFloatAccounts(
            data.accounts.filter((account: any) => account.is_active)
          );
        } else {
          setFloatAccounts([]);
        }
      } else {
        setFloatAccounts([]);
      }
    } catch (error) {
      console.error("Error loading float accounts:", error);
      setFloatAccounts([]);
    } finally {
      setLoadingFloats(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1);
    loadTransactions(1);
  };

  useEffect(() => {
    if (user?.branchId) {
      loadTransactions();
      loadPackages();
      loadFloatAccounts();
      calculateSettlementAmount(); // Auto-calculate settlement amount on load
    }
  }, [user?.branchId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (user?.branchId) {
      handleFilterChange();
    }
  }, [searchTerm, statusFilter, typeFilter]);

  // Auto-calculate settlement amount when settlement tab is opened
  useEffect(() => {
    if (user?.branchId && activeTab === "settlement") {
      calculateSettlementAmount();
    }
  }, [user?.branchId, activeTab]);

  // Reset float account when payment method changes
  useEffect(() => {
    setPodForm((prevForm) => ({
      ...prevForm,
      float_account_id: "", // Reset to empty when payment method changes
    }));
  }, [podForm.payment_method]);

  const handlePackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Validate required fields
    if (!packageForm.tracking_id.trim() || !packageForm.customer_name.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate customer phone (must be exactly 10 digits for package collection)
    if (!packageForm.customer_phone) {
      toast({
        title: "Missing Phone Number",
        description: "Customer phone number is required for package collection",
        variant: "destructive",
      });
      return;
    }

    if (
      packageForm.customer_phone.length !== 10 ||
      !/^\d{10}$/.test(packageForm.customer_phone)
    ) {
      toast({
        title: "Invalid Phone Number",
        description:
          "Phone number must be exactly 10 digits (e.g., 0241234567)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/jumia/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tracking_id: packageForm.tracking_id.trim(),
          customer_name: packageForm.customer_name.trim(),
          customer_phone: packageForm.customer_phone.trim() || null,
          notes: packageForm.notes.trim() || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Package Received",
          description: `Package with tracking ID ${packageForm.tracking_id} has been received from Jumia and is ready for pickup.`,
        });

        // Reset form
        setPackageForm({
          tracking_id: "",
          customer_name: "",
          customer_phone: "",
          notes: "",
        });
        // Refresh data
        loadPackages();
        refreshStatistics();
        calculateSettlementAmount(); // Recalculate settlement amount after package creation
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to record package",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error recording package:", error);
      toast({
        title: "Error",
        description: "Failed to record package. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.branchId || !user?.id) {
      toast({
        title: "Error",
        description: "Branch ID is required",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    if (!podForm.tracking_id || !podForm.customer_name) {
      toast({
        title: "Missing Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate customer phone (must be exactly 10 digits for POD collection)
    if (!podForm.customer_phone) {
      toast({
        title: "Missing Phone Number",
        description: "Customer phone number is required for package collection",
        variant: "destructive",
      });
      return;
    }

    if (
      podForm.customer_phone.length !== 10 ||
      !/^\d{10}$/.test(podForm.customer_phone)
    ) {
      toast({
        title: "Invalid Phone Number",
        description:
          "Phone number must be exactly 10 digits (e.g., 0241234567)",
        variant: "destructive",
      });
      return;
    }

    // Validate amount only if it's a POD package
    if (podForm.is_pod) {
      if (!podForm.amount || Number(podForm.amount) <= 0) {
        toast({
          title: "Invalid Amount",
          description:
            "Please enter a valid amount greater than 0 for POD packages",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate customer phone (if provided, must be exactly 10 digits)
    if (podForm.customer_phone) {
      if (
        podForm.customer_phone.length !== 10 ||
        !/^\d{10}$/.test(podForm.customer_phone)
      ) {
        toast({
          title: "Invalid Phone Number",
          description:
            "Phone number must be exactly 10 digits (e.g., 0241234567)",
          variant: "destructive",
        });
        return;
      }
    }

    if (!podForm.float_account_id) {
      toast({
        title: "Missing Float Account",
        description: "Please select a float account for payment",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/jumia/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_type: "pod_collection",
          tracking_id: podForm.tracking_id.trim(),
          amount: podForm.is_pod ? Number(podForm.amount) : 0,
          fee: podForm.is_pod ? Number(podForm.fee) : 0,
          customer_name: podForm.customer_name.trim(),
          customer_phone: podForm.customer_phone.trim() || null,
          delivery_status: podForm.delivery_status,
          payment_method: podForm.payment_method,
          float_account_id: podForm.float_account_id || null,
          notes: podForm.notes.trim() || null,
          branch_id: user.branchId,
          user_id: user.id,
          is_pod: podForm.is_pod, // Send POD flag
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Collection Recorded",
          description: podForm.is_pod
            ? `POD collection of ${formatCurrency(
                Number(podForm.amount)
              )} recorded for ${podForm.customer_name}`
            : `Free delivery recorded for ${podForm.customer_name}`,
        });

        // Reset form
        setPodForm({
          tracking_id: "",
          amount: "",
          fee: 0,
          customer_name: "",
          customer_phone: "",
          delivery_status: "delivered",
          payment_method: "cash",
          float_account_id: "",
          notes: "",
          is_pod: true,
        });

        // Refresh data
        loadTransactions();
        loadPackages();
        refreshStatistics();
        calculateSettlementAmount(); // Recalculate settlement amount after collection
      } else {
        throw new Error(result.error || "Failed to record payment collection");
      }
    } catch (error) {
      toast({
        title: "Failed to Record Payment",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.branchId || !user?.id) {
      toast({
        title: "Error",
        description: "Branch ID is required",
        variant: "destructive",
      });
      return;
    }
    if (!settlementForm.amount || !settlementForm.reference) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate amount (must be positive and not exceed available amount)
    const amount = Number(settlementForm.amount);
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Check if amount exceeds available settlement amount
    if (amount > settlementCalculator.settlementAmount) {
      toast({
        title: "Amount Too High",
        description: `Amount cannot exceed available settlement amount of ${formatCurrency(
          settlementCalculator.settlementAmount
        )}`,
        variant: "destructive",
      });
      return;
    }
    if (
      !settlementForm.float_account_id ||
      settlementForm.float_account_id === "none"
    ) {
      toast({
        title: "Missing Float Account",
        description: "Please select a float account for settlement",
        variant: "destructive",
      });
      return;
    }
    const selectedFloat = floatAccounts.find(
      (a) => a.id === settlementForm.float_account_id
    );
    if (!selectedFloat) {
      toast({
        title: "Invalid Float Account",
        description: "Selected float account is invalid.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const settlementData = {
        transaction_type: "settlement",
        amount: Number.parseFloat(settlementForm.amount),
        settlement_reference: settlementForm.reference, // Fix: map reference to settlement_reference
        float_account_id: settlementForm.float_account_id,
        tracking_id: settlementForm.tracking_id || null,
        notes: settlementForm.notes || null,
        branch_id: user.branchId,
        user_id: user.id,
        paymentAccountCode: selectedFloat.gl_account_code,
        paymentAccountName: selectedFloat.provider,
      };

      console.log("Submitting settlement data:", settlementData);

      const response = await fetch("/api/jumia/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settlementData),
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Settlement Processed",
          description: `Settlement of ${formatCurrency(
            Number.parseFloat(settlementForm.amount)
          )} has been successfully processed.`,
        });
        setSettlementForm({
          amount: "",
          reference: "",
          float_account_id: "none",
          tracking_id: "",
          notes: "",
        });
        loadTransactions();
        loadPackages();
        refreshStatistics();
        calculateSettlementAmount(); // Recalculate settlement amount after settlement
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process settlement",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing settlement:", error);
      toast({
        title: "Error",
        description: "Failed to process settlement",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateSettlementAmount = async () => {
    if (!user?.branchId) return;

    try {
      console.log("Calculating settlement amount for branch:", user.branchId);
      const response = await fetch(
        `/api/jumia/settlement-calculator?branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Settlement calculator response:", data);
        if (data.success) {
          console.log("Setting settlement calculator data:", data.data);
          setSettlementCalculator(data.data);

          // Show success message with the calculated amount
          toast({
            title: "Settlement Calculator Updated",
            description: `Available for settlement: ${formatCurrency(
              data.data.settlementAmount
            )}`,
          });

          // Remove auto-population - let users enter any amount they want
          // setSettlementForm((prev) => ({
          //   ...prev,
          //   amount: data.data.settlementAmount.toString(),
          // }));
        }
      } else {
        console.error(
          "Settlement calculator API error:",
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error("Error calculating settlement amount:", error);
    }
  };

  const searchPackageByTracking = async (trackingId: string) => {
    if (!trackingId.trim() || !user?.branchId) return;

    try {
      const response = await fetch(
        `/api/jumia/packages/search?trackingId=${trackingId}&branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const packageInfo = data.data;
          setSettlementForm((prev) => ({
            ...prev,
            tracking_id: packageInfo.tracking_id,
            notes: `Package: ${packageInfo.customer_name} - ${
              packageInfo.customer_phone || "No phone"
            }`,
          }));

          toast({
            title: "Package Found",
            description: `Package info loaded for ${packageInfo.customer_name}`,
          });
        } else {
          toast({
            title: "Package Not Found",
            description: "No package found with this tracking ID",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error searching package:", error);
      toast({
        title: "Error",
        description: "Failed to search package",
        variant: "destructive",
      });
    }
  };

  const searchPackageForCollection = async (trackingId: string) => {
    if (!trackingId.trim() || !user?.branchId) return;

    try {
      const response = await fetch(
        `/api/jumia/packages/search?trackingId=${trackingId}&branchId=${user.branchId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const packageInfo = data.data;

          // Auto-populate collection form
          setPodForm((prev) => ({
            ...prev,
            tracking_id: packageInfo.tracking_id,
            customer_name: packageInfo.customer_name,
            customer_phone: packageInfo.customer_phone || "",
          }));

          toast({
            title: "Package Found",
            description: `Package info loaded for ${packageInfo.customer_name}`,
          });
        } else {
          toast({
            title: "Package Not Found",
            description:
              "No package found with this tracking ID. Please record the package first.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error searching package:", error);
      toast({
        title: "Error",
        description: "Failed to search package",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Type",
      "Tracking ID/Reference",
      "Customer",
      "Phone",
      "Amount",
      "Status",
      "Payment Method",
    ];
    const csvData = transactions.map((transaction: any) => [
      format(
        new Date(transaction.created_at || new Date()),
        "yyyy-MM-dd HH:mm:ss"
      ),
      transaction.transaction_type?.replace("_", " ") || "",
      transaction.transaction_type === "settlement"
        ? transaction.settlement_reference || transaction.tracking_id || ""
        : transaction.tracking_id || "",
      transaction.customer_name || "",
      transaction.customer_phone || "",
      transaction.amount
        ? Number.parseFloat(transaction.amount).toFixed(2)
        : "0.00",
      transaction.delivery_status || transaction.status || "",
      transaction.payment_method || "",
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `jumia-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${transactions.length} transactions to CSV`,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, text: "Pending" },
      completed: { variant: "default" as const, text: "Completed" },
      delivered: { variant: "default" as const, text: "Delivered" },
      settled: { variant: "default" as const, text: "Settled" },
      failed: { variant: "destructive" as const, text: "Failed" },
      active: { variant: "default" as const, text: "Active" },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "outline" as const,
      text: status,
    };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      package_receipt: { variant: "default" as const, text: "Package Receipt" },
      pod_collection: { variant: "secondary" as const, text: "POD Collection" },
      settlement: { variant: "outline" as const, text: "Settlement" },
    };
    const config = typeConfig[type as keyof typeof typeConfig] || {
      variant: "outline" as const,
      text: type,
    };
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getSelectedProvider = () => {
    // For Jumia, we always show "Jumia" instead of dynamic provider selection
    return "Jumia";
  };

  const handleEdit = (tx: any) => {
    setCurrentTransaction(tx);
    setShowEditDialog(true);
  };

  const handleDelete = (tx: any) => {
    setCurrentTransaction(tx);
    setShowDeleteDialog(true);
  };

  const handlePrint = (tx: any) => {
    setCurrentTransaction(tx);
    setShowPrintDialog(true);
  };

  const confirmDelete = async () => {
    if (!currentTransaction) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/jumia/transactions/${currentTransaction.transaction_id}`,
        {
          method: "DELETE",
        }
      );
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Transaction Deleted",
          description: "Transaction has been deleted successfully",
        });
        setShowDeleteDialog(false);
        setCurrentTransaction(null);
        loadTransactions();
        refreshStatistics();
      } else {
        toast({
          title: "Delete Failed",
          description: result.error || "Failed to delete transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSubmit = async (updated: any) => {
    if (!currentTransaction) return;
    setIsEditing(true);
    try {
      const response = await fetch(
        `/api/jumia/transactions/${currentTransaction.transaction_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        }
      );
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Transaction Updated",
          description: "Transaction has been updated successfully",
        });
        setShowEditDialog(false);
        setCurrentTransaction(null);
        loadTransactions();
        refreshStatistics();
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Failed to update transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update transaction",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const printReceipt = (tx: any) => {
    // Format transaction data for the shared receipt component
    const formattedReceiptData: TransactionReceiptData = {
      transactionId: tx.id || tx.transaction_id,
      sourceModule: "jumia",
      transactionType: tx.transaction_type || "package_receipt",
      amount: tx.amount || 0,
      fee: tx.fee || 0,
      customerName: tx.customer_name,
      customerPhone: tx.customer_phone,
      reference: tx.reference || tx.id || tx.transaction_id,
      branchName: user?.branchName || "Main Branch",
      date: tx.created_at || tx.date || new Date().toISOString(),
      additionalData: {
        "Tracking ID": tx.tracking_id,
        "Delivery Status": tx.delivery_status,
        "Payment Method": tx.payment_method,
        Status: tx.status,
      },
    };

    setReceiptData(formattedReceiptData);
    setShowReceipt(true);
  };

  const getStatusText = (status: string) => {
    if (!status) return "-";
    const map: Record<string, string> = {
      active: "Active",
      completed: "Completed",
      reversed: "Reversed",
      deleted: "Deleted",
      pending: "Pending",
      delivered: "Delivered",
      returned: "Returned",
      partial: "Partial Delivery",
      unknown: "Unknown",
    };
    return (
      map[status.toLowerCase()] ||
      status.charAt(0).toUpperCase() + status.slice(1)
    );
  };

  const shouldShowPaymentMethod = (transaction: any) => {
    return (
      transaction.transaction_type === "pod_collection" ||
      transaction.transaction_type === "settlement"
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jumia Services</h1>
          <p className="text-muted-foreground">
            Manage packages, collections, and settlements
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            loadTransactions();
            loadPackages();
            loadFloatAccounts();
            refreshStatistics();
            calculateSettlementAmount(); // Recalculate settlement amount on refresh
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Float Alerts */}
      {floatAlerts.length > 0 && (
        <div className="space-y-2">
          {floatAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.severity === "critical"
                  ? "border-l-red-500 bg-red-50"
                  : "border-l-yellow-500 bg-yellow-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    alert.severity === "critical"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                />
                <span className="font-medium">
                  {alert.provider} float balance is {alert.severity}:{" "}
                  {formatCurrency(alert.current_balance)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Delivered Packages
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.todayPackages || statistics.todayTransactions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total:{" "}
              {statistics.totalPackages || statistics.totalTransactions || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Collections
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                statistics.todayCollectionAmount || statistics.todayVolume || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Total:{" "}
              {formatCurrency(
                statistics.totalCollectionAmount || statistics.totalVolume || 0
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Settlements
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                statistics.totalSettlementAmount ||
                  statistics.summary?.settlementAmount ||
                  statistics.total_settlement_amount ||
                  0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Amount settled to Jumia
            </p>
          </CardContent>
        </Card>

        {/* Jumia Liability Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Jumia Liability
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                (statistics.unsettledAmount || statistics.liability) ??
                  statistics.float_balance ??
                  statistics.floatBalance ??
                  0
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Unsettled POD collections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="package_delivery">Package Collection</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="transaction_history">
            Transaction History
          </TabsTrigger>
        </TabsList>

        <div
          className={`grid grid-cols-1 gap-6 mt-6 ${
            activeTab === "transaction_history" ? "" : "lg:grid-cols-3"
          }`}
        >
          {/* Main Content - 2 columns when float display is shown, full width when hidden */}
          <div
            className={
              activeTab === "transaction_history" ? "" : "lg:col-span-2"
            }
          >
            <TabsContent value="package_delivery" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Package Collection
                  </CardTitle>
                  <CardDescription>
                    Search and collect packages for customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePodSubmit} className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pod_tracking_id">Tracking ID</Label>
                        <div className="flex gap-2">
                          <Input
                            id="pod_tracking_id"
                            value={podForm.tracking_id}
                            onChange={(e) =>
                              setPodForm({
                                ...podForm,
                                tracking_id: e.target.value,
                              })
                            }
                            placeholder="Enter tracking ID to search"
                            required
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              searchPackageForCollection(podForm.tracking_id)
                            }
                            disabled={!podForm.tracking_id.trim()}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="pod_customer_name">
                            Customer Name
                          </Label>
                          <Input
                            id="pod_customer_name"
                            value={podForm.customer_name}
                            onChange={(e) =>
                              setPodForm({
                                ...podForm,
                                customer_name: e.target.value,
                              })
                            }
                            placeholder="Customer name"
                            required
                            disabled={true}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pod_customer_phone">
                            Customer Phone
                          </Label>
                          <Input
                            id="pod_customer_phone"
                            value={podForm.customer_phone}
                            onChange={(e) => {
                              // Only allow digits
                              const value = e.target.value.replace(/\D/g, "");
                              // Limit to 10 digits
                              const limitedValue = value.slice(0, 10);
                              setPodForm({
                                ...podForm,
                                customer_phone: limitedValue,
                              });
                            }}
                            placeholder="0241234567"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pod_amount">
                            Payment Amount (POD)
                          </Label>
                          <Input
                            id="pod_amount"
                            type="number"
                            step="0.01"
                            value={podForm.amount}
                            onChange={async (e) => {
                              const amount = parseFloat(e.target.value) || 0;

                              // Calculate fee if amount is provided
                              let fee = 0;
                              if (amount > 0 && podForm.is_pod) {
                                try {
                                  const feeResponse = await fetch(
                                    "/api/jumia/calculate-fee",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({
                                        amount,
                                        transactionType: "pod_collection",
                                      }),
                                    }
                                  );
                                  const feeData = await feeResponse.json();
                                  if (feeData.success) {
                                    fee = feeData.fee;
                                  }
                                } catch (error) {
                                  console.error(
                                    "Error calculating fee:",
                                    error
                                  );
                                }
                              }

                              setPodForm({
                                ...podForm,
                                amount,
                                fee,
                              });
                            }}
                            placeholder="0.00"
                            required
                          />
                          {podForm.is_pod && podForm.amount && (
                            <p className="text-sm text-muted-foreground">
                              Service Fee: GHS {podForm.fee.toFixed(2)}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pod_payment_method">
                            Payment Method
                          </Label>
                          <Select
                            value={podForm.payment_method}
                            onValueChange={(value) =>
                              setPodForm({
                                ...podForm,
                                payment_method: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="momo">Mobile Money</SelectItem>
                              <SelectItem value="card">
                                Bank Transfer
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pod_delivery_status">
                            Delivery Status
                          </Label>
                          <Select
                            value={podForm.delivery_status}
                            onValueChange={(value) =>
                              setPodForm({
                                ...podForm,
                                delivery_status: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select delivery status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="delivered">
                                Delivered
                              </SelectItem>
                              <SelectItem value="attempted">
                                Attempted
                              </SelectItem>
                              <SelectItem value="returned">Returned</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pod_float_account">
                            Float Account
                          </Label>
                          <Select
                            value={podForm.float_account_id}
                            onValueChange={(value) =>
                              setPodForm({
                                ...podForm,
                                float_account_id: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select float account" />
                            </SelectTrigger>
                            <SelectContent>
                              {floatAccounts
                                .filter((account) => {
                                  // Filter accounts based on payment method
                                  switch (podForm.payment_method) {
                                    case "cash":
                                      return (
                                        account.account_type ===
                                          "cash-in-till" ||
                                        account.account_type === "cash" ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("cash")
                                      );
                                    case "momo":
                                      return (
                                        account.account_type === "momo" ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("momo") ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("mtn") ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("vodafone") ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("airtel")
                                      );
                                    case "card":
                                      return (
                                        account.account_type ===
                                          "agency-banking" ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("bank") ||
                                        account.provider
                                          ?.toLowerCase()
                                          .includes("card")
                                      );
                                    default:
                                      return true; // Show all if no payment method selected
                                  }
                                })
                                .map((account) => (
                                  <SelectItem
                                    key={account.id}
                                    value={account.id}
                                  >
                                    {account.account_name ||
                                      account.provider ||
                                      account.account_type}{" "}
                                    - GHS{" "}
                                    {Number(
                                      account.current_balance || 0
                                    ).toFixed(2)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pod_notes">Notes (Optional)</Label>
                        <Textarea
                          id="pod_notes"
                          value={podForm.notes}
                          onChange={(e) =>
                            setPodForm({
                              ...podForm,
                              notes: e.target.value,
                            })
                          }
                          placeholder="Additional notes about delivery..."
                          rows={3}
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={
                          submitting ||
                          !podForm.tracking_id ||
                          !podForm.customer_name
                        }
                        className="w-full"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing Collection...
                          </>
                        ) : (
                          "Process Collection"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settlement" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Settlement
                  </CardTitle>
                  <CardDescription>
                    Process settlements to Jumia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSettlementSubmit} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="settlement_amount">
                          Settlement Amount
                        </Label>
                        <Input
                          id="settlement_amount"
                          type="number"
                          step="0.01"
                          value={settlementForm.amount}
                          onChange={(e) =>
                            setSettlementForm({
                              ...settlementForm,
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="settlement_reference">
                          Settlement Reference
                        </Label>
                        <Input
                          id="settlement_reference"
                          value={settlementForm.reference}
                          onChange={(e) =>
                            setSettlementForm({
                              ...settlementForm,
                              reference: e.target.value,
                            })
                          }
                          placeholder="Enter settlement reference"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="settlement_float_account">
                          Float Account
                        </Label>
                        <Select
                          value={settlementForm.float_account_id}
                          onValueChange={(value) =>
                            setSettlementForm({
                              ...settlementForm,
                              float_account_id: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select float account" />
                          </SelectTrigger>
                          <SelectContent>
                            {floatAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.account_name ||
                                  account.provider ||
                                  account.account_type}{" "}
                                - GHS{" "}
                                {Number(account.current_balance || 0).toFixed(
                                  2
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="settlement_notes">
                          Notes (Optional)
                        </Label>
                        <Input
                          id="settlement_notes"
                          value={settlementForm.notes}
                          onChange={(e) =>
                            setSettlementForm({
                              ...settlementForm,
                              notes: e.target.value,
                            })
                          }
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing Settlement...
                        </>
                      ) : (
                        "Process Settlement"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transaction_history" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Transaction History
                  </CardTitle>
                  <CardDescription>View all Jumia transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search transactions..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 w-full lg:w-64"
                        />
                      </div>
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger className="w-full lg:w-32">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="settled">Settled</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full lg:w-40">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="package_receipt">
                            Package Receipt
                          </SelectItem>
                          <SelectItem value="pod_collection">
                            POD Collection
                          </SelectItem>
                          <SelectItem value="settlement">Settlement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={exportToCSV} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                      </Button>
                      <Button
                        onClick={() =>
                          window.open("/dashboard/jumia/packages", "_blank")
                        }
                        variant="outline"
                      >
                        <Package className="mr-2 h-4 w-4" />
                        View All Packages
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Tracking</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingTransactions ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8">
                              Loading transactions...
                            </TableCell>
                          </TableRow>
                        ) : transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8">
                              No transactions found
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell>
                                {new Date(tx.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {getTypeBadge(tx.transaction_type)}
                              </TableCell>
                              <TableCell>
                                GHS {Number(tx.amount || 0).toFixed(2)}
                              </TableCell>
                              <TableCell>{tx.customer_name}</TableCell>
                              <TableCell>{tx.customer_phone}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {tx.tracking_id}
                              </TableCell>
                              <TableCell>{getStatusBadge(tx.status)}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {tx.reference}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(tx)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePrint(tx)}
                                  >
                                    Print
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(tx)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * transactionsPerPage + 1} to{" "}
                        {Math.min(
                          currentPage * transactionsPerPage,
                          totalTransactions
                        )}{" "}
                        of {totalTransactions} transactions
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadTransactions(currentPage - 1)}
                          disabled={currentPage <= 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>

                        <div className="flex items-center space-x-1">
                          {Array.from(
                            { length: Math.min(5, totalPages) },
                            (_, i) => {
                              const page = i + 1;
                              if (totalPages <= 5) {
                                return (
                                  <Button
                                    key={page}
                                    variant={
                                      currentPage === page
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => loadTransactions(page)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {page}
                                  </Button>
                                );
                              } else {
                                // Smart pagination for many pages
                                let pageToShow;
                                if (currentPage <= 3) {
                                  pageToShow = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                  pageToShow = totalPages - 4 + i;
                                } else {
                                  pageToShow = currentPage - 2 + i;
                                }
                                return (
                                  <Button
                                    key={pageToShow}
                                    variant={
                                      currentPage === pageToShow
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    onClick={() => loadTransactions(pageToShow)}
                                    className="w-8 h-8 p-0"
                                  >
                                    {pageToShow}
                                  </Button>
                                );
                              }
                            }
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadTransactions(currentPage + 1)}
                          disabled={currentPage >= totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          {/* Dynamic Float Display - Only show on package_delivery and settlement tabs */}
          {activeTab !== "transaction_history" && (
            <DynamicFloatDisplay
              selectedProvider={getSelectedProvider()}
              floatAccounts={floatAccounts}
              serviceType="jumia"
              onRefresh={loadFloatAccounts}
              isLoading={loadingFloats}
            />
          )}
        </div>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Jumia Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details below.
            </DialogDescription>
          </DialogHeader>
          {currentTransaction && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const updated = {
                  tracking_id: formData.get("tracking_id"),
                  customer_name: formData.get("customer_name"),
                  customer_phone: formData.get("customer_phone"),
                  amount: Number(formData.get("amount")),
                  status: formData.get("status"),
                  delivery_status: formData.get("delivery_status"),
                  payment_method: formData.get("payment_method"),
                  notes: formData.get("notes"),
                };
                handleEditSubmit(updated);
              }}
              className="space-y-4"
            >
              <div>
                <Label>Tracking ID</Label>
                <Input
                  name="tracking_id"
                  defaultValue={currentTransaction.tracking_id}
                />
              </div>
              <div>
                <Label>Customer Name</Label>
                <Input
                  name="customer_name"
                  defaultValue={currentTransaction.customer_name}
                />
              </div>
              <div>
                <Label>Customer Phone</Label>
                <Input
                  name="customer_phone"
                  defaultValue={currentTransaction.customer_phone}
                />
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={currentTransaction.amount}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Input name="status" defaultValue={currentTransaction.status} />
              </div>
              <div>
                <Label>Delivery Status</Label>
                <Input
                  name="delivery_status"
                  defaultValue={currentTransaction.delivery_status}
                />
              </div>
              <div>
                <Label>Payment Method</Label>
                <Input
                  name="payment_method"
                  defaultValue={currentTransaction.payment_method}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  name="notes"
                  defaultValue={currentTransaction.notes}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditing}>
                  {isEditing ? "Updating..." : "Update Transaction"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Jumia Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action
              cannot be undone.
              <br />
              <strong>Transaction ID:</strong>{" "}
              {currentTransaction?.transaction_id}
              <br />
              <strong>Tracking ID:</strong> {currentTransaction?.tracking_id}
              <br />
              <strong>Amount:</strong> GHS{" "}
              {Number(currentTransaction?.amount || 0).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Receipt</DialogTitle>
            <DialogDescription>
              Click the button below to print the receipt for this transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button onClick={() => printReceipt(currentTransaction)}>
              <Printer className="mr-2 h-4 w-4" /> Print Receipt
            </Button>
            <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Receipt Dialog */}
      <TransactionReceipt
        data={receiptData}
        open={showReceipt}
        onOpenChange={setShowReceipt}
      />
    </div>
  );
}
