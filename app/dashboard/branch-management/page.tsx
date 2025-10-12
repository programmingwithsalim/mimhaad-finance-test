"use client";

import { AlertCircle } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BranchManagementDashboard } from "@/components/branch-management/branch-management-dashboard";

export default function BranchManagementPage() {
  const { user } = useCurrentUser();
  const canManageBranches = user?.role === "Admin" || user?.role === "Manager";

  return (
    <div className="container-fluid p-6">
      {!canManageBranches ? (
        <div className="flex items-center justify-center h-64">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent className="text-red-700">
              <p>
                You don't have permission to manage branches. Contact your
                administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <BranchManagementDashboard />
      )}
    </div>
  );
}
