"use client"

import { useState, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Calendar, FileText, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { ReconciliationTable } from "./reconciliation-table"
import { ReconciliationSummary } from "./reconciliation-summary"
import { ReconciliationForm } from "./reconciliation-form"
import { useToast } from "@/hooks/use-toast"

// Types
export interface ReconciliationItem {
  id: string
  bankId: string
  bankName: string
  bankCode: string
  reconciliationDate: string
  startDate: string
  endDate: string
  systemBalance: number
  bankBalance: number
  difference: number
  status: "pending" | "approved" | "rejected" | "in-progress"
  discrepancies: Discrepancy[]
  notes?: string
  createdBy: string
  createdAt: string
  approvedBy?: string
  approvedAt?: string
}

export interface Discrepancy {
  id: string
  type: "missing-in-system" | "missing-in-bank" | "amount-mismatch"
  transactionId?: string
  transactionDate?: string
  systemAmount?: number
  bankAmount?: number
  difference: number
  status: "pending" | "resolved" | "ignored"
  resolution?: string
  resolvedBy?: string
  resolvedAt?: string
}

// Sample partner banks
const partnerBanks = [
  {
    id: "bank1",
    name: "Ghana Commercial Bank",
    code: "GCB",
    logo: "/banks/gcb-logo.png",
    status: "active" as const,
  },
  {
    id: "bank2",
    name: "Ecobank Ghana",
    code: "ECO",
    logo: "/banks/ecobank-logo.png",
    status: "active" as const,
  },
  {
    id: "bank9",
    name: "Cal Bank",
    code: "CAL",
    logo: "/banks/calbank-logo.png",
    status: "active" as const,
  },
  // Other banks...
]

// Sample reconciliation data
const sampleReconciliations: ReconciliationItem[] = [
  {
    id: "rec-001",
    bankId: "bank1",
    bankName: "Ghana Commercial Bank",
    bankCode: "GCB",
    reconciliationDate: new Date().toISOString(),
    startDate: subDays(new Date(), 7).toISOString(),
    endDate: new Date().toISOString(),
    systemBalance: 125000,
    bankBalance: 125000,
    difference: 0,
    status: "approved",
    discrepancies: [],
    notes: "All transactions match. No discrepancies found.",
    createdBy: "John Doe",
    createdAt: subDays(new Date(), 1).toISOString(),
    approvedBy: "Jane Smith",
    approvedAt: new Date().toISOString(),
  },
  {
    id: "rec-002",
    bankId: "bank2",
    bankName: "Ecobank Ghana",
    bankCode: "ECO",
    reconciliationDate: new Date().toISOString(),
    startDate: subDays(new Date(), 7).toISOString(),
    endDate: new Date().toISOString(),
    systemBalance: 85000,
    bankBalance: 84500,
    difference: 500,
    status: "pending",
    discrepancies: [
      {
        id: "disc-001",
        type: "missing-in-bank",
        transactionId: "TX-12345",
        transactionDate: subDays(new Date(), 3).toISOString(),
        systemAmount: 500,
        bankAmount: 0,
        difference: 500,
        status: "pending",
      },
    ],
    notes: "One transaction missing from bank statement.",
    createdBy: "John Doe",
    createdAt: subDays(new Date(), 1).toISOString(),
  },
  {
    id: "rec-003",
    bankId: "bank9",
    bankName: "Cal Bank",
    bankCode: "CAL",
    reconciliationDate: new Date().toISOString(),
    startDate: subDays(new Date(), 7).toISOString(),
    endDate: new Date().toISOString(),
    systemBalance: 67500,
    bankBalance: 68000,
    difference: -500,
    status: "in-progress",
    discrepancies: [
      {
        id: "disc-002",
        type: "missing-in-system",
        transactionDate: subDays(new Date(), 2).toISOString(),
        systemAmount: 0,
        bankAmount: 500,
        difference: -500,
        status: "pending",
      },
    ],
    notes: "Investigating transaction missing from our system.",
    createdBy: "John Doe",
    createdAt: subDays(new Date(), 1).toISOString(),
  },
]

export function ReconciliationDashboard() {
  const { toast } = useToast()
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>(sampleReconciliations)
  const [filteredReconciliations, setFilteredReconciliations] = useState<ReconciliationItem[]>(sampleReconciliations)
  const [selectedBank, setSelectedBank] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [activeTab, setActiveTab] = useState("reconciliations")
  const [showReconciliationForm, setShowReconciliationForm] = useState(false)
  const [selectedReconciliation, setSelectedReconciliation] = useState<ReconciliationItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Current branch and user info - in a real app, this would come from auth context
  const branchId = "branch-1"
  const userId = "user-1"

  // Filter reconciliations based on selected filters
  useEffect(() => {
    let filtered = [...reconciliations]

    if (selectedBank !== "all") {
      filtered = filtered.filter((rec) => rec.bankId === selectedBank)
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((rec) => rec.status === selectedStatus)
    }

    if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      filtered = filtered.filter((rec) => {
        const recDate = new Date(rec.reconciliationDate)
        return format(recDate, "yyyy-MM-dd") === dateStr
      })
    }

    setFilteredReconciliations(filtered)
  }, [reconciliations, selectedBank, selectedStatus, selectedDate])

  // Handle new reconciliation submission
  const handleReconciliationSubmit = (data: any) => {
    setIsLoading(true)

    // Simulate API call delay
    setTimeout(() => {
      const selectedBankInfo = partnerBanks.find((bank) => bank.id === data.bankId)
      if (!selectedBankInfo) {
        toast({
          title: "Error",
          description: "Selected bank not found",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // In a real app, we would fetch the system balance from our database
      // and the bank balance from the uploaded statement or API
      const systemBalance = Math.random() * 100000 + 50000
      const bankBalance = data.manualEntry
        ? Number.parseFloat(data.bankBalance)
        : systemBalance + (Math.random() > 0.7 ? Math.random() * 1000 - 500 : 0)

      const difference = systemBalance - bankBalance

      // Generate random discrepancies if there's a difference
      const discrepancies: Discrepancy[] = []
      if (Math.abs(difference) > 0) {
        if (difference > 0) {
          // Missing in bank
          discrepancies.push({
            id: `disc-${Date.now()}-1`,
            type: "missing-in-bank",
            transactionId: `TX-${Math.floor(Math.random() * 100000)}`,
            transactionDate: subDays(new Date(), Math.floor(Math.random() * 7)).toISOString(),
            systemAmount: difference,
            bankAmount: 0,
            difference: difference,
            status: "pending",
          })
        } else {
          // Missing in system
          discrepancies.push({
            id: `disc-${Date.now()}-2`,
            type: "missing-in-system",
            transactionDate: subDays(new Date(), Math.floor(Math.random() * 7)).toISOString(),
            systemAmount: 0,
            bankAmount: Math.abs(difference),
            difference: difference,
            status: "pending",
          })
        }
      }

      const newReconciliation: ReconciliationItem = {
        id: `rec-${Date.now()}`,
        bankId: data.bankId,
        bankName: selectedBankInfo.name,
        bankCode: selectedBankInfo.code,
        reconciliationDate: new Date().toISOString(),
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        systemBalance,
        bankBalance,
        difference,
        status: difference === 0 ? "approved" : "pending",
        discrepancies,
        notes: data.notes || (difference === 0 ? "All transactions match. No discrepancies found." : ""),
        createdBy: "Current User", // Would be the logged-in user
        createdAt: new Date().toISOString(),
        ...(difference === 0
          ? {
              approvedBy: "System",
              approvedAt: new Date().toISOString(),
            }
          : {}),
      }

      setReconciliations((prev) => [newReconciliation, ...prev])
      setShowReconciliationForm(false)
      setActiveTab("reconciliations")

      toast({
        title: "Reconciliation Created",
        description: difference === 0 ? "All balances match!" : "Discrepancies found. Review required.",
        variant: difference === 0 ? "default" : "destructive",
      })

      setIsLoading(false)
    }, 2000)
  }

  // Handle reconciliation approval
  const handleApproveReconciliation = (id: string) => {
    setReconciliations((prev) =>
      prev.map((rec) =>
        rec.id === id
          ? {
              ...rec,
              status: "approved",
              approvedBy: "Current User", // Would be the logged-in user
              approvedAt: new Date().toISOString(),
            }
          : rec,
      ),
    )

    toast({
      title: "Reconciliation Approved",
      description: "The reconciliation has been approved successfully.",
    })
  }

  // Handle reconciliation rejection
  const handleRejectReconciliation = (id: string) => {
    setReconciliations((prev) =>
      prev.map((rec) =>
        rec.id === id
          ? {
              ...rec,
              status: "rejected",
              approvedBy: "Current User", // Would be the logged-in user
              approvedAt: new Date().toISOString(),
            }
          : rec,
      ),
    )

    toast({
      title: "Reconciliation Rejected",
      description: "The reconciliation has been rejected.",
      variant: "destructive",
    })
  }

  // Handle discrepancy resolution
  const handleResolveDiscrepancy = (reconciliationId: string, discrepancyId: string, resolution: string) => {
    setReconciliations((prev) =>
      prev.map((rec) => {
        if (rec.id === reconciliationId) {
          const updatedDiscrepancies = rec.discrepancies.map((disc) =>
            disc.id === discrepancyId
              ? {
                  ...disc,
                  status: "resolved",
                  resolution,
                  resolvedBy: "Current User", // Would be the logged-in user
                  resolvedAt: new Date().toISOString(),
                }
              : disc,
          )

          // Check if all discrepancies are resolved
          const allResolved = updatedDiscrepancies.every((disc) => disc.status !== "pending")

          return {
            ...rec,
            discrepancies: updatedDiscrepancies,
            status: allResolved ? "in-progress" : rec.status,
          }
        }
        return rec
      }),
    )

    toast({
      title: "Discrepancy Resolved",
      description: "The discrepancy has been marked as resolved.",
    })
  }

  // Handle discrepancy ignore
  const handleIgnoreDiscrepancy = (reconciliationId: string, discrepancyId: string, reason: string) => {
    setReconciliations((prev) =>
      prev.map((rec) => {
        if (rec.id === reconciliationId) {
          const updatedDiscrepancies = rec.discrepancies.map((disc) =>
            disc.id === discrepancyId
              ? {
                  ...disc,
                  status: "ignored",
                  resolution: reason,
                  resolvedBy: "Current User", // Would be the logged-in user
                  resolvedAt: new Date().toISOString(),
                }
              : disc,
          )

          // Check if all discrepancies are resolved or ignored
          const allHandled = updatedDiscrepancies.every((disc) => disc.status !== "pending")

          return {
            ...rec,
            discrepancies: updatedDiscrepancies,
            status: allHandled ? "in-progress" : rec.status,
          }
        }
        return rec
      }),
    )

    toast({
      title: "Discrepancy Ignored",
      description: "The discrepancy has been marked as ignored.",
    })
  }

  // Export reconciliation report
  const handleExportReport = (id: string) => {
    const reconciliation = reconciliations.find((rec) => rec.id === id)
    if (!reconciliation) return

    toast({
      title: "Report Exported",
      description: `Reconciliation report for ${reconciliation.bankName} has been exported.`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Float Reconciliation</h1>
        <p className="text-muted-foreground">Reconcile partner bank float balances with system records</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="reconciliations">Reconciliations</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          <Button onClick={() => setShowReconciliationForm(true)}>New Reconciliation</Button>
        </div>

        <TabsContent value="reconciliations" className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks</SelectItem>
                {partnerBanks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
              </PopoverContent>
            </Popover>

            {selectedDate && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(undefined)}>
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ReconciliationTable
            reconciliations={filteredReconciliations}
            onViewDetails={setSelectedReconciliation}
            onApprove={handleApproveReconciliation}
            onReject={handleRejectReconciliation}
            onExport={handleExportReport}
          />
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <ReconciliationSummary reconciliations={reconciliations} banks={partnerBanks} />
        </TabsContent>
      </Tabs>

      {showReconciliationForm && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>New Reconciliation</CardTitle>
            <CardDescription>Reconcile partner bank float balances with system records</CardDescription>
          </CardHeader>
          <CardContent>
            <ReconciliationForm
              banks={partnerBanks}
              onSubmit={handleReconciliationSubmit}
              onCancel={() => setShowReconciliationForm(false)}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      )}

      {selectedReconciliation && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Reconciliation Details</CardTitle>
              <CardDescription>
                {selectedReconciliation.bankName} - {format(new Date(selectedReconciliation.reconciliationDate), "PPP")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedReconciliation.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectReconciliation(selectedReconciliation.id)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => handleApproveReconciliation(selectedReconciliation.id)}>
                    Approve
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => handleExportReport(selectedReconciliation.id)}>
                <FileText className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReconciliation(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">System Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    GHS {selectedReconciliation.systemBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Bank Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    GHS {selectedReconciliation.bankBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Difference</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`text-2xl font-bold ${
                      selectedReconciliation.difference === 0
                        ? "text-green-600"
                        : selectedReconciliation.difference > 0
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    GHS{" "}
                    {Math.abs(selectedReconciliation.difference).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                    {selectedReconciliation.difference !== 0 && (
                      <span className="ml-1 text-sm">
                        ({selectedReconciliation.difference > 0 ? "System > Bank" : "Bank > System"})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-md border">
              <div className="p-4">
                <h3 className="text-lg font-semibold">Reconciliation Status</h3>
                <div className="mt-2 flex items-center">
                  <Badge
                    className={`${
                      selectedReconciliation.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : selectedReconciliation.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : selectedReconciliation.status === "in-progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {selectedReconciliation.status.charAt(0).toUpperCase() + selectedReconciliation.status.slice(1)}
                  </Badge>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {selectedReconciliation.status === "approved" || selectedReconciliation.status === "rejected"
                      ? `by ${selectedReconciliation.approvedBy} on ${format(
                          new Date(selectedReconciliation.approvedAt!),
                          "PPP",
                        )}`
                      : `Created by ${selectedReconciliation.createdBy} on ${format(
                          new Date(selectedReconciliation.createdAt),
                          "PPP",
                        )}`}
                  </span>
                </div>
              </div>

              <div className="border-t p-4">
                <h3 className="text-lg font-semibold">Reconciliation Period</h3>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Start Date:</span>{" "}
                  {format(new Date(selectedReconciliation.startDate), "PPP")}
                </div>
                <div className="mt-1 text-sm">
                  <span className="font-medium">End Date:</span>{" "}
                  {format(new Date(selectedReconciliation.endDate), "PPP")}
                </div>
              </div>

              {selectedReconciliation.notes && (
                <div className="border-t p-4">
                  <h3 className="text-lg font-semibold">Notes</h3>
                  <p className="mt-2 text-sm">{selectedReconciliation.notes}</p>
                </div>
              )}
            </div>

            {selectedReconciliation.discrepancies.length > 0 && (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Discrepancies</h3>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-left font-medium">System Amount</th>
                        <th className="px-4 py-2 text-left font-medium">Bank Amount</th>
                        <th className="px-4 py-2 text-left font-medium">Difference</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                        <th className="px-4 py-2 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReconciliation.discrepancies.map((disc) => (
                        <tr key={disc.id} className="border-b">
                          <td className="px-4 py-2">
                            <Badge
                              variant="outline"
                              className={
                                disc.type === "missing-in-system"
                                  ? "border-red-500 text-red-700"
                                  : disc.type === "missing-in-bank"
                                    ? "border-amber-500 text-amber-700"
                                    : "border-blue-500 text-blue-700"
                              }
                            >
                              {disc.type === "missing-in-system"
                                ? "Missing in System"
                                : disc.type === "missing-in-bank"
                                  ? "Missing in Bank"
                                  : "Amount Mismatch"}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            {disc.transactionDate ? format(new Date(disc.transactionDate), "PPP") : "N/A"}
                          </td>
                          <td className="px-4 py-2">
                            {disc.systemAmount !== undefined
                              ? `GHS ${disc.systemAmount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`
                              : "N/A"}
                          </td>
                          <td className="px-4 py-2">
                            {disc.bankAmount !== undefined
                              ? `GHS ${disc.bankAmount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`
                              : "N/A"}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={
                                disc.difference === 0
                                  ? "text-green-600"
                                  : disc.difference > 0
                                    ? "text-amber-600"
                                    : "text-red-600"
                              }
                            >
                              GHS {Math.abs(disc.difference).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <Badge
                              className={
                                disc.status === "resolved"
                                  ? "bg-green-100 text-green-800"
                                  : disc.status === "ignored"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-yellow-100 text-yellow-800"
                              }
                            >
                              {disc.status.charAt(0).toUpperCase() + disc.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            {disc.status === "pending" ? (
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleResolveDiscrepancy(
                                      selectedReconciliation.id,
                                      disc.id,
                                      "Manually resolved after investigation",
                                    )
                                  }
                                >
                                  Resolve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleIgnoreDiscrepancy(
                                      selectedReconciliation.id,
                                      disc.id,
                                      "Ignored for this reconciliation period",
                                    )
                                  }
                                >
                                  Ignore
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {disc.resolution || "No resolution notes"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              Last updated: {format(new Date(selectedReconciliation.createdAt), "PPP p")}
            </div>
            <Button variant="outline" onClick={() => setSelectedReconciliation(null)}>
              Close
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
