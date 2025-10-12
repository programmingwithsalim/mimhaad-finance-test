export interface FloatAccount {
  id: string
  name: string
  accountNumber: string
  bankName?: string
  provider?: string
  accountType: string
  balance: number
  branchId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  branchId?: string
  branchName?: string
}

export interface Branch {
  id: string
  name: string
  code: string
  location: string
  managerId?: string
  isActive: boolean
}
