export interface FloatAccount {
  id: string
  name: string
  account_number: string
  bank_name?: string
  provider?: string
  account_type: string
  balance: number
  branch_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function getFloatAccounts(): Promise<FloatAccount[]> {
  try {
    const response = await fetch("/api/float-accounts")
    if (!response.ok) {
      throw new Error("Failed to fetch float accounts")
    }
    return await response.json()
  } catch (error) {
    console.error("Error fetching float accounts:", error)
    throw error
  }
}

export async function createFloatAccount(data: Partial<FloatAccount>): Promise<FloatAccount> {
  try {
    const response = await fetch("/api/float-accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Failed to create float account")
    }

    return await response.json()
  } catch (error) {
    console.error("Error creating float account:", error)
    throw error
  }
}

export async function updateFloatAccount(id: string, data: Partial<FloatAccount>): Promise<FloatAccount> {
  try {
    const response = await fetch(`/api/float-accounts/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Failed to update float account")
    }

    return await response.json()
  } catch (error) {
    console.error("Error updating float account:", error)
    throw error
  }
}

export async function deleteFloatAccount(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/float-accounts/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to delete float account")
    }
  } catch (error) {
    console.error("Error deleting float account:", error)
    throw error
  }
}
