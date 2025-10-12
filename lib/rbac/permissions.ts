import type { Permission } from "./types";

// Define which permissions each role has
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "manage_users",
    "view_users",
    "create_user",
    "edit_user",
    "delete_user",
    "view_transactions",
    "create_transaction",
    "approve_transaction",
    "cancel_transaction",
    "view_reports",
    "manage_expenses",
    "approve_expenses",
    "view_gl",
    "manage_gl",
    "view_float",
    "manage_float",
    "approve_float",
    "view_branches",
    "manage_branches",
    "view_audit_logs",
    "manage_settings",
  ],
  manager: [
    "view_transactions",
    "create_transaction",
    "approve_transaction",
    "view_reports",
    "manage_expenses",
    "approve_expenses",
    "view_gl",
    "view_float",
    "manage_float",
    "view_branches",
    "view_audit_logs",
    "view_settings",
    // Note: Manager does NOT have user management or branch management permissions
  ],
  finance: [
    "view_transactions",
    "view_reports",
    "manage_expenses",
    "view_gl",
    "manage_gl",
    "view_float",
    "manage_float",
    "view_branches",
    "view_audit_logs",
    "view_settings",
  ],
  operations: [
    "view_transactions",
    "create_transaction",
    "view_float",
    "view_expenses",
    "create_expenses",
    "view_settings",
  ],
  cashier: ["view_transactions", "view_expenses", "view_settings"],
  user: ["view_transactions"],
};

// Helper function to check if a user has a specific permission
export function hasPermission(role: string, permission: Permission): boolean {
  // Convert role to lowercase to ensure case-insensitive matching
  const normalizedRole = role.toLowerCase();

  // If the role doesn't exist in our mapping, return false
  if (!ROLE_PERMISSIONS[normalizedRole]) {
    console.warn(`Role "${normalizedRole}" not found in permissions mapping`);
    return false;
  }

  return ROLE_PERMISSIONS[normalizedRole].includes(permission);
}

// Helper function to check if a user has any of the specified permissions
export function hasAnyPermission(
  role: string,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

// Helper function to check if a user has all of the specified permissions
export function hasAllPermissions(
  role: string,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// Get all permissions for a role
export function getPermissionsForRole(role: string): Permission[] {
  // Convert role to lowercase to ensure case-insensitive matching
  const normalizedRole = role.toLowerCase();
  return ROLE_PERMISSIONS[normalizedRole] || [];
}
