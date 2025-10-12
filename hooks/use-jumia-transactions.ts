"use client"

import { useState, useEffect, useCallback } from "react"
import type { JumiaTransaction, JumiaStatistics } from "@/lib/jumia-service"

interface UseJumiaTransactionsProps {
  branchId: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseJumiaTransactionsReturn {
  transactions: JumiaTransaction[]
  statistics: JumiaStatistics & { current_liability: number }
  loading: boolean
  error: string | null
  createTransaction: (
    transaction: Omit<JumiaTransaction, "id" | "transaction_id" | "created_at" | "updated_at">,
  ) => Promise<JumiaTransaction>
  updateTransaction: (transactionId: string, updateData: Partial<JumiaTransaction>) => Promise<JumiaTransaction>
  deleteTransaction: (transactionId: string) => Promise<void>
  getTransaction: (transactionId: string) => Promise<JumiaTransaction>
  refreshData: () => Promise<void>
  initializeDatabase: () => Promise<void>
}

export function useJumiaTransactions({
  branchId,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseJumiaTransactionsProps): UseJumiaTransactionsReturn {
  const [transactions, setTransactions] = useState<JumiaTransaction[]>([])
  const [statistics, setStatistics] = useState<JumiaStatistics & { current_liability: number }>({
    total_packages: 0,
    packages_collected: 0,
    total_pod_amount: 0,
    unsettled_amount: 0,
    total_settlements: 0,
    current_liability: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializeDatabase = useCallback(async () => {
    try {
      const response = await fetch("/api/db/init-jumia", {
        method: "POST",
      })
      const result = await response.json()

      if (result.success) {
        console.log("Jumia database initialized successfully")
        await refreshData()
      } else {
        throw new Error(result.error || "Failed to initialize database")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("Database initialization error:", errorMessage)
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await fetch(`/api/jumia/transactions?branchId=${branchId}&limit=50`)
      const result = await response.json()

      console.log("Fetch transactions response:", result)

      if (result.success) {
        setTransactions(result.data)
        setError(null)
      } else {
        // If database tables don't exist, suggest initialization
        if (result.details && result.details.includes("not found")) {
          setError("Database not initialized. Please initialize the Jumia database first.")
        } else {
          setError(result.error || "Failed to fetch transactions")
        }
      }
    } catch (err) {
      console.error("Error fetching transactions:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [branchId])

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch(`/api/jumia/statistics?branchId=${branchId}`)
      const result = await response.json()

      console.log("Fetch statistics response:", result)

      if (result.success) {
        setStatistics(result.data)
        setError(null)
      } else {
        if (result.details && result.details.includes("not found")) {
          setError("Database not initialized. Please initialize the Jumia database first.")
        } else {
          setError(result.error || "Failed to fetch statistics")
        }
      }
    } catch (err) {
      console.error("Error fetching statistics:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }, [branchId])

  const refreshData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchTransactions(), fetchStatistics()])
    setLoading(false)
  }, [fetchTransactions, fetchStatistics])

  const createTransaction = useCallback(
    async (transaction: Omit<JumiaTransaction, "id" | "transaction_id" | "created_at" | "updated_at">) => {
      try {
        const response = await fetch("/api/jumia/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...transaction,
            branch_id: branchId,
          }),
        })

        const result = await response.json()

        if (result.success) {
          await refreshData()
          return result.data
        } else {
          throw new Error(result.error || "Failed to create transaction")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    },
    [branchId, refreshData],
  )

  const updateTransaction = useCallback(
    async (transactionId: string, updateData: Partial<JumiaTransaction>) => {
      try {
        console.log("Making PUT request to update transaction:", transactionId, updateData)

        const response = await fetch(`/api/jumia/transactions/${transactionId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        })

        const result = await response.json()

        if (result.success) {
          await refreshData()
          return result.data
        } else {
          throw new Error(result.error || "Failed to update transaction")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        console.error("Update transaction error:", errorMessage)
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    },
    [refreshData],
  )

  const deleteTransaction = useCallback(
    async (transactionId: string) => {
      try {
        console.log("Making DELETE request for transaction:", transactionId)

        const response = await fetch(`/api/jumia/transactions/${transactionId}`, {
          method: "DELETE",
        })

        const result = await response.json()

        if (result.success) {
          await refreshData()
        } else {
          throw new Error(result.error || "Failed to delete transaction")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        console.error("Delete transaction error:", errorMessage)
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    },
    [refreshData],
  )

  const getTransaction = useCallback(async (transactionId: string) => {
    try {
      const response = await fetch(`/api/jumia/transactions/${transactionId}`)
      const result = await response.json()

      if (result.success) {
        return result.data
      } else {
        throw new Error(result.error || "Failed to get transaction")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  // Initial data fetch
  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(refreshData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, refreshData])

  return {
    transactions,
    statistics,
    loading,
    error,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getTransaction,
    refreshData,
    initializeDatabase,
  }
}
