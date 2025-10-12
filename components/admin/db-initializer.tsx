"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

export function DatabaseInitializer() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const initializeTable = async (tableName: string, endpoint: string) => {
    try {
      setLoading(true)
      const response = await fetch(endpoint, { method: "POST" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to initialize ${tableName}`)
      }

      setResults((prev) => ({
        ...prev,
        [tableName]: { success: true, message: data.message || `${tableName} initialized successfully` },
      }))

      toast({
        title: "Success",
        description: `${tableName} initialized successfully`,
      })
    } catch (error) {
      console.error(`Error initializing ${tableName}:`, error)
      setResults((prev) => ({
        ...prev,
        [tableName]: {
          success: false,
          message: error instanceof Error ? error.message : `Failed to initialize ${tableName}`,
        },
      }))

      toast({
        title: "Error",
        description: `Failed to initialize ${tableName}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const initializeAll = async () => {
    await initializeTable("Branches", "/api/db/init-branches")
    await initializeTable("Float Accounts", "/api/db/init-float-accounts")
    // Add more tables as needed
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Initialization</CardTitle>
        <CardDescription>Initialize database tables required for the application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span>Branches Table</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => initializeTable("Branches", "/api/db/init-branches")}
              disabled={loading}
            >
              {loading && results["Branches"]?.success === undefined ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                "Initialize"
              )}
            </Button>
          </div>
          {results["Branches"] && (
            <div
              className={`text-sm p-2 rounded ${
                results["Branches"].success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {results["Branches"].success ? (
                <CheckCircle2 className="inline-block mr-1 h-4 w-4" />
              ) : (
                <XCircle className="inline-block mr-1 h-4 w-4" />
              )}
              {results["Branches"].message}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span>Float Accounts Table</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => initializeTable("Float Accounts", "/api/db/init-float-accounts")}
              disabled={loading}
            >
              {loading && results["Float Accounts"]?.success === undefined ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                "Initialize"
              )}
            </Button>
          </div>
          {results["Float Accounts"] && (
            <div
              className={`text-sm p-2 rounded ${
                results["Float Accounts"].success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {results["Float Accounts"].success ? (
                <CheckCircle2 className="inline-block mr-1 h-4 w-4" />
              ) : (
                <XCircle className="inline-block mr-1 h-4 w-4" />
              )}
              {results["Float Accounts"].message}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={initializeAll} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing All Tables...
            </>
          ) : (
            "Initialize All Tables"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
