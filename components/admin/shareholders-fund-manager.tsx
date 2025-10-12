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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, TrendingUp, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface EquityTransaction {
  id: string;
  ledger_type: string;
  transaction_date: string;
  particulars: string;
  note_number: number | null;
  debit: number;
  credit: number;
  balance: number;
  description: string | null;
  created_by: string;
  created_at: string;
}

export function ShareholdersFundManager() {
  const [transactions, setTransactions] = useState<EquityTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [ledgerType, setLedgerType] = useState<string>("share_capital");
  const [transactionDate, setTransactionDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [particulars, setParticulars] = useState<string>("");
  const [noteNumber, setNoteNumber] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>("credit");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/equity-transactions");
      const result = await response.json();

      if (result.success) {
        setTransactions(result.data);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch equity transactions",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching equity transactions:", error);
      toast({
        title: "Error",
        description: "Failed to fetch equity transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!particulars || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/admin/equity-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledger_type: ledgerType,
          transaction_date: transactionDate,
          particulars,
          note_number: noteNumber ? parseInt(noteNumber) : null,
          debit: transactionType === "debit" ? parseFloat(amount) : 0,
          credit: transactionType === "credit" ? parseFloat(amount) : 0,
          description,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Equity transaction recorded successfully",
        });

        // Reset form
        setParticulars("");
        setNoteNumber("");
        setAmount("");
        setDescription("");

        // Refresh transactions
        await fetchTransactions();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to record equity transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error recording equity transaction:", error);
      toast({
        title: "Error",
        description: "Failed to record equity transaction",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Calculate current balances
  const balances = {
    share_capital: 0,
    retained_earnings: 0,
    other_fund: 0,
  };

  transactions.forEach((txn) => {
    const netAmount = txn.credit - txn.debit;
    if (txn.ledger_type === "share_capital") {
      balances.share_capital += netAmount;
    } else if (txn.ledger_type === "retained_earnings") {
      balances.retained_earnings += netAmount;
    } else if (txn.ledger_type === "other_fund") {
      balances.other_fund += netAmount;
    }
  });

  const totalEquity =
    balances.share_capital + balances.retained_earnings + balances.other_fund;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Share Capital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              GHS {formatCurrency(balances.share_capital)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Retained Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              GHS {formatCurrency(balances.retained_earnings)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Other Fund</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              GHS {formatCurrency(balances.other_fund)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              GHS {formatCurrency(totalEquity)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Transaction Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Record Equity Transaction
          </CardTitle>
          <CardDescription>
            Add new transactions to the shareholders fund ledgers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ledger_type">Ledger Type *</Label>
                <Select value={ledgerType} onValueChange={setLedgerType}>
                  <SelectTrigger id="ledger_type">
                    <SelectValue placeholder="Select ledger type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="share_capital">Share Capital</SelectItem>
                    <SelectItem value="retained_earnings">
                      Retained Earnings
                    </SelectItem>
                    <SelectItem value="other_fund">Other Fund</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_date">Transaction Date *</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="particulars">Particulars *</Label>
                <Input
                  id="particulars"
                  value={particulars}
                  onChange={(e) => setParticulars(e.target.value)}
                  placeholder="e.g., Issue of Share Capital"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note_number">Note Number</Label>
                <Input
                  id="note_number"
                  type="number"
                  value={noteNumber}
                  onChange={(e) => setNoteNumber(e.target.value)}
                  placeholder="23, 24, 25, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_type">Transaction Type *</Label>
                <Select
                  value={transactionType}
                  onValueChange={setTransactionType}
                >
                  <SelectTrigger id="transaction_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Increase)</SelectItem>
                    <SelectItem value="debit">Debit (Decrease)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (GHS) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this transaction"
                rows={3}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Transaction
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            All equity transactions recorded in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No equity transactions found. Add your first transaction above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ledger</TableHead>
                    <TableHead>Particulars</TableHead>
                    <TableHead className="text-center">Note</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>
                        {format(new Date(txn.transaction_date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            txn.ledger_type === "share_capital"
                              ? "bg-blue-100 text-blue-700"
                              : txn.ledger_type === "retained_earnings"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {txn.ledger_type
                            .replace("_", " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                      </TableCell>
                      <TableCell>{txn.particulars}</TableCell>
                      <TableCell className="text-center">
                        {txn.note_number || "-"}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {txn.debit > 0 ? formatCurrency(txn.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {txn.credit > 0 ? formatCurrency(txn.credit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(txn.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

