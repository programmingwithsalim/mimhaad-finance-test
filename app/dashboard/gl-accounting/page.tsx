"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GLAccountManagement } from "@/components/gl-accounting/gl-account-management";
import { UnifiedGLMapping } from "@/components/gl-accounting/unified-gl-mapping";
import { GLAccountingDashboard } from "@/components/gl-accounting/gl-accounting-dashboard";
import { BranchProvider } from "@/contexts/branch-context";

export default function GLAccountingPage() {
  return (
    <BranchProvider>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            General Ledger Accounting
          </h1>
          <p className="text-muted-foreground">
            Manage GL accounts, view financial reports, and configure account
            mappings
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="accounts">GL Accounts</TabsTrigger>
            <TabsTrigger value="mappings">Mappings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <GLAccountingDashboard />
          </TabsContent>

          <TabsContent value="accounts" className="space-y-6">
            <GLAccountManagement />
          </TabsContent>

          <TabsContent value="mappings" className="space-y-6">
            <UnifiedGLMapping />
          </TabsContent>
        </Tabs>
      </div>
    </BranchProvider>
  );
}
