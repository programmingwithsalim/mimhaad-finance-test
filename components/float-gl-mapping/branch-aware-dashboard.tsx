"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Zap, Building2, CreditCard, TrendingUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ManualMappingTable } from "./manual-mapping-table"

interface BranchAwareDashboardProps {
  className?: string
}

export function BranchAwareDashboard({ className }: BranchAwareDashboardProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/float-gl-mapping/branch-aware")
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to load branch-aware mapping data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string) => {
    setProcessing(true)
    try {
      const response = await fetch("/api/float-gl-mapping/branch-aware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Success",
          description:
            action === "auto-map"
              ? `Mapped ${result.data.success} accounts`
              : `Synced ${result.data.synced} GL accounts`,
        })
        await fetchData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Branch-Aware Float-GL Mapping</h1>
            <p className="text-muted-foreground">Option B: Provider GL accounts with branch dimensions</p>
          </div>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Alert>
          <AlertDescription>No data available. Click refresh to load the mapping data.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const { floatAccounts, glAccounts, branchPerformance } = data

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Branch-Aware Float-GL Mapping</h1>
          <p className="text-muted-foreground">Option B: Provider GL accounts with branch dimensions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleAction("auto-map")} disabled={processing}>
            <Zap className="h-4 w-4 mr-2" />
            Auto Map by Provider
          </Button>
          <Button variant="outline" onClick={() => handleAction("sync-balances")} disabled={processing}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Balances
          </Button>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Branches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{branchPerformance?.branches?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Float Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(floatAccounts?.unmapped?.length || 0) + Object.values(floatAccounts?.byProvider || {}).flat().length}
            </div>
            <p className="text-xs text-muted-foreground">{floatAccounts?.unmapped?.length || 0} unmapped</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">GL Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{glAccounts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Provider-based</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Float
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                branchPerformance?.branches?.reduce((sum, branch) => sum + (branch.totalFloat || 0), 0) || 0,
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manual-mapping" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual-mapping">Manual Mapping</TabsTrigger>
          <TabsTrigger value="by-branch">By Branch</TabsTrigger>
          <TabsTrigger value="by-provider">By Provider</TabsTrigger>
          <TabsTrigger value="gl-accounts">GL Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="manual-mapping" className="space-y-4">
          <ManualMappingTable onMappingChange={fetchData} />
        </TabsContent>

        <TabsContent value="by-branch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branch Performance</CardTitle>
              <CardDescription>Float accounts grouped by branch</CardDescription>
            </CardHeader>
            <CardContent>
              {branchPerformance?.branches?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Total Float</TableHead>
                      <TableHead>Providers</TableHead>
                      <TableHead>Mapping Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branchPerformance.branches.map((branch) => (
                      <TableRow key={branch.branchId}>
                        <TableCell className="font-medium">{branch.branchName}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(branch.totalFloat)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(branch.accountsByProvider || {}).map(([provider, amount]) => (
                              <Badge key={provider} variant="outline" className="text-xs">
                                {provider}: {formatCurrency(amount)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-green-600">{branch.glMappingStatus?.mapped || 0}</span>
                            {" / "}
                            <span className="text-muted-foreground">{branch.glMappingStatus?.total || 0}</span>
                            {" mapped"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">No branch data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-provider" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Summary</CardTitle>
              <CardDescription>Float accounts grouped by provider type</CardDescription>
            </CardHeader>
            <CardContent>
              {floatAccounts?.byProvider && Object.keys(floatAccounts.byProvider).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(floatAccounts.byProvider).map(([providerKey, accounts]) => (
                    <div key={providerKey} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">{providerKey}</h4>
                        <Badge variant="secondary">{accounts.length} accounts</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {accounts.map((account) => (
                          <div key={account.id} className="flex justify-between">
                            <span>{account.branchName}</span>
                            <span>{formatCurrency(account.currentBalance)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No provider data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gl-accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>GL Accounts with Branch Mappings</CardTitle>
              <CardDescription>Provider-based GL accounts showing branch breakdowns</CardDescription>
            </CardHeader>
            <CardContent>
              {glAccounts?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GL Account</TableHead>
                      <TableHead className="text-right">GL Balance</TableHead>
                      <TableHead className="text-right">Branch Total</TableHead>
                      <TableHead>Branch Breakdown</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {glAccounts.map((glAccount) => (
                      <TableRow key={glAccount.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {glAccount.code} - {glAccount.name}
                            </div>
                            <div className="text-sm text-muted-foreground">{glAccount.type}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(glAccount.balance)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(glAccount.totalBranchBalance)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {glAccount.branchMappings?.map((mapping) => (
                              <div key={mapping.floatAccountId} className="text-sm flex justify-between">
                                <span>
                                  {mapping.branchName} ({mapping.provider})
                                </span>
                                <span>{formatCurrency(mapping.balance)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-8">No GL account data available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Unmapped Accounts Alert */}
      {floatAccounts?.unmapped?.length > 0 && (
        <Alert>
          <AlertDescription>
            You have {floatAccounts.unmapped.length} unmapped float accounts. Use "Auto Map by Provider" or the Manual
            Mapping tab to map them to appropriate GL accounts.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
