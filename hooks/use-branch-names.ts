"use client"

import { useState, useEffect } from "react"

interface Branch {
  id: string
  name: string
  code?: string
}

export function useBranchNames() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBranches()
  }, [])

  const fetchBranches = async () => {
    try {
      const response = await fetch("/api/branches")
      if (response.ok) {
        const data = await response.json()

        // Handle different response formats
        let branchesArray: Branch[] = []
        if (Array.isArray(data)) {
          branchesArray = data
        } else if (data?.data && Array.isArray(data.data)) {
          branchesArray = data.data
        } else if (data?.rows && Array.isArray(data.rows)) {
          branchesArray = data.rows
        }

        setBranches(branchesArray)
      }
    } catch (error) {
      console.error("Error fetching branches:", error)
      setBranches([])
    } finally {
      setLoading(false)
    }
  }

  const getBranchName = (branchId: string): string => {
    if (!branchId) return "Unknown Branch"

    const branch = branches.find((b) => b.id === branchId)
    return branch?.name || `Branch ${branchId.slice(0, 8)}`
  }

  return {
    branches,
    loading,
    getBranchName,
    refetch: fetchBranches,
  }
}
