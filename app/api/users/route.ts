import { NextResponse } from "next/server"
import { getAllUsers, createUser, getUserStatistics } from "@/lib/user-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get("includeStats") === "true"

    if (includeStats) {
      const [users, statistics] = await Promise.all([getAllUsers(), getUserStatistics()])

      return NextResponse.json({
        data: users,
        statistics,
      })
    }

    const users = await getAllUsers()
    return NextResponse.json({ data: users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const userData = await request.json()
    console.log("Received user data:", userData)

    // Validate required fields
    if (!userData.firstName || !userData.lastName || !userData.email || !userData.role) {
      return NextResponse.json({ error: "Missing required fields: firstName, lastName, email, role" }, { status: 400 })
    }

    if (!userData.primaryBranchId) {
      return NextResponse.json({ error: "Primary branch is required" }, { status: 400 })
    }

    if (!userData.branchIds || userData.branchIds.length === 0) {
      return NextResponse.json({ error: "At least one branch assignment is required" }, { status: 400 })
    }

    // Ensure primary branch is in the branch assignments
    if (!userData.branchIds.includes(userData.primaryBranchId)) {
      userData.branchIds.push(userData.primaryBranchId)
    }

    const user = await createUser({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone || null,
      role: userData.role,
      primaryBranchId: userData.primaryBranchId,
      branchIds: userData.branchIds,
      status: userData.status || "active",
      avatar: userData.avatar || "/placeholder.svg",
    })

    console.log("User created successfully:", user.id)

    return NextResponse.json({
      data: user,
      message: "User created successfully",
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json(
      {
        error: "Failed to create user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
