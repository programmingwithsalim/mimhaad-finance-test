import type React from "react"
import type { Metadata } from "next"
import { DashboardLayout } from "@/components/dashboard-layout"

export const metadata: Metadata = {
  title: "Dashboard | Mimhaad Finance",
  description: "FinTech Admin Financial Solution",
}

export default function ProtectedRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
