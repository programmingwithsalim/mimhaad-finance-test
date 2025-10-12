import bcrypt from "bcryptjs"

/**
 * Generate a secure random password
 */
export function generateSecurePassword(
  length = 12,
  includeUppercase = true,
  includeLowercase = true,
  includeNumbers = true,
  includeSymbols = true,
): string {
  const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const lowercaseChars = "abcdefghijklmnopqrstuvwxyz"
  const numberChars = "0123456789"
  const symbolChars = "!@#$%^&*()_+-=[]{}|;:,.<>?"

  let chars = ""
  if (includeUppercase) chars += uppercaseChars
  if (includeLowercase) chars += lowercaseChars
  if (includeNumbers) chars += numberChars
  if (includeSymbols) chars += symbolChars

  if (chars.length === 0) {
    chars = lowercaseChars + numberChars
  }

  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // Ensure at least one character from each selected type
  let finalPassword = password
  if (includeUppercase && !/[A-Z]/.test(finalPassword)) {
    finalPassword = uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length)) + finalPassword.slice(1)
  }
  if (includeLowercase && !/[a-z]/.test(finalPassword)) {
    finalPassword =
      finalPassword.slice(0, 1) +
      lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length)) +
      finalPassword.slice(2)
  }
  if (includeNumbers && !/[0-9]/.test(finalPassword)) {
    finalPassword =
      finalPassword.slice(0, 2) +
      numberChars.charAt(Math.floor(Math.random() * numberChars.length)) +
      finalPassword.slice(3)
  }
  if (includeSymbols && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(finalPassword)) {
    finalPassword =
      finalPassword.slice(0, 3) +
      symbolChars.charAt(Math.floor(Math.random() * symbolChars.length)) +
      finalPassword.slice(4)
  }

  return finalPassword
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Calculate password strength (0-100)
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) return 0

  let strength = 0
  const length = password.length

  // Length contribution (up to 25 points)
  strength += Math.min(length * 2, 25)

  // Character variety contribution (up to 50 points)
  if (/[A-Z]/.test(password)) strength += 10 // Uppercase
  if (/[a-z]/.test(password)) strength += 10 // Lowercase
  if (/[0-9]/.test(password)) strength += 10 // Numbers
  if (/[^A-Za-z0-9]/.test(password)) strength += 20 // Symbols

  // Pattern penalties
  if (/(.)\1\1/.test(password)) strength -= 10 // Repeated characters
  if (/^[A-Za-z]+$/.test(password)) strength -= 10 // Letters only
  if (/^[0-9]+$/.test(password)) strength -= 10 // Numbers only

  // Common password check (simplified)
  const commonPasswords = ["password", "123456", "qwerty", "admin", "welcome", "letmein"]
  if (commonPasswords.includes(password.toLowerCase())) strength = 10

  // Ensure strength is between 0 and 100
  return Math.max(0, Math.min(100, strength))
}
