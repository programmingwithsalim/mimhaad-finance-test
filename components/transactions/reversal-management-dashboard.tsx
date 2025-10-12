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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
} from "lucide-react";
import { format } from "date-fns";

interface Reversal {
  id: string;
  transaction_id: string;
  service_type: string;
  reversal_type: string;
  reason: string;
  amount: number;
  fee: number;
  customer_name: string;
  phone_number: string;
  branch_id: string;
  branch_name: string;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  executed_by?: string;
  executed_at?: string;
  status: string;
  approval_notes?: string;
  review_comments?: string;
}

export function ReversalManagementDashboard() {
  const { toast } = useToast();
  const [reversals, setReversals] = useState<Reversal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    serviceType: "all",
    branchId: "all",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReversals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.serviceType !== "all")
        params.append("serviceType", filters.serviceType);
      if (filters.branchId !== "all")
        params.append("branchId", filters.branchId);

      const response = await fetch(
        `/api/transactions/reversals?${params.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        setReversals(result.reversals || []);
      } else {
        throw new Error(result.error || "Failed to fetch reversals");
      }
    } catch (error) {
      console.error("Error fetching reversals:", error);
      toast({
        title: "Error",
        description: "Failed to fetch transaction reversals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReversals();
  }, [filters]);

  const handleApprove = async (reversalId: string) => {
    try {
      const response = await fetch(
        `/api/transactions/reversals/${reversalId}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            approved_by: "current-user", // Replace with actual user ID
            approval_notes: "Approved via dashboard",
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Reversal Approved",
          description: "The reversal request has been approved successfully.",
        });
        fetchReversals();
      } else {
        throw new Error(result.error || "Failed to approve reversal");
      }
    } catch (error) {
      console.error("Error approving reversal:", error);
      toast({
        title: "Error",
        description: "Failed to approve reversal",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (reversalId: string) => {
    try {
      const response = await fetch(
        `/api/transactions/reversals/${reversalId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rejected_by: "current-user", // Replace with actual user ID
            rejection_reason: "Rejected via dashboard",
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Reversal Rejected",
          description: "The reversal request has been rejected.",
        });
        fetchReversals();
      } else {
        throw new Error(result.error || "Failed to reject reversal");
      }
    } catch (error) {
      console.error("Error rejecting reversal:", error);
      toast({
        title: "Error",
        description: "Failed to reject reversal",
        variant: "destructive",
      });
    }
  };

  const handleExecute = async (reversalId: string) => {
    try {
      const response = await fetch(
        `/api/transactions/reversals/${reversalId}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            executed_by: "current-user", // Replace with actual user ID
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Reversal Executed",
          description: "The reversal has been executed successfully.",
        });
        fetchReversals();
      } else {
        throw new Error(result.error || "Failed to execute reversal");
      }
    } catch (error) {
      console.error("Error executing reversal:", error);
      toast({
        title: "Error",
        description: "Failed to execute reversal",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="text-blue-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="text-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "reversed":
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800">
            Reversed
          </Badge>
        );
      case "deleted":
        return (
          <Badge
            variant="outline"
            className="bg-gray-200 text-gray-700 line-through"
          >
            Deleted
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredReversals = reversals.filter(
    (reversal) =>
      searchQuery === "" ||
      reversal.transaction_id
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      reversal.customer_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      reversal.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingReversals = filteredReversals.filter(
    (r) => r.status === "pending"
  );
  const approvedReversals = filteredReversals.filter(
    (r) => r.status === "approved"
  );
  const completedReversals = filteredReversals.filter(
    (r) => r.status === "completed"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold tracking-tight">
          Transaction Reversals
        </h2>
        <Button onClick={fetchReversals} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Reversals
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReversals.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedReversals.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedReversals.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Reversals
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reversals.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select
                value={filters.serviceType}
                onValueChange={(value) =>
                  setFilters({ ...filters, serviceType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="momo">MoMo</SelectItem>
                  <SelectItem value="agency-banking">Agency Banking</SelectItem>
                  <SelectItem value="e-zwich">E-Zwich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reversals Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All Reversals ({filteredReversals.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingReversals.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedReversals.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedReversals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ReversalsList
            reversals={filteredReversals}
            onApprove={handleApprove}
            onReject={handleReject}
            onExecute={handleExecute}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="pending">
          <ReversalsList
            reversals={pendingReversals}
            onApprove={handleApprove}
            onReject={handleReject}
            onExecute={handleExecute}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="approved">
          <ReversalsList
            reversals={approvedReversals}
            onApprove={handleApprove}
            onReject={handleReject}
            onExecute={handleExecute}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>

        <TabsContent value="completed">
          <ReversalsList
            reversals={completedReversals}
            onApprove={handleApprove}
            onReject={handleReject}
            onExecute={handleExecute}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ReversalsListProps {
  reversals: Reversal[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
}

function ReversalsList({
  reversals,
  onApprove,
  onReject,
  onExecute,
  getStatusBadge,
}: ReversalsListProps) {
  if (reversals.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Reversals Found</h3>
            <p className="text-muted-foreground">
              No transaction reversals match your current filters.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reversals.map((reversal) => (
        <Card key={reversal.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  {reversal.service_type.toUpperCase()} -{" "}
                  {reversal.reversal_type.toUpperCase()}
                </CardTitle>
                <CardDescription>
                  Transaction ID: {reversal.transaction_id}
                </CardDescription>
              </div>
              {getStatusBadge(reversal.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Customer</Label>
                <p className="text-sm">{reversal.customer_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Amount</Label>
                <p className="text-sm font-mono">
                  GHS {reversal.amount.toFixed(2)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Branch</Label>
                <p className="text-sm">{reversal.branch_name}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Reason</Label>
              <p className="text-sm text-muted-foreground">{reversal.reason}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <strong>Requested by:</strong> {reversal.requested_by_name}{" "}
                <br />
                <strong>Requested at:</strong>{" "}
                {format(new Date(reversal.requested_at), "PPp")}
              </div>
              {reversal.approved_by && (
                <div>
                  <strong>Approved by:</strong> {reversal.approved_by_name}{" "}
                  <br />
                  <strong>Approved at:</strong>{" "}
                  {reversal.approved_at
                    ? format(new Date(reversal.approved_at), "PPp")
                    : "N/A"}
                </div>
              )}
            </div>

            {reversal.approval_notes && (
              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <p className="text-sm text-muted-foreground">
                  {reversal.approval_notes}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {reversal.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => onApprove(reversal.id)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onReject(reversal.id)}
                  >
                    Reject
                  </Button>
                </>
              )}
              {reversal.status === "approved" && (
                <Button size="sm" onClick={() => onExecute(reversal.id)}>
                  Execute Reversal
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
