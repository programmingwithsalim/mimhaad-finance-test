import { type NextRequest, NextResponse } from "next/server"
import {
  defaultGLMappings,
  getActiveGLMappings,
  getGLMappingsByModule,
  createGLMapping,
  type GLAccountMapping,
} from "@/lib/gl-mapping"

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const module = searchParams.get("module")
    const activeOnly = searchParams.get("activeOnly") === "true"

    let mappings: GLAccountMapping[]

    if (module) {
      // Get mappings for a specific module
      mappings = getGLMappingsByModule(module)
    } else if (activeOnly) {
      // Get only active mappings
      mappings = getActiveGLMappings()
    } else {
      // Get all mappings
      mappings = defaultGLMappings
    }

    return NextResponse.json({ mappings })
  } catch (error) {
    console.error("Error in GET /api/gl/mappings:", error)
    return NextResponse.json({ error: "Failed to fetch GL mappings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      serviceModule,
      transactionType,
      debitAccountId,
      creditAccountId,
      description,
      conditions,
      isActive = true,
    } = body

    // Validate required fields
    if (!serviceModule || !transactionType || !debitAccountId || !creditAccountId || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create the GL mapping
    const mapping = createGLMapping({
      serviceModule,
      transactionType,
      debitAccountId,
      creditAccountId,
      description,
      conditions,
      isActive,
    })

    return NextResponse.json({ mapping })
  } catch (error) {
    console.error("Error in POST /api/gl/mappings:", error)
    return NextResponse.json({ error: "Failed to create GL mapping" }, { status: 500 })
  }
}
