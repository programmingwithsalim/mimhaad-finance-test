import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { packages } = body;

    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return NextResponse.json(
        { success: false, error: "No packages provided" },
        { status: 400 }
      );
    }

    // Create jumia_packages table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS jumia_packages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tracking_id VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        branch_id UUID NOT NULL,
        user_id UUID NOT NULL,
        status VARCHAR(50) DEFAULT 'received',
        received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP WITH TIME ZONE,
        settled_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert packages in bulk
    const insertPromises = packages.map(async (pkg) => {
      const {
        tracking_id,
        customer_name,
        customer_phone,
        branch_id,
        user_id,
        status = "received",
      } = pkg;

      if (!tracking_id || !customer_name) {
        return null;
      }

      try {
        const result = await sql`
          INSERT INTO jumia_packages (
            tracking_id,
            customer_name,
            customer_phone,
            branch_id,
            user_id,
            status,
            received_at
          ) VALUES (
            ${tracking_id},
            ${customer_name},
            ${customer_phone || null},
            ${branch_id},
            ${user_id},
            ${status},
            CURRENT_TIMESTAMP
          )
          RETURNING *
        `;
        return result[0];
      } catch (error) {
        console.error(`Error inserting package ${tracking_id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(insertPromises);
    const successCount = results.filter((r) => r !== null).length;

    return NextResponse.json({
      success: true,
      count: successCount,
      total: packages.length,
      message: `Successfully uploaded ${successCount} out of ${packages.length} packages`,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload packages" },
      { status: 500 }
    );
  }
}
