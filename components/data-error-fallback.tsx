"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DataErrorFallbackProps {
  message?: string
  onRetry?: () => void
  className?: string
}

export function DataErrorFallback({
  message = "Failed to load data",
  onRetry,
  className = "h-32",
}: DataErrorFallbackProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  )
}
