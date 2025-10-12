"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRBAC } from "@/components/rbac/rbac-provider";
import {
  LayoutDashboard,
  Receipt,
  DollarSign,
  Smartphone,
  Building2,
  CreditCard,
  Zap,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Calculator,
  FileText,
  Shield,
  Users,
  Settings,
} from "lucide-react";

const roleAccessMap = {
  Admin: {
    description: "Full system access",
    access: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
        description: "Full overview",
      },
      {
        name: "All Transactions",
        icon: Receipt,
        description: "View all transactions",
      },
      {
        name: "All Services",
        icon: Smartphone,
        description: "MoMo, Agency Banking, E-Zwich, Power, Jumia",
      },
      {
        name: "Financial Management",
        icon: DollarSign,
        description: "Float, Expenses, Commissions, GL Accounting",
      },
      {
        name: "Inventory & Assets",
        icon: Wallet,
        description: "E-Zwich Inventory, Fixed Assets",
      },
      {
        name: "User Management",
        icon: Users,
        description: "Manage users and branches",
      },
      {
        name: "Reports & Analytics",
        icon: FileText,
        description: "All reports and analytics",
      },
      {
        name: "System Settings",
        icon: Settings,
        description: "Full system configuration",
      },
    ],
  },
  Manager: {
    description: "Operational management access",
    access: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
        description: "Full overview",
      },
      {
        name: "All Transactions",
        icon: Receipt,
        description: "View all transactions",
      },
      {
        name: "All Services",
        icon: Smartphone,
        description: "MoMo, Agency Banking, E-Zwich, Power, Jumia",
      },
      {
        name: "Financial Management",
        icon: DollarSign,
        description: "Float, Expenses, Commissions",
      },
      {
        name: "Inventory & Assets",
        icon: Wallet,
        description: "E-Zwich Inventory, Fixed Assets",
      },
      {
        name: "Reports & Analytics",
        icon: FileText,
        description: "All reports and analytics",
      },
      {
        name: "System Settings",
        icon: Settings,
        description: "System configuration",
      },
    ],
  },
  Finance: {
    description: "Financial management access",
    access: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
        description: "Financial overview",
      },
      {
        name: "All Transactions",
        icon: Receipt,
        description: "View all transactions",
      },
      {
        name: "Financial Management",
        icon: DollarSign,
        description: "Float, Expenses, Commissions, GL Accounting",
      },
      {
        name: "Inventory & Assets",
        icon: Wallet,
        description: "E-Zwich Inventory, Fixed Assets",
      },
      {
        name: "Reports & Analytics",
        icon: FileText,
        description: "Financial reports and analytics",
      },
      { name: "Audit Trail", icon: Shield, description: "System audit logs" },
      {
        name: "System Settings",
        icon: Settings,
        description: "System configuration",
      },
    ],
  },
  Operations: {
    description: "Service operations access",
    access: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
        description: "Operational overview",
      },
      {
        name: "All Transactions",
        icon: Receipt,
        description: "View all transactions",
      },
      {
        name: "All Services",
        icon: Smartphone,
        description: "MoMo, Agency Banking, E-Zwich, Power, Jumia",
      },
      {
        name: "Expenses",
        icon: DollarSign,
        description: "View and create expenses",
      },
      {
        name: "System Settings",
        icon: Settings,
        description: "System configuration",
      },
    ],
  },
  Cashier: {
    description: "Basic transaction and expense access",
    access: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
        description: "Basic overview",
      },
      {
        name: "All Transactions",
        icon: Receipt,
        description: "View all transactions",
      },
      { name: "Expenses", icon: DollarSign, description: "View expenses" },
      {
        name: "System Settings",
        icon: Settings,
        description: "System configuration",
      },
    ],
  },
};

export function RoleAccessSummary() {
  const { userRole } = useRBAC();

  if (!userRole) return null;

  const roleInfo = roleAccessMap[userRole as keyof typeof roleAccessMap];

  if (!roleInfo) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Badge variant="outline">{userRole}</Badge>
          Role Access Summary
        </CardTitle>
        <CardDescription>{roleInfo.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleInfo.access.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <item.icon className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
