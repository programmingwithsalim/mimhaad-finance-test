"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canPerformTransaction,
  canPerformDailyTransaction,
  normalizeRole,
  type Role,
  type Permission,
  TRANSACTION_LIMITS,
  ROLE_DISPLAY_INFO,
} from "@/lib/rbac/unified-rbac";

interface RBACContextType {
  userRole: Role | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canPerformTransaction: (amount: number) => boolean;
  canPerformDailyTransaction: (
    dailyTotal: number,
    newAmount: number
  ) => boolean;
  getTransactionLimits: () => { maxAmount: number; dailyLimit: number } | null;
  getRoleInfo: () => {
    label: string;
    description: string;
    color: string;
  } | null;
  isAdmin: boolean;
  isManager: boolean;
  isFinance: boolean;
  isOperations: boolean;
  isSupervisor: boolean;
  isCashier: boolean;
}

const RBACContext = createContext<RBACContextType>({
  userRole: null,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  canPerformTransaction: () => false,
  canPerformDailyTransaction: () => false,
  getTransactionLimits: () => null,
  getRoleInfo: () => null,
  isAdmin: false,
  isManager: false,
  isFinance: false,
  isOperations: false,
  isSupervisor: false,
  isCashier: false,
});

export const useRBAC = () => useContext(RBACContext);

export function RBACProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<Role | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (user?.role) {
        const normalizedRole = normalizeRole(user.role);

        if (normalizedRole) {
          setUserRole(normalizedRole);
        } else {
          // Use the original role if normalization fails
          setUserRole(user.role as Role);
        }
      } else if (user) {
        setUserRole("Operations");
      } else {
        setUserRole(null);
      }
    }
  }, [user?.role, authLoading, user]);

  const contextValue: RBACContextType = {
    userRole,
    hasPermission: (permission: Permission) => {
      if (!userRole) return false;
      return hasPermission(userRole, permission);
    },
    hasAnyPermission: (permissions: Permission[]) => {
      if (!userRole) return false;
      return hasAnyPermission(userRole, permissions);
    },
    hasAllPermissions: (permissions: Permission[]) => {
      if (!userRole) return false;
      return hasAllPermissions(userRole, permissions);
    },
    canPerformTransaction: (amount: number) => {
      if (!userRole) return false;
      return canPerformTransaction(userRole, amount);
    },
    canPerformDailyTransaction: (dailyTotal: number, newAmount: number) => {
      if (!userRole) return false;
      return canPerformDailyTransaction(userRole, dailyTotal, newAmount);
    },
    getTransactionLimits: () => {
      if (!userRole) return null;
      return TRANSACTION_LIMITS[userRole];
    },
    getRoleInfo: () => {
      if (!userRole) return null;
      return ROLE_DISPLAY_INFO[userRole];
    },
    isAdmin: userRole === "Admin",
    isManager: userRole === "Manager",
    isFinance: userRole === "Finance",
    isOperations: userRole === "Operations",
    isSupervisor: userRole === "Supervisor",
    isCashier: userRole === "Cashier",
  };

  return (
    <RBACContext.Provider value={contextValue}>{children}</RBACContext.Provider>
  );
}
