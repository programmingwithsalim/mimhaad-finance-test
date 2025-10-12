"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface CashTillTransaction {
  id: string
  branchId: string
  amount: number
  transactionType: string
  timestamp: string
  notes?: string
  performedBy?: string
  previousBalance?: number
  newBalance?: number
  serviceModule?: string
}

interface UseCashTillProps {
  branchId?: string
  serviceModule?: string
  userId?: string
}

export function useCashTill(props?: UseCashTillProps) {
  // Default values if props are not provided
  const branchId = props?.branchId || "default-branch"
  const serviceModule = props?.serviceModule || "general"
  const userId = props?.userId || "default-user"

  const [cashBalance, setCashBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<CashTillTransaction[]>([])
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [cashFloatAccount, setCashFloatAccount] = useState<any>(null)

  // Use a ref to track if this is the first render
  const isFirstRender = useRef(true)

  // Fetch cash till balance
  const fetchCashTillBalance = useCallback(async () => {
    if (!branchId) {
      setCashBalance(null)
      setIsLoading(false)
      setError("No branch ID provided")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("Fetching cash till balance for branch:", branchId, "service:", serviceModule)

      // First, try to get the cash-in-till account directly
      const accountResponse = await fetch(`/api/branches/${branchId}/cash-in-till`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (accountResponse.ok) {
        const accountData = await accountResponse.json()
        if (accountData.account) {
          console.log("Found cash-in-till account:", accountData.account)
          setCashFloatAccount(accountData.account)
          setCashBalance(accountData.account.current_balance || 0)
          console.log("Cash till balance from account:", accountData.account.current_balance)
          return
        }
      } else {
        // Handle 404 or other errors
        const errorData = await accountResponse.json()
        throw new Error(errorData.message || errorData.error || "Cash-in-till account not found")
      }

      // Fallback: try the float-accounts API
      const accountsResponse = await fetch(`/api/float-accounts?branchId=${branchId}&accountType=cash-in-till`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json()

        // Check if we have a cash-in-till account
        if (Array.isArray(accountsData.floatAccounts) && accountsData.floatAccounts.length > 0) {
          // Use the current balance from the account
          const account = accountsData.floatAccounts[0]
          console.log("Found cash-in-till account via float-accounts:", account)
          setCashFloatAccount(account)
          setCashBalance(account.currentBalance || 0)
          console.log("Cash till balance from account:", account.currentBalance)
        } else {
          console.log("No cash-in-till account found")
          setCashBalance(null)
          setCashFloatAccount(null)
          setError("No cash-in-till account found for this branch")
        }
      } else {
        console.log("Float accounts API failed")
        setCashBalance(null)
        setCashFloatAccount(null)
        setError("Failed to fetch cash-in-till account")
      }
    } catch (err) {
      console.error("Error fetching cash till balance:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch cash till balance")
      setCashBalance(null)
      setCashFloatAccount(null)
    } finally {
      setIsLoading(false)
    }
  }, [branchId, serviceModule])

  // Fetch cash till transactions
  const fetchCashTillTransactions = useCallback(async () => {
    if (!branchId) {
      setTransactions([])
      return
    }

    try {
      // Build the query parameters
      const params = new URLSearchParams()
      params.append("branchId", branchId)
      params.append("limit", "10")
      if (serviceModule) {
        params.append("serviceModule", serviceModule)
      }

      // Fetch the cash transactions
      const response = await fetch(`/api/cash-transactions?${params.toString()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
      } else {
        console.log("Cash transactions API failed, using empty array")
        setTransactions([])
      }
    } catch (err) {
      console.error("Error fetching cash transactions:", err)
      // Don't clear transactions on error, keep the previous ones
      setTransactions([])
    }
  }, [branchId, serviceModule])

  // Update local balance immediately for real-time feedback
  const updateLocalBalance = useCallback((amount: number) => {
    setCashBalance((prevBalance) => (prevBalance !== null ? prevBalance + amount : null))
  }, [])

  // Refresh data
  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  // Process a cash transaction
  const processCashTransaction = useCallback(
    async (amount: number, transactionType: string, notes: string) => {
      try {
        if (!cashFloatAccount) {
          throw new Error("Cash in till account not found")
        }

        // Update local balance immediately for better UX
        updateLocalBalance(amount)

        // Try to update the float account balance
        try {
          const floatResponse = await fetch("/api/float-transactions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              toAccountId: cashFloatAccount.id,
              type: amount > 0 ? "allocation" : "return",
              amount: Math.abs(amount),
              reference: `CASH-${transactionType}-${Date.now()}`,
              description: notes,
              branchId,
              userId,
            }),
          })

          if (floatResponse.ok) {
            const floatData = await floatResponse.json()
            setCashBalance(floatData.newBalance || (cashBalance !== null ? cashBalance + amount : null))
          }
        } catch (floatError) {
          console.error("Float transaction failed, continuing with local update:", floatError)
        }

        // Also record in cash transactions for backward compatibility
        try {
          await fetch("/api/cash-transactions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              branchId,
              amount,
              transactionType,
              notes,
              performedBy: userId,
              serviceModule,
            }),
          })
        } catch (cashError) {
          console.error("Cash transaction recording failed:", cashError)
        }

        // Refresh transactions
        fetchCashTillTransactions()

        return true
      } catch (err) {
        console.error("Error processing cash transaction:", err)
        setError(err instanceof Error ? err.message : "Failed to process cash transaction")
        return false
      }
    },
    [branchId, cashBalance, cashFloatAccount, fetchCashTillTransactions, serviceModule, userId, updateLocalBalance],
  )

  // Fetch cash till balance and transactions on mount and when dependencies change
  useEffect(() => {
    // Only fetch data on the first render or when refreshTrigger changes
    if (isFirstRender.current || refreshTrigger > 0) {
      fetchCashTillBalance()
      fetchCashTillTransactions()
      isFirstRender.current = false
    }
  }, [fetchCashTillBalance, fetchCashTillTransactions, refreshTrigger])

  // Simple cash management functions for client-side use
  const [denominations, setDenominations] = useState({
    "200": 0,
    "100": 0,
    "50": 0,
    "20": 0,
    "10": 0,
    "5": 0,
    "2": 0,
    "1": 0,
    "0.5": 0,
    "0.2": 0,
    "0.1": 0,
  })

  const addCash = useCallback((amount: number) => {
    setCashBalance((prev) => (prev !== null ? prev + amount : amount))
  }, [])

  const removeCash = useCallback((amount: number) => {
    setCashBalance((prev) => (prev !== null ? Math.max(0, prev - amount) : 0))
  }, [])

  const calculateTotal = useCallback(() => {
    return cashBalance !== null ? cashBalance : 0
  }, [cashBalance])

  return {
    cashBalance,
    isLoading,
    error,
    transactions,
    processCashTransaction,
    updateLocalBalance,
    refetch,
    // Simple cash management functions
    denominations,
    setDenominations,
    addCash,
    removeCash,
    calculateTotal,
    cashFloatAccount,
  }
}
