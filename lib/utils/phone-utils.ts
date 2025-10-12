/**
 * Phone number utilities for Ghana phone numbers
 */

/**
 * Formats a phone number to include Ghana country code (+233)
 * @param phone - The phone number to format
 * @returns Formatted phone number with Ghana country code
 */
export function formatGhanaPhoneNumber(phone: string): string {
  if (!phone) return ""
  
  // Remove any existing formatting
  let cleaned = phone.replace(/[\s\-\(\)]/g, "")
  
  // If it already starts with +233, return as is
  if (cleaned.startsWith("+233")) {
    return cleaned
  }
  
  // If it starts with 233, add the +
  if (cleaned.startsWith("233")) {
    return `+${cleaned}`
  }
  
  // If it starts with 0, replace with +233
  if (cleaned.startsWith("0")) {
    return `+233${cleaned.slice(1)}`
  }
  
  // If it's a 9-digit number (Ghana mobile), add +233
  if (cleaned.length === 9 && /^[0-9]{9}$/.test(cleaned)) {
    return `+233${cleaned}`
  }
  
  // If it's a 10-digit number starting with 0, replace 0 with +233
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return `+233${cleaned.slice(1)}`
  }
  
  // For any other format, assume it needs the country code
  return `+233${cleaned.replace(/^0/, "")}`
}

/**
 * Formats a phone number for SMS providers (removes + and ensures 233 format)
 * @param phone - The phone number to format
 * @returns Phone number formatted for SMS providers
 */
export function formatPhoneForSMS(phone: string): string {
  if (!phone) return ""
  
  // First ensure it has Ghana country code
  const formatted = formatGhanaPhoneNumber(phone)
  
  // Remove the + and return the 233 format
  return formatted.replace(/^\+/, "")
}

/**
 * Validates if a phone number is a valid Ghana mobile number
 * @param phone - The phone number to validate
 * @returns True if valid Ghana mobile number
 */
export function isValidGhanaPhoneNumber(phone: string): boolean {
  if (!phone) return false
  
  const formatted = formatGhanaPhoneNumber(phone)
  
  // Ghana mobile numbers should be +233 followed by 9 digits
  const ghanaMobileRegex = /^\+233[0-9]{9}$/
  
  return ghanaMobileRegex.test(formatted)
}

/**
 * Extracts the mobile network from a Ghana phone number
 * @param phone - The phone number
 * @returns Network name (MTN, Vodafone, AirtelTigo, etc.)
 */
export function getGhanaNetwork(phone: string): string {
  if (!phone) return "Unknown"
  
  const formatted = formatGhanaPhoneNumber(phone)
  const number = formatted.replace("+233", "")
  
  if (!number || number.length !== 9) return "Unknown"
  
  const prefix = number.substring(0, 2)
  
  switch (prefix) {
    case "24":
    case "54":
    case "55":
    case "59":
    case "25":
      return "MTN"
    case "20":
    case "50":
      return "Vodafone"
    case "27":
    case "57":
    case "26":
    case "56":
      return "AirtelTigo"
    default:
      return "Unknown"
  }
} 