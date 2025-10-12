"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  primaryBranchId?: string
  branchIds?: string[]
  status: string
  createdAt: string
  updatedAt: string
  avatar?: string
  primaryBranchName?: string
}

interface UserStatistics {
  total: number
  active: number
  inactive: number
  admins: number
  managers: number
  cashiers: number
}

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [statistics, setStatistics] = useState<UserStatistics>({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    managers: 0,
    cashiers: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/users?includeStats=true")

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      setUsers(result.data || [])
      setStatistics(
        result.statistics || {
          total: 0,
          active: 0,
          inactive: 0,
          admins: 0,
          managers: 0,
          cashiers: 0,
        },
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch users"
      setError(errorMessage)
      console.error("Error fetching users:", error)

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const createUser = useCallback(
    async (userData: any) => {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create user")
        }

        const result = await response.json()

        toast({
          title: "Success",
          description: result.message || "User created successfully",
        })

        // Refresh data
        await fetchUsers()

        return result.data
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create user"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchUsers, toast],
  )

  const updateUser = useCallback(
    async (id: string, userData: any) => {
      try {
        const response = await fetch(`/api/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update user")
        }

        const result = await response.json()

        toast({
          title: "Success",
          description: result.message || "User updated successfully",
        })

        // Refresh data
        await fetchUsers()

        return result.user
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update user"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchUsers, toast],
  )

  const deleteUser = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/users/${id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to delete user")
        }

        const result = await response.json()

        toast({
          title: "Success",
          description: result.message || "User deleted successfully",
        })

        // Refresh data
        await fetchUsers()

        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to delete user"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchUsers, toast],
  )

  const resetPassword = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/users/${id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generateTemporary: true,
            resetRequired: true,
            notifyUser: true,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to reset password")
        }

        toast({
          title: "Password Reset",
          description: "Password has been reset and user will be notified via email.",
        })

        // Refresh data
        await fetchUsers()

        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to reset password"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        throw error
      }
    },
    [fetchUsers, toast],
  )

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    users,
    statistics,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
  }
}
