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
import { Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBranches } from "@/hooks/use-branches";

interface JournalEntryLine {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  type: "debit" | "credit";
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  current_balance?: number;
  branch_id?: string;
}

export function ManualJournalEntry() {
  const { user, loading: userLoading } = useCurrentUser();
  const { branches, loading: branchesLoading } = useBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [entries, setEntries] = useState<JournalEntryLine[]>([
    {
      id: "1",
      accountId: "",
      accountName: "",
      description: "",
      debit: 0,
      credit: 0,
      type: "debit",
    },
    {
      id: "2",
      accountId: "",
      accountName: "",
      description: "",
      debit: 0,
      credit: 0,
      type: "credit",
    },
  ]);

  const [journalDescription, setJournalDescription] = useState("");
  const [journalDate, setJournalDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reference, setReference] = useState("");
  const [transactionSource, setTransactionSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    if (!userLoading && user) {
      if (user.role === "Admin") {
        setSelectedBranchId(selectedBranchId || branches[0]?.id || "");
      } else {
        setSelectedBranchId(user.branchId);
      }
    }
  }, [user, userLoading, branches]);

  useEffect(() => {
    if (selectedBranchId) {
      fetchAccounts(selectedBranchId);
    }
  }, [selectedBranchId]);

  const fetchAccounts = async (branchId: string) => {
    setLoadingAccounts(true);
    try {
      const response = await fetch(
        `/api/gl/manual-journal-entry?branch_id=${branchId}`
      );
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const addEntry = () => {
    const newEntry: JournalEntryLine = {
      id: Date.now().toString(),
      accountId: "",
      accountName: "",
      description: "",
      debit: 0,
      credit: 0,
      type: "debit",
    };
    setEntries([...entries, newEntry]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 2) {
      setEntries(entries.filter((entry) => entry.id !== id));
    }
  };

  const updateEntry = (
    id: string,
    field: keyof JournalEntryLine,
    value: any
  ) => {
    setEntries(
      entries.map((entry) => {
        if (entry.id === id) {
          const updatedEntry = { ...entry, [field]: value };

          // If updating account, also update account name
          if (field === "accountId") {
            const account = accounts.find((acc) => acc.id === value);
            updatedEntry.accountName = account ? account.name : "";
          }

          // If updating amount, clear the opposite field and set type
          if (field === "debit" && value > 0) {
            updatedEntry.credit = 0;
            updatedEntry.type = "debit";
          } else if (field === "credit" && value > 0) {
            updatedEntry.debit = 0;
            updatedEntry.type = "credit";
          }

          return updatedEntry;
        }
        return entry;
      })
    );
  };

  const calculateTotals = () => {
    const totalDebits = entries.reduce(
      (sum, entry) => sum + (entry.debit || 0),
      0
    );
    const totalCredits = entries.reduce(
      (sum, entry) => sum + (entry.credit || 0),
      0
    );
    return {
      totalDebits,
      totalCredits,
      difference: totalDebits - totalCredits,
    };
  };

  const { totalDebits, totalCredits, difference } = calculateTotals();
  const isBalanced = Math.abs(difference) < 0.01;

  const validateEntry = () => {
    const errors = [];

    if (!journalDescription.trim()) {
      errors.push("Journal Description (above the table) is required");
    }

    if (!journalDate) {
      errors.push("Date is required");
    }

    const validEntries = entries.filter(
      (entry) => entry.accountId && (entry.debit > 0 || entry.credit > 0)
    );

    if (validEntries.length < 2) {
      errors.push("At least 2 valid entries are required");
    }

    if (!isBalanced) {
      errors.push("Total debits must equal total credits");
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validateEntry();

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const validEntries = entries
        .filter(
          (entry) => entry.accountId && (entry.debit > 0 || entry.credit > 0)
        )
        .map((entry) => ({
          accountId: entry.accountId,
          description: entry.description || journalDescription,
          amount: entry.debit > 0 ? entry.debit : entry.credit,
          type: entry.debit > 0 ? "debit" : "credit",
        }));

      const response = await fetch("/api/gl/manual-journal-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: journalDate,
          description: journalDescription,
          reference: reference || `MJE-${Date.now()}`,
          source: transactionSource,
          entries: validEntries,
          branch_id: selectedBranchId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "Journal Entry Saved",
          description: `Manual journal entry ${result.journalEntry?.reference_number} has been recorded successfully`,
        });

        // Reset form
        setEntries([
          {
            id: "1",
            accountId: "",
            accountName: "",
            description: "",
            debit: 0,
            credit: 0,
            type: "debit",
          },
          {
            id: "2",
            accountId: "",
            accountName: "",
            description: "",
            debit: 0,
            credit: 0,
            type: "credit",
          },
        ]);
        setJournalDescription("");
        setReference("");
        setTransactionSource("manual");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save journal entry");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save journal entry",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getAccountBalance = (accountId: string) => {
    const account = accounts.find((acc) => acc.id === accountId);
    return account?.current_balance || 0;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Journal Entry</CardTitle>
          <CardDescription>
            Create manual journal entries for missed transactions, adjustments,
            or corrections. Perfect for recording MoMo transactions that weren't
            automatically captured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Branch selection (only for admin) */}
          {user && user.role === "Admin" && (
            <div>
              <Label htmlFor="branch_id">Branch</Label>
              <Select
                value={selectedBranchId}
                onValueChange={setSelectedBranchId}
                disabled={branchesLoading}
              >
                <SelectTrigger id="branch_id">
                  <SelectValue
                    placeholder={
                      branchesLoading ? "Loading..." : "Select branch"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* For non-admins, branch is auto-assigned and hidden */}

          {/* Validation Alert */}
          {!isBalanced && totalDebits > 0 && totalCredits > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Journal entry is not balanced. Difference:{" "}
                {formatCurrency(Math.abs(difference))}
              </AlertDescription>
            </Alert>
          )}

          {/* Journal Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="date">Transaction Date</Label>
              <Input
                id="date"
                type="date"
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                placeholder="MJE-001 (auto-generated if empty)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="source">Transaction Source</Label>
              <Select
                value={transactionSource}
                onValueChange={setTransactionSource}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="momo_correction">
                    MoMo Correction
                  </SelectItem>
                  <SelectItem value="agency_correction">
                    Agency Banking Correction
                  </SelectItem>
                  <SelectItem value="ezwich_correction">
                    E-Zwich Correction
                  </SelectItem>
                  <SelectItem value="power_correction">
                    Power Correction
                  </SelectItem>
                  <SelectItem value="adjustment">Account Adjustment</SelectItem>
                  <SelectItem value="reconciliation">
                    Reconciliation Entry
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Journal Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this journal entry (e.g., 'Recording missed MoMo transaction from 2024-01-15')"
              value={journalDescription}
              onChange={(e) => setJournalDescription(e.target.value)}
              rows={3}
              required
              className={!journalDescription.trim() ? "border-red-300" : ""}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This description is required and will be used for all journal
              entry lines
            </p>
          </div>

          {/* Journal Entries */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Journal Entry Lines</h3>
              <Button onClick={addEntry} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Select
                        value={entry.accountId}
                        onValueChange={(value) =>
                          updateEntry(entry.id, "accountId", value)
                        }
                        disabled={loadingAccounts}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingAccounts ? "Loading..." : "Select account"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <div className="flex flex-col py-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs bg-muted px-1 rounded">
                                    {account.code}
                                  </span>
                                  <span className="font-medium">
                                    {account.name}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {account.type} • Balance:{" "}
                                  {formatCurrency(account.current_balance || 0)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Line description (optional)"
                        value={entry.description}
                        onChange={(e) =>
                          updateEntry(entry.id, "description", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={entry.debit || ""}
                        onChange={(e) =>
                          updateEntry(
                            entry.id,
                            "debit",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={entry.credit || ""}
                        onChange={(e) =>
                          updateEntry(
                            entry.id,
                            "credit",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className="text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {entry.accountId
                          ? formatCurrency(getAccountBalance(entry.accountId))
                          : "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntry(entry.id)}
                        disabled={entries.length <= 2}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4 max-w-md ml-auto">
              <div className="text-right">
                <div className="text-sm text-gray-500">Total Debits:</div>
                <div className="font-medium">{formatCurrency(totalDebits)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Total Credits:</div>
                <div className="font-medium">
                  {formatCurrency(totalCredits)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Difference:</div>
                <div
                  className={`font-medium ${
                    isBalanced ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(Math.abs(difference))}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!isBalanced || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Journal Entry"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
