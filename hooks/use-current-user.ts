"use client";

// This file is kept for backward compatibility
// The actual implementation is now in contexts/auth-context.tsx
// which provides global state management and caching

export type { CurrentUser } from "@/contexts/auth-context";
export { useCurrentUser, useAuth } from "@/contexts/auth-context";
