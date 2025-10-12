import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Define case-sensitive roles
export type Role =
  | "Admin"
  | "Manager"
  | "Finance"
  | "Operations"
  | "Cashier"
  | "Supervisor";

// Define all available permissions
export const PERMISSIONS = {
  // Dashboard permissions
  VIEW_DASHBOARD: "dashboard.view",

  // Transaction permissions
  VIEW_TRANSACTIONS: "transactions.view",
  CREATE_TRANSACTIONS: "transactions.create",
  APPROVE_TRANSACTIONS: "transactions.approve",
  REVERSE_TRANSACTIONS: "transactions.reverse",
  PROCESS_MOMO: "momo.process",
  PROCESS_AGENCY_BANKING: "agency_banking.process",
  PROCESS_EZWICH: "ezwich.process",
  PROCESS_POWER: "power.process",
  PROCESS_JUMIA: "jumia.process",

  // Financial permissions
  VIEW_FLOAT: "float.view",
  MANAGE_FLOAT: "float.manage",
  APPROVE_FLOAT_REQUESTS: "float.approve",
  ALLOCATE_FLOAT: "float.allocate",
  VIEW_EXPENSES: "expenses.view",
  CREATE_EXPENSES: "expenses.create",
  APPROVE_EXPENSES: "expenses.approve",
  VIEW_COMMISSIONS: "commissions.view",
  MANAGE_COMMISSIONS: "commissions.manage",
  VIEW_GL_ACCOUNTS: "gl.view",
  MANAGE_GL_ACCOUNTS: "gl.manage",
  RECONCILE_ACCOUNTS: "accounts.reconcile",

  // Management permissions
  VIEW_USERS: "users.view",
  CREATE_USERS: "users.create",
  EDIT_USERS: "users.edit",
  DELETE_USERS: "users.delete",
  VIEW_BRANCHES: "branches.view",
  MANAGE_BRANCHES: "branches.manage",
  VIEW_BRANCH_PERFORMANCE: "branches.performance",

  // Reports and audit permissions
  VIEW_REPORTS: "reports.view",
  EXPORT_REPORTS: "reports.export",
  VIEW_AUDIT_LOGS: "audit.view",

  // System permissions
  VIEW_SETTINGS: "settings.view",
  MANAGE_SETTINGS: "settings.manage",
  VIEW_INVENTORY: "inventory.view",
  MANAGE_INVENTORY: "inventory.manage",

  // Transfer permissions
  INITIATE_TRANSFERS: "transfers.initiate",
  APPROVE_TRANSFERS: "transfers.approve",
  MANAGE_TRANSFERS: "transfers.manage",

  // All permissions (for admin)
  ALL: "*",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Role hierarchy and default permissions with proper capitalization
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: Object.values(PERMISSIONS), // Full access

  Manager: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.CREATE_TRANSACTIONS,
    PERMISSIONS.APPROVE_TRANSACTIONS,
    PERMISSIONS.PROCESS_MOMO,
    PERMISSIONS.PROCESS_AGENCY_BANKING,
    PERMISSIONS.PROCESS_EZWICH,
    PERMISSIONS.PROCESS_POWER,
    PERMISSIONS.PROCESS_JUMIA,
    PERMISSIONS.VIEW_FLOAT,
    PERMISSIONS.MANAGE_FLOAT,
    PERMISSIONS.APPROVE_FLOAT_REQUESTS,
    PERMISSIONS.ALLOCATE_FLOAT,
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.CREATE_EXPENSES,
    PERMISSIONS.APPROVE_EXPENSES,
    PERMISSIONS.VIEW_COMMISSIONS,
    PERMISSIONS.MANAGE_COMMISSIONS,
    PERMISSIONS.VIEW_BRANCHES,
    PERMISSIONS.VIEW_BRANCH_PERFORMANCE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.INITIATE_TRANSFERS,
    PERMISSIONS.APPROVE_TRANSFERS,
    PERMISSIONS.MANAGE_TRANSFERS,
    // Note: Manager does NOT have user management or branch management permissions
  ],

  Finance: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.REVERSE_TRANSACTIONS,
    PERMISSIONS.VIEW_FLOAT,
    PERMISSIONS.MANAGE_FLOAT,
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.CREATE_EXPENSES,
    PERMISSIONS.APPROVE_EXPENSES,
    PERMISSIONS.VIEW_COMMISSIONS,
    PERMISSIONS.MANAGE_COMMISSIONS,
    PERMISSIONS.VIEW_GL_ACCOUNTS,
    PERMISSIONS.MANAGE_GL_ACCOUNTS,
    PERMISSIONS.RECONCILE_ACCOUNTS,
    PERMISSIONS.VIEW_BRANCHES,
    PERMISSIONS.VIEW_BRANCH_PERFORMANCE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_INVENTORY,
  ],

  Operations: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.CREATE_TRANSACTIONS,
    PERMISSIONS.PROCESS_MOMO,
    PERMISSIONS.PROCESS_AGENCY_BANKING,
    PERMISSIONS.PROCESS_EZWICH,
    PERMISSIONS.PROCESS_POWER,
    PERMISSIONS.PROCESS_JUMIA,
    PERMISSIONS.VIEW_FLOAT,
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.CREATE_EXPENSES,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.INITIATE_TRANSFERS,
  ],

  Cashier: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.VIEW_SETTINGS,
  ],
};

