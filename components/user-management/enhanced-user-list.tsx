"use client"

import { useState } from "react"
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  KeyRound,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Calendar,
  Shield,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UserType } from "@/components/user-management/mock-data"
import type { Branch } from "@/lib/branch-data"

// Import the WithRoleCheck component
import { WithRoleCheck } from "@/components/rbac/with-role-check"

interface UserListProps {
  users: UserType[]
  branches: Branch[]
  onViewUser: (user: UserType) => void
  onEditUser: (user: UserType) => void
  onDeleteUser: (userId: string) => void
  onResetPassword: (userId: string, success: boolean) => void
  onAssignBranch: (userId: string, branchIds: string[]) => void
}

export function UserList({
  users,
  branches,
  onViewUser,
  onEditUser,
  onDeleteUser,
  onResetPassword,
  onAssignBranch,
}: UserListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [branchFilter, setBranchFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null)
  const [userToAssignBranch, setUserToAssignBranch] = useState<UserType | null>(null)
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([])
  const [expandedUsers, setExpandedUsers] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Filter users based on search query and filters
  const filteredUsers = users.filter((user) => {
    // Search functionality
    const searchLower = searchQuery.toLowerCase()
    const userMatchesSearch =
      user.firstName.toLowerCase().includes(searchLower) ||
      user.lastName.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.id.toLowerCase().includes(searchLower)

    // Filter by role
    const roleMatches = roleFilter ? user.role === roleFilter : true

    // Filter by branch - check if user has the branch in their branches array
    const branchMatches = branchFilter
      ? user.branches
        ? user.branches.includes(branchFilter)
        : user.branch === branchFilter
      : true

    // Filter by status
    const statusMatches = statusFilter ? user.status === statusFilter : true

    return userMatchesSearch && roleMatches && branchMatches && statusMatches
  })

  // Get unique values for filters
  const uniqueRoles = [...new Set(users.map((user) => user.role))]

  // Get unique branches from all users' branch assignments
  const uniqueBranchIds = new Set<string>()
  users.forEach((user) => {
    if (user.branches) {
      user.branches.forEach((branchId) => uniqueBranchIds.add(branchId))
    } else {
      uniqueBranchIds.add(user.branch)
    }
  })

  const uniqueStatuses = [...new Set(users.map((user) => user.status))]

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  // Reset filters
  const resetFilters = () => {
    setRoleFilter(null)
    setBranchFilter(null)
    setStatusFilter(null)
    setSearchQuery("")
  }

  // Handle user deletion confirmation
  const handleDeleteClick = (user: UserType) => {
    setUserToDelete(user)
  }

  const confirmDelete = () => {
    if (userToDelete) {
      onDeleteUser(userToDelete.id)
      setUserToDelete(null)
    }
  }

  // Handle branch assignment
  const handleAssignBranchClick = (user: UserType) => {
    setUserToAssignBranch(user)
    setSelectedBranchIds(user.branches || [user.branch])
  }

  const confirmAssignBranch = () => {
    if (userToAssignBranch && selectedBranchIds.length > 0) {
      onAssignBranch(userToAssignBranch.id, selectedBranchIds)
      setUserToAssignBranch(null)
    }
  }

  // Toggle user expanded state
  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
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

  // Get branch name by ID
  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId)
    return branch ? branch.name : branchId
  }

  // Get branch badges for a user
  const getBranchBadges = (user: UserType) => {
    const branchIds = user.branches || [user.branch]
    const primaryBranchId = user.branch

    return (
      <div className="flex flex-wrap gap-1">
        {branchIds.map((branchId) => {
          const isPrimary = branchId === primaryBranchId
          return (
            <Badge key={branchId} variant={isPrimary ? "default" : "outline"} className={isPrimary ? "" : "bg-gray-50"}>
              {isPrimary && <Building2 className="mr-1 h-3 w-3" />}
              {getBranchName(branchId)}
            </Badge>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Card className="mb-6 w-full">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={roleFilter || ""}
                onValueChange={(value) => {
                  setRoleFilter(value || null)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Roles</SelectLabel>
                    <SelectItem value="all">All Roles</SelectItem>
                    {uniqueRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={branchFilter || ""}
                onValueChange={(value) => {
                  setBranchFilter(value || null)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Branches</SelectLabel>
                    <SelectItem value="all">All Branches</SelectItem>
                    {Array.from(uniqueBranchIds).map((branchId) => (
                      <SelectItem key={branchId} value={branchId}>
                        {getBranchName(branchId)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter || ""}
                onValueChange={(value) => {
                  setStatusFilter(value || null)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={resetFilters} title="Reset filters">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border w-full overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[25%]">User</TableHead>
              <TableHead className="w-[15%]">Role</TableHead>
              <TableHead className="hidden md:table-cell w-[20%]">Branch</TableHead>
              <TableHead className="hidden lg:table-cell w-[15%]">Created</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="text-right w-[15%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((user) => {
                const isExpanded = expandedUsers.includes(user.id)
                return (
                  <>
                    <TableRow key={user.id} className={isExpanded ? "border-b-0" : ""}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleUserExpanded(user.id)}
                          className="h-8 w-8"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage
                              src={user.avatar || "/placeholder.svg"}
                              alt={`${user.firstName} ${user.lastName}`}
                            />
                            <AvatarFallback>{user.firstName[0] + user.lastName[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span>{getBranchName(user.branch)}</span>
                                {user.branches && user.branches.length > 1 && (
                                  <Badge variant="outline" className="ml-1 text-xs">
                                    +{user.branches.length - 1}
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {user.branches && user.branches.length > 1 ? (
                                <div className="space-y-1">
                                  <p className="font-medium">Assigned Branches:</p>
                                  <ul className="text-sm">
                                    {user.branches.map((branchId) => (
                                      <li key={branchId} className="flex items-center gap-1">
                                        {branchId === user.branch && (
                                          <Badge variant="outline" className="text-xs">
                                            Primary
                                          </Badge>
                                        )}
                                        {getBranchName(branchId)}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p>Primary Branch: {getBranchName(user.branch)}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewUser(user)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditUser(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAssignBranchClick(user)}>
                              <Building2 className="mr-2 h-4 w-4" />
                              Assign Branches
                            </DropdownMenuItem>
                            <WithRoleCheck allowedRoles={["Admin", "Manager"]}>
                              <DropdownMenuItem onClick={() => onResetPassword(user.id, true)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Reset Password
                              </DropdownMenuItem>
                            </WithRoleCheck>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteClick(user)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/50">
                        <TableCell colSpan={7} className="p-0">
                          <div className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-sm font-medium flex items-center mb-2">
                                  <Shield className="h-4 w-4 mr-1" />
                                  Role & Permissions
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Role:</span>
                                    <span>{getRoleBadge(user.role)}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Status:</span>
                                    <span>{getStatusBadge(user.status)}</span>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium flex items-center mb-2">
                                  <Building2 className="h-4 w-4 mr-1" />
                                  Branch Assignments
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Primary:</span>
                                    <span className="font-medium">{getBranchName(user.branch)}</span>
                                  </div>
                                  <div>
                                    <span className="text-sm text-muted-foreground block mb-1">All Branches:</span>
                                    {getBranchBadges(user)}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium flex items-center mb-2">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  Account Information
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Created:</span>
                                    <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Last Login:</span>
                                    <span>
                                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                                    </span>
                                  </div>
                                  {user.lastPasswordReset && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground">Password Reset:</span>
                                      <span>{new Date(user.lastPasswordReset).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end mt-4 space-x-2">
                              <Button size="sm" variant="outline" onClick={() => onViewUser(user)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Full Details
                              </Button>
                              <Button size="sm" onClick={() => onEditUser(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No users found. Try adjusting your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filteredUsers.length)} to{" "}
            {Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {userToDelete?.firstName} {userToDelete?.lastName}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Assignment Dialog */}
      <Dialog open={!!userToAssignBranch} onOpenChange={(open) => !open && setUserToAssignBranch(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Branches</DialogTitle>
            <DialogDescription>
              Select branches for {userToAssignBranch?.firstName} {userToAssignBranch?.lastName}. The first branch will
              be set as primary.
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
            <Button variant="outline" onClick={() => setUserToAssignBranch(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAssignBranch} disabled={selectedBranchIds.length === 0}>
              Save Branch Assignments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
