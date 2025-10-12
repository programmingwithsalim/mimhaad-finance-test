import { cn } from "@/lib/utils"

interface PasswordStrengthIndicatorProps {
  password: string
  className?: string
}

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  // Calculate password strength
  const getStrength = (password: string): { score: number; feedback: string } => {
    if (!password) {
      return { score: 0, feedback: "Password is required" }
    }

    let score = 0
    let feedback = ""

    // Length check
    if (password.length >= 12) {
      score += 2
    } else if (password.length >= 8) {
      score += 1
    } else {
      return { score: 0, feedback: "Password should be at least 8 characters" }
    }

    // Character variety checks
    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasNumbers = /[0-9]/.test(password)
    const hasSpecialChars = /[^A-Za-z0-9]/.test(password)

    // Add points for character variety
    if (hasUppercase) score += 1
    if (hasLowercase) score += 1
    if (hasNumbers) score += 1
    if (hasSpecialChars) score += 1

    // Generate feedback based on missing criteria
    const missingCriteria = []
    if (!hasUppercase) missingCriteria.push("uppercase letters")
    if (!hasLowercase) missingCriteria.push("lowercase letters")
    if (!hasNumbers) missingCriteria.push("numbers")
    if (!hasSpecialChars) missingCriteria.push("special characters")

    if (missingCriteria.length > 0) {
      feedback = `Add ${missingCriteria.join(", ")} for a stronger password`
    } else if (password.length < 12) {
      feedback = "Consider a longer password for extra security"
    } else {
      feedback = "Strong password"
    }

    return { score, feedback }
  }

  const { score, feedback } = getStrength(password)

  // Calculate percentage for progress bar
  const strengthPercentage = Math.min(100, (score / 6) * 100)

  // Determine color based on strength
  const getColorClass = () => {
    if (score < 2) return "bg-red-500"
    if (score < 4) return "bg-yellow-500"
    return "bg-green-500"
  }

  // Determine strength label
  const getStrengthLabel = () => {
    if (score < 2) return "Weak"
    if (score < 4) return "Fair"
    if (score < 6) return "Good"
    return "Strong"
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", getColorClass())}
          style={{ width: `${strengthPercentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span
          className={cn("font-medium", score < 2 ? "text-red-500" : score < 4 ? "text-yellow-500" : "text-green-500")}
        >
          {getStrengthLabel()}
        </span>
        <span className="text-gray-500">{feedback}</span>
      </div>
    </div>
  )
}