// Transaction limits by role
export const TRANSACTION_LIMITS: Record<
  Role,
  { maxAmount: number; dailyLimit: number }
> = {
  Admin: {
    maxAmount: Number.POSITIVE_INFINITY,
    dailyLimit: Number.POSITIVE_INFINITY,
  },
  Manager: { maxAmount: 100000, dailyLimit: 500000 },
  Finance: { maxAmount: 50000, dailyLimit: 200000 },
  Operations: { maxAmount: 25000, dailyLimit: 100000 },
  Supervisor: { maxAmount: 15000, dailyLimit: 75000 },
  Cashier: { maxAmount: 5000, dailyLimit: 25000 },
};

// Normalize role to handle case sensitivity and variations
export function normalizeRole(role: string | undefined | null): Role | null {
  if (!role) {
    return null;
  }

  const normalized = role.toLowerCase().trim();

  switch (normalized) {
    case "admin":
    case "administrator":
      return "Admin";
    case "manager":
    case "management":
      return "Manager";
    case "finance":
    case "financial":
      return "Finance";
    case "operations":
    case "operation":
      return "Operations";
    case "supervisor":
    case "supervisory":
      return "Supervisor";
    case "cashier":
    case "cash":
      return "Cashier";
    default:
      console.log("normalizeRole: Unknown role:", role, "-> returning null");
      return null;
  }
}

// Permission checking functions
export function hasPermission(userRole: Role, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return (
    rolePermissions.includes(permission) ||
    rolePermissions.includes(PERMISSIONS.ALL)
  );
}

export function hasAnyPermission(
  userRole: Role,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission));
}

export function hasAllPermissions(
  userRole: Role,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission));
}

// Database functions for dynamic permissions
export async function getUserPermissions(
  userId: string
): Promise<Permission[]> {
  try {
    const user = await sql`
      SELECT role FROM users WHERE id = ${userId} AND status = 'active'
    `;

    if (user.length === 0) return [];

    const userRole = normalizeRole(user[0].role);
    if (!userRole) return [];

    return ROLE_PERMISSIONS[userRole] || [];
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return [];
  }
}

export async function getUserRole(userId: string): Promise<Role | null> {
  try {
    const user = await sql`
      SELECT role FROM users WHERE id = ${userId} AND status = 'active'
    `;

    if (user.length === 0) return null;

    return normalizeRole(user[0].role);
  } catch (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
}

// Check if user can perform transaction with given amount
export function canPerformTransaction(userRole: Role, amount: number): boolean {
  const limits = TRANSACTION_LIMITS[userRole];
  if (!limits) return false;

  return amount <= limits.maxAmount;
}

// Check if user can perform daily transactions up to given amount
export function canPerformDailyTransaction(
  userRole: Role,
  dailyTotal: number,
  newAmount: number
): boolean {
  const limits = TRANSACTION_LIMITS[userRole];
  if (!limits) return false;

  return dailyTotal + newAmount <= limits.dailyLimit;
}

// Get role display information
export const ROLE_DISPLAY_INFO: Record<
  Role,
  { label: string; description: string; color: string }
> = {
  Admin: {
    label: "Administrator",
    description: "Full system access with all permissions",
    color: "bg-red-100 text-red-800",
  },
  Manager: {
    label: "Manager",
    description: "Branch management and transaction approval",
    color: "bg-blue-100 text-blue-800",
  },
  Finance: {
    label: "Finance",
    description: "Financial operations and reporting",
    color: "bg-green-100 text-green-800",
  },
  Operations: {
    label: "Operations",
    description: "Daily transaction processing",
    color: "bg-yellow-100 text-yellow-800",
  },
  Supervisor: {
    label: "Supervisor",
    description: "Transaction supervision and approval",
    color: "bg-purple-100 text-purple-800",
  },
  Cashier: {
    label: "Cashier",
    description: "Basic transaction processing",
    color: "bg-gray-100 text-gray-800",
  },
};
