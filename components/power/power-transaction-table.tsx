"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Printer } from "lucide-react";
import { EditPowerTransactionDialog } from "./edit-power-transaction-dialog";

interface PowerTransaction {
  id: string;
  reference: string;
  meterNumber: string;
  provider: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  status: string;
  createdAt: string;
}

interface PowerTransactionTableProps {
  transactions: PowerTransaction[];
  onTransactionUpdated?: () => void;
  onTransactionDeleted?: () => void;
  onEdit?: (transaction: PowerTransaction) => void;
  onDelete?: (transactionId: string) => void;
  onPrintReceipt?: (transaction: PowerTransaction) => void;
}

export function PowerTransactionTable({
  transactions,
  onTransactionUpdated,
  onTransactionDeleted,
  onEdit,
  onDelete,
  onPrintReceipt,
}: PowerTransactionTableProps) {
  const [editingTransaction, setEditingTransaction] =
    useState<PowerTransaction | null>(null);

  const handleEdit = (transaction: PowerTransaction) => {
    setEditingTransaction(transaction);
  };

  const handleDelete = (transactionId: string) => {
    if (onDelete) {
      onDelete(transactionId);
    }
  };

  const handlePrintReceipt = (transaction: PowerTransaction) => {
    if (onPrintReceipt) {
      onPrintReceipt(transaction);
    }
  };

  const handleTransactionUpdated = () => {
    setEditingTransaction(null);
    onTransactionUpdated?.();
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "success":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "failed":
      case "error":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      case "reversed":
        return <Badge className="bg-red-100 text-red-800">Reversed</Badge>;
      case "deleted":
        return (
          <Badge className="bg-gray-200 text-gray-700 line-through">
            Deleted
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Meter Number</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-8 text-muted-foreground"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{transaction.meterNumber}</TableCell>
                  <TableCell>{transaction.provider}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {transaction.customerName || "N/A"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.customerPhone || ""}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>GHS {transaction.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {getStatusBadge(transaction.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintReceipt(transaction)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(transaction)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(transaction.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Transaction Dialog */}
      <EditPowerTransactionDialog
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        transaction={editingTransaction}
        onSuccess={handleTransactionUpdated}
      />
    </>
  );
}
