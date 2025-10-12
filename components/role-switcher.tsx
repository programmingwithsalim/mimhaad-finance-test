"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { User, Settings, RefreshCw } from "lucide-react";

const ROLES = [
  { value: "admin", label: "Admin", description: "Full system access" },
  { value: "finance", label: "Finance", description: "Financial operations" },
  { value: "manager", label: "Manager", description: "Branch management" },
  { value: "operations", label: "Operations", description: "Daily operations" },
  { value: "cashier", label: "Cashier", description: "Transaction processing" },
];

const BRANCHES = [
  { id: "branch-001", name: "Main Branch", location: "Accra Central" },
  { id: "branch-002", name: "East Branch", location: "East Legon" },
  { id: "branch-003", name: "West Branch", location: "West Hills" },
  { id: "branch-004", name: "North Branch", location: "North Ridge" },
  { id: "branch-005", name: "South Branch", location: "South Labadi" },
];

export function RoleSwitcher() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const switchRole = async (newRole: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Create a new user object with the updated role
      const updatedUser = {
        ...user,
        role: newRole,
        // For non-admin roles, assign a specific branch
        branchId: newRole === "admin" ? undefined : BRANCHES[0].id,
        branchName: newRole === "admin" ? undefined : BRANCHES[0].name,
      };

      // Update the user in the auth context
      updateUser(updatedUser);

      toast({
        title: "Role Switched",
        description: `Now testing as ${
          newRole.charAt(0).toUpperCase() + newRole.slice(1)
        }`,
      });

      // Force a page refresh to update all components
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error switching role:", error);
      toast({
        title: "Error",
        description: "Failed to switch role",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchBranch = async (branchId: string, branchName: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const updatedUser = {
        ...user,
        branchId,
        branchName,
      };

      updateUser(updatedUser);

      toast({
        title: "Branch Switched",
        description: `Now viewing ${branchName}`,
      });

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Error switching branch:", error);
      toast({
        title: "Error",
        description: "Failed to switch branch",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentRoleInfo = () => {
    const role = ROLES.find((r) => r.value === user?.role);
    return role || ROLES[0];
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Current Role Display */}
      <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
        <User className="h-4 w-4" />
        <span className="text-sm font-medium">
          {getCurrentRoleInfo().label}
        </span>
        <Badge variant="outline" className="text-xs">
          {user.branchName || "All Branches"}
        </Badge>
      </div>

      {/* Role Switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            <Settings className="h-4 w-4 mr-2" />
            Switch Role
            {isLoading && <RefreshCw className="h-4 w-4 ml-2 animate-spin" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Switch User Role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLES.map((role) => (
            <DropdownMenuItem
              key={role.value}
              onClick={() => switchRole(role.value)}
              className="flex flex-col items-start p-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{role.label}</span>
                {user.role === role.value && (
                  <Badge variant="default" className="text-xs">
                    Current
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {role.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Branch Switcher (for non-admin roles) */}
      {user.role !== "admin" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isLoading}>
              <Settings className="h-4 w-4 mr-2" />
              Switch Branch
              {isLoading && <RefreshCw className="h-4 w-4 ml-2 animate-spin" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {BRANCHES.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => switchBranch(branch.id, branch.name)}
                className="flex flex-col items-start p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{branch.name}</span>
                  {user.branchId === branch.id && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {branch.location}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Development Info */}
      <div className="text-xs text-muted-foreground px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
        🧪 Dev Mode
      </div>
    </div>
  );
}
