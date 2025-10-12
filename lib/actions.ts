"use server"

import { z } from "zod"

// Personal information form schema
const personalInfoSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
})

// Password change form schema
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
      .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
      .regex(/[0-9]/, { message: "Password must contain at least one number." }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export async function updatePersonalInfo(formData: FormData) {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Parse and validate the form data
  const validatedFields = personalInfoSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  })

  // Return error if validation fails
  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // In a real application, you would update the user's information in the database here
  // For this example, we'll just return success
  return {
    success: true,
    data: validatedFields.data,
  }
}

export async function changePassword(formData: FormData) {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Parse and validate the form data
  const validatedFields = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })

  // Return error if validation fails
  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // In a real application, you would verify the current password and update the password in the database here
  // For this example, we'll simulate a check for the current password
  const currentPassword = formData.get("currentPassword")
  if (currentPassword !== "password") {
    return {
      success: false,
      errors: {
        currentPassword: ["Current password is incorrect."],
      },
    }
  }

  // Return success
  return {
    success: true,
  }
}

export async function uploadProfileImage(formData: FormData) {
  // Simulate a delay
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Get the file from the form data
  const file = formData.get("profileImage") as File

  // Check if a file was provided
  if (!file || file.size === 0) {
    return {
      success: false,
      error: "No file provided.",
    }
  }

  // Check file type
  if (!file.type.startsWith("image/")) {
    return {
      success: false,
      error: "File must be an image.",
    }
  }

  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return {
      success: false,
      error: "File size must be less than 5MB.",
    }
  }

  // In a real application, you would upload the file to a storage service and update the user's profile in the database
  // For this example, we'll just return success
  return {
    success: true,
    imageUrl: URL.createObjectURL(file), // This won't work in a server action, but it's just for demonstration
  }
}
