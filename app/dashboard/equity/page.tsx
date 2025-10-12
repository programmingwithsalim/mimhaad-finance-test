"use client";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Briefcase,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function EquityPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<EquityTransaction[]>([]);
  const [balances, setBalances] = useState({
    shareCapital: 0,
    retainedEarnings: 0,
    otherFund: 0,
    total: 0,
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeLedger, setActiveLedger] = useState<string>("share_capital");

  const [form, setForm] = useState({
    ledger_type: "share_capital",
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    particulars: "",
    note_number: 22,
    type: "credit", // credit or debit
    amount: 0,
    description: "",
  });

  useEffect(() => {
    fetchTransactions();
  }, [activeLedger]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ledgerType: activeLedger,
      });

      const response = await fetch(`/api/equity/transactions?${params}`);
      const data = await response.json();

      if (data.success) {
        setTransactions(data.data.transactions || []);
        setBalances(
          data.data.balances || {
            shareCapital: 0,
            retainedEarnings: 0,
            otherFund: 0,
            total: 0,
          }
        );
      }
    } catch (error) {
      console.error("Error fetching equity transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load equity transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);

      const debit = form.type === "debit" ? form.amount : 0;
      const credit = form.type === "credit" ? form.amount : 0;

      const response = await fetch("/api/equity/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ledger_type: form.ledger_type,
          transaction_date: form.transaction_date,
          particulars: form.particulars,
          note_number: form.note_number,
          debit,
          credit,
          description: form.description,
          branch_id: user?.branchId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Equity transaction created successfully",
        });
        setIsDialogOpen(false);
        resetForm();
        fetchTransactions();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast({
        title: "Error",
        description: "Failed to create equity transaction",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this transaction? All subsequent balances will be recalculated."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/equity/transactions/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Transaction deleted and balances recalculated",
        });
        fetchTransactions();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete transaction",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setForm({
      ledger_type: activeLedger,
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      particulars: "",
      note_number: 22,
      type: "credit",
      amount: 0,
      description: "",
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getLedgerIcon = (type: string) => {
    switch (type) {
      case "share_capital":
        return <DollarSign className="h-5 w-5" />;
      case "retained_earnings":
        return <TrendingUp className="h-5 w-5" />;
      case "other_fund":
        return <Briefcase className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getLedgerTitle = (type: string) => {
    switch (type) {
      case "share_capital":
        return "Shareholders Capital Ledger";
      case "retained_earnings":
        return "Retained Earnings Ledger";
      case "other_fund":
        return "Other Equity Fund Ledger";
      default:
        return "Equity Ledger";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Shareholders Fund
          </h1>
          <p className="text-muted-foreground">
            Manage Shareholders Capital, Retained Earnings, and Other Equity
            Fund
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Shareholders Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {formatCurrency(balances.shareCapital)}
            </div>
            <p className="text-xs text-muted-foreground">Note 5</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Retained Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {formatCurrency(balances.retainedEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">Note 6</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Other Equity Fund
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {formatCurrency(balances.otherFund)}
            </div>
            <p className="text-xs text-muted-foreground">Note 6a/25</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Shareholders Fund
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              GHS {formatCurrency(balances.total)}
            </div>
            <p className="text-xs text-muted-foreground">Total Equity</p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Tabs */}
      <Tabs value={activeLedger} onValueChange={setActiveLedger}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="share_capital">Shareholders Capital</TabsTrigger>
          <TabsTrigger value="retained_earnings">Retained Earnings</TabsTrigger>
          <TabsTrigger value="other_fund">Other Equity Fund</TabsTrigger>
        </TabsList>

        {["share_capital", "retained_earnings", "other_fund"].map(
          (ledgerType) => (
            <TabsContent key={ledgerType} value={ledgerType}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getLedgerIcon(ledgerType)}
                    {getLedgerTitle(ledgerType)}
                  </CardTitle>
                  <CardDescription>
                    {ledgerType === "share_capital" &&
                      "Shareholders Capital: Funds raised by issuing shares to shareholders (par value)"}
                    {ledgerType === "retained_earnings" &&
                      "Retained Earnings: Accumulated profits reinvested in the business"}
                    {ledgerType === "other_fund" &&
                      "Other Equity Fund: Unrealized gains/losses, revaluations, and comprehensive income"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Particulars</TableHead>
                            <TableHead className="text-center">Note</TableHead>
                            <TableHead className="text-right">
                              Debit (GHS)
                            </TableHead>
                            <TableHead className="text-right">
                              Credit (GHS)
                            </TableHead>
                            <TableHead className="text-right">
                              Balance (GHS)
                            </TableHead>
                            <TableHead className="text-right">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-center py-8 text-muted-foreground"
                              >
                                No transactions found. Click "New Transaction"
                                to add entries.
                              </TableCell>
                            </TableRow>
                          ) : (
                            transactions.map((txn) => (
                              <TableRow key={txn.id}>
                                <TableCell>
                                  {format(
                                    new Date(txn.transaction_date),
                                    "dd/MM/yyyy"
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-medium">
                                      {txn.particulars}
                                    </div>
                                    {txn.description && (
                                      <div className="text-sm text-muted-foreground">
                                        {txn.description}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {txn.note_number || "-"}
                                </TableCell>
                                <TableCell className="text-right text-red-600">
                                  {txn.debit > 0
                                    ? formatCurrency(txn.debit)
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-right text-green-600">
                                  {txn.credit > 0
                                    ? formatCurrency(txn.credit)
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatCurrency(txn.balance)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteTransaction(txn.id)
                                    }
                                    className="text-red-600 hover:text-red-900"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        )}
      </Tabs>

      {/* New Transaction Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Equity Transaction</DialogTitle>
            <DialogDescription>
              Add a new transaction to the {getLedgerTitle(form.ledger_type)}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTransaction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ledger_type">Ledger Type</Label>
                <Select
                  value={form.ledger_type}
                  onValueChange={(value) => {
                    setForm({ ...form, ledger_type: value });
                    setActiveLedger(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="share_capital">
                      Shareholders Capital
                    </SelectItem>
                    <SelectItem value="retained_earnings">
                      Retained Earnings
                    </SelectItem>
                    <SelectItem value="other_fund">
                      Other Equity Fund
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_date">Transaction Date</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) =>
                    setForm({ ...form, transaction_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="particulars">Particulars</Label>
                <Input
                  id="particulars"
                  value={form.particulars}
                  onChange={(e) =>
                    setForm({ ...form, particulars: e.target.value })
                  }
                  placeholder="e.g., Issue of new shares"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note_number">Note Number</Label>
                <Select
                  value={form.note_number.toString()}
                  onValueChange={(value) =>
                    setForm({ ...form, note_number: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="22">22 - Opening Balance</SelectItem>
                    <SelectItem value="23">
                      23 - Share Capital Issue/Redemption
                    </SelectItem>
                    <SelectItem value="24">24 - Income for the Year</SelectItem>
                    <SelectItem value="25">
                      25 - Other Fund Adjustments
                    </SelectItem>
                    <SelectItem value="26">26 - Dividends Declared</SelectItem>
                    <SelectItem value="27">27 - Closing Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Transaction Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm({ ...form, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Increase)</SelectItem>
                    <SelectItem value="debit">Debit (Decrease)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (GHS)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Additional details about this transaction..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Create Transaction"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
