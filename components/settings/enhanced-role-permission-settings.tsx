"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Users, Shield, Plus, Edit, Trash2, Save, X, Lock, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Define all available permissions
const ALL_PERMISSIONS = [
  { id: "dashboard.view", label: "View Dashboard", category: "Dashboard" },
  { id: "transactions.view", label: "View Transactions", category: "Transactions" },
  { id: "transactions.create", label: "Create Transactions", category: "Transactions" },
  { id: "transactions.approve", label: "Approve Transactions", category: "Transactions" },
  { id: "transactions.reverse", label: "Reverse Transactions", category: "Transactions" },
  { id: "momo.access", label: "Access Mobile Money", category: "Services" },
  { id: "agency_banking.access", label: "Access Agency Banking", category: "Services" },
  { id: "ezwich.access", label: "Access E-Zwich", category: "Services" },
  { id: "power.access", label: "Access Power/Utilities", category: "Services" },
  { id: "jumia.access", label: "Access Jumia Pay", category: "Services" },
  { id: "float.view", label: "View Float Management", category: "Financial" },
  { id: "float.manage", label: "Manage Float", category: "Financial" },
  { id: "expenses.view", label: "View Expenses", category: "Financial" },
  { id: "expenses.create", label: "Create Expenses", category: "Financial" },
  { id: "expenses.approve", label: "Approve Expenses", category: "Financial" },
  { id: "commissions.view", label: "View Commissions", category: "Financial" },
  { id: "commissions.manage", label: "Manage Commissions", category: "Financial" },
  { id: "gl.view", label: "View GL Accounting", category: "Financial" },
  { id: "gl.manage", label: "Manage GL Accounting", category: "Financial" },
  { id: "inventory.view", label: "View Inventory", category: "Inventory" },
  { id: "inventory.manage", label: "Manage Inventory", category: "Inventory" },
  { id: "users.view", label: "View Users", category: "Management" },
  { id: "users.create", label: "Create Users", category: "Management" },
  { id: "users.edit", label: "Edit Users", category: "Management" },
  { id: "users.delete", label: "Delete Users", category: "Management" },
  { id: "branches.view", label: "View Branches", category: "Management" },
  { id: "branches.manage", label: "Manage Branches", category: "Management" },
  { id: "reports.view", label: "View Reports", category: "Reports" },
  { id: "reports.export", label: "Export Reports", category: "Reports" },
  { id: "audit.view", label: "View Audit Trail", category: "Reports" },
  { id: "settings.view", label: "View Settings", category: "System" },
  { id: "settings.manage", label: "Manage Settings", category: "System" },
]

// Default role configurations
const DEFAULT_ROLES = [
  {
    id: "1",
    name: "Admin",
    description: "Full system access",
    permissions: ALL_PERMISSIONS.map((p) => p.id),
    isSystem: true,
  },
  {
    id: "2",
    name: "Manager",
    description: "Management level access",
    permissions: [
      "dashboard.view",
      "transactions.view",
      "transactions.create",
      "transactions.approve",
      "momo.access",
      "agency_banking.access",
      "ezwich.access",
      "power.access",
      "jumia.access",
      "float.view",
      "float.manage",
      "expenses.view",
      "expenses.create",
      "expenses.approve",
      "commissions.view",
      "commissions.manage",
      "inventory.view",
      "inventory.manage",
      "reports.view",
      "reports.export",
      "audit.view",
      "settings.view",
    ],
    isSystem: true,
  },
  {
    id: "3",
    name: "Finance",
    description: "Financial operations access",
    permissions: [
      "dashboard.view",
      "transactions.view",
      "transactions.reverse",
      "float.view",
      "float.manage",
      "expenses.view",
      "expenses.create",
      "expenses.approve",
      "commissions.view",
      "commissions.manage",
      "gl.view",
      "gl.manage",
      "inventory.view",
      "reports.view",
      "reports.export",
      "audit.view",
      "settings.view",
    ],
    isSystem: true,
  },
  {
    id: "4",
    name: "Operations",
    description: "Operational services access",
    permissions: [
      "dashboard.view",
      "transactions.view",
      "transactions.create",
      "momo.access",
      "agency_banking.access",
      "ezwich.access",
      "power.access",
      "jumia.access",
      "settings.view",
    ],
    isSystem: true,
  },
  {
    id: "5",
    name: "Cashier",
    description: "Basic transaction access",
    permissions: ["dashboard.view", "transactions.view", "settings.view"],
    isSystem: true,
  },
]

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  isSystem: boolean
}

