import { type NextRequest, NextResponse } from "next/server"
import { getUserById, updateUser, deleteUser } from "@/lib/user-service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test((await params).id)) {
      return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 })
    }

    const user = await getUserById((await params).id)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Remove sensitive data
    const { passwordHash, ...safeUser } = user

    return NextResponse.json({ user: safeUser })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const body = await request.json()
    console.log("Updating user with data:", body)

    const { firstName, lastName, email, phone, role, primaryBranchId, branchIds, status, avatar } = body

    // Prepare update data
    const updateData: any = {}

    if (firstName) updateData.firstName = firstName
    if (lastName) updateData.lastName = lastName
    if (email) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (role) updateData.role = role
    if (primaryBranchId) updateData.primaryBranchId = primaryBranchId
    if (branchIds) updateData.branchIds = branchIds
    if (status) updateData.status = status
    if (avatar) updateData.avatar = avatar

    const updatedUser = await updateUser((await params).id, updateData)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Remove sensitive data
    const { passwordHash, ...safeUser } = updatedUser

    return NextResponse.json({
      data: {
        ...safeUser,
        name: `${safeUser.firstName} ${safeUser.lastName}`.trim(),
      },
      message: "User updated successfully",
    })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  return PUT(request, { params })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const success = await deleteUser((await params).id)

    if (!success) {
      return NextResponse.json({ error: "User not found or could not be deleted" }, { status: 404 })
    }

    return NextResponse.json({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  }
}
