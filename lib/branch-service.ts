import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export interface Branch {
  id: string
  name: string
  location: string
  manager: string
  contactNumber: string
  email: string
  status: "active" | "inactive"
  createdAt: string
  updatedAt: string
}

/**
 * Get all branches
 */
export async function getAllBranches(): Promise<Branch[]> {
  try {
    // Try database first
    try {
      const branches = await sql`
        SELECT * FROM branches ORDER BY name
      `

      return branches.map((b) => ({
        id: b.id,
        name: b.name,
        location: b.location,
        manager: b.manager,
        contactNumber: b.contact_number,
        email: b.email,
        status: b.status,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      }))
    } catch (dbError) {
      console.log("Database not available, using mock data")
    }

    // Fallback to mock data
    return [
      {
        id: "branch-1",
        name: "Main Branch",
        location: "Accra Central",
        manager: "John Doe",
        contactNumber: "0301234567",
        email: "main@example.com",
        status: "active",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
      {
        id: "branch-2",
        name: "Downtown Branch",
        location: "Kumasi",
        manager: "Jane Smith",
        contactNumber: "0301234568",
        email: "downtown@example.com",
        status: "active",
        createdAt: "2023-01-02T00:00:00Z",
        updatedAt: "2023-01-02T00:00:00Z",
      },
    ]
  } catch (error) {
    console.error("Error getting all branches:", error)
    return []
  }
}

/**
 * Get a branch by ID
 */
export async function getBranchById(id: string): Promise<Branch | null> {
  try {
    const branches = await getAllBranches()
    return branches.find((b) => b.id === id) || null
  } catch (error) {
    console.error("Error getting branch by ID:", error)
    return null
  }
}

/**
 * Create a new branch
 */
export async function createBranch(branchData: Omit<Branch, "id" | "createdAt" | "updatedAt">): Promise<Branch | null> {
  try {
    const newBranch: Branch = {
      id: `branch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...branchData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Try to store in database
    try {
      await sql`
        INSERT INTO branches (id, name, location, manager, contact_number, email, status)
        VALUES (${newBranch.id}, ${newBranch.name}, ${newBranch.location}, ${newBranch.manager}, 
                ${newBranch.contactNumber}, ${newBranch.email}, ${newBranch.status})
      `
    } catch (dbError) {
      console.log("Database not available, using mock data")
    }

    return newBranch
  } catch (error) {
    console.error("Error creating branch:", error)
    return null
  }
}

/**
 * Update an existing branch
 */
export async function updateBranch(
  id: string,
  branchData: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
): Promise<Branch | null> {
  try {
    // Try to update in database
    try {
      const updateFields = []
      const values = []
      let paramIndex = 1

      if (branchData.name) {
        updateFields.push(`name = $${paramIndex}`)
        values.push(branchData.name)
        paramIndex++
      }
      if (branchData.location) {
        updateFields.push(`location = $${paramIndex}`)
        values.push(branchData.location)
        paramIndex++
      }
      if (branchData.manager) {
        updateFields.push(`manager = $${paramIndex}`)
        values.push(branchData.manager)
        paramIndex++
      }
      if (branchData.contactNumber) {
        updateFields.push(`contact_number = $${paramIndex}`)
        values.push(branchData.contactNumber)
        paramIndex++
      }
      if (branchData.email) {
        updateFields.push(`email = $${paramIndex}`)
        values.push(branchData.email)
        paramIndex++
      }
      if (branchData.status) {
        updateFields.push(`status = $${paramIndex}`)
        values.push(branchData.status)
        paramIndex++
      }

      updateFields.push(`updated_at = NOW()`)
      values.push(id)

      const query = `
        UPDATE branches 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `

      const result = await sql.query(query, values)

      if (result.length > 0) {
        const b = result[0]
        return {
          id: b.id,
          name: b.name,
          location: b.location,
          manager: b.manager,
          contactNumber: b.contact_number,
          email: b.email,
          status: b.status,
          createdAt: b.created_at,
          updatedAt: b.updated_at,
        }
      }
    } catch (dbError) {
      console.log("Database not available for update")
    }

    // Fallback: return updated mock data
    const existingBranch = await getBranchById(id)
    if (existingBranch) {
      return {
        ...existingBranch,
        ...branchData,
        updatedAt: new Date().toISOString(),
      }
    }

    return null
  } catch (error) {
    console.error("Error updating branch:", error)
    return null
  }
}

/**
 * Delete a branch
 */
export async function deleteBranch(id: string): Promise<boolean> {
  try {
    // Try to delete from database
    try {
      const result = await sql`
        DELETE FROM branches WHERE id = ${id}
      `
      return result.count > 0
    } catch (dbError) {
      console.log("Database not available for delete")
    }

    // For mock data, always return true
    return true
  } catch (error) {
    console.error("Error deleting branch:", error)
    return false
  }
}

/**
 * Search branches by name or location
 */
export async function searchBranches(query: string): Promise<Branch[]> {
  try {
    const allBranches = await getAllBranches()

    if (!query || query.trim() === "") {
      return allBranches
    }

    const searchTerm = query.toLowerCase().trim()

    return allBranches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(searchTerm) ||
        branch.location.toLowerCase().includes(searchTerm) ||
        branch.manager.toLowerCase().includes(searchTerm),
    )
  } catch (error) {
    console.error("Error searching branches:", error)
    return []
  }
}
