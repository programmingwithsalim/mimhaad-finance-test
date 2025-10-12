// API Service for interacting with the backend
export class ApiService {
  // Users
  static async getUsers() {
    try {
      const response = await fetch("/api/users")
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to fetch users",
          data: [],
        }
      }

      return {
        success: true,
        data: data.data || [],
      }
    } catch (error) {
      console.error("Error fetching users:", error)
      return {
        success: false,
        error: (error as Error).message,
        data: [],
      }
    }
  }

  static async getUserById(id: string) {
    try {
      const response = await fetch(`/api/users/${id}`)
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to fetch user ${id}`,
          data: null,
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error(`Error fetching user ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
        data: null,
      }
    }
  }

  static async createUser(userData: any) {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to create user",
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error("Error creating user:", error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async updateUser(id: string, userData: any) {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to update user ${id}`,
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error(`Error updating user ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async deleteUser(id: string) {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to delete user ${id}`,
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      console.error(`Error deleting user ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async resetUserPassword(id: string) {
    try {
      const response = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to reset password for user ${id}`,
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      console.error(`Error resetting password for user ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async getUserStatistics() {
    try {
      const response = await fetch("/api/users/statistics")
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to fetch user statistics",
          data: null,
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error("Error fetching user statistics:", error)
      return {
        success: false,
        error: (error as Error).message,
        data: null,
      }
    }
  }

  // Branches
  static async getBranches() {
    try {
      const response = await fetch("/api/branches")
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to fetch branches",
          data: [],
        }
      }

      return {
        success: true,
        data: data.data || [],
      }
    } catch (error) {
      console.error("Error fetching branches:", error)
      return {
        success: false,
        error: (error as Error).message,
        data: [],
      }
    }
  }

  static async getBranchById(id: string) {
    try {
      const response = await fetch(`/api/branches/${id}`)
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to fetch branch ${id}`,
          data: null,
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error(`Error fetching branch ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
        data: null,
      }
    }
  }

  static async createBranch(branchData: any) {
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(branchData),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to create branch",
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error("Error creating branch:", error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async updateBranch(id: string, branchData: any) {
    try {
      const response = await fetch(`/api/branches/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(branchData),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to update branch ${id}`,
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error(`Error updating branch ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async deleteBranch(id: string) {
    try {
      const response = await fetch(`/api/branches/${id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Failed to delete branch ${id}`,
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      console.error(`Error deleting branch ${id}:`, error)
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  static async searchBranches(query: string) {
    try {
      const response = await fetch(`/api/branches/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to search branches",
          data: [],
        }
      }

      return {
        success: true,
        data: data.data || [],
      }
    } catch (error) {
      console.error("Error searching branches:", error)
      return {
        success: false,
        error: (error as Error).message,
        data: [],
      }
    }
  }

  static async getBranchStatistics() {
    try {
      const response = await fetch("/api/branches/statistics")
      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to fetch branch statistics",
          data: null,
        }
      }

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error("Error fetching branch statistics:", error)
      return {
        success: false,
        error: (error as Error).message,
        data: null,
      }
    }
  }
}
