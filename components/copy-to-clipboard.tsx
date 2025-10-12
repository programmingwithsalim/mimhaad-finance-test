"use client"

import { toast } from "sonner"

export function CopyToClipboard(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Copied to clipboard")
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard")
      })
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea")
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand("copy")
      toast.success("Copied to clipboard")
    } catch (err) {
      toast.error("Failed to copy to clipboard")
    }
    document.body.removeChild(textArea)
  }
}
