"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, AlertCircle, CheckCircle, RefreshCw, Users, Building } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function SyncBranchesUsers() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    updatedBranches?: number
    errors?: number
    details?: string[]
  } | null>(null)

  const handleSync = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/sync/branches-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)

      if (data.success) {
        toast({
          title: "Synchronization Successful",
          description: `Updated ${data.updatedBranches} branches with ${data.errors} errors.`,
          variant: "default",
        })
      } else {
        toast({
          title: "Synchronization Failed",
          description: data.details?.[0] || "Unknown error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error during synchronization:", error)
      setResult({
        success: false,
        updatedBranches: 0,
        errors: 1,
        details: [(error as Error).message],
      })

      toast({
        title: "Synchronization Failed",
        description: (error as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Synchronize Branches and Users
        </CardTitle>
        <CardDescription>
          Update branch information based on user assignments and synchronize staff counts and managers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result && (
          <Alert variant={result.success ? "default" : "destructive"} className="mb-4">
            <div className="flex items-start gap-2">
              {result.success ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <div>
                <AlertTitle>{result.success ? "Synchronization Successful" : "Synchronization Failed"}</AlertTitle>
                <AlertDescription>
                  {result.success
                    ? `Successfully updated ${result.updatedBranches} branches with ${result.errors} errors.`
                    : "Failed to synchronize data. See details below."}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-sm">
              <Users className="h-3 w-3 mr-1" />
              Updates staff counts
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Building className="h-3 w-3 mr-1" />
              Assigns branch managers
            </Badge>
          </div>

          {result && result.details && result.details.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Synchronization Details:</h3>
              <ScrollArea className="h-48 w-full rounded-md border p-2">
                <div className="space-y-1">
                  {result.details.map((detail, index) => (
                    <div
                      key={index}
                      className={`text-xs p-1 rounded ${
                        detail.includes("Error") || detail.includes("Failed")
                          ? "bg-destructive/10 text-destructive"
                          : detail.includes("Warning")
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500"
                            : "bg-muted"
                      }`}
                    >
                      {detail}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSync} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Synchronizing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Synchronize Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
