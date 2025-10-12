"use client"

import { useState, useEffect, useCallback } from "react"

interface PowerTransaction {
  id: string
  type: "sale" | "purchase"
  meterNumber: string
  provider: "ecg" | "nedco"
  amount: number
  commission: number
  customerName?: string
  customerPhone?: string
  status: "pending" | "completed" | "failed"
  branchId: string
  userId: string
  createdAt: string
  reference: string
  metadata?: {
    tokenNumber?: string
    units?: string
  }
}

interface PowerStatistics {
  todayTransactions: number
  todayVolume: number
  todayCommission: number
  monthlyTransactions: number
  monthlyVolume: number
  monthlyCommission: number
}

export function usePowerTransactions(branchId?: string) {
  const [transactions, setTransactions] = useState<PowerTransaction[]>([])
  const [statistics, setStatistics] = useState<PowerStatistics>({
    todayTransactions: 0,
    todayVolume: 0,
    todayCommission: 0,
    monthlyTransactions: 0,
    monthlyVolume: 0,
    monthlyCommission: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (branchId) params.append("branchId", branchId)

      const response = await fetch(`/api/power/transactions?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch power transactions")
      }

      const data = await response.json()
      setTransactions(data.transactions)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [branchId])

  const fetchStatistics = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (branchId) params.append("branchId", branchId)

      const response = await fetch(`/api/power/statistics?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch power statistics")
      }

      const data = await response.json()
      setStatistics(data.statistics)
    } catch (err) {
      console.error("Error fetching power statistics:", err)
    }
  }, [branchId])

  const createSale = useCallback(
    async (saleData: {
      meterNumber: string
      provider: "ecg" | "nedco"
      amount: number
      commission: number
      customerName?: string
      customerPhone?: string
      branchId: string
      userId: string
    }) => {
      try {
        const response = await fetch("/api/power/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(saleData),
        })

        if (!response.ok) {
          throw new Error("Failed to create power sale")
        }

        const data = await response.json()

        // Refresh data
        await Promise.all([fetchTransactions(), fetchStatistics()])

        return data.transaction
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Failed to create sale")
      }
    },
    [fetchTransactions, fetchStatistics],
  )

  useEffect(() => {
    fetchTransactions()
    fetchStatistics()
  }, [fetchTransactions, fetchStatistics])

  const refetch = useCallback(() => {
    fetchTransactions()
    fetchStatistics()
  }, [fetchTransactions, fetchStatistics])

  return {
    transactions,
    statistics,
    loading,
    error,
    createSale,
    refetch,
  }
}
