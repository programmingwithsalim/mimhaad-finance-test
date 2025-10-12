"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2 } from "lucide-react"
import { defaultGLMappings, type GLAccountMapping } from "@/lib/gl-mapping"

// Mock GL accounts for the demo
const glAccounts = [
  { id: "1001", code: "1001", name: "Cash in Bank - Operations", type: "Asset" },
  { id: "1002", code: "1002", name: "Cash in Bank - Payroll", type: "Asset" },
  { id: "1003", code: "1003", name: "Petty Cash", type: "Asset" },
  { id: "1200", code: "1200", name: "Accounts Receivable", type: "Asset" },
  { id: "1300", code: "1300", name: "Prepaid Insurance", type: "Asset" },
  { id: "2001", code: "2001", name: "Accounts Payable", type: "Liability" },
  { id: "3001", code: "3001", name: "Share Capital", type: "Equity" },
  { id: "4001", code: "4001", name: "MoMo Commission Revenue", type: "Revenue" },
  { id: "4002", code: "4002", name: "E-Zwich Commission Revenue", type: "Revenue" },
  { id: "5001", code: "5001", name: "Salaries Expense", type: "Expense" },
  { id: "5002", code: "5002", name: "Rent Expense", type: "Expense" },
  { id: "5003", code: "5003", name: "Office Supplies Expense", type: "Expense" },
  { id: "5004", code: "5004", name: "Insurance Expense", type: "Expense" },
]

// Service modules
const serviceModules = [
  { id: "momo", name: "Mobile Money" },
  { id: "agency", name: "Agency Banking" },
  { id: "ezwich", name: "E-Zwich" },
  { id: "jumia", name: "Jumia" },
  { id: "power", name: "Power" },
  { id: "expenses", name: "Expenses" },
  { id: "commissions", name: "Commissions" },
]

// Transaction types
const transactionTypes = {
  momo: [
    { id: "cash-in", name: "Cash In" },
    { id: "cash-out", name: "Cash Out" },
    { id: "commission", name: "Commission" },
  ],
  agency: [
    { id: "deposit", name: "Deposit" },
    { id: "withdrawal", name: "Withdrawal" },
    { id: "commission", name: "Commission" },
  ],
  ezwich: [
    { id: "issue", name: "Card Issue" },
    { id: "withdrawal", name: "Withdrawal" },
    { id: "commission", name: "Commission" },
  ],
  jumia: [
    { id: "collection", name: "Collection" },
    { id: "settlement", name: "Settlement" },
    { id: "commission", name: "Commission" },
  ],
  power: [
    { id: "sale", name: "Sale" },
    { id: "commission", name: "Commission" },
  ],
  expenses: [{ id: "payment", name: "Payment" }],
  commissions: [{ id: "receipt", name: "Receipt" }],
}

// Form schema
const mappingSchema = z.object({
  serviceModule: z.string({
    required_error: "Please select a service module",
  }),
  transactionType: z.string({
    required_error: "Please select a transaction type",
  }),
  debitAccountId: z.string({
    required_error: "Please select a debit account",
  }),
  creditAccountId: z.string({
    required_error: "Please select a credit account",
  }),
  description: z.string().min(5, {
    message: "Description must be at least 5 characters",
  }),
  isActive: z.boolean().default(true),
})

type MappingFormValues = z.infer<typeof mappingSchema>

export function TransactionSourcesMapping() {
  const [mappings, setMappings] = useState<GLAccountMapping[]>(defaultGLMappings)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedServiceModule, setSelectedServiceModule] = useState<string>("")
  const [availableTransactionTypes, setAvailableTransactionTypes] = useState<{ id: string; name: string }[]>([])

  const form = useForm<MappingFormValues>({
    resolver: zodResolver(mappingSchema),
    defaultValues: {
      serviceModule: "",
      transactionType: "",
      debitAccountId: "",
      creditAccountId: "",
      description: "",
      isActive: true,
    },
  })

  // Update available transaction types when service module changes
  useEffect(() => {
    const serviceModule = form.watch("serviceModule")
    if (serviceModule && transactionTypes[serviceModule as keyof typeof transactionTypes]) {
      setAvailableTransactionTypes(transactionTypes[serviceModule as keyof typeof transactionTypes])
    } else {
      setAvailableTransactionTypes([])
    }
    form.setValue("transactionType", "")
  }, [form.watch("serviceModule")])

  function onSubmit(data: MappingFormValues) {
    // Create a new mapping
    const newMapping: GLAccountMapping = {
      id: `mapping-${data.serviceModule}-${data.transactionType}-${Date.now()}`,
      serviceModule: data.serviceModule,
      transactionType: data.transactionType,
      debitAccountId: data.debitAccountId,
      creditAccountId: data.creditAccountId,
      description: data.description,
      isActive: data.isActive,
    }

    // Add to mappings
    setMappings([...mappings, newMapping])
    setIsAddDialogOpen(false)
    form.reset()
  }

  function handleDeleteMapping(id: string) {
    setMappings(mappings.filter((mapping) => mapping.id !== id))
  }

  function handleToggleActive(id: string) {
    setMappings(mappings.map((mapping) => (mapping.id === id ? { ...mapping, isActive: !mapping.isActive } : mapping)))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Transaction Source Mappings</CardTitle>
            <CardDescription>
              Configure how transactions from different modules are mapped to GL accounts
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Mapping
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Add GL Account Mapping</DialogTitle>
                <DialogDescription>
                  Define how transactions from a specific source should be mapped to GL accounts.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="serviceModule"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Module</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select module" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {serviceModules.map((module) => (
                                <SelectItem key={module.id} value={module.id}>
                                  {module.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transactionType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Transaction Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={availableTransactionTypes.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableTransactionTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="debitAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Debit Account</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {glAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="creditAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Account</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {glAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Description for journal entries" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Save Mapping</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Module</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Debit Account</TableHead>
                <TableHead>Credit Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => {
                const debitAccount = glAccounts.find((a) => a.id === mapping.debitAccountId)
                const creditAccount = glAccounts.find((a) => a.id === mapping.creditAccountId)
                const serviceModule = serviceModules.find((m) => m.id === mapping.serviceModule)
                const transactionType = transactionTypes[mapping.serviceModule as keyof typeof transactionTypes]?.find(
                  (t) => t.id === mapping.transactionType,
                )

                return (
                  <TableRow key={mapping.id}>
                    <TableCell>{serviceModule?.name || mapping.serviceModule}</TableCell>
                    <TableCell>{transactionType?.name || mapping.transactionType}</TableCell>
                    <TableCell>
                      {debitAccount ? `${debitAccount.code} - ${debitAccount.name}` : mapping.debitAccountId}
                    </TableCell>
                    <TableCell>
                      {creditAccount ? `${creditAccount.code} - ${creditAccount.name}` : mapping.creditAccountId}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          mapping.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {mapping.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(mapping.id)}
                          title={mapping.isActive ? "Deactivate" : "Activate"}
                        >
                          {mapping.isActive ? (
                            <span className="h-4 w-4 text-green-500">✓</span>
                          ) : (
                            <span className="h-4 w-4 text-gray-500">✗</span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMapping(mapping.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {mappings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                    No mappings configured. Click "Add Mapping" to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
