import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Default expense heads to seed
const defaultExpenseHeads = [
  {
    id: "depreciation",
    name: "Depreciation",
    category: "Administrative",
    description: "Depreciation of fixed assets",
    gl_account_code: "5006",
  },
  {
    id: "amortization",
    name: "Amortization",
    category: "Administrative",
    description: "Amortization of intangible assets",
    gl_account_code: "5011",
  },
  {
    id: "office-supplies",
    name: "Office Supplies",
    category: "Operational",
    description: "Stationery and office materials",
    gl_account_code: "6100",
  },
  {
    id: "utilities",
    name: "Utilities",
    category: "Operational",
    description: "Electricity, water, internet bills",
    gl_account_code: "6200",
  },
  {
    id: "travel-transport",
    name: "Travel & Transport",
    category: "Operational",
    description: "Business travel and transportation",
    gl_account_code: "6500",
  },
  {
    id: "rent",
    name: "Rent",
    category: "Operational",
    description: "Office/building rent",
    gl_account_code: "6300",
  },
  {
    id: "salaries",
    name: "Salaries & Wages",
    category: "Human Resources",
    description: "Staff salaries and wages",
    gl_account_code: "6400",
  },
  {
    id: "marketing",
    name: "Marketing & Advertising",
    category: "Marketing",
    description: "Promotional activities and advertising",
    gl_account_code: "6600",
  },
];

export async function POST() {
  try {
    console.log("Seeding expense heads...");

    const seededHeads = [];

    for (const head of defaultExpenseHeads) {
      try {
        // Insert or update expense head
        await sql`
          INSERT INTO expense_heads (id, name, category, description, gl_account_code, is_active)
          VALUES (
            ${head.id},
            ${head.name},
            ${head.category},
            ${head.description},
            ${head.gl_account_code},
            true
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            gl_account_code = EXCLUDED.gl_account_code,
            is_active = EXCLUDED.is_active
        `;

        seededHeads.push(head.name);
        console.log(`✓ Seeded expense head: ${head.name}`);
      } catch (error) {
        console.error(`✗ Error seeding expense head ${head.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${seededHeads.length} expense heads`,
      heads: seededHeads,
    });
  } catch (error) {
    console.error("Error seeding expense heads:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed expense heads",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
