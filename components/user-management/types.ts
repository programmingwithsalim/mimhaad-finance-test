export interface UserType {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  branch: string // Primary branch
  branches?: string[] // Multiple branch assignments
  phone?: string
  status: "active" | "inactive" | "locked" | "pending"
  createdAt: string
  lastLogin: string | null
  avatar?: string
  passwordResetRequired?: boolean
  lastPasswordReset?: string
}

export interface UserActivityLog {
  id: string
  userId: string
  action: string
  timestamp: string
  details: Record<string, any>
  ipAddress: string
  userAgent: string
}
