import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userRole = searchParams.get("userRole");
    const userBranchId = searchParams.get("userBranchId");

    console.log("Dashboard statistics API called with:", {
      userRole,
      userBranchId,
      url: request.url,
    });

    // Determine effective branch filter based on user role
    const isAdmin = userRole === "Admin";
    const effectiveBranchId = isAdmin ? null : userBranchId;
    const branchFilter = effectiveBranchId
      ? sql`AND branch_id = ${effectiveBranchId}`
      : sql``;

    console.log("Branch filter determined:", {
      isAdmin,
      effectiveBranchId,
      hasBranchFilter: !!effectiveBranchId,
    });

    // Get today's date for filtering
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    console.log("Date filters:", { today, yesterday });

    // Check if we have any data in the database
    const dataCheckRes = await sql`SELECT 
      (SELECT COUNT(*) FROM momo_transactions) as momo_count,
      (SELECT COUNT(*) FROM agency_banking_transactions) as agency_count,
      (SELECT COUNT(*) FROM e_zwich_withdrawals) as ezwich_count,
      (SELECT COUNT(*) FROM power_transactions) as power_count,
      (SELECT COUNT(*) FROM jumia_transactions) as jumia_count,
      (SELECT COUNT(*) FROM users WHERE status = 'active') as user_count
    `;

    console.log("Database data check:", dataCheckRes[0]);

    // If no data exists, provide sample data for testing
    const hasData =
      dataCheckRes[0] &&
      (Number(dataCheckRes[0].momo_count) > 0 ||
        Number(dataCheckRes[0].agency_count) > 0 ||
        Number(dataCheckRes[0].ezwich_count) > 0 ||
        Number(dataCheckRes[0].power_count) > 0 ||
        Number(dataCheckRes[0].jumia_count) > 0);

    console.log("Has transaction data:", hasData);

    // Total branches (only for admin)
    const branchRes = isAdmin
      ? await sql`SELECT COUNT(*) AS total FROM branches WHERE status = 'active'`
      : [{ total: 1 }];
    const totalBranches = Number(branchRes[0]?.total || 0);

    // Total users (filtered by branch for non-admin)
    console.log("Executing users query with:", { effectiveBranchId, isAdmin });
    let totalUsers = 0;
    try {
      const userRes = effectiveBranchId
        ? await sql`SELECT COUNT(*) AS total FROM users WHERE status = 'active' AND primary_branch_id = ${effectiveBranchId}`
        : await sql`SELECT COUNT(*) AS total FROM users WHERE status = 'active'`;
      totalUsers = Number(userRes[0]?.total || 0);
      console.log("Users query result:", { totalUsers, rawResult: userRes[0] });
    } catch (error) {
      console.error("Error fetching users:", error);
      totalUsers = 0;
    }

    // Today's MoMo transactions
    let momoTodayRes;
    if (effectiveBranchId) {
      momoTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM momo_transactions 
        WHERE status = 'completed' AND DATE(created_at) = ${today} AND branch_id = ${effectiveBranchId}
      `;
    } else {
      momoTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM momo_transactions 
        WHERE status = 'completed' AND DATE(created_at) = ${today}
      `;
    }
    const todayMomoTransactions = Number(momoTodayRes[0]?.total || 0);
    const todayMomoVolume = Number(momoTodayRes[0]?.volume || 0);

    // Total MoMo transactions
    let momoRes;
    if (effectiveBranchId) {
      momoRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM momo_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;
    } else {
      momoRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM momo_transactions 
        WHERE status = 'completed'
      `;
    }
    const totalMomoTransactions = Number(momoRes[0]?.total || 0);
    const totalMomoVolume = Number(momoRes[0]?.volume || 0);

    // Today's Agency Banking transactions
    let agencyTodayRes;
    if (effectiveBranchId) {
      agencyTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM agency_banking_transactions 
        WHERE status = 'completed' AND DATE(date) = ${today} AND branch_id = ${effectiveBranchId}
      `;
    } else {
      agencyTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM agency_banking_transactions 
        WHERE status = 'completed' AND DATE(date) = ${today}
      `;
    }
    const todayAgencyTransactions = Number(agencyTodayRes[0]?.total || 0);
    const todayAgencyVolume = Number(agencyTodayRes[0]?.volume || 0);

    // Total Agency Banking transactions
    let agencyRes;
    if (effectiveBranchId) {
      agencyRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM agency_banking_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;
    } else {
      agencyRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM agency_banking_transactions 
        WHERE status = 'completed'
      `;
    }
    const totalAgencyTransactions = Number(agencyRes[0]?.total || 0);
    const totalAgencyVolume = Number(agencyRes[0]?.volume || 0);

    // Today's E-Zwich withdrawals
    let ezwichTodayRes;
    if (effectiveBranchId) {
      ezwichTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM e_zwich_withdrawals 
        WHERE status = 'completed' AND DATE(transaction_date) = ${today} AND branch_id = ${effectiveBranchId}
      `;
    } else {
      ezwichTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM e_zwich_withdrawals 
        WHERE status = 'completed' AND DATE(transaction_date) = ${today}
      `;
    }
    const todayEzwichTransactions = Number(ezwichTodayRes[0]?.total || 0);
    const todayEzwichVolume = Number(ezwichTodayRes[0]?.volume || 0);

    // Total E-Zwich withdrawals
    let ezwichRes;
    if (effectiveBranchId) {
      ezwichRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM e_zwich_withdrawals 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;
    } else {
      ezwichRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM e_zwich_withdrawals 
        WHERE status = 'completed'
      `;
    }
    const totalEzwichTransactions = Number(ezwichRes[0]?.total || 0);
    const totalEzwichVolume = Number(ezwichRes[0]?.volume || 0);

    // Today's Power transactions
    let powerTodayRes;
    if (effectiveBranchId) {
      powerTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM power_transactions 
        WHERE status = 'completed' AND DATE(created_at) = ${today} AND branch_id = ${effectiveBranchId}
      `;
    } else {
      powerTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM power_transactions 
        WHERE status = 'completed' AND DATE(created_at) = ${today}
      `;
    }
    const todayPowerTransactions = Number(powerTodayRes[0]?.total || 0);
    const todayPowerVolume = Number(powerTodayRes[0]?.volume || 0);

    // Total Power transactions
    let powerRes;
    if (effectiveBranchId) {
      powerRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM power_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;
    } else {
      powerRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM power_transactions 
        WHERE status = 'completed'
      `;
    }
    const totalPowerTransactions = Number(powerRes[0]?.total || 0);
    const totalPowerVolume = Number(powerRes[0]?.volume || 0);

    // Today's Jumia transactions
    let jumiaTodayRes;
    if (effectiveBranchId) {
      jumiaTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM jumia_transactions 
        WHERE deleted = false AND DATE(created_at) = ${today} AND branch_id = ${effectiveBranchId}
      `;
    } else {
      jumiaTodayRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM jumia_transactions 
        WHERE deleted = false AND DATE(created_at) = ${today}
      `;
    }
    const todayJumiaTransactions = Number(jumiaTodayRes[0]?.total || 0);
    const todayJumiaVolume = Number(jumiaTodayRes[0]?.volume || 0);

    // Total Jumia transactions
    let jumiaRes;
    if (effectiveBranchId) {
      jumiaRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM jumia_transactions 
        WHERE deleted = false AND branch_id = ${effectiveBranchId}
      `;
    } else {
      jumiaRes = await sql`
        SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS volume 
        FROM jumia_transactions 
        WHERE deleted = false
      `;
    }
    const totalJumiaTransactions = Number(jumiaRes[0]?.total || 0);
    const totalJumiaVolume = Number(jumiaRes[0]?.volume || 0);

    // Today's commissions
    let commissionTodayRes;
    if (effectiveBranchId) {
      commissionTodayRes = await sql`
        SELECT COALESCE(SUM(amount),0) AS total 
        FROM commissions 
        WHERE status = 'approved' AND DATE(created_at) = ${today} AND branch_id = ${effectiveBranchId}
      `;
    } else {
      commissionTodayRes = await sql`
        SELECT COALESCE(SUM(amount),0) AS total 
        FROM commissions 
        WHERE status = 'approved' AND DATE(created_at) = ${today}
      `;
    }
    const todayCommissions = Number(commissionTodayRes[0]?.total || 0);

    // Total commissions
    let commissionRes;
    if (effectiveBranchId) {
      commissionRes = await sql`
        SELECT COALESCE(SUM(amount),0) AS total 
        FROM commissions 
        WHERE status = 'approved' AND branch_id = ${effectiveBranchId}
      `;
    } else {
      commissionRes = await sql`
        SELECT COALESCE(SUM(amount),0) AS total 
        FROM commissions 
        WHERE status = 'approved'
      `;
    }
    const totalCommissions = Number(commissionRes[0]?.total || 0);

    // Active users (filtered by branch for non-admin)
    let activeUserRes;
    if (effectiveBranchId) {
      activeUserRes = await sql`
        SELECT COUNT(*) AS total FROM users WHERE status = 'active' AND primary_branch_id = ${effectiveBranchId}
      `;
    } else {
      activeUserRes = await sql`
        SELECT COUNT(*) AS total FROM users WHERE status = 'active'
      `;
    }
    const activeUsers = Number(activeUserRes[0]?.total || 0);

    // Pending approvals (commissions)
    let pendingRes;
    if (effectiveBranchId) {
      pendingRes = await sql`
        SELECT COUNT(*) AS total 
        FROM commissions 
        WHERE status = 'pending' AND branch_id = ${effectiveBranchId}
      `;
    } else {
      pendingRes = await sql`
        SELECT COUNT(*) AS total 
        FROM commissions 
        WHERE status = 'pending'
      `;
    }
    const pendingApprovals = Number(pendingRes[0]?.total || 0);

    // Float alerts - accounts below threshold (filtered by branch for non-admin)
    // Exclude jumia and e-zwich accounts from alerts when they're at 0
    let floatAlertsRes;
    if (effectiveBranchId) {
      floatAlertsRes = await sql`
        SELECT 
          id,
          account_type as provider,
          account_type as service,
          current_balance,
          min_threshold as threshold,
          CASE 
            WHEN current_balance <= min_threshold * 0.5 THEN 'critical'
            ELSE 'warning'
          END as severity
        FROM float_accounts 
        WHERE current_balance <= min_threshold 
          AND is_active = true 
          AND account_type NOT IN ('jumia', 'e-zwich') -- Exclude these from alerts
          AND branch_id = ${effectiveBranchId}
      `;
    } else {
      floatAlertsRes = await sql`
        SELECT 
          id,
          account_type as provider,
          account_type as service,
          current_balance,
          min_threshold as threshold,
          CASE 
            WHEN current_balance <= min_threshold * 0.5 THEN 'critical'
            ELSE 'warning'
          END as severity
        FROM float_accounts 
        WHERE current_balance <= min_threshold 
          AND is_active = true 
          AND account_type NOT IN ('jumia', 'e-zwich') -- Exclude these from alerts
      `;
    }
    const floatAlerts = floatAlertsRes.map((row: any) => ({
      id: row.id,
      provider: row.provider,
      service: row.service,
      current_balance: Number(row.current_balance),
      threshold: Number(row.threshold),
      severity: row.severity,
    }));

    console.log(
      "Float alerts found:",
      floatAlerts.length,
      "for branch filter:",
      !!effectiveBranchId
    );

    // Recent activity with actual transaction amounts (filtered by branch for non-admin)
    let activityRes;
    if (effectiveBranchId) {
      activityRes = await sql`
        SELECT 
          id,
          'momo_transaction' as entity_type,
          amount,
          created_at,
          'MoMo Transaction' as description,
          'completed' as status,
          'MoMo' as service
        FROM momo_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
        
        UNION ALL
        
        SELECT 
          id,
          'agency_banking_transaction' as entity_type,
          amount,
          date as created_at,
          'Agency Banking Transaction' as description,
          'completed' as status,
          'Agency Banking' as service
        FROM agency_banking_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
        
        UNION ALL
        
        SELECT 
          id,
          'e_zwich_withdrawal' as entity_type,
          amount,
          transaction_date as created_at,
          'E-Zwich Withdrawal' as description,
          'completed' as status,
          'E-Zwich' as service
        FROM e_zwich_withdrawals 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
        
        UNION ALL
        
        SELECT 
          id,
          'power_transaction' as entity_type,
          amount,
          created_at,
          'Power Transaction' as description,
          'completed' as status,
          'Power' as service
        FROM power_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
        
        UNION ALL
        
        SELECT 
          id,
          'jumia_transaction' as entity_type,
          amount,
          created_at,
          'Jumia Transaction' as description,
          'completed' as status,
          'Jumia' as service
        FROM jumia_transactions 
        WHERE deleted = false AND branch_id = ${effectiveBranchId}
        
        ORDER BY created_at DESC 
        LIMIT 10
      `;
    } else {
      activityRes = await sql`
        SELECT 
          id,
          'momo_transaction' as entity_type,
          amount,
          created_at,
          'MoMo Transaction' as description,
          'completed' as status,
          'MoMo' as service
        FROM momo_transactions 
        WHERE status = 'completed'
        
        UNION ALL
        
        SELECT 
          id,
          'agency_banking_transaction' as entity_type,
          amount,
          date as created_at,
          'Agency Banking Transaction' as description,
          'completed' as status,
          'Agency Banking' as service
        FROM agency_banking_transactions 
        WHERE status = 'completed'
        
        UNION ALL
        
        SELECT 
          id,
          'e_zwich_withdrawal' as entity_type,
          amount,
          transaction_date as created_at,
          'E-Zwich Withdrawal' as description,
          'completed' as status,
          'E-Zwich' as service
        FROM e_zwich_withdrawals 
        WHERE status = 'completed'
        
        UNION ALL
        
        SELECT 
          id,
          'power_transaction' as entity_type,
          amount,
          created_at,
          'Power Transaction' as description,
          'completed' as status,
          'Power' as service
        FROM power_transactions 
        WHERE status = 'completed'
        
        UNION ALL
        
        SELECT 
          id,
          'jumia_transaction' as entity_type,
          amount,
          created_at,
          'Jumia Transaction' as description,
          'completed' as status,
          'Jumia' as service
        FROM jumia_transactions 
        WHERE deleted = false
        
        ORDER BY created_at DESC 
        LIMIT 10
      `;
    }
    const recentActivity = activityRes.map((row: any) => ({
      id: row.id,
      type: "transaction",
      service: row.service,
      amount: Number(row.amount || 0),
      timestamp: row.created_at,
      user: "System", // We'll get this from user context if needed
      description: row.description,
      status: row.status,
    }));

    // Get actual fee data for each service
    let momoFeesRes, agencyFeesRes, ezwichFeesRes, powerFeesRes, jumiaFeesRes;

    if (effectiveBranchId) {
      // MoMo fees (1% of transaction amount)
      momoFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.01), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.01 ELSE 0 END), 0) as today_fees_only
        FROM momo_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;

      // Agency Banking fees (0.5% of transaction amount)
      agencyFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.005), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(date) = ${today} THEN amount * 0.005 ELSE 0 END), 0) as today_fees_only
        FROM agency_banking_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;

      // E-Zwich fees (1% of withdrawal amount)
      ezwichFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.01), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(transaction_date) = ${today} THEN amount * 0.01 ELSE 0 END), 0) as today_fees_only
        FROM e_zwich_withdrawals 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;

      // Power fees (2% of transaction amount)
      powerFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.02), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.02 ELSE 0 END), 0) as today_fees_only
        FROM power_transactions 
        WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
      `;

      // Jumia fees (1% of transaction amount)
      jumiaFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.01), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.01 ELSE 0 END), 0) as today_fees_only
        FROM jumia_transactions 
        WHERE deleted = false AND branch_id = ${effectiveBranchId}
      `;
    } else {
      // MoMo fees (1% of transaction amount)
      momoFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.01), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.01 ELSE 0 END), 0) as today_fees_only
        FROM momo_transactions 
        WHERE status = 'completed'
      `;

      // Agency Banking fees (0.5% of transaction amount)
      agencyFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.005), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(date) = ${today} THEN amount * 0.005 ELSE 0 END), 0) as today_fees_only
        FROM agency_banking_transactions 
        WHERE status = 'completed'
      `;

      // E-Zwich fees (1% of withdrawal amount)
      ezwichFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.01), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(transaction_date) = ${today} THEN amount * 0.01 ELSE 0 END), 0) as today_fees_only
        FROM e_zwich_withdrawals 
        WHERE status = 'completed'
      `;

      // Power fees (2% of transaction amount)
      powerFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.02), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.02 ELSE 0 END), 0) as today_fees_only
        FROM power_transactions 
        WHERE status = 'completed'
      `;

      // Jumia fees (1% of transaction amount)
      jumiaFeesRes = await sql`
        SELECT 
          COALESCE(SUM(amount * 0.01), 0) as today_fees,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.01 ELSE 0 END), 0) as today_fees_only
        FROM jumia_transactions 
        WHERE deleted = false
      `;
    }

    const momoFees = Number(momoFeesRes[0]?.today_fees || 0);
    const momoTodayFees = Number(momoFeesRes[0]?.today_fees_only || 0);
    const agencyFees = Number(agencyFeesRes[0]?.today_fees || 0);
    const agencyTodayFees = Number(agencyFeesRes[0]?.today_fees_only || 0);
    const ezwichFees = Number(ezwichFeesRes[0]?.today_fees || 0);
    const ezwichTodayFees = Number(ezwichFeesRes[0]?.today_fees_only || 0);
    const powerFees = Number(powerFeesRes[0]?.today_fees || 0);
    const powerTodayFees = Number(powerFeesRes[0]?.today_fees_only || 0);
    const jumiaFees = Number(jumiaFeesRes[0]?.today_fees || 0);
    const jumiaTodayFees = Number(jumiaFeesRes[0]?.today_fees_only || 0);

    // Branch stats (only for admin, or single branch for non-admin)
    const branchStatsRes = isAdmin
      ? await sql`SELECT id, name, code, region, status FROM branches`
      : await sql`SELECT id, name, code, region, status FROM branches WHERE id = ${userBranchId}`;
    const branchStats = branchStatsRes;

    // Daily breakdown for the last 7 days (filtered by branch for non-admin)
    let dailyBreakdownRes;
    if (effectiveBranchId) {
      dailyBreakdownRes = await sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transactions,
          COALESCE(SUM(amount), 0) as volume
        FROM (
          SELECT created_at, amount FROM momo_transactions WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
          UNION ALL
          SELECT date as created_at, amount FROM agency_banking_transactions WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
          UNION ALL
          SELECT transaction_date as created_at, amount FROM e_zwich_withdrawals WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
          UNION ALL
          SELECT created_at, amount FROM power_transactions WHERE status = 'completed' AND branch_id = ${effectiveBranchId}
          UNION ALL
          SELECT created_at, amount FROM jumia_transactions WHERE deleted = false AND branch_id = ${effectiveBranchId}
        ) all_transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
    } else {
      dailyBreakdownRes = await sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transactions,
          COALESCE(SUM(amount), 0) as volume
        FROM (
          SELECT created_at, amount FROM momo_transactions WHERE status = 'completed'
          UNION ALL
          SELECT date as created_at, amount FROM agency_banking_transactions WHERE status = 'completed'
          UNION ALL
          SELECT transaction_date as created_at, amount FROM e_zwich_withdrawals WHERE status = 'completed'
          UNION ALL
          SELECT created_at, amount FROM power_transactions WHERE status = 'completed'
          UNION ALL
          SELECT created_at, amount FROM jumia_transactions WHERE deleted = false
        ) all_transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
    }
    const dailyBreakdown = dailyBreakdownRes.map((row: any) => ({
      date: row.date,
      transactions: Number(row.transactions),
      volume: Number(row.volume),
      commission: Number(row.volume) * 0.01, // 1% average commission across all services
    }));

    // Service stats with actual calculated fees
    const serviceStats = [
      {
        service: "MoMo",
        todayTransactions: todayMomoTransactions,
        todayVolume: todayMomoVolume,
        todayFees: momoTodayFees,
        totalTransactions: totalMomoTransactions,
        totalVolume: totalMomoVolume,
        totalFees: momoFees,
      },
      {
        service: "Agency Banking",
        todayTransactions: todayAgencyTransactions,
        todayVolume: todayAgencyVolume,
        todayFees: agencyTodayFees,
        totalTransactions: totalAgencyTransactions,
        totalVolume: totalAgencyVolume,
        totalFees: agencyFees,
      },
      {
        service: "E-Zwich",
        todayTransactions: todayEzwichTransactions,
        todayVolume: todayEzwichVolume,
        todayFees: ezwichTodayFees,
        totalTransactions: totalEzwichTransactions,
        totalVolume: totalEzwichVolume,
        totalFees: ezwichFees,
      },
      {
        service: "Power",
        todayTransactions: todayPowerTransactions,
        todayVolume: todayPowerVolume,
        todayFees: powerTodayFees,
        totalTransactions: totalPowerTransactions,
        totalVolume: totalPowerVolume,
        totalFees: powerFees,
      },
      {
        service: "Jumia",
        todayTransactions: todayJumiaTransactions,
        todayVolume: todayJumiaVolume,
        todayFees: jumiaTodayFees,
        totalTransactions: totalJumiaTransactions,
        totalVolume: totalJumiaVolume,
        totalFees: jumiaFees,
      },
    ];

    // Calculate totals
    const todayTransactions =
      todayMomoTransactions +
      todayAgencyTransactions +
      todayEzwichTransactions +
      todayPowerTransactions +
      todayJumiaTransactions;
    const todayVolume =
      todayMomoVolume +
      todayAgencyVolume +
      todayEzwichVolume +
      todayPowerVolume +
      todayJumiaVolume;
    const todayCommission = todayCommissions;
    const totalTransactions =
      totalMomoTransactions +
      totalAgencyTransactions +
      totalEzwichTransactions +
      totalPowerTransactions +
      totalJumiaTransactions;
    const totalVolume =
      totalMomoVolume +
      totalAgencyVolume +
      totalEzwichVolume +
      totalPowerVolume +
      totalJumiaVolume;

    // Financial metrics
    const financialMetrics = {
      totalRevenue: totalVolume * 0.01, // 1% average revenue
      totalExpenses: totalVolume * 0.005, // 0.5% average expenses
      netIncome: totalVolume * 0.01 - totalVolume * 0.005,
      profitMargin:
        totalVolume > 0
          ? ((totalVolume * 0.01 - totalVolume * 0.005) /
              (totalVolume * 0.01)) *
            100
          : 0,
    };

    // System alerts (filtered by branch for non-admin)
    const systemAlerts = floatAlerts.length;

    return NextResponse.json({
      totalTransactions,
      totalVolume,
      totalCommissions,
      activeUsers,
      todayTransactions,
      todayVolume,
      todayCommission,
      serviceStats,
      recentActivity,
      floatAlerts,
      dailyBreakdown,
      branchStats,
      systemAlerts: floatAlerts.length,
      pendingApprovals,
      users: {
        totalUsers,
        activeUsers,
      },
      // Add fallback values to ensure frontend doesn't break
      financialMetrics: {
        totalRevenue: totalVolume,
        totalExpenses: 0,
        netProfit: totalVolume,
        growthRate: 0,
      },
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    // Return proper error response instead of mock data
    return NextResponse.json(
      {
        error: "Failed to load dashboard statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
