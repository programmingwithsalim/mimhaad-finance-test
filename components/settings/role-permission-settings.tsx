"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Shield, Users, Settings, Eye, Edit, Loader2, Lock, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface RolePermissionSettingsProps {
  userRole: string | undefined
}

interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  user_count?: number
}

const permissionLabels = {
  user_management: "User Management",
  branch_management: "Branch Management",
  system_settings: "System Settings",
  financial_management: "Financial Management",
  reports_access: "Reports Access",
  audit_trail: "Audit Trail",
  role_management: "Role Management",
  expense_management: "Expense Management",
  commission_management: "Commission Management",
  transaction_processing: "Transaction Processing",
  basic_reports: "Basic Reports",
  view_dashboard: "View Dashboard",
  basic_transactions: "Basic Transactions",
  "transactions:approve": "Approve Transactions",
  "transfers:manage": "Manage Transfers",
  "operations:override": "Override Operations",
  "reports:all": "All Reports",
  "accounts:reconcile": "Reconcile Accounts",
  "audit:view": "View Audit Trail",
  "transactions:process": "Process Transactions",
  "transactions:view": "View Transactions",
  "balance:view": "View Balance",
  "transactions:initiate": "Initiate Transactions",
  "transactions:verify": "Verify Transactions",
  "customers:view": "View Customers",
  all: "All Permissions",
}

