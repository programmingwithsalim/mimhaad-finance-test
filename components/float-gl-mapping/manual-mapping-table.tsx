"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Trash2, Save, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ManualMappingTableProps {
  onMappingChange?: () => void
}

export function ManualMappingTable({ onMappingChange }: ManualMappingTableProps) {
  const [floatAccounts, setFloatAccounts] = useState<any[]>([])
  const [glAccounts, setGlAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedGlAccount, setSelectedGlAccount] = useState<string>("")
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch float accounts with current mappings
      const floatResponse = await fetch("/api/float-accounts")
      const floatResult = await floatResponse.json()

      // Fetch GL accounts
      const glResponse = await fetch("/api/gl/accounts")
      const glResult = await glResponse.json()

      if (floatResult.success && glResult.success) {
        setFloatAccounts(floatResult.data || [])
        setGlAccounts(glResult.data || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to load mapping data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveMapping = async (floatAccountId: string, glAccountId: string) => {
    try {
      const response = await fetch("/api/float-gl-mapping/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "map",
          floatAccountId,
          glAccountId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Success",
          description: "Mapping saved successfully",
        })
        setEditingId(null)
        setSelectedGlAccount("")
        await fetchData()
        onMappingChange?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleRemoveMapping = async (floatAccountId: string) => {
    try {
      const response = await fetch("/api/float-gl-mapping/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unmap",
          floatAccountId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Success",
          description: "Mapping removed successfully",
        })
        await fetchData()
        onMappingChange?.()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
    }).format(amount)
  }

  const getGlAccountName = (glAccountId: string) => {
    const glAccount = glAccounts.find((gl) => gl.id === glAccountId)
    return glAccount ? `${glAccount.code} - ${glAccount.name}` : "Unknown"
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Float-GL Account Mapping</CardTitle>
        <CardDescription>Manually assign float accounts to GL accounts or modify existing mappings</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Float Account</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Current GL Account</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {floatAccounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{account.account_type}</div>
                    <div className="text-sm text-muted-foreground">
                      Branch: {account.branch_name || account.branch_id}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {account.provider ? (
                    <Badge variant="outline">{account.provider}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(Number.parseFloat(account.current_balance || "0"))}
                </TableCell>
                <TableCell>
                  {editingId === account.id ? (
                    <Select value={selectedGlAccount} onValueChange={setSelectedGlAccount}>
                      <SelectTrigger className="w-[250px]">
                        <SelectValue placeholder="Select GL Account" />
                      </SelectTrigger>
                      <SelectContent>
                        {glAccounts
                          .filter((gl) => gl.type === "Asset") // Only show asset accounts for float mapping
                          .map((gl) => (
                            <SelectItem key={gl.id} value={gl.id}>
                              {gl.code} - {gl.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : account.gl_account_id ? (
                    <div className="text-sm">
                      <div className="font-medium">{getGlAccountName(account.gl_account_id)}</div>
                      <Badge variant="secondary" className="text-xs">
                        Mapped
                      </Badge>
                    </div>
                  ) : (
                    <Badge variant="destructive">Unmapped</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingId === account.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleSaveMapping(account.id, selectedGlAccount)}
                          disabled={!selectedGlAccount}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null)
                            setSelectedGlAccount("")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(account.id)
                            setSelectedGlAccount(account.gl_account_id || "")
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {account.gl_account_id && (
                          <Button size="sm" variant="outline" onClick={() => handleRemoveMapping(account.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
