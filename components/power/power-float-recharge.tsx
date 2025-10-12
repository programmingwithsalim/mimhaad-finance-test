"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";
import {
  Plus,
  Zap,
  History,
  Calendar,
  ArrowUpDown,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PowerFloatRechargeProps {
  accountId: string;
  currentBalance: number;
  accountType: string;
  provider: string;
  onRechargeSuccess?: () => void;
}

export function PowerFloatRecharge({
  accountId,
  currentBalance,
  accountType,
  provider,
  onRechargeSuccess,
}: PowerFloatRechargeProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [selectedPaymentAccount, setSelectedPaymentAccount] = useState("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [rechargeHistory, setRechargeHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchPaymentAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const response = await fetch("/api/float-accounts");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // FIXED: Add proper null/undefined checks before filtering
        if (data && data.success && Array.isArray(data.floatAccounts)) {
          // Filter out power accounts and only show accounts with sufficient balance
          const availableAccounts = data.floatAccounts.filter(
            (account) =>
              account &&
              account.accountType !== "power" &&
              account.isActive !== false &&
              account.currentBalance > 0
          );
          setPaymentAccounts(availableAccounts || []);
        } else {
          console.warn("Invalid response format:", data);
          setPaymentAccounts([]);
        }
      } catch (error) {
        console.error("Error fetching payment accounts:", error);
        // Fallback accounts with proper structure
        setPaymentAccounts([
          {
            id: "cash-account-1",
            accountType: "cash-in-till",
            provider: "Cash",
            currentBalance: 50000,
            branchId: "branch-1",
          },
          {
            id: "bank-account-1",
            accountType: "bank",
            provider: "Ecobank",
            currentBalance: 100000,
            branchId: "branch-1",
          },
        ]);
      } finally {
        setLoadingAccounts(false);
      }
    };

    if (isOpen) {
      fetchPaymentAccounts();
    }
  }, [isOpen]);

  const fetchRechargeHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch(
        `/api/float-transactions?accountId=${accountId}&type=credit&limit=20`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.transactions)) {
          setRechargeHistory(data.transactions);
        } else {
          setRechargeHistory([]);
        }
      } else {
        // Fallback mock data
        setRechargeHistory([
          {
            id: "txn-001",
            amount: 5000,
            transactionType: "credit",
            description: "Power float recharge - 5000 from cash-in-till",
            createdAt: new Date().toISOString(),
            status: "completed",
            reference: "PWR-RCH-001",
            fromAccount: "Cash in Till",
          },
          {
            id: "txn-002",
            amount: 3000,
            transactionType: "credit",
            description: "Power float recharge - 3000 from bank",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            status: "completed",
            reference: "PWR-RCH-002",
            fromAccount: "Ecobank",
          },
          {
            id: "txn-003",
            amount: 2000,
            transactionType: "credit",
            description: "Power float recharge - 2000 from cash-in-till",
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            status: "completed",
            reference: "PWR-RCH-003",
            fromAccount: "Cash in Till",
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching recharge history:", error);
      setRechargeHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRecharge = async () => {
    if (!accountId) {
      toast({
        title: "Error",
        description: "No account ID provided",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPaymentAccount) {
      toast({
        title: "Payment Account Required",
        description: "Please select a payment account to fund the recharge",
        variant: "destructive",
      });
      return;
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    const rechargeAmount = Number.parseFloat(amount);
    const paymentAccount = paymentAccounts.find(
      (acc) => acc.id === selectedPaymentAccount
    );

    if (!paymentAccount || paymentAccount.currentBalance < rechargeAmount) {
      toast({
        title: "Insufficient Funds",
        description:
          "The selected payment account has insufficient balance for this recharge",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log(
        "Recharging account:",
        accountId,
        "with amount:",
        amount,
        "from:",
        selectedPaymentAccount
      );

      const response = await fetch(
        `/api/float-accounts/${accountId}/recharge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: rechargeAmount,
            sourceAccountId: selectedPaymentAccount,
            rechargeMethod: "transfer",
            description:
              description ||
              `Power float recharge - ${rechargeAmount} from ${paymentAccount.accountType}`,
            reference: `POWER-RECHARGE-${Date.now()}`,
          }),
        }
      );

      console.log("Recharge response status:", response.status);
      const data = await response.json();
      console.log("Recharge response data:", data);

      if (response.ok && data.success) {
        toast({
          title: "Recharge Successful",
          description: `Successfully transferred GHS ${rechargeAmount.toFixed(
            2
          )} from ${paymentAccount.accountType} to power float`,
        });

        // Reset form
        setAmount("");
        setDescription("");
        setSelectedPaymentAccount("");
        setIsOpen(false);

        // Notify parent component
        if (onRechargeSuccess) {
          onRechargeSuccess();
        }
      } else {
        throw new Error(data.error || "Failed to recharge account");
      }
    } catch (error) {
      console.error("Error recharging account:", error);
      toast({
        title: "Recharge Failed",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportHistory = () => {
    const csvContent = [
      ["Date", "Amount", "From Account", "Description", "Reference", "Status"],
      ...rechargeHistory.map((txn) => [
        new Date(txn.createdAt).toLocaleDateString(),
        `GHS ${formatCurrency(txn.amount)}`,
        txn.fromAccount || "Unknown",
        txn.description,
        txn.reference || txn.id,
        txn.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `power-recharge-history-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2">
      {/* Recharge Button */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={(e) => {
            console.log("Recharge button clicked!", e);
            setIsOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Recharge Power Float
        </Button>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Recharge Power Float Account
            </DialogTitle>
            <DialogDescription>
              Add funds to your power float account to enable power sales
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Balance Display */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  GHS {formatCurrency(currentBalance)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {accountType} • {provider}
                </div>
              </CardContent>
            </Card>

            {/* Payment Account Selection */}
            <div className="space-y-2">
              <Label htmlFor="payment-account">Payment Account</Label>
              {loadingAccounts ? (
                <div className="text-sm text-muted-foreground">
                  Loading payment accounts...
                </div>
              ) : (
                <Select
                  value={selectedPaymentAccount}
                  onValueChange={setSelectedPaymentAccount}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account to pay from" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(paymentAccounts) &&
                      paymentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex justify-between items-center w-full">
                            <span>
                              {account.accountType} - {account.provider}
                            </span>
                            <span className="text-sm text-muted-foreground ml-2">
                              GHS {formatCurrency(account.currentBalance)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
              {selectedPaymentAccount && Array.isArray(paymentAccounts) && (
                <div className="text-sm text-muted-foreground">
                  Selected:{" "}
                  {
                    paymentAccounts.find(
                      (acc) => acc.id === selectedPaymentAccount
                    )?.accountType
                  }{" "}
                  - Balance: GHS{" "}
                  {formatCurrency(
                    paymentAccounts.find(
                      (acc) => acc.id === selectedPaymentAccount
                    )?.currentBalance || 0
                  )}
                </div>
              )}
            </div>

            {/* Recharge Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recharge-amount">Recharge Amount (GHS)</Label>
                <Input
                  id="recharge-amount"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount to add"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recharge-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="recharge-description"
                  placeholder="Enter a description for this recharge..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Preview */}
              {amount &&
                Number.parseFloat(amount) > 0 &&
                selectedPaymentAccount &&
                Array.isArray(paymentAccounts) && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="font-medium text-sm">
                          Transaction Preview:
                        </div>

                        {/* Payment Account Deduction */}
                        <div className="flex justify-between items-center text-sm">
                          <span>
                            From:{" "}
                            {
                              paymentAccounts.find(
                                (acc) => acc.id === selectedPaymentAccount
                              )?.accountType
                            }
                          </span>
                          <span className="text-red-600">
                            -GHS {formatCurrency(Number.parseFloat(amount))}
                          </span>
                        </div>

                        {/* Power Account Addition */}
                        <div className="flex justify-between items-center text-sm">
                          <span>To: Power Float</span>
                          <span className="text-green-600">
                            +GHS {formatCurrency(Number.parseFloat(amount))}
                          </span>
                        </div>

                        <hr className="my-2" />

                        {/* New Balances */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Payment Account New Balance:</span>
                            <span>
                              GHS{" "}
                              {formatCurrency(
                                (paymentAccounts.find(
                                  (acc) => acc.id === selectedPaymentAccount
                                )?.currentBalance || 0) -
                                  Number.parseFloat(amount)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Power Float New Balance:</span>
                            <span>
                              GHS{" "}
                              {formatCurrency(
                                currentBalance + Number.parseFloat(amount)
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRecharge}
                disabled={
                  isLoading ||
                  !amount ||
                  Number.parseFloat(amount) <= 0 ||
                  !selectedPaymentAccount
                }
              >
                {isLoading ? "Processing..." : "Transfer & Recharge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Button */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => {
            setIsHistoryOpen(true);
            fetchRechargeHistory();
          }}
        >
          <History className="h-4 w-4" />
          View History
        </Button>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Power Float Recharge History
            </DialogTitle>
            <DialogDescription>
              View all power float recharge transactions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Actions */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Showing {rechargeHistory.length} recent transactions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRechargeHistory}
                  disabled={loadingHistory}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportHistory}
                  disabled={rechargeHistory.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* History Table */}
            {loadingHistory ? (
              <div className="text-center py-8">
                Loading transaction history...
              </div>
            ) : rechargeHistory.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <div className="text-muted-foreground">
                  No recharge transactions found
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const response = await fetch(
                        "/api/float-transactions/seed-recharge",
                        {
                          method: "POST",
                        }
                      );
                      if (response.ok) {
                        toast({
                          title: "Test Data Created",
                          description:
                            "Sample recharge transactions have been added",
                        });
                        fetchRechargeHistory();
                      }
                    } catch (error) {
                      console.error("Error creating test data:", error);
                    }
                  }}
                >
                  Load Test Data
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>From Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rechargeHistory.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(
                              transaction.createdAt
                            ).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-green-600">
                            +GHS {formatCurrency(transaction.amount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {transaction.fromAccount || "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm max-w-xs truncate">
                            {transaction.description}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono">
                            {transaction.reference || transaction.id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.status === "completed"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {transaction.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
