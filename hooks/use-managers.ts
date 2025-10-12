"use client"

import { useState, useEffect } from "react"

export interface Manager {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email?: string
  role: string
  branchId?: string
  status: string
}

export function useManagers() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchManagers = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/users/managers")

      if (!response.ok) {
        throw new Error(`Failed to fetch managers: ${response.status}`)
      }

      const data = await response.json()
      console.log("Managers data received:", data)

      // Handle different response formats
      const managersData = Array.isArray(data) ? data : data.managers || data.users || []

      setManagers(managersData)
    } catch (error) {
      console.error("Error fetching managers:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch managers")

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchManagers()
  }, [])

  return {
    managers,
    loading,
    error,
    refetch: fetchManagers,
  }
}
