"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, ChevronDown, RefreshCw, Users, Building } from "lucide-react"
import { useCurrentUser } from "@/hooks/use-current-user"

interface RoleBranchSwitcherProps {
  onRoleChange: (role: string) => void
  onBranchChange: (branchId: string, branchName: string) => void
  onRefresh?: () => void
}

export function RoleBranchSwitcher({ onRoleChange, onBranchChange, onRefresh }: RoleBranchSwitcherProps) {
  const { user } = useCurrentUser()
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)

  const roles = [
    { id: "admin", name: "Admin" },
    { id: "manager", name: "Manager" },
    { id: "finance", name: "Finance" },
    { id: "cashier", name: "Cashier" },
    { id: "supervisor", name: "Supervisor" },
  ]

  useEffect(() => {
    // Fetch branches
    const fetchBranches = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/branches")
        if (response.ok) {
          const data = await response.json()
          console.log("Branches API response:", data)
          if (data.success && Array.isArray(data.branches)) {
            setBranches(data.branches.map((branch: any) => ({ id: branch.id, name: branch.name })))
          } else if (Array.isArray(data)) {
            setBranches(data.map((branch: any) => ({ id: branch.id, name: branch.name })))
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error)
        // Fallback branches if API fails
        setBranches([
          { id: "branch-1", name: "Main Branch" },
          { id: "branch-2", name: "Downtown Branch" },
          { id: "branch-3", name: "East Side Branch" },
          { id: "branch-4", name: "West Side Branch" },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchBranches()
  }, [])

  const handleRoleSelect = (roleId: string) => {
    console.log("Role selected:", roleId)
    setSelectedRole(roleId)
    onRoleChange(roleId)
    setRoleDropdownOpen(false)
  }

  const handleBranchSelect = (branch: { id: string; name: string }) => {
    console.log("Branch selected:", branch)
    setSelectedBranch(branch)
    onBranchChange(branch.id, branch.name)
    setBranchDropdownOpen(false)
  }

  const handleRefresh = () => {
    console.log("Refresh clicked")
    if (onRefresh) {
      onRefresh()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={roleDropdownOpen} onOpenChange={setRoleDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={() => {
              console.log("Role dropdown clicked")
              setRoleDropdownOpen(!roleDropdownOpen)
            }}
          >
            <Users className="h-4 w-4 mr-1" />
            {selectedRole ? roles.find((r) => r.id === selectedRole)?.name : user?.role || "Role"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" sideOffset={5}>
          <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {roles.map((role) => (
            <DropdownMenuItem
              key={role.id}
              onClick={() => handleRoleSelect(role.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              {role.name}
              {selectedRole === role.id && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setSelectedRole(null)
              setRoleDropdownOpen(false)
            }}
            className="text-muted-foreground cursor-pointer"
          >
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu open={branchDropdownOpen} onOpenChange={setBranchDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={() => {
              console.log("Branch dropdown clicked")
              setBranchDropdownOpen(!branchDropdownOpen)
            }}
          >
            <Building className="h-4 w-4 mr-1" />
            {selectedBranch ? selectedBranch.name : user?.branchName || "Branch"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" sideOffset={5}>
          <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loading ? (
            <DropdownMenuItem disabled>Loading branches...</DropdownMenuItem>
          ) : (
            branches.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => handleBranchSelect(branch)}
                className="flex items-center justify-between cursor-pointer"
              >
                {branch.name}
                {selectedBranch?.id === branch.id && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setSelectedBranch(null)
              setBranchDropdownOpen(false)
            }}
            className="text-muted-foreground cursor-pointer"
          >
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh dashboard">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  )
}
