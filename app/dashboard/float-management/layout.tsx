import type React from "react"
import { Toaster } from "@/components/ui/toaster"

export default function FloatManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      {children}
      <Toaster />
    </div>
  )
}
