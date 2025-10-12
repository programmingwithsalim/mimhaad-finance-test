"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCurrentUser } from "./use-current-user"

interface Transaction {
  id: string
  type: string
  service_type: string
  amount: number
  fee: number
  status: string
  customer_name?: string
  phone_number?: string
  reference?: string
  created_at: string
  updated_at: string
  branch_id: string
  processed_by?: string
}

interface UseRealtimeTransactionsProps {
  branchId?: string
  serviceType?: string
  status?: string
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useRealtimeTransactions({
  branchId,
  serviceType,
  status,
  limit = 50,
  autoRefresh = true,
  refreshInterval = 5000, // 5 seconds
}: UseRealtimeTransactionsProps = {}) {
  const { user } = useCurrentUser()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Get branch ID from user if not provided
  const effectiveBranchId = branchId || user?.branchId

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    if (!effectiveBranchId) {
      setTransactions([])
      setLoading(false)
      return
    }

    try {
      // Cancel previous request if it's still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()

      const params = new URLSearchParams({
        branchId: effectiveBranchId,
        limit: limit.toString(),
        ...(serviceType && { serviceType }),
        ...(status && { status }),
      })

      const response = await fetch(`/api/transactions/realtime?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setTransactions(data.transactions || [])
        setError(null)
        setLastUpdate(new Date())
      } else {
        throw new Error(data.error || "Failed to fetch transactions")
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Request was cancelled, don't update error state
        return
      }
      
      console.error("Error fetching transactions:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch transactions")
      
      // Don't clear transactions on error, keep the previous ones
      if (!isRefresh) {
        setTransactions([])
      }
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [effectiveBranchId, serviceType, status, limit])

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    await fetchTransactions(true)
  }, [fetchTransactions])

  // Set up auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || !effectiveBranchId) {
      return
    }

    // Initial fetch
    fetchTransactions()

    // Set up interval for auto-refresh
    intervalRef.current = setInterval(() => {
      fetchTransactions(true)
    }, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [autoRefresh, effectiveBranchId, refreshInterval, fetchTransactions])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Update transaction status (for loading indicators)
  const updateTransactionStatus = useCallback((transactionId: string, status: string) => {
    setTransactions(prev => 
      prev.map(tx => 
        tx.id === transactionId 
          ? { ...tx, status, updated_at: new Date().toISOString() }
          : tx
      )
    )
  }, [])

  // Add new transaction to the list
  const addTransaction = useCallback((transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev.slice(0, limit - 1)])
  }, [limit])

  // Remove transaction from the list
  const removeTransaction = useCallback((transactionId: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== transactionId))
  }, [])

  return {
    transactions,
    loading,
    error,
    lastUpdate,
    isRefreshing,
    refresh,
    updateTransactionStatus,
    addTransaction,
    removeTransaction,
  }
} 