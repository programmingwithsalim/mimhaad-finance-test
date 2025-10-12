import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    console.log("🌱 [FLOAT] Seeding float accounts...");

    // Get current user for branch context
    let user;
    try {
      user = await getCurrentUser();
    } catch (authError) {
      console.warn("Authentication failed, using fallback:", authError);
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        name: "System User",
        username: "system",
        role: "Admin",
        branchId: "635844ab-029a-43f8-8523-d7882915266a",
        branchName: "Main Branch",
      };
    }

    // Check if float_accounts table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'float_accounts'
      ) as exists
    `;

    if (!tableExists[0]?.exists) {
      console.log("🌱 [FLOAT] Creating float_accounts table...");

      await sql`
        CREATE TABLE IF NOT EXISTS float_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          account_type VARCHAR(50) NOT NULL,
          provider VARCHAR(100) NOT NULL,
          account_number VARCHAR(100),
          current_balance DECIMAL(15,2) DEFAULT 0,
          min_threshold DECIMAL(15,2) DEFAULT 1000,
          max_threshold DECIMAL(15,2) DEFAULT 50000,
          is_active BOOLEAN DEFAULT true,
          branch_id UUID NOT NULL REFERENCES branches(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by UUID REFERENCES users(id),
          isezwichpartner BOOLEAN DEFAULT false,
          notes TEXT
        )
      `;

      // Create indexes
      await sql`
        CREATE INDEX IF NOT EXISTS idx_float_accounts_branch_id ON float_accounts(branch_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_float_accounts_account_type ON float_accounts(account_type)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_float_accounts_provider ON float_accounts(provider)
      `;
    }

    // Check if we already have float accounts
    const existingCount = await sql`
      SELECT COUNT(*) as count FROM float_accounts
    `;

    if (existingCount[0]?.count > 0) {
      console.log(
        `🌱 [FLOAT] Found ${existingCount[0].count} existing float accounts`
      );
      return NextResponse.json({
        success: true,
        message: `Found ${existingCount[0].count} existing float accounts`,
        count: existingCount[0].count,
      });
    }

    // Get branches to create accounts for
    const branches = await sql`
      SELECT id, name FROM branches WHERE is_active = true
    `;

    if (branches.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No active branches found",
        },
        { status: 400 }
      );
    }

    console.log(
      `🌱 [FLOAT] Creating float accounts for ${branches.length} branches`
    );

    // Sample float accounts to create
    const sampleAccounts = [
      {
        account_type: "momo",
        provider: "MTN",
        current_balance: 5000,
        min_threshold: 1000,
        max_threshold: 20000,
      },
      {
        account_type: "momo",
        provider: "Vodafone",
        current_balance: 3000,
        min_threshold: 1000,
        max_threshold: 15000,
      },
      {
        account_type: "agency-banking",
        provider: "Ghana Commercial Bank",
        current_balance: 10000,
        min_threshold: 2000,
        max_threshold: 50000,
      },
      {
        account_type: "e-zwich",
        provider: "Ghana Interbank Payment",
        current_balance: 2000,
        min_threshold: 500,
        max_threshold: 10000,
      },
      {
        account_type: "cash-in-till",
        provider: "Cash",
        current_balance: 15000,
        min_threshold: 5000,
        max_threshold: 100000,
      },
      {
        account_type: "power",
        provider: "ECG",
        current_balance: 8000,
        min_threshold: 1000,
        max_threshold: 25000,
      },
    ];

    let createdCount = 0;

    // Create float accounts for each branch
    for (const branch of branches) {
      for (const account of sampleAccounts) {
        try {
          await sql`
            INSERT INTO float_accounts (
              account_type,
              provider,
              account_number,
              current_balance,
              min_threshold,
              max_threshold,
              is_active,
              branch_id,
              created_by,
              notes
            ) VALUES (
              ${account.account_type},
              ${account.provider},
              ${`${account.provider}-${account.account_type}-${branch.name}`},
              ${account.current_balance},
              ${account.min_threshold},
              ${account.max_threshold},
              true,
              ${branch.id},
              ${user.id},
              ${`Sample ${account.account_type} account for ${branch.name}`}
            )
          `;
          createdCount++;
        } catch (error) {
          console.warn(
            `Failed to create account ${account.account_type} for ${branch.name}:`,
            error
          );
        }
      }
    }

    console.log(
      `🌱 [FLOAT] Created ${createdCount} float accounts successfully`
    );

    return NextResponse.json({
      success: true,
      message: `Created ${createdCount} float accounts successfully`,
      count: createdCount,
    });
  } catch (error) {
    console.error("🌱 [FLOAT] Error seeding float accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed float accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
