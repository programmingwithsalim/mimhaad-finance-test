"use client"

import { useState, useEffect } from "react"
import { Users, UserPlus, RefreshCw, Search, Filter, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { UserForm } from "@/components/user-management/user-form"
import { UserList } from "@/components/user-management/user-list"
import { UserStatistics } from "@/components/user-management/user-statistics"
import { addUser, removeUser, syncUserBranchData, updateUserAction } from "@/lib/user-actions"
import type { User } from "@/lib/user-service"
import type { Branch } from "@/lib/branch-service"

interface ModernUserManagementProps {
  initialUsers: User[]
  branches: Branch[]
}

export function ModernUserManagement({ initialUsers, branches }: ModernUserManagementProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("all-users")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statsRefreshCounter, setStatsRefreshCounter] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch users when the component mounts
  useEffect(() => {
    fetchUsers()
  }, [])

  // Refresh statistics
  const refreshStatistics = () => {
    setStatsRefreshCounter((prev) => prev + 1)
  }

  // Fetch users from the API
  const fetchUsers = async () => {
    try {
      setError(null)
      const response = await fetch("/api/users")
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error("Error fetching users:", error)
      setError((error as Error).message || "Failed to fetch users")
      toast({
        title: "Error",
        description: "Failed to fetch users. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Filter users based on search query
  const filteredUsers = users.filter(
    (user) =>
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Handle user creation
  const handleCreateUser = async (userData: any) => {
    setIsLoading(true)
    try {
      setError(null)
      const result = await addUser({
        ...userData,
        status: userData.isActive ? "active" : "inactive",
      })

      if (result.success) {
        toast({
          title: "User Created",
          description: `${userData.firstName} ${userData.lastName} has been added successfully.`,
        })
        setIsAddUserOpen(false)
        await fetchUsers()
        refreshStatistics()
      } else {
        setError(result.error || "Failed to create user")
        toast({
          title: "Error",
          description: result.error || "Failed to create user",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating user:", error)
      setError((error as Error).message || "An unexpected error occurred")
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle user update
  const handleUpdateUser = async (userData: any) => {
    if (!selectedUser) return

    setIsLoading(true)
    try {
      setError(null)
      const result = await updateUserAction(selectedUser.id, {
        ...userData,
        status: userData.isActive ? "active" : "inactive",
      })

      if (result.success) {
        toast({
          title: "User Updated",
          description: `${userData.firstName} ${userData.lastName} has been updated successfully.`,
        })
        setIsAddUserOpen(false)
        setSelectedUser(null)
        await fetchUsers()
        refreshStatistics()
      } else {
        setError(result.error || "Failed to update user")
        toast({
          title: "Error",
          description: result.error || "Failed to update user",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating user:", error)
      setError((error as Error).message || "An unexpected error occurred")
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle user deletion
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    try {
      setError(null)
      const result = await removeUser(selectedUser.id)

      if (result.success) {
        toast({
          title: "User Deleted",
          description: `${selectedUser.firstName} ${selectedUser.lastName} has been removed from the system.`,
        })
        setIsDeleteDialogOpen(false)
        setSelectedUser(null)
        await fetchUsers()
        refreshStatistics()
      } else {
        setError(result.error || "Failed to delete user")
        toast({
          title: "Error",
          description: result.error || "Failed to delete user",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting user:", error)
      setError((error as Error).message || "An unexpected error occurred")
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle password reset
  const handleResetPassword = async () => {
    if (!selectedUser) return

    setIsLoading(true)
    try {
      setError(null)
      // Simulate password reset
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Password Reset",
        description: `Password reset link has been sent to ${selectedUser.email}.`,
      })
      setIsResetPasswordDialogOpen(false)
      setSelectedUser(null)
    } catch (error) {
      console.error("Error resetting password:", error)
      setError((error as Error).message || "Failed to reset password")
      toast({
        title: "Error",
        description: "Failed to reset password",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle data synchronization
  const handleSyncData = async () => {
    setIsSyncing(true)
    try {
      setError(null)
      const result = await syncUserBranchData()

      if (result.success) {
        toast({
          title: "Data Synchronized",
          description: "User and branch data has been synchronized successfully.",
        })
        await fetchUsers()
        refreshStatistics()
      } else {
        setError(result.error || "Failed to synchronize data")
        toast({
          title: "Error",
          description: result.error || "Failed to synchronize data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error synchronizing data:", error)
      setError((error as Error).message || "An unexpected error occurred")
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Users className="h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          </div>
          <p className="text-muted-foreground">Manage users, assign roles and branches, and control system access</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSyncData} variant="outline" disabled={isSyncing} className="w-full sm:w-auto">
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Data
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              setSelectedUser(null)
              setIsAddUserOpen(true)
            }}
            className="w-full sm:w-auto"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* User Statistics */}
      <UserStatistics refreshTrigger={statsRefreshCounter} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="mb-2 sm:mb-0">
            <TabsTrigger
              value="all-users"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              All Users
            </TabsTrigger>
            <TabsTrigger
              value="active-users"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Active
            </TabsTrigger>
            <TabsTrigger
              value="inactive-users"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Inactive
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center w-full sm:w-auto gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" title="Filter options">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <TabsContent value="all-users" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage all users in the system</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <UserList
                users={filteredUsers}
                branches={branches}
                onEditUser={(user) => {
                  setSelectedUser(user)
                  setIsAddUserOpen(true)
                }}
                onDeleteUser={(user) => {
                  setSelectedUser(user)
                  setIsDeleteDialogOpen(true)
                }}
                onResetPassword={(user) => {
                  setSelectedUser(user)
                  setIsResetPasswordDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active-users" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Active Users</CardTitle>
              <CardDescription>Manage active users in the system</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <UserList
                users={filteredUsers.filter((user) => user.status === "active")}
                branches={branches}
                onEditUser={(user) => {
                  setSelectedUser(user)
                  setIsAddUserOpen(true)
                }}
                onDeleteUser={(user) => {
                  setSelectedUser(user)
                  setIsDeleteDialogOpen(true)
                }}
                onResetPassword={(user) => {
                  setSelectedUser(user)
                  setIsResetPasswordDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive-users" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Inactive Users</CardTitle>
              <CardDescription>Manage inactive users in the system</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <UserList
                users={filteredUsers.filter((user) => user.status === "inactive")}
                branches={branches}
                onEditUser={(user) => {
                  setSelectedUser(user)
                  setIsAddUserOpen(true)
                }}
                onDeleteUser={(user) => {
                  setSelectedUser(user)
                  setIsDeleteDialogOpen(true)
                }}
                onResetPassword={(user) => {
                  setSelectedUser(user)
                  setIsResetPasswordDialogOpen(true)
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Form Dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `Update information for ${selectedUser.firstName} ${selectedUser.lastName}`
                : "Create a new user account and assign roles and branches"}
            </DialogDescription>
          </DialogHeader>
          <UserForm
            user={selectedUser}
            branches={branches}
            onSubmit={selectedUser ? handleUpdateUser : handleCreateUser}
            onCancel={() => {
              setIsAddUserOpen(false)
              setSelectedUser(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser &&
                `Are you sure you want to delete ${selectedUser.firstName} ${selectedUser.lastName}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setSelectedUser(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
              {isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={isResetPasswordDialogOpen} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser &&
                `Are you sure you want to reset the password for ${selectedUser.firstName} ${selectedUser.lastName}? A password reset link will be sent to their email.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsResetPasswordDialogOpen(false)
                setSelectedUser(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
