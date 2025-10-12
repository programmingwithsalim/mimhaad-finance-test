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
  location?: string;
  region?: string;
  status: string;
  created_at: string;
}

interface BranchesData {
  tableExists: boolean;
  branchesCount: number;
  branches: Branch[];
}

export function BranchesChecker() {
  const [data, setData] = useState<BranchesData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/debug/check-branches", {
        credentials: "include",
      });
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        toast({
          title: "Branches Check Complete",
          description: `Found ${result.data.branchesCount} branches in the database.`,
        });
      } else {
        throw new Error(result.error || "Failed to check branches");
      }
    } catch (error) {
      console.error("Error checking branches:", error);
      toast({
        title: "Error",
        description: "Failed to check branches. Please try again.",
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
          Branches Checker
        </CardTitle>
        <CardDescription>
          Check what branches exist in the database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={checkBranches} disabled={loading} className="w-full">
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking Branches...
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4 mr-2" />
              Check Branches
            </>
          )}
        </Button>

        {data && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Table Exists</p>
                <p className="text-2xl font-bold">
                  {data.tableExists ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Total Branches</p>
                <p className="text-2xl font-bold">{data.branchesCount}</p>
              </div>
            </div>

            {/* Table Status */}
            {!data.tableExists && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  The branches table does not exist in the database.
                </AlertDescription>
              </Alert>
            )}

            {/* Branches List */}
            {data.branchesCount > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Branches:</h4>
                <div className="space-y-2">
                  {data.branches.map((branch) => (
                    <div
                      key={branch.id}
                      className="p-3 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{branch.name}</h5>
                        <Badge
                          variant={
                            branch.status === "active" ? "default" : "secondary"
                          }
                        >
                          {branch.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Code:</span>
                          <br />
                          <span className="font-medium">{branch.code}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Location:
                          </span>
                          <br />
                          <span className="font-medium">
                            {branch.location || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Region:</span>
                          <br />
                          <span className="font-medium">
                            {branch.region || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Created:
                          </span>
                          <br />
                          <span className="font-medium">
                            {new Date(branch.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.tableExists && data.branchesCount === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  The branches table exists but contains no data. Consider
                  creating some branches.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
