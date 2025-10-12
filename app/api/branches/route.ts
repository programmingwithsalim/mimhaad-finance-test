import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const isDev = process.env.NODE_ENV === "development";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let branches;

    if (includeInactive) {
      branches = await sql`
        SELECT 
          id, name, code, location, region, manager, phone, email, address,
          status, staff_count, created_at, updated_at
        FROM branches
        ORDER BY name ASC
      `;
    } else {
      branches = await sql`
        SELECT 
          id, name, code, location, region, manager, phone, email, address,
          status, staff_count, created_at, updated_at
        FROM branches
        WHERE status = 'active'
        ORDER BY name ASC
      `;
    }

    return NextResponse.json({
      success: true,
      data: branches || [],
    });
  } catch (error) {
    console.error("Error fetching branches:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch branches",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, location, region, phone, email, address, manager } =
      body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: "Name and code are required" },
        { status: 400 }
      );
    }

    // Check if branch code already exists
    const existingBranch = await sql`
      SELECT id FROM branches WHERE code = ${code}
    `;

    if (existingBranch.length > 0) {
      return NextResponse.json(
        { success: false, error: "Branch code already exists" },
        { status: 400 }
      );
    }

    const [branch] = await sql`
      INSERT INTO branches (
        name, code, location, region, phone, email, address, manager, status, staff_count, created_at, updated_at
      )
      VALUES (
        ${name}, 
        ${code}, 
        ${location || ""}, 
        ${region || ""}, 
        ${phone || ""}, 
        ${email || ""}, 
        ${address || ""}, 
        ${manager || "Branch Manager"}, 
        'active', 
        0, 
        NOW(), 
        NOW()
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      branch,
    });
  } catch (error) {
    console.error("Error creating branch:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create branch",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
