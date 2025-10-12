import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Generate unique card number
function generateCardNumber(): string {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `627760${timestamp}${random}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const limit = searchParams.get("limit") || "50";

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Ensure table exists with VARCHAR branch_id
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS ezwich_cards (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          card_number VARCHAR(20) UNIQUE NOT NULL,
          batch_id UUID REFERENCES ezwich_card_batches(id),
          customer_name VARCHAR(100) NOT NULL,
          customer_phone VARCHAR(15) NOT NULL,
          customer_email VARCHAR(100),
          date_of_birth DATE,
          gender VARCHAR(10),
          id_type VARCHAR(20),
          id_number VARCHAR(50),
          id_expiry_date DATE,
          address_line1 TEXT,
          address_line2 TEXT,
          city VARCHAR(50),
          region VARCHAR(50),
          postal_code VARCHAR(10),
          country VARCHAR(50) DEFAULT 'Ghana',
          card_status VARCHAR(20) NOT NULL DEFAULT 'active',
          issue_date DATE NOT NULL,
          expiry_date DATE,
          branch_id VARCHAR(50) NOT NULL,
          issued_by VARCHAR(255) NOT NULL,
          fee_charged DECIMAL(10,2) DEFAULT 15.0,
          partner_bank VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (tableError) {
      console.log("Table creation skipped:", tableError);
    }

    const cards = await sql`
      SELECT c.*, cb.batch_code 
      FROM ezwich_cards c
      LEFT JOIN ezwich_card_batches cb ON c.batch_id = cb.id
      WHERE c.branch_id = ${branchId} 
      ORDER BY c.created_at DESC
      LIMIT ${Number.parseInt(limit)}
    `;

    return NextResponse.json({ success: true, data: cards || [] });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cards",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      batch_id,
      customer_name,
      customer_phone,
      customer_email,
      date_of_birth,
      gender,
      id_type,
      id_number,
      id_expiry_date,
      address_line1,
      address_line2,
      city,
      region,
      postal_code,
      country,
      branch_id,
      issued_by,
      fee_charged,
      partner_bank,
    } = body;

    if (
      !batch_id ||
      !customer_name ||
      !customer_phone ||
      !branch_id ||
      !issued_by ||
      !partner_bank
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: batch_id, customer_name, customer_phone, branch_id, issued_by, partner_bank",
        },
        { status: 400 }
      );
    }

    // Check if batch has available cards
    const batch = await sql`
      SELECT quantity_available FROM ezwich_card_batches WHERE id = ${batch_id}
    `;

    if (batch.length === 0) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    if (batch[0].quantity_available <= 0) {
      return NextResponse.json(
        { success: false, error: "No cards available in this batch" },
        { status: 400 }
      );
    }

    const cardNumber = generateCardNumber();
    const issueDate = new Date().toISOString().split("T")[0];
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 5);

    // Insert card
    const cardResult = await sql`
      INSERT INTO ezwich_cards (
        card_number, batch_id, customer_name, customer_phone, customer_email,
        date_of_birth, gender, id_type, id_number, id_expiry_date,
        address_line1, address_line2, city, region, postal_code, country,
        issue_date, expiry_date, branch_id, issued_by, fee_charged, partner_bank
      ) VALUES (
        ${cardNumber}, ${batch_id}, ${customer_name}, ${customer_phone}, 
        ${customer_email || null}, ${date_of_birth || null}, ${gender || null},
        ${id_type || null}, ${id_number || null}, ${id_expiry_date || null},
        ${address_line1 || null}, ${address_line2 || null}, ${city || null},
        ${region || null}, ${postal_code || null}, ${country || "Ghana"},
        ${issueDate}, ${expiryDate.toISOString().split("T")[0]}, ${branch_id}, 
        ${issued_by}, ${fee_charged || 15.0}, ${partner_bank}
      )
      RETURNING *
    `;

    // Update batch quantity
    await sql`
      UPDATE ezwich_card_batches 
      SET quantity_issued = quantity_issued + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${batch_id}
    `;

    return NextResponse.json({ success: true, data: { card: cardResult[0] } });
  } catch (error) {
    console.error("Error issuing card:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to issue card",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
