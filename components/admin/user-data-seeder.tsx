"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, Database, Users, Shield } from "lucide-react"

export function UserDataSeeder() {
  const [usersStatus, setUsersStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [sessionsStatus, setSessionsStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [usersMessage, setUsersMessage] = useState("")
  const [sessionsMessage, setSessionsMessage] = useState("")

  const initializeUsers = async () => {
    setUsersStatus("loading")
    setUsersMessage("")

    try {
      // First initialize the users table
      const initResponse = await fetch("/api/db/init-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!initResponse.ok) {
        throw new Error("Failed to initialize users table")
      }

      // Then seed the user data
      const seedResponse = await fetch("/api/seed/user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const result = await seedResponse.json()

      if (seedResponse.ok) {
        setUsersStatus("success")
        setUsersMessage(result.message || "Users table initialized and seeded successfully!")
      } else {
        throw new Error(result.error || "Failed to seed user data")
      }
    } catch (error) {
      setUsersStatus("error")
      setUsersMessage(error instanceof Error ? error.message : "An error occurred")
    }
  }

  const initializeSessions = async () => {
    setSessionsStatus("loading")
    setSessionsMessage("")

    try {
      const response = await fetch("/api/db/init-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const result = await response.json()

      if (response.ok) {
        setSessionsStatus("success")
        setSessionsMessage(result.message || "Sessions table initialized successfully!")
      } else {
        throw new Error(result.error || "Failed to initialize sessions table")
      }
    } catch (error) {
      setSessionsStatus("error")
      setSessionsMessage(error instanceof Error ? error.message : "An error occurred")
    }
  }

  const initializeAll = async () => {
    await initializeUsers()
    await initializeSessions()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Initialization
          </CardTitle>
          <CardDescription>Initialize the database tables and seed with default data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Setup Button */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Quick Setup</h4>
            <p className="text-sm text-blue-700 mb-3">Initialize both users and sessions tables with one click</p>
            <Button
              onClick={initializeAll}
              disabled={usersStatus === "loading" || sessionsStatus === "loading"}
              className="w-full"
            >
              {(usersStatus === "loading" || sessionsStatus === "loading") && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Initialize Complete System
            </Button>
          </div>

          {/* Individual Setup Sections */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Users Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h4 className="font-medium">Users Table</h4>
              </div>

              <Button
                onClick={initializeUsers}
                disabled={usersStatus === "loading"}
                variant="outline"
                className="w-full"
              >
                {usersStatus === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize Users
              </Button>

              {usersStatus === "success" && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{usersMessage}</AlertDescription>
                </Alert>
              )}

              {usersStatus === "error" && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">{usersMessage}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Sessions Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <h4 className="font-medium">Sessions Table</h4>
              </div>

              <Button
                onClick={initializeSessions}
                disabled={sessionsStatus === "loading"}
                variant="outline"
                className="w-full"
              >
                {sessionsStatus === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Initialize Sessions
              </Button>

              {sessionsStatus === "success" && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{sessionsMessage}</AlertDescription>
                </Alert>
              )}

              {sessionsStatus === "error" && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">{sessionsMessage}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Status Summary */}
          {(usersStatus !== "idle" || sessionsStatus !== "idle") && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium mb-2">Setup Status:</h5>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {usersStatus === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : usersStatus === "error" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : usersStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-gray-300" />
                  )}
                  <span>Users table and data</span>
                </div>
                <div className="flex items-center gap-2">
                  {sessionsStatus === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : sessionsStatus === "error" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : sessionsStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-gray-300" />
                  )}
                  <span>Sessions table</span>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps */}
          {usersStatus === "success" && sessionsStatus === "success" && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Setup Complete!</strong> You can now{" "}
                <a href="/" className="underline hover:no-underline">
                  go to the login page
                </a>{" "}
                and sign in with the admin credentials.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
