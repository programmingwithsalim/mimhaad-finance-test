"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function ErrorBoundary({ children, fallback, onError }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error("Caught error:", error)
      setError(error.error || new Error(error.message))
      setHasError(true)

      if (onError && error.error) {
        onError(error.error, { componentStack: error.filename || "" })
      }
    }

    window.addEventListener("error", errorHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
    }
  }, [onError])

  if (hasError) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Card className="w-full max-w-md mx-auto my-8">
        <CardHeader className="bg-red-50 dark:bg-red-900/20">
          <CardTitle className="flex items-center text-red-700 dark:text-red-400">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Something went wrong
          </CardTitle>
          <CardDescription className="text-red-600 dark:text-red-300">
            An error occurred while rendering this component
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground mb-4">{error?.message || "Unknown error"}</div>
          <div className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
            {error?.stack || "No stack trace available"}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setHasError(false)
              setError(null)
              window.location.reload()
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reload Page
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return <>{children}</>
}
