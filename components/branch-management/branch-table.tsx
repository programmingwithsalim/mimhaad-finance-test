"use client"

import { useState } from "react"
import { Edit, Trash, ExternalLink, Check, X } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Branch } from "@/hooks/use-branches"

interface BranchTableProps {
  branches: Branch[]
  onEdit: (branch: Branch) => void
  onDelete: (branch: Branch) => void
  onView: (branch: Branch) => void
}

export function BranchTable({ branches, onEdit, onDelete, onView }: BranchTableProps) {
  const [sortField, setSortField] = useState<keyof Branch>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Safety check: ensure branches is always an array
  const safeBranches = Array.isArray(branches) ? branches : []

  console.log("Brancheees", safeBranches)

  const handleSort = (field: keyof Branch) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedBranches = [...safeBranches].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (aValue === null || aValue === undefined) return sortDirection === "asc" ? -1 : 1
    if (bValue === null || bValue === undefined) return sortDirection === "asc" ? 1 : -1

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    // For numbers and other types
    return sortDirection === "asc"
      ? aValue < bValue
        ? -1
        : aValue > bValue
          ? 1
          : 0
      : bValue < aValue
        ? -1
        : bValue > aValue
          ? 1
          : 0
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
              Branch Name {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("code")}>
              Code {sortField === "code" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("location")}>
              Location {sortField === "location" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("region")}>
              Region {sortField === "region" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("manager")}>
              Manager {sortField === "manager" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("staff_count")}>
              Staff {sortField === "staff_count" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
              Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBranches.length > 0 ? (
            sortedBranches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>{branch.code}</TableCell>
                <TableCell>{branch.location}</TableCell>
                <TableCell>{branch.region}</TableCell>
                <TableCell>{branch.manager}</TableCell>
                <TableCell>{branch.staff_count || 0}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`flex items-center gap-1 ${
                      branch.status === "active"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}
                  >
                    {branch.status === "active" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {branch.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onView(branch)} title="View Details">
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">View Details</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(branch)} title="Edit Branch">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(branch)}
                      className="text-destructive hover:text-destructive"
                      title="Delete Branch"
                    >
                      <Trash className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center">
                No branches found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
