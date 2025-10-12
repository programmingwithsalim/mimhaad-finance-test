"use client"

import { useState, useEffect } from "react"

export interface FloatThresholdSettings {
  float_min_threshold_momo: { value: number; description: string; data_type: string }
  float_max_threshold_momo: { value: number; description: string; data_type: string }
  float_min_threshold_agency_banking: { value: number; description: string; data_type: string }
  float_max_threshold_agency_banking: { value: number; description: string; data_type: string }
  float_min_threshold_e_zwich: { value: number; description: string; data_type: string }
  float_max_threshold_e_zwich: { value: number; description: string; data_type: string }
  float_min_threshold_power: { value: number; description: string; data_type: string }
  float_max_threshold_power: { value: number; description: string; data_type: string }
  float_critical_threshold_percentage: { value: number; description: string; data_type: string }
  float_low_threshold_percentage: { value: number; description: string; data_type: string }
}

export function useFloatThresholds() {
  const [settings, setSettings] = useState<FloatThresholdSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/settings/float-thresholds", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch float threshold settings: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.settings) {
        setSettings(data.settings)
      } else {
        throw new Error(data.error || "Failed to load settings")
      }
    } catch (err) {
      console.error("Error fetching float threshold settings:", err)
      setError(err instanceof Error ? err : new Error("Failed to fetch settings"))
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings: Partial<FloatThresholdSettings>) => {
    try {
      const settingsArray = Object.entries(newSettings).map(([key, setting]) => ({
        key,
        value: setting.value.toString(),
      }))

      const response = await fetch("/api/settings/float-thresholds", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ settings: settingsArray }),
      })

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        await fetchSettings() // Refresh settings
        return true
      } else {
        throw new Error(data.error || "Failed to update settings")
      }
    } catch (err) {
      console.error("Error updating float threshold settings:", err)
      throw err
    }
  }

  const getThresholdForAccountType = (accountType: string) => {
    if (!settings) return { min: 0, max: 1000000 }

    const normalizedType = accountType.toLowerCase().replace("-", "_")
    const minKey = `float_min_threshold_${normalizedType}` as keyof FloatThresholdSettings
    const maxKey = `float_max_threshold_${normalizedType}` as keyof FloatThresholdSettings

    return {
      min: settings[minKey]?.value || 0,
      max: settings[maxKey]?.value || 1000000,
    }
  }

  const getCriticalThreshold = (minThreshold: number) => {
    if (!settings) return minThreshold * 0.8

    const percentage = settings.float_critical_threshold_percentage?.value || 80
    return minThreshold * (percentage / 100)
  }

  const getLowThreshold = (minThreshold: number) => {
    if (!settings) return minThreshold * 1.5

    const percentage = settings.float_low_threshold_percentage?.value || 150
    return minThreshold * (percentage / 100)
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    updateSettings,
    getThresholdForAccountType,
    getCriticalThreshold,
    getLowThreshold,
  }
}
