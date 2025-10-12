"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type Role,
  type Permission,
} from "@/lib/rbac/unified-rbac";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermissions?: Permission[];
  requiredRole?: Role;
  requireAllPermissions?: boolean;
  fallback?: React.ReactNode;
  redirectTo?: string;
  showAccessDenied?: boolean;
}

export function PermissionGuard({
  children,
  requiredPermissions = [],
  requiredRole,
  requireAllPermissions = false,
  fallback,
  redirectTo = "/unauthorized",
  showAccessDenied = true,
}: PermissionGuardProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setHasAccess(false);
      router.push("/");
      return;
    }

    const userRole = user.role as Role;

    // Check role requirement
    if (requiredRole && userRole !== requiredRole) {
      setHasAccess(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
      return;
    }

    // Check permission requirements
    if (requiredPermissions.length > 0) {
      let permissionCheck = false;

      if (requireAllPermissions) {
        permissionCheck = hasAllPermissions(userRole, requiredPermissions);
      } else {
        permissionCheck = hasAnyPermission(userRole, requiredPermissions);
      }

      if (!permissionCheck) {
        setHasAccess(false);
        if (redirectTo) {
          router.push(redirectTo);
        }
        return;
      }
    }

    setHasAccess(true);
  }, [
    user,
    isLoading,
    requiredPermissions,
    requiredRole,
    requireAllPermissions,
    redirectTo,
    router,
  ]);

  // Show loading state
  if (isLoading || hasAccess === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking permissions...</span>
        </div>
      </div>
    );
  }

  // Show access denied
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (!showAccessDenied) {
      return null;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="mt-2">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You don't have permission to access this resource.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                >
                  Go Back
                </Button>
                <Button size="sm" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}

// Convenience components for common permission checks
export function AdminOnly({
  children,
  ...props
}: Omit<PermissionGuardProps, "requiredRole">) {
  return (
    <PermissionGuard requiredRole="Admin" {...props}>
      {children}
    </PermissionGuard>
  );
}

export function ManagerOnly({
  children,
  ...props
}: Omit<PermissionGuardProps, "requiredRole">) {
  return (
    <PermissionGuard requiredRole="Manager" {...props}>
      {children}
    </PermissionGuard>
  );
}

export function FinanceOnly({
  children,
  ...props
}: Omit<PermissionGuardProps, "requiredRole">) {
  return (
    <PermissionGuard requiredRole="Finance" {...props}>
      {children}
    </PermissionGuard>
  );
}

export function OperationsOnly({
  children,
  ...props
}: Omit<PermissionGuardProps, "requiredRole">) {
  return (
    <PermissionGuard requiredRole="Operations" {...props}>
      {children}
    </PermissionGuard>
  );
}

export function CashierOnly({
  children,
  ...props
}: Omit<PermissionGuardProps, "requiredRole">) {
  return (
    <PermissionGuard requiredRole="Cashier" {...props}>
      {children}
    </PermissionGuard>
  );
}

export function SupervisorOnly({
  children,
  ...props
}: Omit<PermissionGuardProps, "requiredRole">) {
  return (
    <PermissionGuard requiredRole="Supervisor" {...props}>
      {children}
    </PermissionGuard>
  );
}

// Role-based access components
export function WithRoleCheck({
  children,
  allowedRoles,
  ...props
}: Omit<PermissionGuardProps, "requiredRole"> & { allowedRoles: Role[] }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      setHasAccess(false);
      router.push("/");
      return;
    }

    const userRole = user.role as Role;
    const hasValidRole = allowedRoles.includes(userRole);
    setHasAccess(hasValidRole);

    if (!hasValidRole && props.redirectTo) {
      router.push(props.redirectTo);
    }
  }, [user, isLoading, allowedRoles, props.redirectTo, router]);

  if (isLoading || hasAccess === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking role access...</span>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (props.fallback) {
      return <>{props.fallback}</>;
    }

    if (!props.showAccessDenied) {
      return null;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <Alert className="max-w-md">
          <Shield className="h-4 w-4" />
          <AlertDescription className="mt-2">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Insufficient Role</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your role does not have access to this resource.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                >
                  Go Back
                </Button>
                <Button size="sm" onClick={() => router.push("/dashboard")}>
                  Dashboard
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
