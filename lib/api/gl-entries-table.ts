export const fetchGLEntriesTableStatus = async () => {
  const response = await fetch("/api/debug/fix-gl-entries-table")
  if (!response.ok) {
    throw new Error("Failed to fetch GL entries table status")
  }
  return response.json()
}

export const createGLEntriesTable = async (data: any) => {
  const response = await fetch("/api/debug/fix-gl-entries-table", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error("Failed to create GL entries table")
  }
  return response.json()
}

export const updateGLEntriesTable = async (data: any) => {
  const response = await fetch("/api/debug/fix-gl-entries-table", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error("Failed to update GL entries table")
  }
  return response.json()
}

export const deleteGLEntriesTable = async (id: string) => {
  const response = await fetch(`/api/debug/fix-gl-entries-table?id=${id}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error("Failed to delete GL entries table")
  }
  return response.json()
}
