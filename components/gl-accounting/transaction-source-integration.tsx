"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

// Integration status for each module
type IntegrationStatus = "integrated" | "partial" | "pending" | "not-started"

interface ModuleIntegration {
  id: string
  name: string
  status: IntegrationStatus
  description: string
  transactionCount: number
  journalEntryCount: number
  lastSync?: string
}

// Mock data for demonstration
const moduleIntegrations: ModuleIntegration[] = [
  {
    id: "momo",
    name: "Mobile Money",
    status: "integrated",
    description: "MoMo transactions are fully integrated with GL accounting",
    transactionCount: 1245,
    journalEntryCount: 1245,
    lastSync: "2023-05-21T14:30:00Z",
  },
  {
    id: "agency-banking",
    name: "Agency Banking",
    status: "partial",
    description: "Some Agency Banking transactions are not mapped to GL accounts",
    transactionCount: 876,
    journalEntryCount: 742,
    lastSync: "2023-05-21T12:15:00Z",
  },
  {
    id: "e-zwich",
    name: "E-Zwich",
    status: "integrated",
    description: "E-Zwich transactions are fully integrated with GL accounting",
    transactionCount: 532,
    journalEntryCount: 532,
    lastSync: "2023-05-21T13:45:00Z",
  },
  {
    id: "jumia",
    name: "Jumia",
    status: "pending",
    description: "Jumia integration is in progress",
    transactionCount: 321,
    journalEntryCount: 0,
    lastSync: undefined,
  },
  {
    id: "power",
    name: "Power",
    status: "integrated",
    description: "Power transactions are fully integrated with GL accounting",
    transactionCount: 189,
    journalEntryCount: 189,
    lastSync: "2023-05-21T11:30:00Z",
  },
  {
    id: "expenses",
    name: "Expenses",
    status: "integrated",
    description: "Expense transactions are fully integrated with GL accounting",
    transactionCount: 98,
    journalEntryCount: 98,
    lastSync: "2023-05-21T10:45:00Z",
  },
  {
    id: "commissions",
    name: "Commissions",
    status: "not-started",
    description: "Commission transactions are not yet integrated with GL accounting",
    transactionCount: 76,
    journalEntryCount: 0,
    lastSync: undefined,
  },
  {
    id: "float",
    name: "Float Management",
    status: "partial",
    description: "Some Float transactions are not mapped to GL accounts",
    transactionCount: 154,
    journalEntryCount: 112,
    lastSync: "2023-05-21T09:30:00Z",
  },
]

export function TransactionSourceIntegration() {
  const [activeTab, setActiveTab] = useState("overview")
  const [syncingModule, setSyncingModule] = useState<string | null>(null)

  // Calculate integration statistics
  const totalTransactions = moduleIntegrations.reduce((sum, module) => sum + module.transactionCount, 0)
  const totalJournalEntries = moduleIntegrations.reduce((sum, module) => sum + module.journalEntryCount, 0)
  const integrationPercentage = Math.round((totalJournalEntries / totalTransactions) * 100)

  const fullyIntegrated = moduleIntegrations.filter((m) => m.status === "integrated").length
  const partiallyIntegrated = moduleIntegrations.filter((m) => m.status === "partial").length
  const pending = moduleIntegrations.filter((m) => m.status === "pending").length
  const notStarted = moduleIntegrations.filter((m) => m.status === "not-started").length

  // Handle sync button click
  const handleSync = (moduleId: string) => {
    setSyncingModule(moduleId)

    // Simulate sync process
    setTimeout(() => {
      setSyncingModule(null)
    }, 2000)
  }

  // Get status badge based on integration status
  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status) {
      case "integrated":
        return (
          <div className="flex items-center text-green-600">
            <CheckCircle className="mr-1 h-4 w-4" />
            <span>Integrated</span>
          </div>
        )
      case "partial":
        return (
          <div className="flex items-center text-amber-600">
            <Info className="mr-1 h-4 w-4" />
            <span>Partial</span>
          </div>
        )
      case "pending":
        return (
          <div className="flex items-center text-blue-600">
            <Info className="mr-1 h-4 w-4" />
            <span>Pending</span>
          </div>
        )
      case "not-started":
        return (
          <div className="flex items-center text-gray-600">
            <AlertCircle className="mr-1 h-4 w-4" />
            <span>Not Started</span>
          </div>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Source Integration</CardTitle>
        <CardDescription>
          Monitor the integration status between transaction sources and the GL accounting system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Integration Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{integrationPercentage}%</div>
                  <p className="text-xs text-muted-foreground">
                    {totalJournalEntries} of {totalTransactions} transactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Fully Integrated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fullyIntegrated}</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((fullyIntegrated / moduleIntegrations.length) * 100)}% of modules
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Partially Integrated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{partiallyIntegrated}</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((partiallyIntegrated / moduleIntegrations.length) * 100)}% of modules
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Not Integrated</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pending + notStarted}</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(((pending + notStarted) / moduleIntegrations.length) * 100)}% of modules
                  </p>
                </CardContent>
              </Card>
            </div>

            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertTitle>Integration Status</AlertTitle>
              <AlertDescription>
                {integrationPercentage < 90
                  ? "Some transactions are not properly mapped to GL accounts. Review the Modules tab for details."
                  : "Most transactions are properly integrated with the GL accounting system."}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="modules">
            <div className="space-y-4">
              {moduleIntegrations.map((module) => (
                <Card key={module.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-medium">{module.name}</CardTitle>
                      {getStatusBadge(module.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{module.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span>Transactions: {module.transactionCount}</span>
                          <span>Journal Entries: {module.journalEntryCount}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-end space-x-2">
                        {module.lastSync && (
                          <div className="text-xs text-muted-foreground">
                            Last sync: {new Date(module.lastSync).toLocaleString()}
                          </div>
                        )}
                        <Button size="sm" onClick={() => handleSync(module.id)} disabled={syncingModule === module.id}>
                          {syncingModule === module.id ? "Syncing..." : "Sync Now"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div className="space-y-4">
              {moduleIntegrations
                .filter((m) => m.status === "partial" || m.status === "pending" || m.status === "not-started")
                .map((module) => (
                  <Alert key={module.id} variant={module.status === "not-started" ? "destructive" : "default"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{module.name} Integration Issue</AlertTitle>
                    <AlertDescription>
                      {module.status === "partial" && (
                        <>
                          {module.transactionCount - module.journalEntryCount} transactions are not mapped to GL
                          accounts.
                          <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("modules")}>
                            View Details
                          </Button>
                        </>
                      )}
                      {module.status === "pending" && (
                        <>
                          Integration is in progress. No transactions have been mapped yet.
                          <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("modules")}>
                            View Details
                          </Button>
                        </>
                      )}
                      {module.status === "not-started" && (
                        <>
                          Integration has not been started. Configure GL mappings for this module.
                          <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("modules")}>
                            View Details
                          </Button>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}

              {moduleIntegrations.filter(
                (m) => m.status === "partial" || m.status === "pending" || m.status === "not-started",
              ).length === 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>No Integration Issues</AlertTitle>
                  <AlertDescription>All modules are fully integrated with the GL accounting system.</AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
