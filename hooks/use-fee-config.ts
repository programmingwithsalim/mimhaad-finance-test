"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface FeeConfig {
  id?: number
  service_type: string
  transaction_type: string
  fee_type: "percentage" | "fixed"
  fee_value: number
  minimum_fee: number
  maximum_fee: number
  currency: string
  is_active: boolean
}

export interface ServiceFees {
  momo: {
    deposit: FeeConfig | null
    withdrawal: FeeConfig | null
  }
  agency_banking: {
    deposit: FeeConfig | null
    withdrawal: FeeConfig | null
    interbank_transfer: FeeConfig | null
  }
  e_zwich: {
    card_issuance: FeeConfig | null
    withdrawal: FeeConfig | null
  }
  power: {
    transaction: FeeConfig | null
  }
  jumia: {
    transaction: FeeConfig | null
  }
  interbank: {
    transfer: FeeConfig | null
    inquiry: FeeConfig | null
  }
}

export function useFeeConfig() {
  const [fees, setFees] = useState<FeeConfig[]>([])
  const [serviceFees, setServiceFees] = useState<ServiceFees | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Load fee configuration
  const loadFees = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/settings/fee-config")

      if (response.ok) {
        const result = await response.json()
        if (result.success && Array.isArray(result.data)) {
          setFees(result.data)

          // Organize fees by service and transaction type
          const organized: ServiceFees = {
            momo: { deposit: null, withdrawal: null },
            agency_banking: { deposit: null, withdrawal: null, interbank_transfer: null },
            e_zwich: { card_issuance: null, withdrawal: null },
            power: { transaction: null },
            jumia: { transaction: null },
            interbank: { transfer: null, inquiry: null },
          }

          result.data.forEach((fee: FeeConfig) => {
            const serviceKey = fee.service_type as keyof ServiceFees
            const transactionKey = fee.transaction_type as keyof ServiceFees[typeof serviceKey]

            if (organized[serviceKey] && typeof organized[serviceKey] === "object") {
              ;(organized[serviceKey] as any)[transactionKey] = fee
            }
          })

          setServiceFees(organized)
        } else {
          throw new Error(result.error || "Invalid response format")
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load fee configuration"
      setError(errorMessage)
      console.error("Error loading fees:", error)

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Calculate fee for a transaction
  const calculateFee = useCallback(
    (
      serviceType: string,
      transactionType: string,
      amount: number,
    ): { fee: number; total: number; feeConfig: FeeConfig | null } => {
      const feeConfig = fees.find(
        (f) => f.service_type === serviceType && f.transaction_type === transactionType && f.is_active,
      )

      if (!feeConfig) {
        return { fee: 0, total: amount, feeConfig: null }
      }

      let calculatedFee = 0

      if (feeConfig.fee_type === "percentage") {
        calculatedFee = (amount * feeConfig.fee_value) / 100

        // Apply minimum and maximum limits
        if (feeConfig.minimum_fee > 0 && calculatedFee < feeConfig.minimum_fee) {
          calculatedFee = feeConfig.minimum_fee
        }
        if (feeConfig.maximum_fee > 0 && calculatedFee > feeConfig.maximum_fee) {
          calculatedFee = feeConfig.maximum_fee
        }
      } else {
        calculatedFee = feeConfig.fee_value
      }

      return {
        fee: Math.round(calculatedFee * 100) / 100, // Round to 2 decimal places
        total: Math.round((amount + calculatedFee) * 100) / 100,
        feeConfig,
      }
    },
    [fees],
  )

  // Get fee for specific service and transaction type
  const getFee = useCallback(
    (serviceType: string, transactionType: string): FeeConfig | null => {
      return (
        fees.find((f) => f.service_type === serviceType && f.transaction_type === transactionType && f.is_active) ||
        null
      )
    },
    [fees],
  )

  // Get all fees for a service
  const getServiceFees = useCallback(
    (serviceType: string): FeeConfig[] => {
      return fees.filter((f) => f.service_type === serviceType && f.is_active)
    },
    [fees],
  )

  // Update fee configuration
  const updateFees = useCallback(
    async (updatedFees: Partial<FeeConfig>[]) => {
      try {
        setIsLoading(true)

        const response = await fetch("/api/settings/fee-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fees: updatedFees }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            toast({
              title: "Success",
              description: "Fee configuration updated successfully",
            })

            // Reload fees
            await loadFees()
            return true
          } else {
            throw new Error(result.error || "Failed to update fees")
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update fee configuration"
        setError(errorMessage)

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })

        return false
      } finally {
        setIsLoading(false)
      }
    },
    [loadFees, toast],
  )

  // Load fees on mount
  useEffect(() => {
    loadFees()
  }, [loadFees])

  return {
    fees,
    serviceFees,
    isLoading,
    error,
    loadFees,
    calculateFee,
    getFee,
    getServiceFees,
    updateFees,
  }
}
