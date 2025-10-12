// Define the available roles in the system
export type UserRole = "admin" | "manager" | "finance" | "operations" | "cashier" | "user"

// Define all possible permissions in the system
export type Permission =
  // User management permissions
  | "manage_users"
  | "view_users"
  | "create_user"
  | "edit_user"
  | "delete_user"

  // Transaction permissions
  | "view_transactions"
  | "create_transaction"
  | "approve_transaction"
  | "cancel_transaction"

  // Finance permissions
  | "view_reports"
  | "manage_expenses"
  | "approve_expenses"
  | "view_gl"
  | "manage_gl"

  // Float management
  | "view_float"
  | "manage_float"
  | "approve_float"

  // Branch management
  | "view_branches"
  | "manage_branches"

  // System permissions
  | "view_audit_logs"
  | "manage_settings"

// User interface with role
export interface RBACUser {
  id: string
  name: string
  email: string
  role: UserRole
  branchId?: string
}
