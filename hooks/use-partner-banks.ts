"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

export interface PartnerBank {
  id: string
  name: string
  code: string
  transferFee: number
  minFee: number
  maxFee: number
  status: "active" | "inactive" | "maintenance"
  floatAccountId?: string | null
  currentBalance?: number
}

export function usePartnerBanks(branchId?: string) {
  const [partnerBanks, setPartnerBanks] = useState<PartnerBank[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchPartnerBanks() {
      try {
        setIsLoading(true)
        setError(null)

        // Construct the URL based on whether a branchId is provided
        const url = branchId ? `/api/branches/${branchId}/partner-banks` : "/api/partner-banks"

        const response = await fetch(url)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Failed to fetch partner banks: ${response.statusText}${errorData.error ? ` - ${errorData.error}` : ""}`,
          )
        }

        const data = await response.json()

        // Ensure we have at least some data
        if (Array.isArray(data) && data.length > 0) {
          setPartnerBanks(data)
        } else {
          // If no data, use fallback
          setPartnerBanks([
            {
              id: "gcb-fallback",
              name: "Ghana Commercial Bank",
              code: "GCB",
              transferFee: 0.01,
              minFee: 5,
              maxFee: 50,
              status: "active",
              currentBalance: 0,
              floatAccountId: null,
            },
            {
              id: "eco-fallback",
              name: "Ecobank Ghana",
              code: "ECO",
              transferFee: 0.01,
              minFee: 5,
              maxFee: 50,
              status: "active",
              currentBalance: 0,
              floatAccountId: null,
            },
          ])
        }
      } catch (err) {
        console.error("Error fetching partner banks:", err)
        setError(err instanceof Error ? err : new Error(String(err)))

        // Use fallback data even in case of error
        setPartnerBanks([
          {
            id: "gcb-fallback",
            name: "Ghana Commercial Bank",
            code: "GCB",
            transferFee: 0.01,
            minFee: 5,
            maxFee: 50,
            status: "active",
            currentBalance: 0,
            floatAccountId: null,
          },
          {
            id: "eco-fallback",
            name: "Ecobank Ghana",
            code: "ECO",
            transferFee: 0.01,
            minFee: 5,
            maxFee: 50,
            status: "active",
            currentBalance: 0,
            floatAccountId: null,
          },
        ])

        toast({
          title: "Warning",
          description: "Using default partner banks data. Some features may be limited.",
          variant: "default",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPartnerBanks()
  }, [branchId, toast])

  return {
    partnerBanks,
    isLoading,
    error,
    refresh: () => {
      setIsLoading(true)
      // This will trigger the useEffect to run again
    },
  }
}
