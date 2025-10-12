"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SystemConfigSettings } from "./system-config-settings"
import { RolePermissionSettings } from "./role-permission-settings"
import { FeeConfigSettings } from "./fee-config-settings"
import { useAuth } from "@/lib/auth-context"

export function OrganizationSettings() {
  const { user } = useAuth()
  const userRole = user?.role || "user"

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
          <CardDescription>Manage system configuration, user roles, and fee structures</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="system" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="system">System Config</TabsTrigger>
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
              <TabsTrigger value="fees">Fee Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="system" className="space-y-4">
              <SystemConfigSettings userRole={userRole} />
            </TabsContent>

            <TabsContent value="roles" className="space-y-4">
              <RolePermissionSettings userRole={userRole} />
            </TabsContent>

            <TabsContent value="fees" className="space-y-4">
              <FeeConfigSettings userRole={userRole} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
