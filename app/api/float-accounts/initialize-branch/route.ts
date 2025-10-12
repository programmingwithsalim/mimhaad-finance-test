import { NextRequest, NextResponse } from "next/server";
import { FloatAccountService } from "@/lib/services/float-account-service";

export async function POST(request: NextRequest) {
  try {
    const { branch_id, branch_name } = await request.json();

    if (!branch_id) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    console.log(
      `🔧 [FLOAT] Initializing float accounts for branch: ${
        branch_name || branch_id
      }`
    );

    const createdAccounts = [];

    // 1. Create Cash in Till account (one per branch)
    try {
      const cashTillAccount = await FloatAccountService.createFloatAccount({
        branch_id,
        account_type: "cash_till",
        account_name: `Cash in Till - ${branch_name || "Branch"}`,
        initial_balance: 0,
      });
      createdAccounts.push(cashTillAccount);
      console.log("✅ Created Cash in Till account");
    } catch (error) {
      console.log("ℹ️ Cash in Till account already exists");
    }

    // 2. Create Power Float accounts (one per provider)
    const powerProviders = ["NEDCo", "ECG"];
    for (const provider of powerProviders) {
      try {
        const powerAccount = await FloatAccountService.createFloatAccount({
          branch_id,
          account_type: "power",
          provider,
          account_name: `Power Float - ${provider}`,
          initial_balance: 0,
        });
        createdAccounts.push(powerAccount);
        console.log(`✅ Created Power Float account for ${provider}`);
      } catch (error) {
        console.log(`ℹ️ Power Float account for ${provider} already exists`);
      }
    }

    // 3. Create MoMo Float accounts (one per provider)
    const momoProviders = ["MTN", "Telecel", "Z-Pay"];
    for (const provider of momoProviders) {
      try {
        const momoAccount = await FloatAccountService.createFloatAccount({
          branch_id,
          account_type: "momo",
          provider,
          account_name: `MoMo Float - ${provider}`,
          initial_balance: 0,
        });
        createdAccounts.push(momoAccount);
        console.log(`✅ Created MoMo Float account for ${provider}`);
      } catch (error) {
        console.log(`ℹ️ MoMo Float account for ${provider} already exists`);
      }
    }

    // 4. Create Agency Banking Float accounts (one per bank)
    const agencyBanks = ["Cal Bank", "GCB", "Fidelity"];
    for (const bank of agencyBanks) {
      try {
        const agencyAccount = await FloatAccountService.createFloatAccount({
          branch_id,
          account_type: "agency_banking",
          provider: bank,
          account_name: `Agency Banking Float - ${bank}`,
          initial_balance: 0,
        });
        createdAccounts.push(agencyAccount);
        console.log(`✅ Created Agency Banking Float account for ${bank}`);
      } catch (error) {
        console.log(
          `ℹ️ Agency Banking Float account for ${bank} already exists`
        );
      }
    }

    // 5. Create E-Zwich Float account
    try {
      const ezwichAccount = await FloatAccountService.createFloatAccount({
        branch_id,
        account_type: "e_zwich",
        account_name: "E-Zwich Float",
        initial_balance: 0,
      });
      createdAccounts.push(ezwichAccount);
      console.log("✅ Created E-Zwich Float account");
    } catch (error) {
      console.log("ℹ️ E-Zwich Float account already exists");
    }

    // 6. Create Jumia Float account
    try {
      const jumiaAccount = await FloatAccountService.createFloatAccount({
        branch_id,
        account_type: "jumia",
        account_name: "Jumia Float",
        initial_balance: 0,
      });
      createdAccounts.push(jumiaAccount);
      console.log("✅ Created Jumia Float account");
    } catch (error) {
      console.log("ℹ️ Jumia Float account already exists");
    }

    // Get all float accounts for the branch
    const allAccounts = await FloatAccountService.getFloatAccountsByBranch(
      branch_id
    );

    return NextResponse.json({
      success: true,
      message: `Float accounts initialized for branch: ${
        branch_name || branch_id
      }`,
      createdAccounts: createdAccounts.length,
      totalAccounts: allAccounts.length,
      accounts: allAccounts,
    });
  } catch (error) {
    console.error("❌ [FLOAT] Error initializing float accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize float accounts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
