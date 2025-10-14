import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function POST() {
  try {
    console.log("🧹 Cleaning up duplicate GL accounts...");

    // Find duplicate accounts by code
    const duplicates = await sql`
      SELECT code, COUNT(*) as count
      FROM gl_accounts
      GROUP BY code
      HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} duplicate account codes`);

    for (const duplicate of duplicates) {
      console.log(`Cleaning up duplicates for account code: ${duplicate.code}`);

      // Get all accounts with this code, ordered by creation date (keep the oldest)
      const accounts = await sql`
        SELECT id, created_at, balance
        FROM gl_accounts
        WHERE code = ${duplicate.code}
        ORDER BY created_at ASC
      `;

      if (accounts.length > 1) {
        // Keep the first (oldest) account
        const keepAccount = accounts[0];
        const duplicateAccounts = accounts.slice(1);

        // Sum up balances from duplicate accounts
        let totalBalance = Number(keepAccount.balance) || 0;
        for (const dupAccount of duplicateAccounts) {
          totalBalance += Number(dupAccount.balance) || 0;
        }

        // Update the kept account with the total balance
        await sql`
          UPDATE gl_accounts
          SET balance = ${totalBalance}, updated_at = NOW()
          WHERE id = ${keepAccount.id}
        `;

        // Delete the duplicate accounts
        for (const dupAccount of duplicateAccounts) {
          await sql`DELETE FROM gl_accounts WHERE id = ${dupAccount.id}`;
        }

        console.log(
          `Merged ${duplicateAccounts.length} duplicate accounts for code ${duplicate.code}`
        );
      }
    }

    console.log("GL accounts cleanup completed");

    return NextResponse.json({
      success: true,
      message: "GL accounts cleanup completed",
      duplicatesFound: duplicates.length,
    });
  } catch (error) {
    console.error("Error cleaning up GL accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cleanup GL accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
