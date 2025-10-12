"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Database, CheckCircle, AlertTriangle } from "lucide-react";

export function FloatAccountsSeeder() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const seedFloatAccounts = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/db/seed-float-accounts", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setSeeded(true);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to seed float accounts",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error seeding float accounts:", error);
      toast({
        title: "Error",
        description: "Failed to seed float accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Float Accounts Seeder
        </CardTitle>
        <CardDescription>
          Create sample float accounts for all branches. This will create
          accounts for MOMO, E-ZWICH, Agency Banking, Power, and Cash-in-Till
          services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {seeded ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <span className="text-sm text-muted-foreground">
              {seeded
                ? "Float accounts have been seeded successfully"
                : "No float accounts found. Click the button below to create sample accounts."}
            </span>
          </div>

          <Button
            onClick={seedFloatAccounts}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Seeding Float Accounts...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Seed Float Accounts
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
