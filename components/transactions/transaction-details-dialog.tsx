"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface Transaction {
  id: string;
  customer_name: string;
  phone_number: string;
  amount: number;
  fee: number;
  type: string;
  status: string;
  reference: string;
  provider: string;
  created_at: string;
  branch_id: string;
  branch_name?: string;
  processed_by: string;
  service_type: string;
}

interface TransactionDetailsDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailsDialog({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailsDialogProps) {
  if (!transaction) return null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "successful":
      case "success":
      case "complete":
      case "settled":
      case "received":
        return "bg-green-100 text-green-800";
      case "pending":
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
      case "error":
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "reversed":
        return "bg-red-100 text-red-800";
      case "deleted":
        return "bg-gray-200 text-gray-700 line-through";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getServiceColor = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return "bg-blue-100 text-blue-800";
      case "agency_banking":
        return "bg-purple-100 text-purple-800";
      case "ezwich":
        return "bg-green-100 text-green-800";
      case "power":
        return "bg-yellow-100 text-yellow-800";
      case "jumia":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
          <DialogDescription>
            Detailed information about transaction #{transaction.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                Transaction #{transaction.id}
              </h3>
              <p className="text-sm text-muted-foreground">
                {format(new Date(transaction.created_at), "PPP 'at' HH:mm:ss")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getServiceColor(transaction.service_type)}>
                {transaction.service_type.replace("_", " ").toUpperCase()}
              </Badge>
              <Badge className={getStatusColor(transaction.status)}>
                {transaction.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Customer Name
                  </label>
                  <p className="text-sm">{transaction.customer_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Phone Number
                  </label>
                  <p className="text-sm">{transaction.phone_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Type
                  </label>
                  <p className="text-sm capitalize">
                    {transaction.type.replace("-", " ")}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Provider
                  </label>
                  <p className="text-sm">{transaction.provider}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Amount
                  </label>
                  <p className="text-sm font-medium">
                    ₵{transaction.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Fee
                  </label>
                  <p className="text-sm">₵{transaction.fee.toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Reference
                  </label>
                  <p className="text-sm font-mono">{transaction.reference}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Branch
                  </label>
                  <p className="text-sm">{transaction.branch_name || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Processed By
                  </label>
                  <p className="text-sm">{transaction.processed_by}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Service Type
                  </label>
                  <p className="text-sm capitalize">
                    {transaction.service_type.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Branch ID
                  </label>
                  <p className="text-sm font-mono">{transaction.branch_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Transaction ID
                  </label>
                  <p className="text-sm font-mono">{transaction.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
