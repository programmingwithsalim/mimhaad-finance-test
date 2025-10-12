"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ChevronDown, ChevronUp, FileSpreadsheet, Printer } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface AccountDrilldownProps {
  accountId: string
  dateRange: { from: Date; to: Date }
  onBack: () => void
}

// Mock data for account details
const accountData = {
  "1001": {
    id: "1001",
    code: "1001",
    name: "Cash in Bank - Operations",
    type: "Asset",
    balance: 1250000.0,
    openingBalance: 1200000.0,
    transactions: [
      {
        id: "TX-2023-0001",
        date: "2023-05-12",
        description: "MoMo Commission Revenue - May Week 2",
        reference: "JE-2023-0001",
        debit: 45000,
        credit: 0,
        balance: 1250000.0,
      },
      {
        id: "TX-2023-0002",
        date: "2023-05-11",
        description: "E-Zwich Commission Revenue - May Week 2",
        reference: "JE-2023-0002",
        debit: 22000,
        credit: 0,
        balance: 1205000.0,
      },
      {
        id: "TX-2023-0003",
        date: "2023-05-10",
        description: "Office Supplies Purchase",
        reference: "JE-2023-0003",
        debit: 0,
        credit: 3500,
        balance: 1183000.0,
      },
      {
        id: "TX-2023-0004",
        date: "2023-05-09",
        description: "Vendor Payment - Office Rent",
        reference: "JE-2023-0004",
        debit: 0,
        credit: 15000,
        balance: 1186500.0,
      },
      {
        id: "TX-2023-0005",
        date: "2023-05-08",
        description: "Petty Cash Replenishment",
        reference: "JE-2023-0005",
        debit: 0,
        credit: 5000,
        balance: 1201500.0,
      },
      {
        id: "TX-2023-0006",
        date: "2023-05-05",
        description: "MoMo Commission Revenue - May Week 1",
        reference: "JE-2023-0006",
        debit: 42000,
        credit: 0,
        balance: 1206500.0,
      },
      {
        id: "TX-2023-0007",
        date: "2023-05-04",
        description: "E-Zwich Commission Revenue - May Week 1",
        reference: "JE-2023-0007",
        debit: 19500,
        credit: 0,
        balance: 1164500.0,
      },
      {
        id: "TX-2023-0009",
        date: "2023-05-01",
        description: "Monthly Rent Payment",
        reference: "JE-2023-0009",
        debit: 0,
        credit: 25000,
        balance: 1145000.0,
      },
    ],
  },
  "4001": {
    id: "4001",
    code: "4001",
    name: "MoMo Commission Revenue",
    type: "Revenue",
    balance: -950000.0,
    openingBalance: -863000.0,
    transactions: [
      {
        id: "TX-2023-0001",
        date: "2023-05-12",
        description: "MoMo Commission Revenue - May Week 2",
        reference: "JE-2023-0001",
        debit: 0,
        credit: 45000,
        balance: -950000.0,
      },
      {
        id: "TX-2023-0006",
        date: "2023-05-05",
        description: "MoMo Commission Revenue - May Week 1",
        reference: "JE-2023-0006",
        debit: 0,
        credit: 42000,
        balance: -905000.0,
      },
    ],
  },
}

export function AccountDrilldown({ accountId, dateRange, onBack }: AccountDrilldownProps) {
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null)

  // Get account data based on accountId
  const account = accountData[accountId as keyof typeof accountData]

  if (!account) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Account Not Found</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p>The requested account could not be found.</p>
          <Button className="mt-4" onClick={onBack}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case "Asset":
        return "bg-blue-100 text-blue-800"
      case "Liability":
        return "bg-red-100 text-red-800"
      case "Equity":
        return "bg-purple-100 text-purple-800"
      case "Revenue":
        return "bg-green-100 text-green-800"
      case "Expense":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const toggleTransaction = (txId: string) => {
    if (expandedTransaction === txId) {
      setExpandedTransaction(null)
    } else {
      setExpandedTransaction(txId)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle>{account.name}</CardTitle>
              <CardDescription>
                Account Code: {account.code} | Type:
                <span
                  className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${getAccountTypeColor(account.type)}`}
                >
                  {account.type}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(account.balance)}</div>
                <p className="text-xs text-muted-foreground mt-1">As of {dateRange.to.toLocaleDateString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(account.openingBalance)}</div>
                <p className="text-xs text-muted-foreground mt-1">As of {dateRange.from.toLocaleDateString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net Change</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${account.balance - account.openingBalance > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(account.balance - account.openingBalance)}
                </div>
              </CardContent>
            </Card>
          </div>
          <Tabs defaultValue="transactions" className="w-full">
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              {/* <TabsTrigger value="analytics">Analytics</TabsTrigger> */}
            </TabsList>
            <TabsContent value="transactions" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Transaction History</h2>
                <div>
                  <Button variant="outline" size="sm">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export to CSV
                  </Button>
                  <Button variant="outline" size="sm" className="ml-2">
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {account.transactions.map((transaction) => (
                    <>
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.date}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.reference}</TableCell>
                        <TableCell className="text-right">
                          {transaction.debit > 0 ? formatCurrency(transaction.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.credit > 0 ? formatCurrency(transaction.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(transaction.balance)}</TableCell>
                        <TableCell className="w-10">
                          <Button variant="ghost" size="sm" onClick={() => toggleTransaction(transaction.id)}>
                            {expandedTransaction === transaction.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedTransaction === transaction.id && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0">
                            <div className="bg-muted p-4 rounded-md">
                              <h3 className="text-sm font-semibold">Transaction Details</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Transaction ID: {transaction.id}</p>
                                  <p className="text-xs text-muted-foreground">Date: {transaction.date}</p>
                                  <p className="text-xs text-muted-foreground">Reference: {transaction.reference}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Description: {transaction.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Debit: {transaction.debit > 0 ? formatCurrency(transaction.debit) : "-"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Credit: {transaction.credit > 0 ? formatCurrency(transaction.credit) : "-"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            {/* <TabsContent value="analytics">
              Analytics content goes here.
            </TabsContent> */}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
