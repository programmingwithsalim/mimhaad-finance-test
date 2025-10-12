import { Loader2 } from "lucide-react"

interface LoadingFallbackProps {
  message?: string
  className?: string
}

export function LoadingFallback({ message = "Loading...", className = "h-32" }: LoadingFallbackProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
