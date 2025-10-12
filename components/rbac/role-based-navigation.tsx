"use client";

import type React from "react";

import { useMemo } from "react";
import {
  LayoutDashboard,
  Smartphone,
  Building2,
  CreditCard,
  Zap,
  Package,
  TrendingUp,
  DollarSign,
  FileText,
  Calculator,
  Users,
  Settings,
  ClipboardList,
  Wallet,
} from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";

export interface NavigationItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  description?: string;
}

const navigationItems: NavigationItem[] = [
  // Dashboard - Available to all roles
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ["admin", "manager", "finance", "operations", "cashier"],
    description: "Overview and analytics",
  },

  // Transactions - Available to all roles
  {
    name: "All Transactions",
    path: "/dashboard/transactions",
    icon: <FileText className="h-4 w-4" />,
    roles: ["admin", "manager", "finance", "operations", "cashier"],
    description: "View all transactions",
  },

  // Services - Only for Operations, Manager, and Admin
  {
    name: "MoMo Services",
    path: "/dashboard/momo",
    icon: <Smartphone className="h-4 w-4" />,
    roles: ["admin", "manager", "operations"],
    description: "Mobile money transactions",
  },
  {
    name: "Agency Banking",
    path: "/dashboard/agency-banking",
    icon: <Building2 className="h-4 w-4" />,
    roles: ["admin", "manager", "operations"],
    description: "Bank agency services",
  },
  {
    name: "E-Zwich Services",
    path: "/dashboard/e-zwich",
    icon: <CreditCard className="h-4 w-4" />,
    roles: ["admin", "manager", "operations"],
    description: "E-Zwich card services",
  },
  {
    name: "Power Services",
    path: "/dashboard/power",
    icon: <Zap className="h-4 w-4" />,
    roles: ["admin", "manager", "operations"],
    description: "Electricity bill payments",
  },
  {
    name: "Jumia Services",
    path: "/dashboard/jumia",
    icon: <Package className="h-4 w-4" />,
    roles: ["admin", "manager", "operations"],
    description: "Jumia bill payments",
  },

  // Financial Management - Finance, Manager, and Admin
  {
    name: "Monthly Commissions",
    path: "/dashboard/monthly-commissions",
    icon: <TrendingUp className="h-4 w-4" />,
    roles: ["admin", "manager", "finance"],
    description: "Commission management",
  },
  {
    name: "Expenses",
    path: "/dashboard/expenses",
    icon: <DollarSign className="h-4 w-4" />,
    roles: ["admin", "manager", "finance", "operations", "cashier"],
    description: "Expense tracking",
  },
  {
    name: "Float Management",
    path: "/dashboard/float-management",
    icon: <Wallet className="h-4 w-4" />,
    roles: ["admin", "manager", "finance"],
    description: "Manage float accounts",
  },

  // Reports & Analytics - Finance, Manager, and Admin
  {
    name: "Reports",
    path: "/dashboard/reports",
    icon: <FileText className="h-4 w-4" />,
    roles: ["admin", "manager", "finance"],
    description: "Financial reports",
  },
  {
    name: "Analytics",
    path: "/dashboard/analytics",
    icon: <TrendingUp className="h-4 w-4" />,
    roles: ["admin", "manager", "finance"],
    description: "Business analytics",
  },

  // Management - Admin only (Manager excluded from Branch and User Management)
  {
    name: "Branch Management",
    path: "/dashboard/branch-management",
    icon: <Building2 className="h-4 w-4" />,
    roles: ["admin"],
    description: "Manage branches",
  },
  {
    name: "User Management",
    path: "/dashboard/user-management",
    icon: <Users className="h-4 w-4" />,
    roles: ["admin"],
    description: "Manage users",
  },

  // System Administration - Admin only (Manager excluded from Settings)
  {
    name: "GL Accounting",
    path: "/dashboard/gl-accounting",
    icon: <Calculator className="h-4 w-4" />,
    roles: ["admin", "finance"],
    description: "General ledger",
  },
  {
    name: "Audit Trail",
    path: "/dashboard/audit-trail",
    icon: <ClipboardList className="h-4 w-4" />,
    roles: ["admin", "manager", "finance"],
    description: "System audit logs",
  },
  {
    name: "Settings",
    path: "/dashboard/settings",
    icon: <Settings className="h-4 w-4" />,
    roles: ["admin", "manager", "finance", "operations", "cashier"],
    description: "System settings",
  },
];

export function useRoleBasedNavigation() {
  const { user } = useCurrentUser();

  const filteredNavigationItems = useMemo(() => {
    if (!user || !user.role) {
      return [];
    }

    const userRole = user.role.toLowerCase();
    return navigationItems.filter((item) => item.roles.includes(userRole));
  }, [user]);

  return {
    navigationItems: filteredNavigationItems,
    allNavigationItems: navigationItems,
  };
}
