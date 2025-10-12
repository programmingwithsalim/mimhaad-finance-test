"use client"

import { useState, useEffect } from "react"
import { useCurrentUser } from "./use-current-user"

interface TransactionStats {
  todayTransactions: number
  todayVolume: number
  todayFees: number
  weeklyTransactions: number
  weeklyVolume: number
  monthlyTransactions: number
  monthlyVolume: number
}

export function useBranchTransactions(service: string) {
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState<TransactionStats>({
    todayTransactions: 0,
    todayVolume: 0,
    todayFees: 0,
    weeklyTransactions: 0,
    weeklyVolume: 0,
    monthlyTransactions: 0,
    monthlyVolume: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useCurrentUser()

  const fetchTransactionStats = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/${service}/statistics?branchId=${user.branchId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch ${service} statistics`)
      }

      const data = await response.json()

      if (data.success) {
        setStats({
          todayTransactions: data.data?.totalTransactions || 0,
          todayVolume: data.data?.totalVolume || 0,
          todayFees: data.data?.totalCommission || 0,
          weeklyTransactions: data.data?.weeklyTransactions || 0,
          weeklyVolume: data.data?.weeklyVolume || 0,
          monthlyTransactions: data.data?.monthlyTransactions || 0,
          monthlyVolume: data.data?.monthlyVolume || 0,
        })
      } else {
        throw new Error(data.error || "Failed to fetch statistics")
      }
    } catch (err) {
      console.error(`Error fetching ${service} transaction stats:`, err)
      setError(err instanceof Error ? err.message : "Unknown error")
      // Keep default stats on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactionStats()
  }, [service, user])

  return {
    transactions,
    stats,
    loading,
    error,
    refetch: fetchTransactionStats,
  }
}