interface User {
  id: string
  name: string
  email: string
  role: string
  branchName?: string
}

interface EnhancedRolePermissionSettingsProps {
  userRole: string
}

export function EnhancedRolePermissionSettings({ userRole }: EnhancedRolePermissionSettingsProps) {
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES)
  const [users, setUsers] = useState<User[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [isEditingRole, setIsEditingRole] = useState(false)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleDescription, setNewRoleDescription] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Group permissions by category
  const permissionsByCategory = ALL_PERMISSIONS.reduce(
    (acc, permission) => {
      if (!acc[permission.category]) {
        acc[permission.category] = []
      }
      acc[permission.category].push(permission)
      return acc
    },
    {} as Record<string, typeof ALL_PERMISSIONS>,
  )

  // Load users data
  useEffect(() => {
    // Mock users data - replace with actual API call
    setUsers([
      { id: "1", name: "John Admin", email: "admin@example.com", role: "Admin", branchName: "Main Branch" },
      { id: "2", name: "Jane Manager", email: "manager@example.com", role: "Manager", branchName: "Branch A" },
      { id: "3", name: "Bob Finance", email: "finance@example.com", role: "Finance", branchName: "Main Branch" },
      { id: "4", name: "Alice Operations", email: "ops@example.com", role: "Operations", branchName: "Branch B" },
      { id: "5", name: "Charlie Cashier", email: "cashier@example.com", role: "Cashier", branchName: "Branch C" },
    ])
  }, [])

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const newRole: Role = {
        id: Date.now().toString(),
        name: newRoleName,
        description: newRoleDescription,
        permissions: selectedPermissions,
        isSystem: false,
      }

      setRoles([...roles, newRole])
      setIsCreatingRole(false)
      setNewRoleName("")
      setNewRoleDescription("")
      setSelectedPermissions([])

      toast({
        title: "Success",
        description: "Role created successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create role",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!selectedRole) return

    setIsLoading(true)
    try {
      const updatedRoles = roles.map((role) =>
        role.id === selectedRole.id ? { ...role, permissions: selectedPermissions } : role,
      )

      setRoles(updatedRoles)
      setIsEditingRole(false)
      setSelectedRole(null)

      toast({
        title: "Success",
        description: "Role permissions updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update role",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRole = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (role?.isSystem) {
      toast({
        title: "Error",
        description: "Cannot delete system roles",
        variant: "destructive",
      })
      return
    }

    setRoles(roles.filter((r) => r.id !== roleId))
    toast({
      title: "Success",
      description: "Role deleted successfully",
    })
  }

  const handleUserRoleChange = (userId: string, newRole: string) => {
    const updatedUsers = users.map((user) => (user.id === userId ? { ...user, role: newRole } : user))
    setUsers(updatedUsers)

    toast({
      title: "Success",
      description: "User role updated successfully",
    })
  }

  const startEditingRole = (role: Role) => {
    if (role.isSystem) {
      toast({
        title: "Warning",
        description: "System roles cannot be modified",
        variant: "destructive",
      })
      return
    }
    setSelectedRole(role)
    setSelectedPermissions([...role.permissions])
    setIsEditingRole(true)
  }

  const startCreatingRole = () => {
    setSelectedPermissions([])
    setNewRoleName("")
    setNewRoleDescription("")
    setIsCreatingRole(true)
  }

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId) ? prev.filter((p) => p !== permissionId) : [...prev, permissionId],
    )
  }

  const selectAllInCategory = (category: string) => {
    const categoryPermissions = permissionsByCategory[category].map((p) => p.id)
    const allSelected = categoryPermissions.every((p) => selectedPermissions.includes(p))

    if (allSelected) {
      // Deselect all in category
      setSelectedPermissions((prev) => prev.filter((p) => !categoryPermissions.includes(p)))
    } else {
      // Select all in category
      setSelectedPermissions((prev) => [...new Set([...prev, ...categoryPermissions])])
    }
  }

  if (userRole.toLowerCase() !== "admin") {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>You don't have permission to manage roles and permissions.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Roles Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Create and manage user roles with specific permissions
              </p>
            </div>
            <Dialog open={isCreatingRole} onOpenChange={setIsCreatingRole}>
              <DialogTrigger asChild>
                <Button onClick={startCreatingRole} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Role
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Role</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="roleName">Role Name</Label>
                      <Input
                        id="roleName"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="Enter role name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="roleDescription">Description</Label>
                      <Input
                        id="roleDescription"
                        value={newRoleDescription}
                        onChange={(e) => setNewRoleDescription(e.target.value)}
                        placeholder="Enter role description"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Permissions</Label>
                    <div className="mt-2 space-y-4">
                      {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                        const categoryPermissions = permissions.map((p) => p.id)
                        const allSelected = categoryPermissions.every((p) => selectedPermissions.includes(p))
                        const someSelected = categoryPermissions.some((p) => selectedPermissions.includes(p))

                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm">{category}</h4>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => selectAllInCategory(category)}
                              >
                                {allSelected ? "Deselect All" : "Select All"}
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 ml-4">
                              {permissions.map((permission) => (
                                <div key={permission.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={permission.id}
                                    checked={selectedPermissions.includes(permission.id)}
                                    onCheckedChange={() => togglePermission(permission.id)}
                                  />
                                  <Label htmlFor={permission.id} className="text-sm">
                                    {permission.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreatingRole(false)} disabled={isLoading}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button onClick={handleCreateRole} disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Create Role
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{role.name}</h3>
                    {role.isSystem && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{role.permissions.length} permissions assigned</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditingRole(role)}
                    className="flex items-center gap-1"
                    disabled={role.isSystem}
                  >
                    <Edit className="h-3 w-3" />
                    {role.isSystem ? "View" : "Edit"}
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRole(role.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Role Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Role Assignment
          </CardTitle>
          <p className="text-sm text-muted-foreground">Assign and manage user roles</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-medium">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {user.branchName && <p className="text-xs text-muted-foreground">{user.branchName}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{user.role}</Badge>
                  <Select value={user.role} onValueChange={(newRole) => handleUserRoleChange(user.id, newRole)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          <div className="flex items-center gap-2">
                            {role.isSystem && <Lock className="h-3 w-3" />}
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isEditingRole} onOpenChange={setIsEditingRole}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRole?.isSystem && <Lock className="h-4 w-4" />}
              {selectedRole?.isSystem ? "View" : "Edit"} Role: {selectedRole?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedRole?.isSystem && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This is a system role and cannot be modified. You can only view its permissions.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label>Permissions</Label>
              <div className="mt-2 space-y-4">
                {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                  const categoryPermissions = permissions.map((p) => p.id)
                  const allSelected = categoryPermissions.every((p) => selectedPermissions.includes(p))

                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{category}</h4>
                        {!selectedRole?.isSystem && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllInCategory(category)}
                          >
                            {allSelected ? "Deselect All" : "Select All"}
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 ml-4">
                        {permissions.map((permission) => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-${permission.id}`}
                              checked={selectedPermissions.includes(permission.id)}
                              onCheckedChange={() => togglePermission(permission.id)}
                              disabled={selectedRole?.isSystem}
                            />
                            <Label htmlFor={`edit-${permission.id}`} className="text-sm">
                              {permission.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditingRole(false)} disabled={isLoading}>
                <X className="h-4 w-4 mr-2" />
                {selectedRole?.isSystem ? "Close" : "Cancel"}
              </Button>
              {!selectedRole?.isSystem && (
                <Button onClick={handleUpdateRole} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Role
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
