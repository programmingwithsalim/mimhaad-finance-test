import { useAuth } from "@/lib/auth-context";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canPerformTransaction,
  canPerformDailyTransaction,
  type Role,
  type Permission,
  normalizeRole,
  TRANSACTION_LIMITS,
  ROLE_DISPLAY_INFO,
} from "@/lib/rbac/unified-rbac";

export function usePermissions() {
  const { user } = useAuth();

  const userRole = user?.role ? normalizeRole(user.role) : null;

  const checkPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    return hasPermission(userRole, permission);
  };

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!userRole) return false;
    return hasAnyPermission(userRole, permissions);
  };

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    if (!userRole) return false;
    return hasAllPermissions(userRole, permissions);
  };

  const canProcessTransaction = (amount: number): boolean => {
    if (!userRole) return false;
    return canPerformTransaction(userRole, amount);
  };

  const canProcessDailyTransaction = (
    dailyTotal: number,
    newAmount: number
  ): boolean => {
    if (!userRole) return false;
    return canPerformDailyTransaction(userRole, dailyTotal, newAmount);
  };

  const getTransactionLimits = () => {
    if (!userRole) return null;
    return TRANSACTION_LIMITS[userRole];
  };

  const getRoleInfo = () => {
    if (!userRole) return null;
    return ROLE_DISPLAY_INFO[userRole];
  };

  const isAdmin = userRole === "Admin";
  const isManager = userRole === "Manager";
  const isFinance = userRole === "Finance";
  const isOperations = userRole === "Operations";
  const isSupervisor = userRole === "Supervisor";
  const isCashier = userRole === "Cashier";

  // Common permission checks
  const canViewDashboard = checkPermission("dashboard.view");
  const canViewTransactions = checkPermission("transactions.view");
  const canCreateTransactions = checkPermission("transactions.create");
  const canApproveTransactions = checkPermission("transactions.approve");
  const canReverseTransactions = checkPermission("transactions.reverse");

  const canProcessMomo = checkPermission("momo.process");
  const canProcessAgencyBanking = checkPermission("agency_banking.process");
  const canProcessEzwich = checkPermission("ezwich.process");
  const canProcessPower = checkPermission("power.process");
  const canProcessJumia = checkPermission("jumia.process");

  const canViewFloat = checkPermission("float.view");
  const canManageFloat = checkPermission("float.manage");
  const canApproveFloatRequests = checkPermission("float.approve");
  const canAllocateFloat = checkPermission("float.allocate");

  const canViewExpenses = checkPermission("expenses.view");
  const canCreateExpenses = checkPermission("expenses.create");
  const canApproveExpenses = checkPermission("expenses.approve");

  const canViewCommissions = checkPermission("commissions.view");
  const canManageCommissions = checkPermission("commissions.manage");

  const canViewGlAccounts = checkPermission("gl.view");
  const canManageGlAccounts = checkPermission("gl.manage");
  const canReconcileAccounts = checkPermission("accounts.reconcile");

  const canViewUsers = checkPermission("users.view");
  const canCreateUsers = checkPermission("users.create");
  const canEditUsers = checkPermission("users.edit");
  const canDeleteUsers = checkPermission("users.delete");

  const canViewBranches = checkPermission("branches.view");
  const canManageBranches = checkPermission("branches.manage");
  const canViewBranchPerformance = checkPermission("branches.performance");

  const canViewReports = checkPermission("reports.view");
  const canExportReports = checkPermission("reports.export");
  const canViewAuditLogs = checkPermission("audit.view");

  const canViewSettings = checkPermission("settings.view");
  const canManageSettings = checkPermission("settings.manage");

  const canViewInventory = checkPermission("inventory.view");
  const canManageInventory = checkPermission("inventory.manage");

  const canInitiateTransfers = checkPermission("transfers.initiate");
  const canApproveTransfers = checkPermission("transfers.approve");
  const canManageTransfers = checkPermission("transfers.manage");

  return {
    // User role
    userRole,
    isAdmin,
    isManager,
    isFinance,
    isOperations,
    isSupervisor,
    isCashier,

    // Permission checking functions
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,

    // Transaction limits
    canProcessTransaction,
    canProcessDailyTransaction,
    getTransactionLimits,
    getRoleInfo,

    // Common permissions
    canViewDashboard,
    canViewTransactions,
    canCreateTransactions,
    canApproveTransactions,
    canReverseTransactions,

    // Service permissions
    canProcessMomo,
    canProcessAgencyBanking,
    canProcessEzwich,
    canProcessPower,
    canProcessJumia,

    // Float permissions
    canViewFloat,
    canManageFloat,
    canApproveFloatRequests,
    canAllocateFloat,

    // Expense permissions
    canViewExpenses,
    canCreateExpenses,
    canApproveExpenses,

    // Commission permissions
    canViewCommissions,
    canManageCommissions,

    // GL permissions
    canViewGlAccounts,
    canManageGlAccounts,
    canReconcileAccounts,

    // User management permissions
    canViewUsers,
    canCreateUsers,
    canEditUsers,
    canDeleteUsers,

    // Branch permissions
    canViewBranches,
    canManageBranches,
    canViewBranchPerformance,

    // Report permissions
    canViewReports,
    canExportReports,
    canViewAuditLogs,

    // Settings permissions
    canViewSettings,
    canManageSettings,

    // Inventory permissions
    canViewInventory,
    canManageInventory,

    // Transfer permissions
    canInitiateTransfers,
    canApproveTransfers,
    canManageTransfers,
  };
}
