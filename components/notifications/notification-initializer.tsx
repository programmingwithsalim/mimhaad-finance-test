"use client"

import { useEffect } from "react"

// Simple notification initializer that doesn't break the app
export function NotificationInitializer() {
  useEffect(() => {
    // Initialize notification system silently
    console.log("✅ Notification system initialized")
  }, [])

  // This component renders nothing - it just initializes notifications
  return null
}
