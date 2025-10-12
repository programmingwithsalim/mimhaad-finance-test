"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, DollarSign, TrendingUp, Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FinancialSetting {
  value: number;
  description: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface FinancialSettings {
  shareholders_equity?: FinancialSetting;
  retained_earnings?: FinancialSetting;
  bank_loan?: FinancialSetting;
}

export default function FinancialSettingsPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FinancialSettings>({});

  const [equityForm, setEquityForm] = useState({
    value: 0,
    description: "",
  });

  const [retainedForm, setRetainedForm] = useState({
    value: 0,
    description: "",
  });

  const [loanForm, setLoanForm] = useState({
    value: 0,
    description: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/settings/financial");
      const data = await response.json();

      if (data.success) {
        setSettings(data.data);

        // Populate forms
        if (data.data.shareholders_equity) {
          setEquityForm({
            value: data.data.shareholders_equity.value,
            description: data.data.shareholders_equity.description || "",
          });
        }

        if (data.data.retained_earnings) {
          setRetainedForm({
            value: data.data.retained_earnings.value,
            description: data.data.retained_earnings.description || "",
          });
        }

        if (data.data.bank_loan) {
          setLoanForm({
            value: data.data.bank_loan.value,
            description: data.data.bank_loan.description || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching financial settings:", error);
      toast({
        title: "Error",
        description: "Failed to load financial settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = async (
    key: string,
    value: number,
    description: string
  ) => {
    try {
      setSaving(true);

      const response = await fetch("/api/settings/financial", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value, description }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Financial setting updated successfully",
        });
        fetchSettings(); // Refresh
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update setting",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating setting:", error);
      toast({
        title: "Error",
        description: "Failed to update financial setting",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Financial Settings
        </h1>
        <p className="text-muted-foreground">
          Manage equity, retained earnings, and long-term liabilities
        </p>
      </div>

      {/* Shareholders Equity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Shareholders Equity
          </CardTitle>
          <CardDescription>
            Initial capital and additional investments by shareholders. This
            represents the resources introduced and controlled by the owners of
            the business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="equity-value">Amount (GHS)</Label>
              <Input
                id="equity-value"
                type="number"
                step="0.01"
                value={equityForm.value}
                onChange={(e) =>
                  setEquityForm({
                    ...equityForm,
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="equity-description">Description</Label>
              <Textarea
                id="equity-description"
                value={equityForm.description}
                onChange={(e) =>
                  setEquityForm({
                    ...equityForm,
                    description: e.target.value,
                  })
                }
                placeholder="e.g., Initial capital contribution by shareholders"
                rows={3}
              />
            </div>
          </div>
          {settings.shareholders_equity?.updatedBy && (
            <div className="text-sm text-muted-foreground">
              Last updated by {settings.shareholders_equity.updatedBy} on{" "}
              {new Date(
                settings.shareholders_equity.updatedAt!
              ).toLocaleString()}
            </div>
          )}
          <Button
            onClick={() =>
              handleUpdateSetting(
                "shareholders_equity",
                equityForm.value,
                equityForm.description
              )
            }
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Equity
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Retained Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Retained Earnings
          </CardTitle>
          <CardDescription>
            Portion of net income retained from previous periods rather than
            distributed as dividends. This accumulates over time and reflects
            the company's reinvestment for growth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="retained-value">Amount (GHS)</Label>
              <Input
                id="retained-value"
                type="number"
                step="0.01"
                value={retainedForm.value}
                onChange={(e) =>
                  setRetainedForm({
                    ...retainedForm,
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="retained-description">Description</Label>
              <Textarea
                id="retained-description"
                value={retainedForm.description}
                onChange={(e) =>
                  setRetainedForm({
                    ...retainedForm,
                    description: e.target.value,
                  })
                }
                placeholder="e.g., Accumulated profits from FY2024"
                rows={3}
              />
            </div>
          </div>
          {settings.retained_earnings?.updatedBy && (
            <div className="text-sm text-muted-foreground">
              Last updated by {settings.retained_earnings.updatedBy} on{" "}
              {new Date(settings.retained_earnings.updatedAt!).toLocaleString()}
            </div>
          )}
          <Button
            onClick={() =>
              handleUpdateSetting(
                "retained_earnings",
                retainedForm.value,
                retainedForm.description
              )
            }
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Retained Earnings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Bank Loan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank Loan
          </CardTitle>
          <CardDescription>
            Outstanding bank loans and long-term liabilities. These are debts
            with repayment terms extending beyond one year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="loan-value">Amount (GHS)</Label>
              <Input
                id="loan-value"
                type="number"
                step="0.01"
                value={loanForm.value}
                onChange={(e) =>
                  setLoanForm({
                    ...loanForm,
                    value: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="loan-description">Description</Label>
              <Textarea
                id="loan-description"
                value={loanForm.description}
                onChange={(e) =>
                  setLoanForm({
                    ...loanForm,
                    description: e.target.value,
                  })
                }
                placeholder="e.g., Bank of Ghana term loan - 5 years at 12% interest"
                rows={3}
              />
            </div>
          </div>
          {settings.bank_loan?.updatedBy && (
            <div className="text-sm text-muted-foreground">
              Last updated by {settings.bank_loan.updatedBy} on{" "}
              {new Date(settings.bank_loan.updatedAt!).toLocaleString()}
            </div>
          )}
          <Button
            onClick={() =>
              handleUpdateSetting(
                "bank_loan",
                loanForm.value,
                loanForm.description
              )
            }
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Bank Loan
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
