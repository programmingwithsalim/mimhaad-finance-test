"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, TrendingUp, TrendingDown, Activity, Edit, Trash2, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

interface ServicePageLayoutProps {
  serviceName: string
  serviceEndpoint: string
  children: React.ReactNode
  branchId?: string
}

interface Transaction {
  id: string
  reference: string
  amount: number
  fee: number
  transaction_type: string
  customer_name: string
  phone_number?: string
  created_at: string
  status?: string
}

interface CashTillData {
  cashTill: {
    amount: number
    opening_balance: number
    closing_balance: number
    date: string
    notes: string
  }
  breakdown: Array<{
    service: string
    transaction_count: number
    cash_in: number
    cash_out: number
    net: number
  }>
  summary: {
    totalCashIn: number
    totalCashOut: number
    netCash: number
    transactionCount: number
  }
}

interface ServiceStats {
  totalTransactions: number
  totalVolume: number
  totalFees: number
  todayTransactions: number
  todayVolume: number
  todayFees: number
  growthRate: number
}

export default function ServicePageLayout({
  serviceName,
  serviceEndpoint,
  children,
  branchId,
}: ServicePageLayoutProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cashTillData, setCashTillData] = useState<CashTillData | null>(null)
  const [serviceStats, setServiceStats] = useState<ServiceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch transactions
      const transactionsResponse = await fetch(
        `/api/${serviceEndpoint}/transactions${branchId ? `?branchId=${branchId}` : ""}`,
      )
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json()
        setTransactions(transactionsResult.data || [])
      }

      // Fetch cash till data
      if (branchId) {
        const cashTillResponse = await fetch(`/api/branches/${branchId}/cash-in-till?date=${selectedDate}`)
        if (cashTillResponse.ok) {
          const cashTillResult = await cashTillResponse.json()
          setCashTillData(cashTillResult.data)
        }
      }

      // Fetch service statistics
      const statsResponse = await fetch(`/api/${serviceEndpoint}/statistics${branchId ? `?branchId=${branchId}` : ""}`)
      if (statsResponse.ok) {
        const statsResult = await statsResponse.json()
        setServiceStats(statsResult.data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [serviceEndpoint, branchId, selectedDate])

  const handleEditTransaction = async (updatedTransaction: Transaction) => {
    try {
      const response = await fetch(`/api/${serviceEndpoint}/transactions/${updatedTransaction.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedTransaction),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Transaction updated successfully",
        })
        setIsEditDialogOpen(false)
        setEditingTransaction(null)
        fetchData()
      } else {
        throw new Error("Failed to update transaction")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return
    }

    try {
      const response = await fetch(`/api/${serviceEndpoint}/transactions/${transactionId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Transaction deleted successfully",
        })
        fetchData()
      } else {
        throw new Error("Failed to delete transaction")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete transaction",
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">{serviceName}</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{serviceName}</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      {serviceStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(serviceStats.totalFees)}</div>
              <p className="text-xs text-muted-foreground">Today: {formatCurrency(serviceStats.todayFees)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(serviceStats.totalVolume)}</div>
              <p className="text-xs text-muted-foreground">Today: {formatCurrency(serviceStats.todayVolume)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(serviceStats.totalTransactions)}</div>
              <p className="text-xs text-muted-foreground">Today: {formatNumber(serviceStats.todayTransactions)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
              {serviceStats.growthRate >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {serviceStats.growthRate >= 0 ? "+" : ""}
                {serviceStats.growthRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">vs last period</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="form">New Transaction</TabsTrigger>
          {cashTillData && <TabsTrigger value="cash-till">Cash in Till</TabsTrigger>}
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest {serviceName.toLowerCase()} transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.reference}</TableCell>
                      <TableCell>{transaction.customer_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.transaction_type.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                      <TableCell>{formatCurrency(transaction.fee)}</TableCell>
                      <TableCell>{format(new Date(transaction.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                          {transaction.status || "completed"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTransaction(transaction)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(transaction.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form">{children}</TabsContent>

        {cashTillData && (
          <TabsContent value="cash-till" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cash In</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(cashTillData.summary.totalCashIn)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Cash Out</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(cashTillData.summary.totalCashOut)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Cash</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${
                      cashTillData.summary.netCash >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(cashTillData.summary.netCash)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(cashTillData.summary.transactionCount)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cash Breakdown by Service</CardTitle>
                <CardDescription>
                  Cash flow breakdown for {format(new Date(selectedDate), "MMM dd, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Cash In</TableHead>
                      <TableHead>Cash Out</TableHead>
                      <TableHead>Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashTillData.breakdown.map((item) => (
                      <TableRow key={item.service}>
                        <TableCell className="font-medium">{item.service}</TableCell>
                        <TableCell>{formatNumber(item.transaction_count)}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(item.cash_in)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(item.cash_out)}</TableCell>
                        <TableCell className={item.net >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(item.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="customer_name" className="text-right">
                  Customer
                </Label>
                <Input
                  id="customer_name"
                  value={editingTransaction.customer_name}
                  onChange={(e) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      customer_name: e.target.value,
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={editingTransaction.amount}
                  onChange={(e) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      amount: Number.parseFloat(e.target.value),
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fee" className="text-right">
                  Fee
                </Label>
                <Input
                  id="fee"
                  type="number"
                  value={editingTransaction.fee}
                  onChange={(e) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      fee: Number.parseFloat(e.target.value),
                    })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="transaction_type" className="text-right">
                  Type
                </Label>
                <Select
                  value={editingTransaction.transaction_type}
                  onValueChange={(value) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      transaction_type: value,
                    })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="bill_payment">Bill Payment</SelectItem>
                    <SelectItem value="cash_in">Cash In</SelectItem>
                    <SelectItem value="cash_out">Cash Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleEditTransaction(editingTransaction)}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