const RolePermissionSettings: React.FC<RolePermissionSettingsProps> = ({ userRole }) => {
  const { toast } = useToast()
  const [canManageRoles, setCanManageRoles] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (userRole) {
      setCanManageRoles(userRole?.toLowerCase() === "admin" || userRole?.toLowerCase() === "system administrator")
    } else {
      setCanManageRoles(false)
    }
    fetchRoles()
  }, [userRole])

  const fetchRoles = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/settings/roles")
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // Fetch user counts for each role
          const rolesWithCounts = await Promise.all(
            result.data.map(async (role: Role) => {
              try {
                const userResponse = await fetch(`/api/users?role=${encodeURIComponent(role.name)}`)
                if (userResponse.ok) {
                  const userResult = await userResponse.json()
                  return {
                    ...role,
                    user_count: userResult.success ? userResult.data.length : 0,
                  }
                }
              } catch (error) {
                console.warn(`Failed to fetch user count for role ${role.name}:`, error)
              }
              return { ...role, user_count: 0 }
            }),
          )

          setRoles(rolesWithCounts)
          if (rolesWithCounts.length > 0) {
            setSelectedRole(rolesWithCounts[0].name)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching roles:", error)
      toast({
        title: "Error",
        description: "Failed to load roles",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateRolePermissions = async (roleId: number, permissions: string[]) => {
    try {
      setIsSaving(true)
      const response = await fetch("/api/settings/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, permissions, updatedBy: 1 }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Role permissions updated successfully",
        })
        fetchRoles() // Refresh roles
      } else {
        throw new Error("Failed to update permissions")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role permissions",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const selectedRoleData = roles.find((role) => role.name === selectedRole)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading roles and permissions...
        </CardContent>
      </Card>
    )
  }

  if (!canManageRoles) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role and Permission Settings
          </CardTitle>
          <CardDescription>Manage user roles and their associated permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">You do not have permission to manage roles and permissions.</p>
              <p className="text-sm text-muted-foreground mt-2">Contact your administrator for access.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role and Permission Settings
          </CardTitle>
          <CardDescription>Manage user roles and their associated permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Current User Role Display */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h4 className="font-medium">Your Current Role</h4>
                  <p className="text-sm text-muted-foreground">You are currently logged in as an administrator</p>
                </div>
              </div>
              <Badge variant="destructive">{userRole}</Badge>
            </div>

            <Separator />

            {/* Role Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Manage Role Permissions</h3>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Role
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role) => (
                  <Card
                    key={role.id}
                    className={`cursor-pointer transition-colors ${
                      selectedRole === role.name ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedRole(role.name)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={role.name.toLowerCase().includes("admin") ? "destructive" : "default"}>
                            {role.name}
                          </Badge>
                          {role.is_system && (
                            <Lock className="h-3 w-3 text-muted-foreground" title="System Role - Protected" />
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {Array.isArray(role.permissions) ? role.permissions.length : 0} permissions
                        </span>
                      </div>

                      <div className="space-y-1 mb-3">
                        {Array.isArray(role.permissions) &&
                          role.permissions.slice(0, 3).map((permission) => (
                            <div key={permission} className="text-xs text-muted-foreground">
                              • {permissionLabels[permission as keyof typeof permissionLabels] || permission}
                            </div>
                          ))}
                        {Array.isArray(role.permissions) && role.permissions.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{role.permissions.length - 3} more...</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{role.user_count || 0} users assigned</span>
                        {role.is_system && <span>Protected</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Separator />

            {/* Permission Details */}
            {selectedRoleData && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Permissions for {selectedRoleData.name}</h3>
                  {selectedRoleData.is_system && (
                    <Alert className="w-auto">
                      <Lock className="h-4 w-4" />
                      <AlertDescription>
                        This is a system role and cannot be modified to maintain system security.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-3">
                  {Object.entries(permissionLabels).map(([permissionKey, permissionLabel]) => {
                    const hasPermission =
                      Array.isArray(selectedRoleData.permissions) &&
                      (selectedRoleData.permissions.includes(permissionKey) ||
                        selectedRoleData.permissions.includes("all"))

                    return (
                      <div key={permissionKey} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${hasPermission ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                          >
                            {permissionKey.includes("management") ? (
                              <Settings className="h-4 w-4" />
                            ) : permissionKey.includes("view") || permissionKey.includes("reports") ? (
                              <Eye className="h-4 w-4" />
                            ) : permissionKey.includes("edit") ? (
                              <Edit className="h-4 w-4" />
                            ) : (
                              <Shield className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{permissionLabel}</h4>
                            <p className="text-sm text-muted-foreground">{getPermissionDescription(permissionKey)}</p>
                          </div>
                        </div>
                        <Switch
                          checked={hasPermission}
                          disabled={selectedRoleData.is_system || isSaving}
                          onCheckedChange={(checked) => {
                            if (!selectedRoleData.is_system) {
                              const currentPermissions = Array.isArray(selectedRoleData.permissions)
                                ? selectedRoleData.permissions
                                : []
                              let newPermissions: string[]

                              if (checked) {
                                newPermissions = [...currentPermissions, permissionKey]
                              } else {
                                newPermissions = currentPermissions.filter((p) => p !== permissionKey)
                              }

                              updateRolePermissions(selectedRoleData.id, newPermissions)
                            }
                          }}
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Role Assignment Info */}
                {selectedRoleData.user_count && selectedRoleData.user_count > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Users with this role</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      {selectedRoleData.user_count} user(s) are currently assigned to this role. Changes to permissions
                      will affect all assigned users.
                    </p>
                    <Button variant="outline" size="sm" className="mt-2">
                      View Users with this Role
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={fetchRoles} disabled={isSaving}>
                Refresh Roles
              </Button>
              <Button disabled={isSaving || selectedRoleData?.is_system}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper function to get permission descriptions
function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    user_management: "Create, edit, and manage user accounts",
    branch_management: "Manage branch information and settings",
    system_settings: "Access and modify system configuration",
    financial_management: "Manage financial operations and float",
    reports_access: "View and generate reports",
    audit_trail: "Access audit logs and system history",
    role_management: "Manage user roles and permissions",
    expense_management: "Handle expense approvals and management",
    commission_management: "Manage commission calculations and payments",
    transaction_processing: "Process daily transactions",
    basic_reports: "View basic transaction reports",
    view_dashboard: "Access the main dashboard",
    basic_transactions: "Perform basic transaction operations",
    "transactions:approve": "Approve high-value transactions",
    "transfers:manage": "Manage fund transfers",
    "operations:override": "Override operational restrictions",
    "reports:all": "Access all system reports",
    "accounts:reconcile": "Reconcile financial accounts",
    "audit:view": "View audit trails and logs",
    "transactions:process": "Process customer transactions",
    "transactions:view": "View transaction history",
    "balance:view": "View account balances",
    "transactions:initiate": "Initiate new transactions",
    "transactions:verify": "Verify customer requests",
    "customers:view": "View customer information",
    all: "Complete system access with all permissions",
  }

  return descriptions[permission] || "Permission description not available"
}

export default RolePermissionSettings

// Named export for compatibility
export { RolePermissionSettings }
