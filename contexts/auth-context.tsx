"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface CurrentUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  role: string;
  branchId: string;
  branchName?: string;
  phone?: string;
}

interface AuthContextType {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache configuration
const CACHE_KEY = "auth_user_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedUser {
  user: CurrentUser;
  timestamp: number;
}

// In-flight request tracking to prevent duplicate calls
let inFlightRequest: Promise<CurrentUser | null> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get cached user if still valid
  const getCachedUser = useCallback((): CurrentUser | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { user, timestamp }: CachedUser = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < CACHE_DURATION) {
        return user;
      }

      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY);
      return null;
    } catch {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, []);

  // Set cached user
  const setCachedUser = useCallback((user: CurrentUser) => {
    const cacheData: CachedUser = {
      user,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  }, []);

  // Fetch user from API with deduplication
  const fetchUserFromAPI =
    useCallback(async (): Promise<CurrentUser | null> => {
      // If there's already a request in flight, return that promise
      if (inFlightRequest) {
        return inFlightRequest;
      }

      // Create new request
      inFlightRequest = (async () => {
        try {
          const response = await fetch("/api/auth/session", {
            credentials: "include",
            headers: {
              "Cache-Control": "no-cache",
            },
          });

          if (!response.ok) {
            throw new Error("Session fetch failed");
          }

          const sessionData = await response.json();

          if (sessionData.user && sessionData.user.id !== "System") {
            return sessionData.user;
          }

          throw new Error("Invalid user session");
        } catch (err) {
          throw err;
        } finally {
          // Clear in-flight request after completion
          inFlightRequest = null;
        }
      })();

      return inFlightRequest;
    }, []);

  // Main fetch function with caching
  const fetchUser = useCallback(
    async (forceRefresh = false) => {
      try {
        setLoading(true);
        setError(null);

        // Try cache first (unless forced refresh)
        if (!forceRefresh) {
          const cached = getCachedUser();
          if (cached) {
            setUser(cached);
            setLoading(false);
            return;
          }
        }

        // Fetch from API
        const fetchedUser = await fetchUserFromAPI();

        if (fetchedUser) {
          setUser(fetchedUser);
          setCachedUser(fetchedUser);
        } else {
          throw new Error("No valid session found");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get user info";
        setError(errorMessage);

        // Clear invalid cache
        localStorage.removeItem(CACHE_KEY);

        // Dev fallback (optional - remove in production)
        if (process.env.NODE_ENV === "development") {
          const defaultUser: CurrentUser = {
            id: "74c0a86e-2585-443f-9c2e-44fbb2bcd79c",
            name: "Test User",
            firstName: "Test",
            lastName: "User",
            username: "testuser",
            email: "test@example.com",
            role: "manager",
            branchId: "635844ab-029a-43f8-8523-d7882915266a",
            branchName: "Main Branch",
            phone: "+233500000000",
          };
          setUser(defaultUser);
        }
      } finally {
        setLoading(false);
      }
    },
    [getCachedUser, fetchUserFromAPI, setCachedUser]
  );

  // Refetch function for manual refresh
  const refetchUser = useCallback(async () => {
    await fetchUser(true);
  }, [fetchUser]);

  // Initial fetch on mount
  useEffect(() => {
    fetchUser(false);
  }, [fetchUser]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    refetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Backward compatibility - create a hook that matches the old API
export function useCurrentUser() {
  const { user, loading, error } = useAuth();
  return { user, loading, error };
}
