"use client"

import { format } from "date-fns"
import { FileText, CheckCircle, XCircle, AlertTriangle, ChevronDown, Eye } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ReconciliationItem } from "./reconciliation-dashboard"

interface ReconciliationTableProps {
  reconciliations: ReconciliationItem[]
  onViewDetails: (reconciliation: ReconciliationItem) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onExport: (id: string) => void
}

export function ReconciliationTable({
  reconciliations,
  onViewDetails,
  onApprove,
  onReject,
  onExport,
}: ReconciliationTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bank</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>System Balance</TableHead>
            <TableHead>Bank Balance</TableHead>
            <TableHead>Difference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reconciliations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center">
                No reconciliations found.
              </TableCell>
            </TableRow>
          ) : (
            reconciliations.map((reconciliation) => (
              <TableRow key={reconciliation.id}>
                <TableCell>
                  <div className="font-medium">{reconciliation.bankName}</div>
                  <div className="text-xs text-muted-foreground">{reconciliation.bankCode}</div>
                </TableCell>
                <TableCell>{format(new Date(reconciliation.reconciliationDate), "MMM d, yyyy")}</TableCell>
                <TableCell>
                  <div className="text-xs">
                    {format(new Date(reconciliation.startDate), "MMM d")} -{" "}
                    {format(new Date(reconciliation.endDate), "MMM d, yyyy")}
                  </div>
                </TableCell>
                <TableCell>
                  GHS {reconciliation.systemBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  GHS {reconciliation.bankBalance.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <div
                    className={`flex items-center ${
                      reconciliation.difference === 0
                        ? "text-green-600"
                        : reconciliation.difference > 0
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {reconciliation.difference === 0 ? (
                      <CheckCircle className="mr-1 h-4 w-4" />
                    ) : (
                      <AlertTriangle className="mr-1 h-4 w-4" />
                    )}
                    GHS {Math.abs(reconciliation.difference).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${
                      reconciliation.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : reconciliation.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : reconciliation.status === "in-progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {reconciliation.status.charAt(0).toUpperCase() + reconciliation.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(reconciliation)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {reconciliation.status === "pending" && (
                        <>
                          <DropdownMenuItem onClick={() => onApprove(reconciliation.id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onReject(reconciliation.id)}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem onClick={() => onExport(reconciliation.id)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export Report
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
