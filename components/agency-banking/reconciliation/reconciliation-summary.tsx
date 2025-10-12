"use client"

import { useMemo } from "react"
import { format, subDays } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ReconciliationItem } from "./reconciliation-dashboard"

interface ReconciliationSummaryProps {
  reconciliations: ReconciliationItem[]
  banks: { id: string; name: string; code: string }[]
}

export function ReconciliationSummary({ reconciliations, banks }: ReconciliationSummaryProps) {
  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalReconciliations = reconciliations.length
    const approvedReconciliations = reconciliations.filter((rec) => rec.status === "approved").length
    const pendingReconciliations = reconciliations.filter((rec) => rec.status === "pending").length
    const inProgressReconciliations = reconciliations.filter((rec) => rec.status === "in-progress").length
    const rejectedReconciliations = reconciliations.filter((rec) => rec.status === "rejected").length

    const totalDiscrepancies = reconciliations.reduce((sum, rec) => sum + rec.discrepancies.length, 0)
    const resolvedDiscrepancies = reconciliations.reduce(
      (sum, rec) => sum + rec.discrepancies.filter((disc) => disc.status === "resolved").length,
      0,
    )
    const pendingDiscrepancies = reconciliations.reduce(
      (sum, rec) => sum + rec.discrepancies.filter((disc) => disc.status === "pending").length,
      0,
    )
    const ignoredDiscrepancies = reconciliations.reduce(
      (sum, rec) => sum + rec.discrepancies.filter((disc) => disc.status === "ignored").length,
      0,
    )

    // Calculate total difference amount
    const totalDifference = reconciliations.reduce((sum, rec) => sum + Math.abs(rec.difference), 0)

    // Calculate bank-specific stats
    const bankStats = banks.map((bank) => {
      const bankReconciliations = reconciliations.filter((rec) => rec.bankId === bank.id)
      const lastReconciliation = bankReconciliations.sort(
        (a, b) => new Date(b.reconciliationDate).getTime() - new Date(a.reconciliationDate).getTime(),
      )[0]
      const totalDifference = bankReconciliations.reduce((sum, rec) => sum + Math.abs(rec.difference), 0)
      const averageDifference = bankReconciliations.length > 0 ? totalDifference / bankReconciliations.length : 0

      return {
        bankId: bank.id,
        bankName: bank.name,
        bankCode: bank.code,
        reconciliationCount: bankReconciliations.length,
        lastReconciliationDate: lastReconciliation?.reconciliationDate,
        lastReconciliationStatus: lastReconciliation?.status,
        totalDifference,
        averageDifference,
      }
    })

    return {
      totalReconciliations,
      approvedReconciliations,
      pendingReconciliations,
      inProgressReconciliations,
      rejectedReconciliations,
      totalDiscrepancies,
      resolvedDiscrepancies,
      pendingDiscrepancies,
      ignoredDiscrepancies,
      totalDifference,
      bankStats,
    }
  }, [reconciliations, banks])

  // Get recent reconciliations (last 30 days)
  const recentReconciliations = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30)
    return reconciliations.filter((rec) => new Date(rec.reconciliationDate).getTime() >= thirtyDaysAgo.getTime()).length
  }, [reconciliations])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reconciliations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReconciliations}</div>
            <p className="text-xs text-muted-foreground">{recentReconciliations} in the last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Reconciliations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReconciliations}</div>
            <p className="text-xs text-muted-foreground">Require review and approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Discrepancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDiscrepancies}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingDiscrepancies} pending, {stats.resolvedDiscrepancies} resolved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              GHS {stats.totalDifference.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Cumulative absolute difference</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Status</CardTitle>
          <CardDescription>Overview of reconciliation statuses across all banks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div className="flex items-center">
              <div className="mr-4 flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
                <div className="h-2 w-2 rounded-full bg-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Approved</div>
                  <div className="text-sm font-medium">{stats.approvedReconciliations}</div>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-green-600"
                    style={{
                      width: `${
                        stats.totalReconciliations > 0
                          ? (stats.approvedReconciliations / stats.totalReconciliations) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="mr-4 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100">
                <div className="h-2 w-2 rounded-full bg-yellow-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Pending</div>
                  <div className="text-sm font-medium">{stats.pendingReconciliations}</div>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-yellow-600"
                    style={{
                      width: `${
                        stats.totalReconciliations > 0
                          ? (stats.pendingReconciliations / stats.totalReconciliations) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="mr-4 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
                <div className="h-2 w-2 rounded-full bg-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">In Progress</div>
                  <div className="text-sm font-medium">{stats.inProgressReconciliations}</div>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{
                      width: `${
                        stats.totalReconciliations > 0
                          ? (stats.inProgressReconciliations / stats.totalReconciliations) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="mr-4 flex h-5 w-5 items-center justify-center rounded-full bg-red-100">
                <div className="h-2 w-2 rounded-full bg-red-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Rejected</div>
                  <div className="text-sm font-medium">{stats.rejectedReconciliations}</div>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-red-600"
                    style={{
                      width: `${
                        stats.totalReconciliations > 0
                          ? (stats.rejectedReconciliations / stats.totalReconciliations) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bank Reconciliation Summary</CardTitle>
          <CardDescription>Reconciliation statistics by partner bank</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Bank</th>
                  <th className="px-4 py-2 text-left font-medium">Reconciliations</th>
                  <th className="px-4 py-2 text-left font-medium">Last Reconciliation</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Avg. Difference</th>
                </tr>
              </thead>
              <tbody>
                {stats.bankStats.map((bank) => (
                  <tr key={bank.bankId} className="border-b">
                    <td className="px-4 py-2">
                      <div className="font-medium">{bank.bankName}</div>
                      <div className="text-xs text-muted-foreground">{bank.bankCode}</div>
                    </td>
                    <td className="px-4 py-2">{bank.reconciliationCount}</td>
                    <td className="px-4 py-2">
                      {bank.lastReconciliationDate
                        ? format(new Date(bank.lastReconciliationDate), "MMM d, yyyy")
                        : "Never"}
                    </td>
                    <td className="px-4 py-2">
                      {bank.lastReconciliationStatus ? (
                        <Badge
                          className={`${
                            bank.lastReconciliationStatus === "approved"
                              ? "bg-green-100 text-green-800"
                              : bank.lastReconciliationStatus === "rejected"
                                ? "bg-red-100 text-red-800"
                                : bank.lastReconciliationStatus === "in-progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {bank.lastReconciliationStatus.charAt(0).toUpperCase() +
                            bank.lastReconciliationStatus.slice(1)}
                        </Badge>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {bank.reconciliationCount > 0
                        ? `GHS ${bank.averageDifference.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
