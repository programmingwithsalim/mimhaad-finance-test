"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { RefreshCw, Plus, Building2, Wallet, AlertTriangle, Edit, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { formatCurrency } from "@/lib/currency"
import { useCurrentUser } from "@/hooks/use-current-user"

// Partner account form schema
const partnerAccountSchema = z.object({
  bankName: z.string().min(1, { message: "Bank name is required" }),
  accountNumber: z.string().min(1, { message: "Account number is required" }),
  accountName: z.string().min(1, { message: "Account name is required" }),
  contactPerson: z.string().min(1, { message: "Contact person is required" }),
  contactPhone: z.string().min(1, { message: "Contact phone is required" }),
  contactEmail: z.string().email().optional().or(z.literal("")),
  settlementTime: z.string().min(1, { message: "Settlement time is required" }),
  currentBalance: z.coerce.number().min(0, { message: "Balance must be positive" }),
  minThreshold: z.coerce.number().min(0, { message: "Minimum threshold must be positive" }),
  maxThreshold: z.coerce.number().min(0, { message: "Maximum threshold must be positive" }),
  isActive: z.boolean().default(true),
})

type PartnerAccountFormValues = z.infer<typeof partnerAccountSchema>

export function EZwichPartnerAccounts() {
  const { toast } = useToast()
  const { user } = useCurrentUser()
  const [partnerAccounts, setPartnerAccounts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)

  const branchId = user?.branchId
  const branchName = user?.branchName || "Unknown Branch"

  // Form initialization
  const partnerAccountForm = useForm<PartnerAccountFormValues>({
    resolver: zodResolver(partnerAccountSchema),
    defaultValues: {
      bankName: "",
      accountNumber: "",
      accountName: "",
      contactPerson: "",
      contactPhone: "",
      contactEmail: "",
      settlementTime: "17:00",
      currentBalance: 0,
      minThreshold: 1000,
      maxThreshold: 100000,
      isActive: true,
    },
  })

  // Fetch partner accounts
  const fetchPartnerAccounts = useCallback(async () => {
    if (!branchId) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/e-zwich/partner-accounts?branchId=${encodeURIComponent(branchId)}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setPartnerAccounts(data.accounts || [])
      } else {
        throw new Error(data.error || "Failed to fetch partner accounts")
      }
    } catch (error) {
      console.error("Error fetching partner accounts:", error)
      toast({
        title: "Error",
        description: "Failed to load partner accounts. Please try again.",
        variant: "destructive",
      })
      setPartnerAccounts([])
    } finally {
      setIsLoading(false)
    }
  }, [branchId, toast])

  // Load data on component mount
  useEffect(() => {
    if (branchId) {
      fetchPartnerAccounts()
    }
  }, [fetchPartnerAccounts, branchId])

  // Create or update partner account
  const onSubmitPartnerAccount = async (data: PartnerAccountFormValues) => {
    if (!branchId) {
      toast({
        title: "Error",
        description: "Branch information not available.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      const url = editingAccount
        ? `/api/e-zwich/partner-accounts/${editingAccount.id}`
        : "/api/e-zwich/partner-accounts"

      const method = editingAccount ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          branchId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to save partner account")
      }

      toast({
        title: "Success",
        description: `Partner account ${editingAccount ? "updated" : "created"} successfully.`,
      })

      partnerAccountForm.reset({
        bankName: "",
        accountNumber: "",
        accountName: "",
        contactPerson: "",
        contactPhone: "",
        contactEmail: "",
        settlementTime: "17:00",
        currentBalance: 0,
        minThreshold: 1000,
        maxThreshold: 100000,
        isActive: true,
      })
      setShowCreateDialog(false)
      setEditingAccount(null)
      fetchPartnerAccounts()
    } catch (error) {
      console.error("Error saving partner account:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save partner account",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Delete partner account
  const handleDeleteAccount = async (accountId: string) => {
    setIsProcessing(true)

    try {
      const response = await fetch(`/api/e-zwich/partner-accounts/${accountId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to delete partner account")
      }

      toast({
        title: "Success",
        description: result.message || "Partner account deleted successfully.",
      })

      fetchPartnerAccounts()
    } catch (error) {
      console.error("Error deleting partner account:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete partner account",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Edit account handler
  const handleEditAccount = (account: any) => {
    setEditingAccount(account)
    partnerAccountForm.reset({
      bankName: account.bank_name,
      accountNumber: account.account_number,
      accountName: account.account_name || `${account.bank_name} E-Zwich Account`,
      contactPerson: account.contact_person || "Branch Manager",
      contactPhone: account.contact_phone || "+233 24 000 0000",
      contactEmail: account.contact_email || "",
      settlementTime: account.settlement_time || "17:00",
      currentBalance: account.current_balance || 0,
      minThreshold: account.min_threshold || 1000,
      maxThreshold: account.max_threshold || 100000,
      isActive: account.is_active,
    })
    setShowCreateDialog(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">E-Zwich Partner Accounts</h2>
          <p className="text-muted-foreground">
            Manage partner bank accounts for E-Zwich services and process settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingAccount(null)
                  partnerAccountForm.reset({
                    bankName: "",
                    accountNumber: "",
                    accountName: "",
                    contactPerson: "",
                    contactPhone: "",
                    contactEmail: "",
                    settlementTime: "17:00",
                    currentBalance: 0,
                    minThreshold: 1000,
                    maxThreshold: 100000,
                    isActive: true,
                  })
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Partner Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Edit Partner Account" : "Add Partner Account"}</DialogTitle>
                <DialogDescription>
                  {editingAccount
                    ? "Update the partner bank account details"
                    : "Add a new partner bank account for E-Zwich services"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={partnerAccountForm.handleSubmit(onSubmitPartnerAccount)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input id="bankName" placeholder="e.g., GCB Bank" {...partnerAccountForm.register("bankName")} />
                    {partnerAccountForm.formState.errors.bankName && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.bankName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      placeholder="1234567890"
                      {...partnerAccountForm.register("accountNumber")}
                    />
                    {partnerAccountForm.formState.errors.accountNumber && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.accountNumber.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="accountName">Account Name *</Label>
                  <Input
                    id="accountName"
                    placeholder="Account holder name"
                    {...partnerAccountForm.register("accountName")}
                  />
                  {partnerAccountForm.formState.errors.accountName && (
                    <p className="mt-1 text-sm text-destructive">
                      {partnerAccountForm.formState.errors.accountName.message}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="contactPerson">Contact Person *</Label>
                    <Input
                      id="contactPerson"
                      placeholder="Contact person name"
                      {...partnerAccountForm.register("contactPerson")}
                    />
                    {partnerAccountForm.formState.errors.contactPerson && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.contactPerson.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="contactPhone">Contact Phone *</Label>
                    <Input
                      id="contactPhone"
                      placeholder="+233 24 123 4567"
                      {...partnerAccountForm.register("contactPhone")}
                    />
                    {partnerAccountForm.formState.errors.contactPhone && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.contactPhone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contact@bank.com"
                      {...partnerAccountForm.register("contactEmail")}
                    />
                    {partnerAccountForm.formState.errors.contactEmail && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.contactEmail.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="settlementTime">Settlement Time *</Label>
                    <Input id="settlementTime" type="time" {...partnerAccountForm.register("settlementTime")} />
                    {partnerAccountForm.formState.errors.settlementTime && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.settlementTime.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="currentBalance">Current Balance (GHS)</Label>
                    <Input
                      id="currentBalance"
                      type="number"
                      step="0.01"
                      min="0"
                      {...partnerAccountForm.register("currentBalance")}
                    />
                    {partnerAccountForm.formState.errors.currentBalance && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.currentBalance.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="minThreshold">Min Threshold (GHS)</Label>
                    <Input
                      id="minThreshold"
                      type="number"
                      step="0.01"
                      min="0"
                      {...partnerAccountForm.register("minThreshold")}
                    />
                    {partnerAccountForm.formState.errors.minThreshold && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.minThreshold.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="maxThreshold">Max Threshold (GHS)</Label>
                    <Input
                      id="maxThreshold"
                      type="number"
                      step="0.01"
                      min="0"
                      {...partnerAccountForm.register("maxThreshold")}
                    />
                    {partnerAccountForm.formState.errors.maxThreshold && (
                      <p className="mt-1 text-sm text-destructive">
                        {partnerAccountForm.formState.errors.maxThreshold.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    {...partnerAccountForm.register("isActive")}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="isActive">Active account</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {editingAccount ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>{editingAccount ? "Update Account" : "Create Account"}</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false)
                      setEditingAccount(null)
                      partnerAccountForm.reset()
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={fetchPartnerAccounts} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partner Accounts</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partnerAccounts.length}</div>
            <p className="text-xs text-muted-foreground">
              {partnerAccounts.filter((acc) => acc.is_active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(partnerAccounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">Combined partner balances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Balance Accounts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {partnerAccounts.filter((acc) => acc.current_balance < acc.min_threshold).length}
            </div>
            <p className="text-xs text-muted-foreground">Below minimum threshold</p>
          </CardContent>
        </Card>
      </div>

      {/* Partner Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Partner Bank Accounts</CardTitle>
          <CardDescription>Manage partner bank accounts for E-Zwich settlement transfers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank Details</TableHead>
                  <TableHead>Contact Information</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Settlement Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading partner accounts...
                    </TableCell>
                  </TableRow>
                ) : partnerAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No partner accounts found. Add your first partner account to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  partnerAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.bank_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.account_number} • {account.account_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.contact_person}</div>
                          <div className="text-sm text-muted-foreground">
                            {account.contact_phone}
                            {account.contact_email && <span> • {account.contact_email}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{formatCurrency(account.current_balance)}</div>
                        <div className="text-xs text-muted-foreground">
                          Min: {formatCurrency(account.min_threshold)} | Max: {formatCurrency(account.max_threshold)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{account.settlement_time || "17:00"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditAccount(account)}
                            title="Edit Account"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Delete Account">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Partner Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this partner account? This action cannot be undone. If
                                  there are related transactions, the account will be deactivated instead.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteAccount(account.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
