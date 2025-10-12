"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, AlertCircle, CheckCircle, Database, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function UserMigration() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{
    success?: boolean
    migrated?: number
    errors?: number
    details?: string[]
  } | null>(null)

  const handleMigration = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/db/migrate-users", {
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
          title: "Migration Successful",
          description: `Migrated ${data.migrated} users with ${data.errors} errors.`,
          variant: "default",
        })
      } else {
        toast({
          title: "Migration Failed",
          description: data.details?.[0] || "Unknown error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error during migration:", error)
      setResult({
        success: false,
        migrated: 0,
        errors: 1,
        details: [(error as Error).message],
      })

      toast({
        title: "Migration Failed",
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
          <Database className="h-5 w-5" />
          User Migration to Database
        </CardTitle>
        <CardDescription>
          Migrate user data from JSON files to the database and establish relationships with branches.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result && (
          <Alert variant={result.success ? "default" : "destructive"} className="mb-4">
            <div className="flex items-start gap-2">
              {result.success ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <div>
                <AlertTitle>{result.success ? "Migration Successful" : "Migration Failed"}</AlertTitle>
                <AlertDescription>
                  {result.success
                    ? `Successfully migrated ${result.migrated} users with ${result.errors} errors.`
                    : "Failed to migrate users. See details below."}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-sm">
              Migrates users from JSON to database
            </Badge>
            <Badge variant="outline" className="text-sm">
              Creates user-branch relationships
            </Badge>
            <Badge variant="outline" className="text-sm">
              Sets up primary branch assignments
            </Badge>
            <Badge variant="outline" className="text-sm">
              Updates branch staff counts
            </Badge>
          </div>

          {result && result.details && result.details.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Migration Details:</h3>
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
        <Button onClick={handleMigration} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Migrating Users...
            </>
          ) : result && result.success ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run Migration Again
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Migrate Users to Database
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
