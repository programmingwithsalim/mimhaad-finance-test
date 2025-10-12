"use client"

import { useState } from "react"

const ManualJumiaGLPosting = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleTestPosting = async () => {
    setIsLoading(true)
    setResult(null)

    try {
      // Use a default user ID for testing - in production, get from auth context
      const userId = "test-user-id"
      const branchId = "test-branch-id"

      const response = await fetch("/api/debug/test-jumia-gl-posting-enhanced", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, branchId }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error("Error testing GL posting:", error)
      setResult({
        success: false,
        error: "Failed to test GL posting",
        details: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h1>Manual Jumia GL Posting</h1>
      <button onClick={handleTestPosting} disabled={isLoading}>
        {isLoading ? "Loading..." : "Test GL Posting"}
      </button>

      {result && (
        <div>
          <h2>Result:</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default ManualJumiaGLPosting
