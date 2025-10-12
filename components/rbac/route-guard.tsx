"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Define route permissions
const routePermissions: Record<string, string[]> = {
  "/dashboard": ["admin", "manager", "finance", "operations", "cashier"],
  "/dashboard/transactions/all": [
    "admin",
    "manager",
    "finance",
    "operations",
    "cashier",
  ],
  "/dashboard/momo": ["admin", "manager", "operations"],
  "/dashboard/agency-banking": ["admin", "manager", "operations"],
  "/dashboard/e-zwich": ["admin", "manager", "operations"],
  "/dashboard/power": ["admin", "manager", "operations"],
  "/dashboard/jumia": ["admin", "manager", "operations"],
  "/dashboard/transactions/reversals": ["admin", "manager", "finance"],
  "/dashboard/float-management": ["admin", "manager", "finance"],
  "/dashboard/expenses": [
    "admin",
    "manager",
    "finance",
    "operations",
    "cashier",
  ],
  "/dashboard/monthly-commissions": ["admin", "manager", "finance"],
  "/dashboard/gl-accounting": ["admin", "finance"],
  "/dashboard/inventory/e-zwich": ["admin", "manager", "finance"],
  "/dashboard/user-management": ["admin"],
  "/dashboard/branch-management": ["admin"],
  "/dashboard/reports": ["admin", "manager", "finance"],
  "/dashboard/audit-trail": ["admin", "manager", "finance"],
  "/dashboard/settings": [
    "admin",
    "manager",
    "finance",
    "operations",
    "cashier",
  ],
};

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading || !user) {
      setHasAccess(null);
      return;
    }

    // Check if current route requires specific permissions
    const requiredRoles = routePermissions[pathname];

    if (!requiredRoles) {
      // Route not in permissions list, allow access
      setHasAccess(true);
      return;
    }

    // Check if user has required role
    const userRole = user.role?.toLowerCase();
    const hasPermission = requiredRoles.includes(userRole || "");

    setHasAccess(hasPermission);
  }, [pathname, user, isLoading]);

  // Show loading while checking permissions
  if (isLoading || hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            Checking permissions...
          </p>
        </div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page. Your current role (
              {user?.role}) doesn't allow access to this resource.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => router.push("/dashboard")}
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              If you believe this is an error, please contact your
              administrator.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has access, render the page
  return <>{children}</>;
}
