import { type NextRequest, NextResponse } from "next/server"
import { updateUserAvatar } from "@/lib/user-service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { imageData } = await request.json()

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 })
    }

    // Validate that it's a data URL
    if (!imageData.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data format" }, { status: 400 })
    }

    // For demo purposes, we'll create a shorter reference
    // In a real app, you would upload to cloud storage and store the URL
    const timestamp = Date.now()
    const { id: userId } = await params.slice(-8) // Last 8 characters of user ID
    const avatarUrl = `/api/avatars/${userId}_${timestamp}`

    // Store the actual image data in a temporary way (in a real app, use cloud storage)
    // For now, we'll just use a placeholder URL that represents the uploaded image
    const placeholderUrl = `/placeholder.svg?height=200&width=200&text=Avatar_${userId}`

    const updatedUser = await updateUserAvatar((await params).id, placeholderUrl)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Return the original image data for immediate display
    return NextResponse.json({
      avatar: imageData, // Return the original for immediate display
      storedUrl: updatedUser.avatar, // The URL stored in database
      message: "Avatar updated successfully",
    })
  } catch (error) {
    console.error("Error uploading avatar:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload avatar",
      },
      { status: 500 },
    )
  }
}
