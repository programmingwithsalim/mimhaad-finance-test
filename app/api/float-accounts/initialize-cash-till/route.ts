import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    console.log("🔧 Initializing cash in till accounts for all branches...");

    // Get all active branches
    const branches = await sql`
      SELECT id, name FROM branches WHERE is_active = true
    `;

    console.log(`Found ${branches.length} active branches`);

    const results = [];

    for (const branch of branches) {
      console.log(`\nProcessing branch: ${branch.name} (${branch.id})`);

      // Check if cash in till account exists for this branch
      const existingAccount = await sql`
        SELECT id, current_balance, min_threshold, max_threshold 
        FROM float_accounts 
        WHERE branch_id = ${branch.id} 
        AND account_type = 'cash-in-till' 
        AND is_active = true
      `;

      if (existingAccount.length > 0) {
        const account = existingAccount[0];
        console.log(`Cash in till account exists:`);
        console.log(`   - ID: ${account.id}`);
        console.log(`   - Current Balance: ${account.current_balance}`);
        console.log(`   - Min Threshold: ${account.min_threshold}`);
        console.log(`   - Max Threshold: ${account.max_threshold}`);

        results.push({
          branch: branch.name,
          status: "exists",
          account: account,
        });
      } else {
        console.log(`No cash in till account found. Creating one...`);

        // Create cash in till account
        const newAccount = await sql`
          INSERT INTO float_accounts (
            branch_id,
            account_name,
            account_type,
            provider,
            current_balance,
            min_threshold,
            max_threshold,
            is_active
          ) VALUES (
            ${branch.id},
            'Cash in Till',
            'cash-in-till',
            'Cash',
            5000.00,
            1000.00,
            50000.00,
            true
          )
          RETURNING id, current_balance, min_threshold, max_threshold
        `;

        console.log(`Created cash in till account:`);
        console.log(`   - ID: ${newAccount[0].id}`);
        console.log(`   - Current Balance: ${newAccount[0].current_balance}`);
        console.log(`   - Min Threshold: ${newAccount[0].min_threshold}`);
        console.log(`   - Max Threshold: ${newAccount[0].max_threshold}`);

        results.push({
          branch: branch.name,
          status: "created",
          account: newAccount[0],
        });
      }
    }

    console.log("\n🎉 Cash in till account initialization completed!");

    return NextResponse.json({
      success: true,
      message: "Cash in till accounts initialized successfully",
      results: results,
      totalBranches: branches.length,
    });
  } catch (error) {
    console.error("Error initializing cash in till accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize cash in till accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
