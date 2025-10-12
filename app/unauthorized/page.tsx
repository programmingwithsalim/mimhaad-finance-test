"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRBAC } from "@/components/rbac/rbac-provider";
import { useRouter } from "next/navigation";
import {
  Shield,
  AlertTriangle,
  ArrowLeft,
  Home,
  Users,
  Building2,
  Settings,
  CheckCircle,
} from "lucide-react";

const roleAccessMap = {
  Admin: {
    description: "Full system access",
    canAccess: "Everything",
    restrictions: "None",
  },
  Manager: {
    description: "Operational management access",
    canAccess:
      "All services, transactions, financial management, reports, inventory",
    restrictions: "Cannot manage users or branches",
  },
  Finance: {
    description: "Financial management access",
    canAccess:
      "Dashboard, transactions, financial management, reports, inventory, audit trail",
    restrictions: "Cannot access service operations or user/branch management",
  },
  Operations: {
    description: "Service operations access",
    canAccess:
      "Dashboard, transactions, all services (MoMo, Agency Banking, E-Zwich, Power, Jumia), expenses",
    restrictions:
      "Cannot access financial management, reports, or user/branch management",
  },
  Cashier: {
    description: "Basic transaction and expense access",
    canAccess: "Dashboard, transactions, expenses",
    restrictions:
      "Cannot access services, financial management, reports, or user/branch management",
  },
};

export default function UnauthorizedPage() {
  const { userRole } = useRBAC();
  const router = useRouter();

  const roleInfo = userRole
    ? roleAccessMap[userRole as keyof typeof roleAccessMap]
    : null;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-red-100">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-red-600">
              Access Denied
            </CardTitle>
            <CardDescription className="text-lg">
              You don't have permission to access this page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {roleInfo && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 justify-center">
                  <Badge variant="outline">{userRole}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {roleInfo.description}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border bg-green-50">
                    <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      You Can Access:
                    </h4>
                    <p className="text-sm text-green-700">
                      {roleInfo.canAccess}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border bg-red-50">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Restrictions:
                    </h4>
                    <p className="text-sm text-red-700">
                      {roleInfo.restrictions}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>If you believe you should have access to this page,</p>
              <p>please contact your system administrator.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
