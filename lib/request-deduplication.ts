/**
 * Request Deduplication Utility
 * Prevents duplicate API calls from being made concurrently
 */

type PendingRequest = {
  promise: Promise<any>;
  timestamp: number;
};

const pendingRequests = new Map<string, PendingRequest>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

/**
 * Generate a cache key from URL and options
 */
function getCacheKey(url: string, options?: RequestInit): string {
  const method = options?.method || "GET";
  const body = options?.body ? JSON.stringify(options.body) : "";
  return `${method}:${url}:${body}`;
}

/**
 * Clean up expired pending requests
 */
function cleanupExpiredRequests(): void {
  const now = Date.now();
  for (const [key, request] of pendingRequests.entries()) {
    if (now - request.timestamp > CACHE_TTL) {
      pendingRequests.delete(key);
    }
  }
}

/**
 * Deduplicated fetch - prevents multiple identical requests from being made concurrently
 */
export async function deduplicatedFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const cacheKey = getCacheKey(url, options);

  // Clean up expired requests periodically
  if (Math.random() < 0.1) {
    cleanupExpiredRequests();
  }

  // Check if there's already a pending request for this key
  const existing = pendingRequests.get(cacheKey);
  if (existing) {
    // Return the existing promise
    return existing.promise;
  }

  // Create a new request
  const promise = fetch(url, options)
    .then((response) => {
      // Remove from pending requests after completion
      setTimeout(() => {
        pendingRequests.delete(cacheKey);
      }, 100);
      return response;
    })
    .catch((error) => {
      // Remove from pending requests on error
      pendingRequests.delete(cacheKey);
      throw error;
    });

  // Store the pending request
  pendingRequests.set(cacheKey, {
    promise,
    timestamp: Date.now(),
  });

  return promise;
}

/**
 * Clear all pending requests (useful for cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Get count of pending requests (for debugging)
 */
export function getPendingRequestsCount(): number {
  return pendingRequests.size;
}



