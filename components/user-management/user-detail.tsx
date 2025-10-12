"use client"

import { useState } from "react"
import {
  ArrowLeft,
  Edit,
  Trash2,
  KeyRound,
  Building2,
  Shield,
  Calendar,
  Clock,
  Mail,
  Phone,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
  LockKeyhole,
  FileText,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserActivityLogs } from "@/components/user-management/user-activity-logs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { generateSecurePassword } from "@/lib/password-utils"
import { AuditLogger } from "@/lib/audit-logger"
import { EmailService } from "@/lib/email-service"
import type { UserType } from "@/components/user-management/mock-data"
import type { Branch } from "@/lib/branch-data"

interface UserDetailProps {
  user: UserType
  branches: Branch[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onResetPassword: (success: boolean) => void
  onAssignBranch: (branchIds: string[]) => void
}

export function UserDetail({
  user,
  branches,
  onBack,
  onEdit,
  onDelete,
  onResetPassword,
  onAssignBranch,
}: UserDetailProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [isAssignBranchOpen, setIsAssignBranchOpen] = useState(false)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(user.branches || [user.branch])

  // Password reset state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isTemporaryPassword, setIsTemporaryPassword] = useState(true)
  const [shouldNotifyUser, setShouldNotifyUser] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Get branch name by ID
  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId)
    return branch ? branch.name : branchId
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Active
          </Badge>
        )
      case "inactive":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 hover:bg-gray-50">
            <XCircle className="mr-1 h-3 w-3" />
            Inactive
          </Badge>
        )
      case "locked":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
            <AlertCircle className="mr-1 h-3 w-3" />
            Locked
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Cashier":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Cashier
          </Badge>
        )
      case "Operations":
        return (
          <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-100">
            Operations
          </Badge>
        )
      case "Manager":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            Manager
          </Badge>
        )
      case "Finance":
        return (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Finance
          </Badge>
        )
      case "Admin":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">
            Admin
          </Badge>
        )
      default:
        return <Badge variant="secondary">{role}</Badge>
    }
  }

  // Generate a secure password
  const handleGeneratePassword = () => {
    const generatedPassword = generateSecurePassword(12, true, true, true, true)
    setNewPassword(generatedPassword)
    setConfirmPassword(generatedPassword)
  }

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  // Confirm password reset
  const confirmResetPassword = async () => {
    // Validate passwords
    if (!newPassword) {
      setPasswordError("New password is required")
      return
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setIsProcessing(true)

    try {
      // In a real application, you would call an API to reset the password
      // For this demo, we'll simulate the process

      // Log the password reset action
      AuditLogger.log("password_reset", user.id, "current_admin", {
        isTemporary: isTemporaryPassword,
        notificationSent: shouldNotifyUser,
      })

      // Send email notification if selected
      if (shouldNotifyUser) {
        await EmailService.sendPasswordResetNotification(
          user.email,
          `${user.firstName} ${user.lastName}`,
          isTemporaryPassword,
          isTemporaryPassword ? newPassword : undefined, // Only send password in email if it's temporary
        )
      }

      // Close the dialog
      setIsResetPasswordOpen(false)
      setNewPassword("")
      setConfirmPassword("")
      setPasswordError(null)

      // Notify parent component
      onResetPassword(true)
    } catch (error) {
      console.error("Error resetting password:", error)
      setPasswordError("An error occurred while resetting the password. Please try again.")
      onResetPassword(false)
    } finally {
      setIsProcessing(false)
    }
  }

  // Confirm branch assignment
  const confirmAssignBranch = () => {
    if (selectedBranchIds.length > 0) {
      onAssignBranch(selectedBranchIds)
      setIsAssignBranchOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAssignBranchOpen(true)}>
            <Building2 className="mr-2 h-4 w-4" />
            Assign Branches
          </Button>
          <Button variant="outline" onClick={() => setIsResetPasswordOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Reset Password
          </Button>
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(true)} className="text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={user.avatar || "/placeholder.svg"} alt={`${user.firstName} ${user.lastName}`} />
              <AvatarFallback className="text-2xl">{user.firstName[0] + user.lastName[0]}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold">
              {user.firstName} {user.lastName}
            </h3>
            <div className="flex items-center justify-center mt-1 mb-4">
              {getRoleBadge(user.role)}
              <span className="mx-2">•</span>
              {getStatusBadge(user.status)}
            </div>
            <div className="w-full space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="ml-auto">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-auto">{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">User ID:</span>
                <span className="ml-auto font-mono text-xs">{user.id}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-auto">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Login:</span>
                <span className="ml-auto">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                </span>
              </div>
              {user.lastPasswordReset && (
                <div className="flex items-center gap-2 text-sm">
                  <LockKeyhole className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Password Reset:</span>
                  <span className="ml-auto">{new Date(user.lastPasswordReset).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>User Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="branches">Branches</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium flex items-center mb-4">
                    <Shield className="h-5 w-5 mr-2" />
                    Role & Permissions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Role</span>
                        <div>{getRoleBadge(user.role)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status</span>
                        <div>{getStatusBadge(user.status)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Account Type</span>
                        <div>
                          <Badge variant="outline">{user.role === "Admin" ? "Administrator" : "Standard User"}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Password Reset Required</span>
                        <div>
                          {user.passwordResetRequired ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              No
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Two-Factor Auth</span>
                        <div>
                          <Badge variant="outline" className="bg-gray-50 text-gray-700">
                            Not Enabled
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium flex items-center mb-4">
                    <Building2 className="h-5 w-5 mr-2" />
                    Branch Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Primary Branch</span>
                        <div>
                          <Badge className="bg-primary/90">{getBranchName(user.branch)}</Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Branches</span>
                        <div>
                          <Badge variant="outline">{user.branches ? user.branches.length : 1}</Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-2">Assigned Branches</span>
                      <div className="flex flex-wrap gap-2">
                        {(user.branches || [user.branch]).map((branchId) => (
                          <Badge
                            key={branchId}
                            variant={branchId === user.branch ? "default" : "outline"}
                            className={branchId === user.branch ? "" : "bg-gray-50"}
                          >
                            {branchId === user.branch && <Building2 className="mr-1 h-3 w-3" />}
                            {getBranchName(branchId)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-medium flex items-center mb-4">
                    <FileText className="h-5 w-5 mr-2" />
                    Additional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Created By</span>
                        <div>
                          <Badge variant="outline">System Admin</Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Last Updated</span>
                        <div>
                          <span className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="branches">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium flex items-center">
                      <Building2 className="h-5 w-5 mr-2" />
                      Branch Assignments
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => setIsAssignBranchOpen(true)}>
                      Manage Branches
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Primary Branch</h4>
                      <div className="p-4 border rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-medium">{getBranchName(user.branch)}</div>
                              <div className="text-sm text-muted-foreground">Primary location</div>
                            </div>
                          </div>
                          <Badge>Primary</Badge>
                        </div>
                      </div>
                    </div>

                    {user.branches && user.branches.length > 1 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Additional Branches</h4>
                        <div className="space-y-2">
                          {user.branches
                            .filter((branchId) => branchId !== user.branch)
                            .map((branchId) => (
                              <div key={branchId} className="p-3 border rounded-md">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <div className="font-medium">{getBranchName(branchId)}</div>
                                  </div>
                                  <Badge variant="outline">Secondary</Badge>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Activity Log
                    </h3>
                  </div>

                  <UserActivityLogs userId={user.id} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {user.firstName} {user.lastName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {user.firstName} {user.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {passwordError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="new-password">New Password</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleGeneratePassword} className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Generate Password
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 text-gray-400 hover:text-gray-600"
                  onClick={togglePasswordVisibility}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && <PasswordStrengthIndicator password={newPassword} className="mt-2" />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="temporary-password"
                  checked={isTemporaryPassword}
                  onCheckedChange={(checked) => setIsTemporaryPassword(checked === true)}
                />
                <Label
                  htmlFor="temporary-password"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Set as temporary password (user must change on next login)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notify-user"
                  checked={shouldNotifyUser}
                  onCheckedChange={(checked) => setShouldNotifyUser(checked === true)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="notify-user"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Send email notification to user
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isTemporaryPassword
                      ? "The temporary password will be included in the email."
                      : "The user will be notified that their password has been reset."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {isTemporaryPassword
                ? "User will be prompted to change this password on next login."
                : "Strong passwords include a mix of letters, numbers, and symbols."}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={confirmResetPassword} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : shouldNotifyUser ? (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Reset & Notify
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Assignment Dialog */}
      <Dialog open={isAssignBranchOpen} onOpenChange={setIsAssignBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Branches</DialogTitle>
            <DialogDescription>
              Select branches for {user.firstName} {user.lastName}. The first branch will be set as primary.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4">
              <Label className="text-sm font-medium">Available Branches</Label>
              <ScrollArea className="h-60 mt-2 border rounded-md p-4">
                <div className="space-y-4">
                  {branches.map((branch) => {
                    const isSelected = selectedBranchIds.includes(branch.id)
                    const isPrimary = isSelected && selectedBranchIds[0] === branch.id

                    return (
                      <div key={branch.id} className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`assign-branch-${branch.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedBranchIds((prev) => [...prev, branch.id])
                              } else {
                                setSelectedBranchIds((prev) => prev.filter((id) => id !== branch.id))
                              }
                            }}
                          />
                          <label
                            htmlFor={`assign-branch-${branch.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {branch.name}
                            {isPrimary && (
                              <Badge variant="outline" className="ml-2 bg-primary/10">
                                Primary
                              </Badge>
                            )}
                          </label>
                        </div>
                        {isSelected && !isPrimary && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Move this branch to the front of the array to make it primary
                              setSelectedBranchIds([branch.id, ...selectedBranchIds.filter((id) => id !== branch.id)])
                            }}
                          >
                            Set as Primary
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            {selectedBranchIds.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Selected Branches</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedBranchIds.map((branchId, index) => {
                    const branch = branches.find((b) => b.id === branchId)
                    return (
                      <Badge
                        key={branchId}
                        variant={index === 0 ? "default" : "outline"}
                        className="flex items-center gap-1"
                      >
                        {index === 0 && <Building2 className="h-3 w-3" />}
                        {branch ? branch.name : branchId}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-1 p-0"
                          onClick={() => {
                            setSelectedBranchIds((prev) => prev.filter((id) => id !== branchId))
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignBranchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAssignBranch} disabled={selectedBranchIds.length === 0}>
              Save Branch Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
