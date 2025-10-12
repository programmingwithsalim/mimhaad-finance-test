import { promises as fs } from "fs"
import path from "path"

export const JOURNAL_ENTRIES_FILE_PATH = "data/journal-entries.json"

/**
 * Initialize journal entries file if it doesn't exist
 */
export async function initJournalEntriesFile(): Promise<void> {
  try {
    const exists = await fileExists(JOURNAL_ENTRIES_FILE_PATH)
    if (!exists) {
      await writeJsonFile(JOURNAL_ENTRIES_FILE_PATH, { journalEntries: [] })
    }
  } catch (error) {
    console.error("Error initializing journal entries file:", error)
    throw new Error("Failed to initialize journal entries file")
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Read and parse a JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8")
    return JSON.parse(fileContent) as T
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}:`, error)
    throw new Error(`Failed to read JSON file: ${filePath}`)
  }
}

/**
 * Write data to a JSON file
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })

    // Write file
    const jsonContent = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, jsonContent, "utf-8")
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}:`, error)
    throw new Error(`Failed to write JSON file: ${filePath}`)
  }
}
