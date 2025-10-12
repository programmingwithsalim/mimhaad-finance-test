"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SystemConfigSettings } from "@/components/settings/system-config-settings";
import { GeneralConfiguration } from "@/components/settings/general-configuration";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  SettingsIcon,
  Shield,
  Users,
  Database,
  DollarSign,
} from "lucide-react";
import { RolePermissionSettings } from "@/components/settings/role-permission-settings";
import { normalizeRole } from "@/lib/rbac/unified-rbac";
import { useRouter } from "next/navigation";

const SettingsPage = () => {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("users");

  const normalizedRole = user?.role ? normalizeRole(user.role) : null;
  const isAdmin = normalizedRole === "Admin";
  const canAccessFinancial = ["Admin", "Manager", "Finance"].includes(
    user?.role || ""
  );

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              System configuration and management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {user?.role}
            </Badge>
          </div>
        </div>

        <Separator />

        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Access Restricted</h3>
              <p className="text-muted-foreground mb-2">
                You don't have permission to access system settings.
              </p>
              <p className="text-sm text-muted-foreground">
                Contact your administrator for assistance. Current role:{" "}
                {user?.role}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const settingsSections = [
    {
      id: "users",
      label: "Users & Roles",
      icon: Users,
      description: "User management and permissions",
      show: true,
    },
    {
      id: "financial",
      label: "Financial Settings",
      icon: DollarSign,
      description: "Equity, retained earnings, and long-term liabilities",
      show: canAccessFinancial,
    },
    {
      id: "system",
      label: "System",
      icon: SettingsIcon,
      description: "System configuration, limits, fees and communication",
      show: true,
    },
    {
      id: "general",
      label: "General Configuration",
      icon: Database,
      description: "System-wide settings and administrative functions",
      show: true,
    },
  ].filter((section) => section.show);

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            System configuration and management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {user?.role}
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Settings Navigation and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription className="text-sm">
                Choose a category to configure
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {settingsSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveTab(section.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        activeTab === section.id
                          ? "bg-muted border-r-2 border-primary"
                          : ""
                      }`}
                    >
                      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {section.label}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {section.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-4">
          <div className="space-y-6">
            {/* Users & Roles */}
            {activeTab === "users" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Users & Roles
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Manage user accounts, roles, and permissions
                  </p>
                </div>
                <RolePermissionSettings userRole={user?.role} />
              </div>
            )}

            {/* System Settings */}
            {activeTab === "system" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    System Configuration
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Configure system-wide settings, limits, fees, and
                    communication parameters
                  </p>
                </div>
                <SystemConfigSettings userRole={user?.role} />
              </div>
            )}

            {/* Financial Settings */}
            {activeTab === "financial" && canAccessFinancial && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Financial Settings
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Manage shareholders equity, retained earnings, and long-term
                    liabilities
                  </p>
                  <Button
                    variant="link"
                    onClick={() => router.push("/dashboard/settings/financial")}
                    className="p-0 h-auto"
                  >
                    Go to Financial Settings →
                  </Button>
                </div>
              </div>
            )}

            {/* General Configuration */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    General Configuration
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    System-wide settings and administrative functions
                  </p>
                </div>
                <GeneralConfiguration userRole={user?.role} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
