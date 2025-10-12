"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
  region: string;
  status: string;
}

export function BranchSeeder() {
  const [result, setResult] = useState<{
    branchesCreated: number;
    totalBranches: number;
    branches: Branch[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const seedBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/debug/seed-sample-branches", {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        toast({
          title: "Branches Seeded",
          description: `Successfully created ${data.data.branchesCreated} branches. Total branches: ${data.data.totalBranches}`,
        });
      } else {
        throw new Error(data.error || "Failed to seed branches");
      }
    } catch (error) {
      console.error("Error seeding branches:", error);
      toast({
        title: "Error",
        description: "Failed to seed branches. Please try again.",
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
          <Building2 className="h-5 w-5" />
          Branch Seeder
        </CardTitle>
        <CardDescription>Create sample branches for testing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will create 5 sample branches across different regions. Use
            this to test branch filtering in reports.
          </AlertDescription>
        </Alert>

        <Button
          onClick={seedBranches}
          disabled={loading}
          className="w-full"
          variant="outline"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Seeding Branches...
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4 mr-2" />
              Seed Sample Branches
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium">Branches Seeded Successfully</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <br />
                <span className="font-medium">{result.branchesCreated}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>
                <br />
                <span className="font-medium">{result.totalBranches}</span>
              </div>
            </div>

            {/* Branches List */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Created Branches:</h4>
              {result.branches.map((branch) => (
                <div
                  key={branch.id}
                  className="p-2 border rounded text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{branch.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {branch.code}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {branch.location}, {branch.region}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
