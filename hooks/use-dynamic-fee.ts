"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface FeeCalculation {
  fee: number;
  total: number;
  feeConfig: any;
  isLoading: boolean;
  error: string | null;
}

export function useDynamicFee() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const calculateFee = useCallback(
    async (
      serviceType: string,
      transactionType: string,
      amount: number
    ): Promise<FeeCalculation> => {
      if (!amount || amount <= 0) {
        return {
          fee: 0,
          total: amount,
          feeConfig: null,
          isLoading: false,
          error: null,
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/fee-config/calculate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceType,
            transactionType,
            amount,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
          return {
            fee: result.fee,
            total: result.total,
            feeConfig: result.feeConfig,
            isLoading: false,
            error: null,
          };
        } else {
          throw new Error(result.error || "Failed to calculate fee");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to calculate fee";
        setError(errorMessage);

        toast({
          title: "Fee Calculation Error",
          description: errorMessage,
          variant: "destructive",
        });

        return {
          fee: 0,
          total: amount,
          feeConfig: null,
          isLoading: false,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  return {
    calculateFee,
    isLoading,
    error,
  };
}
