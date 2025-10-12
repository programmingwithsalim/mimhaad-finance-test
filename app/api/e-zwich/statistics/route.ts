import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    console.log("Fetching E-Zwich statistics for branch:", branchId);

    // First, check if the tables exist
    const tableCheck = await sql`
      SELECT 
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'e_zwich_withdrawals') as withdrawals_exist,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ezwich_card_issuance') as issuances_exist
    `;

    const tablesExist = tableCheck[0];
    console.log("Table existence check:", tablesExist);

    let todayWithdrawals = [
      {
        today_withdrawals: 0,
        today_withdrawal_volume: 0,
        today_withdrawal_fees: 0,
      },
    ];
    let todayIssuances = [{ today_issuances: 0, today_issuance_fees: 0 }];
    let totalWithdrawals = [
      {
        total_withdrawals: 0,
        total_withdrawal_volume: 0,
        total_withdrawal_fees: 0,
      },
    ];
    let totalIssuances = [{ total_issuances: 0, total_issuance_fees: 0 }];

    // Only query if tables exist
    if (tablesExist.withdrawals_exist) {
      // Check what columns exist in e_zwich_withdrawals
      const withdrawalColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'e_zwich_withdrawals'
      `;

      const hasStatus = withdrawalColumns.some(
        (col) => col.column_name === "status"
      );
      const hasTransactionDate = withdrawalColumns.some(
        (col) => col.column_name === "transaction_date"
      );
      const hasIsReversal = withdrawalColumns.some(
        (col) => col.column_name === "is_reversal"
      );

      console.log(
        "E-Zwich withdrawals columns:",
        withdrawalColumns.map((col) => col.column_name)
      );
      console.log(
        "Has status:",
        hasStatus,
        "Has transaction_date:",
        hasTransactionDate,
        "Has is_reversal:",
        hasIsReversal
      );

      // Build withdrawal queries based on available columns
      if (hasStatus && hasTransactionDate && hasIsReversal) {
        [todayWithdrawals, totalWithdrawals] = await Promise.all([
          sql`
            SELECT 
              COUNT(*) as today_withdrawals,
              COALESCE(SUM(amount), 0) as today_withdrawal_volume,
              COALESCE(SUM(fee), 0) as today_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
            AND DATE(transaction_date) = CURRENT_DATE
            AND (is_reversal IS NULL OR is_reversal = false)
          `,
          sql`
            SELECT 
              COUNT(*) as total_withdrawals,
              COALESCE(SUM(amount), 0) as total_withdrawal_volume,
              COALESCE(SUM(fee), 0) as total_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
            AND (is_reversal IS NULL OR is_reversal = false)
          `,
        ]);
      } else if (hasStatus && hasIsReversal) {
        [todayWithdrawals, totalWithdrawals] = await Promise.all([
          sql`
            SELECT 
              COUNT(*) as today_withdrawals,
              COALESCE(SUM(amount), 0) as today_withdrawal_volume,
              COALESCE(SUM(fee), 0) as today_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
            AND DATE(created_at) = CURRENT_DATE
            AND (is_reversal IS NULL OR is_reversal = false)
          `,
          sql`
            SELECT 
              COUNT(*) as total_withdrawals,
              COALESCE(SUM(amount), 0) as total_withdrawal_volume,
              COALESCE(SUM(fee), 0) as total_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
            AND (is_reversal IS NULL OR is_reversal = false)
          `,
        ]);
      } else if (hasStatus) {
        [todayWithdrawals, totalWithdrawals] = await Promise.all([
          sql`
            SELECT 
              COUNT(*) as today_withdrawals,
              COALESCE(SUM(amount), 0) as today_withdrawal_volume,
              COALESCE(SUM(fee), 0) as today_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
            AND DATE(created_at) = CURRENT_DATE
          `,
          sql`
            SELECT 
              COUNT(*) as total_withdrawals,
              COALESCE(SUM(amount), 0) as total_withdrawal_volume,
              COALESCE(SUM(fee), 0) as total_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
          `,
        ]);
      } else {
        [todayWithdrawals, totalWithdrawals] = await Promise.all([
          sql`
            SELECT 
              COUNT(*) as today_withdrawals,
              COALESCE(SUM(amount), 0) as today_withdrawal_volume,
              COALESCE(SUM(fee), 0) as today_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
            AND DATE(created_at) = CURRENT_DATE
          `,
          sql`
            SELECT 
              COUNT(*) as total_withdrawals,
              COALESCE(SUM(amount), 0) as total_withdrawal_volume,
              COALESCE(SUM(fee), 0) as total_withdrawal_fees
            FROM e_zwich_withdrawals 
            WHERE branch_id = ${branchId}
          `,
        ]);
      }
    }

    if (tablesExist.issuances_exist) {
      // Check what columns exist in ezwich_card_issuance
      const issuanceColumns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'ezwich_card_issuance'
      `;

      const hasStatus = issuanceColumns.some(
        (col) => col.column_name === "status"
      );

      console.log(
        "E-Zwich card issuance columns:",
        issuanceColumns.map((col) => col.column_name)
      );
      console.log("Has status:", hasStatus);

      // Build issuance queries based on available columns
      if (hasStatus) {
        [todayIssuances, totalIssuances] = await Promise.all([
          sql`
            SELECT 
              COUNT(*) as today_issuances,
              COALESCE(SUM(fee_charged), 0) as today_issuance_fees
            FROM ezwich_card_issuance 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
            AND DATE(created_at) = CURRENT_DATE
          `,
          sql`
            SELECT 
              COUNT(*) as total_issuances,
              COALESCE(SUM(fee_charged), 0) as total_issuance_fees
            FROM ezwich_card_issuance 
            WHERE branch_id = ${branchId}
            AND status IN ('pending', 'completed', 'disbursed')
          `,
        ]);
      } else {
        [todayIssuances, totalIssuances] = await Promise.all([
          sql`
            SELECT 
              COUNT(*) as today_issuances,
              COALESCE(SUM(fee_charged), 0) as today_issuance_fees
            FROM ezwich_card_issuance 
            WHERE branch_id = ${branchId}
            AND DATE(created_at) = CURRENT_DATE
          `,
          sql`
            SELECT 
              COUNT(*) as total_issuances,
              COALESCE(SUM(fee_charged), 0) as total_issuance_fees
            FROM ezwich_card_issuance 
            WHERE branch_id = ${branchId}
          `,
        ]);
      }
    }

    // Check if isezwichpartner column exists
    let hasIsezwichpartner = false;
    try {
      const columnCheck = await sql`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'float_accounts' 
          AND column_name = 'isezwichpartner'
        ) as exists
      `;
      hasIsezwichpartner = columnCheck[0]?.exists || false;
    } catch (error) {
      console.warn(
        "Could not check isezwichpartner column, using account_type filter:",
        error
      );
      hasIsezwichpartner = false;
    }

    // Get active providers count (E-Zwich partners)
    let providerStats;
    if (hasIsezwichpartner) {
      providerStats = await sql`
        SELECT COUNT(*) as active_providers
        FROM float_accounts 
        WHERE branch_id = ${branchId}
        AND is_active = true
        AND (isezwichpartner = true OR account_type = 'e-zwich')
      `;
    } else {
      providerStats = await sql`
        SELECT COUNT(*) as active_providers
        FROM float_accounts 
        WHERE branch_id = ${branchId}
        AND is_active = true
        AND account_type = 'e-zwich'
      `;
    }

    // Get float balance for E-Zwich accounts
    let floatStats;
    if (hasIsezwichpartner) {
      floatStats = await sql`
        SELECT 
          COALESCE(SUM(current_balance), 0) as float_balance,
          COUNT(*) as low_float_alerts
        FROM float_accounts 
        WHERE branch_id = ${branchId}
        AND is_active = true
        AND (isezwichpartner = true OR account_type = 'e-zwich')
        AND current_balance <= min_threshold
      `;
    } else {
      floatStats = await sql`
        SELECT 
          COALESCE(SUM(current_balance), 0) as float_balance,
          COUNT(*) as low_float_alerts
        FROM float_accounts 
        WHERE branch_id = ${branchId}
        AND is_active = true
        AND account_type = 'e-zwich'
        AND current_balance <= min_threshold
      `;
    }

    // Calculate total float balance (not just low balance accounts)
    let totalFloatBalance;
    if (hasIsezwichpartner) {
      totalFloatBalance = await sql`
        SELECT COALESCE(SUM(current_balance), 0) as total_float_balance
        FROM float_accounts 
        WHERE branch_id = ${branchId}
        AND is_active = true
        AND (isezwichpartner = true OR account_type = 'e-zwich')
      `;
    } else {
      totalFloatBalance = await sql`
        SELECT COALESCE(SUM(current_balance), 0) as total_float_balance
        FROM float_accounts 
        WHERE branch_id = ${branchId}
        AND is_active = true
        AND account_type = 'e-zwich'
      `;
    }

    // Calculate commission (1.5% of withdrawal volume)
    const todayCommission =
      Number(todayWithdrawals[0]?.today_withdrawal_volume || 0) * 0.015 +
      Number(todayIssuances[0]?.today_issuance_fees || 0);

    const totalCommission =
      Number(totalWithdrawals[0]?.total_withdrawal_volume || 0) * 0.015 +
      Number(totalIssuances[0]?.total_issuance_fees || 0);

    const statistics = {
      todayTransactions:
        Number(todayWithdrawals[0]?.today_withdrawals || 0) +
        Number(todayIssuances[0]?.today_issuances || 0),
      totalTransactions:
        Number(totalWithdrawals[0]?.total_withdrawals || 0) +
        Number(totalIssuances[0]?.total_issuances || 0),
      todayVolume:
        Number(todayWithdrawals[0]?.today_withdrawal_volume || 0) +
        Number(todayIssuances[0]?.today_issuance_fees || 0),
      totalVolume:
        Number(totalWithdrawals[0]?.total_withdrawal_volume || 0) +
        Number(totalIssuances[0]?.total_issuance_fees || 0),
      todayCommission: todayCommission,
      totalCommission: totalCommission,
      activeProviders: Number(providerStats[0]?.active_providers || 0),
      floatBalance: Number(totalFloatBalance[0]?.total_float_balance || 0),
      lowFloatAlerts: Number(floatStats[0]?.low_float_alerts || 0),
    };

    console.log("E-Zwich statistics:", statistics);

    return NextResponse.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching E-Zwich statistics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch E-Zwich statistics" },
      { status: 500 }
    );
  }
}
