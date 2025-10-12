"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Filter } from "lucide-react"

interface CommissionFiltersProps {
  onFiltersChange: (filters: any) => void
}

export function CommissionFilters({ onFiltersChange }: CommissionFiltersProps) {
  const [filters, setFilters] = useState({
    source: "all",
    status: "all",
    startDate: "",
    endDate: "",
    search: "",
  })

  const [activeFilters, setActiveFilters] = useState<string[]>([])

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)

    // Update active filters
    const active = Object.entries(newFilters)
      .filter(([_, v]) => v !== "")
      .map(([k, _]) => k)
    setActiveFilters(active)

    // Apply filters - convert to array format for backend compatibility
    const filterForBackend = {
      ...newFilters,
      source: newFilters.source ? [newFilters.source] : [],
      status: newFilters.status ? [newFilters.status] : [],
    }

    onFiltersChange(filterForBackend)
  }

  const clearFilter = (key: string) => {
    handleFilterChange(key, "")
  }

  const clearAllFilters = () => {
    const emptyFilters = {
      source: "all",
      status: "all",
      startDate: "",
      endDate: "",
      search: "",
    }
    setFilters(emptyFilters)
    setActiveFilters([])

    // Send empty arrays for backend
    onFiltersChange({
      source: [],
      status: [],
      startDate: "",
      endDate: "",
      search: "",
    })
  }

  const getFilterLabel = (key: string) => {
    const labels: Record<string, string> = {
      source: "Source",
      status: "Status",
      startDate: "Start Date",
      endDate: "End Date",
      search: "Search",
    }
    return labels[key] || key
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          {activeFilters.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search commissions..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select value={filters.source} onValueChange={(value) => handleFilterChange("source", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="mtn">MTN</SelectItem>
                <SelectItem value="vodafone">Vodafone</SelectItem>
                <SelectItem value="airtel-tigo">AirtelTigo</SelectItem>
                <SelectItem value="jumia">Jumia</SelectItem>
                <SelectItem value="vra">VRA</SelectItem>
                <SelectItem value="agency-banking">Agency Banking</SelectItem>
                <SelectItem value="power">Power Services</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {activeFilters.map((key) => (
              <Badge key={key} variant="secondary" className="flex items-center gap-1">
                {getFilterLabel(key)}: {filters[key as keyof typeof filters]}
                <Button variant="ghost" size="sm" className="h-auto p-0 ml-1" onClick={() => clearFilter(key)}>
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
