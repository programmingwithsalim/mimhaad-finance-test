"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Zap, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FloatAccountWithGL {
  id: string
  accountName: string
  accountType: string
  currentBalance: number
  branchId: string
  branchName?: string
  glMappings: any[]
  mainGLAccount?: any
  feeGLAccount?: any
  commissionGLAccount?: any
}

interface FloatGLMappingDashboardProps {
  className?: string
}

export function FloatGLMappingDashboard({ className }: FloatGLMappingDashboardProps) {
  const [floatAccounts, setFloatAccounts] = useState<FloatAccountWithGL[]>([])
  const [glAccounts, setGLAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoMapping, setAutoMapping] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedFloat, setSelectedFloat] = useState<string>("")
  const [selectedGL, setSelectedGL] = useState<string>("")
  const [selectedMappingType, setSelectedMappingType] = useState<string>("")
  const [showMappingDialog, setShowMappingDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log("Fetching float-GL mapping data...")

      // Test the API first
      const testResponse = await fetch("/api/float-gl-mapping/test")
      const testData = await testResponse.text()
      console.log("Test API response:", testData)

      // Try to parse as JSON
      let testJson
      try {
        testJson = JSON.parse(testData)
        console.log("Test API JSON:", testJson)
      } catch (e) {
        console.error("Test API returned non-JSON:", testData)
        throw new Error("API is not returning JSON. Check server logs.")
      }

      // Fetch float accounts with mappings
      console.log("Fetching float accounts...")
      const floatResponse = await fetch("/api/float-gl-mapping")
      const floatResponseText = await floatResponse.text()
      console.log("Float API response text:", floatResponseText.substring(0, 200))

      let floatData
      try {
        floatData = JSON.parse(floatResponseText)
      } catch (e) {
        console.error("Float API returned non-JSON:", floatResponseText)
        throw new Error(`Float API returned invalid JSON: ${floatResponseText.substring(0, 100)}...`)
      }

      if (floatData.success) {
        setFloatAccounts(floatData.data || [])
        console.log("Float accounts loaded:", floatData.data?.length || 0)
      } else {
        throw new Error(floatData.error || "Failed to fetch float accounts")
      }

      // Fetch GL accounts
      console.log("Fetching GL accounts...")
      const glResponse = await fetch("/api/gl/accounts")
      const glResponseText = await glResponse.text()

      let glData
      try {
        glData = JSON.parse(glResponseText)
      } catch (e) {
        console.error("GL API returned non-JSON:", glResponseText)
        // Don't fail completely if GL accounts can't be fetched
        setGLAccounts([])
        console.log("GL accounts fetch failed, continuing with empty array")
        return
      }

      if (glData.success) {
        setGLAccounts(glData.accounts || [])
        console.log("GL accounts loaded:", glData.accounts?.length || 0)
      } else {
        console.warn("GL accounts fetch failed:", glData.error)
        setGLAccounts([])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      setError(error.message)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAutoMap = async () => {
    setAutoMapping(true)
    try {
      const response = await fetch("/api/float-gl-mapping/auto-map", {
        method: "POST",
      })

      const responseText = await response.text()
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`Auto-map API returned invalid JSON: ${responseText}`)
      }

      if (data.success) {
        toast({
          title: "Auto-mapping completed",
          description: `Successfully mapped ${data.data.success} accounts. ${data.data.failed} failed.`,
        })
        await fetchData()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error in auto-mapping:", error)
      toast({
        title: "Auto-mapping failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setAutoMapping(false)
    }
  }

  const handleSyncBalances = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/float-gl-mapping/sync-balances", {
        method: "POST",
      })

      const responseText = await response.text()
      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error(`Sync API returned invalid JSON: ${responseText}`)
      }

      if (data.success) {
        toast({
          title: "Balance sync completed",
          description: `Synced ${data.data.synced} accounts`,
        })
        await fetchData()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error syncing balances:", error)
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Error loading float-GL mapping data:</div>
            <div className="mt-2 text-sm">{error}</div>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const totalMapped = floatAccounts.filter((a) => a.mainGLAccount).length
  const totalUnmapped = floatAccounts.length - totalMapped

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Float-GL Account Mapping</h1>
          <p className="text-muted-foreground">
            Map float accounts to General Ledger accounts for integrated financial reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoMap} disabled={autoMapping}>
            <Zap className={`h-4 w-4 mr-2 ${autoMapping ? "animate-spin" : ""}`} />
            Auto Map
          </Button>
          <Button variant="outline" onClick={handleSyncBalances} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync Balances
          </Button>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Float Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{floatAccounts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mapped Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalMapped}</div>
            <p className="text-xs text-muted-foreground">
              {totalMapped > 0 ? `${Math.round((totalMapped / floatAccounts.length) * 100)}% mapped` : "None mapped"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unmapped Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalUnmapped}</div>
            <p className="text-xs text-muted-foreground">Need mapping</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">GL Accounts Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{glAccounts.length}</div>
            <p className="text-xs text-muted-foreground">For mapping</p>
          </CardContent>
        </Card>
      </div>

      {/* Mapping Table */}
      <Card>
        <CardHeader>
          <CardTitle>Float Account Mappings</CardTitle>
          <CardDescription>Current mappings between float accounts and GL accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Float Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {floatAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.accountName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{account.accountType}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(account.currentBalance)}</TableCell>
                  <TableCell>{account.branchName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {account.mainGLAccount ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <span className={account.mainGLAccount ? "text-green-600" : "text-gray-600"}>
                        {account.mainGLAccount ? "Mapped" : "Not Mapped"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unmapped Accounts Alert */}
      {totalUnmapped > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {totalUnmapped} unmapped float accounts. Use the "Auto Map" feature to automatically map them based
            on account types.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
