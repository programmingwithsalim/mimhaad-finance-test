import { type NextRequest, NextResponse } from "next/server"
import { updateUserAvatar } from "@/lib/user-service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const formData = await request.formData()
    const file = formData.get("avatar") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    // Validate file size (2MB limit for better performance)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 2MB" }, { status: 400 })
    }

    // For demo purposes, we'll generate a placeholder URL
    // In a real application, you would upload to a cloud storage service like AWS S3, Cloudinary, etc.
    const timestamp = Date.now()
    const fileName = `avatar_${(await params).id}_${timestamp}.${file.type.split("/")[1]}`
    const avatarUrl = `/placeholder.svg?height=200&width=200&text=${encodeURIComponent(fileName)}`

    // In a real app, you would:
    // 1. Upload the file to cloud storage
    // 2. Get the public URL
    // 3. Store that URL in the database

    // For now, we'll use a placeholder approach
    const updatedUser = await updateUserAvatar((await params).id, avatarUrl)

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      avatar: updatedUser.avatar,
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
