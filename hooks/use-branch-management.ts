"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

interface Branch {
  id: string
  name: string
  code: string
  location: string
  region: string
  manager: string
  contact_phone?: string
  email?: string
  staff_count?: number
  status: "active" | "inactive"
  address?: string
  phone?: string
  created_at: string
  updated_at: string
}

interface BranchStatistics {
  total: number
  active: number
  inactive: number
  regions: number
  totalStaff: number
}

export function useBranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [statistics, setStatistics] = useState<BranchStatistics>({
    total: 0,
    active: 0,
    inactive: 0,
    regions: 0,
    totalStaff: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchBranches = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [branchesResponse, statsResponse] = await Promise.all([
        fetch("/api/branches"),
        fetch("/api/branches/statistics"),
      ])

      if (!branchesResponse.ok) {
        throw new Error(`Failed to fetch branches: ${branchesResponse.statusText}`)
      }

      const branchesData = await branchesResponse.json()
      setBranches(Array.isArray(branchesData) ? branchesData : [])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStatistics(
          statsData.data || {
            total: 0,
            active: 0,
            inactive: 0,
            regions: 0,
            totalStaff: 0,
          },
        )
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch branches"
      setError(errorMessage)
      console.error("Error fetching branches:", error)

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const createBranch = useCallback(
    async (branchData: any) => {
      try {
        const response = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(branchData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create branch")
        }

        const result = await response.json()

        toast({
          title: "Success",
          description: `Branch "${branchData.name}" created successfully`,
        })

        // Refresh data
        await fetchBranches()

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create branch"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchBranches, toast],
  )

  const updateBranch = useCallback(
    async (id: string, branchData: any) => {
      try {
        const response = await fetch(`/api/branches/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(branchData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update branch")
        }

        const result = await response.json()

        toast({
          title: "Success",
          description: `Branch "${branchData.name}" updated successfully`,
        })

        // Refresh data
        await fetchBranches()

        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update branch"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchBranches, toast],
  )

  const deleteBranch = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/branches/${id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to delete branch")
        }

        toast({
          title: "Success",
          description: "Branch deleted successfully",
        })

        // Refresh data
        await fetchBranches()

        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete branch"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchBranches, toast],
  )

  const searchBranches = useCallback(
    async (query: string) => {
      try {
        if (!query.trim()) {
          await fetchBranches()
          return
        }

        const response = await fetch(`/api/branches/search?q=${encodeURIComponent(query)}`)

        if (!response.ok) {
          throw new Error("Failed to search branches")
        }

        const results = await response.json()
        setBranches(Array.isArray(results) ? results : [])

        if (results.length === 0) {
          toast({
            title: "No Results",
            description: `No branches found matching "${query}"`,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to search branches"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    },
    [fetchBranches, toast],
  )

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  return {
    branches,
    statistics,
    isLoading,
    error,
    fetchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
    searchBranches,
  }
}
