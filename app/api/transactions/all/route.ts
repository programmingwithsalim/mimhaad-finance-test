import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import { z } from "zod";

// Input validation schema
const TransactionQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1).default(1)),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100).default(50)),
  search: z.string().optional(),
  service: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  branchId: z.string().optional(),
});

interface TransactionFilters {
  search?: string;
  service?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Parse filters
    const filters: TransactionFilters = {
      search: searchParams.get("search") || undefined,
      service: searchParams.get("service") || undefined,
      status: searchParams.get("status") || undefined,
      type: searchParams.get("type") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      branchId: searchParams.get("branchId") || undefined,
    };

    // Get current user with better error handling
    let user;
    let effectiveBranchId = null;

    try {
      user = await getCurrentUser(request); // Ensure this is awaited if async
      if (!user) throw new Error("No user found");
      console.log("Current user:", user);

      if (user.role === "Admin") {
        effectiveBranchId = filters.branchId || "all";
      } else {
        effectiveBranchId = user.branchId;
      }
    } catch (authError) {
      // Instead of fallback admin, return 401
      console.warn("⚠️ Authentication failed:", authError);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("Fetching transactions with optimized query:", {
      page,
      limit,
      filters,
      userRole: user.role,
      effectiveBranchId,
    });

    // Execute queries using template literals
    let transactionsResult = [];
    let totalCount = 0;

    try {
      console.log("Executing individual table queries...");

      // Query each table individually with hardcoded queries

      // 1. MoMo Transactions
      try {
        let momoCount, momoData;
        if (effectiveBranchId && effectiveBranchId !== "all") {
          momoCount =
            await sql`SELECT COUNT(*) as count FROM momo_transactions WHERE branch_id::text = ${effectiveBranchId}`;
          if (momoCount[0]?.count > 0) {
            momoData = await sql`
              SELECT 
                mt.id, mt.type, mt.amount, mt.fee, mt.customer_name, mt.phone_number, 
                mt.provider, mt.status, mt.created_at as date, mt.branch_id, mt.user_id, mt.reference,
                b.name as branch_name
              FROM momo_transactions mt
              LEFT JOIN branches b ON mt.branch_id = b.id
              WHERE mt.branch_id::text = ${effectiveBranchId}
              ORDER BY mt.created_at DESC 
              LIMIT ${limit}
            `;
          }
        } else {
          momoCount =
            await sql`SELECT COUNT(*) as count FROM momo_transactions`;
          if (momoCount[0]?.count > 0) {
            momoData = await sql`
              SELECT 
                mt.id, mt.type, mt.amount, mt.fee, mt.customer_name, mt.phone_number, 
                mt.provider, mt.status, mt.created_at as date, mt.branch_id, mt.user_id, mt.reference,
                b.name as branch_name
              FROM momo_transactions mt
              LEFT JOIN branches b ON mt.branch_id = b.id
              ORDER BY mt.created_at DESC 
              LIMIT ${limit}
            `;
          }
        }

        const momoCountNum = Number.parseInt(momoCount[0]?.count || "0");
        totalCount += momoCountNum;
        if (momoData) {
          transactionsResult.push(
            ...momoData.map((tx: any) => ({ ...tx, source_module: "momo" }))
          );
        }
        console.log(`MoMo transactions: ${momoCountNum}`);
      } catch (error) {
        console.warn("⚠️ MoMo transactions query failed:", error);
      }

      // 2. Agency Banking Transactions
      try {
        let agencyCount, agencyData;
        if (effectiveBranchId && effectiveBranchId !== "all") {
          agencyCount =
            await sql`SELECT COUNT(*) as count FROM agency_banking_transactions WHERE branch_id::text = ${effectiveBranchId}`;
          if (agencyCount[0]?.count > 0) {
            agencyData = await sql`
              SELECT 
                abt.id, abt.type, abt.amount, abt.fee, abt.customer_name, abt.account_number as phone_number, 
                abt.partner_bank as provider, abt.status, abt.date, abt.branch_id, abt.user_id, abt.reference,
                b.name as branch_name
              FROM agency_banking_transactions abt
              LEFT JOIN branches b ON abt.branch_id = b.id
              WHERE abt.branch_id::text = ${effectiveBranchId}
              ORDER BY abt.date DESC 
              LIMIT ${limit}
            `;
          }
        } else {
          agencyCount =
            await sql`SELECT COUNT(*) as count FROM agency_banking_transactions`;
          if (agencyCount[0]?.count > 0) {
            agencyData = await sql`
              SELECT 
                abt.id, abt.type, abt.amount, abt.fee, abt.customer_name, abt.account_number as phone_number, 
                abt.partner_bank as provider, abt.status, abt.date, abt.branch_id, abt.user_id, abt.reference,
                b.name as branch_name
              FROM agency_banking_transactions abt
              LEFT JOIN branches b ON abt.branch_id = b.id
              ORDER BY abt.date DESC 
              LIMIT ${limit}
            `;
          }
        }

        const agencyCountNum = Number.parseInt(agencyCount[0]?.count || "0");
        totalCount += agencyCountNum;
        if (agencyData) {
          transactionsResult.push(
            ...agencyData.map((tx: any) => ({
              ...tx,
              source_module: "agency_banking",
            }))
          );
        }
        console.log(`Agency banking transactions: ${agencyCountNum}`);
      } catch (error) {
        console.warn("⚠️ Agency banking transactions query failed:", error);
      }

      // 3. E-Zwich Transactions (Withdrawals and Card Issuances)
      try {
        let ezwichCount, ezwichData;

        // Count withdrawals and card issuances
        if (effectiveBranchId && effectiveBranchId !== "all") {
          ezwichCount = await sql`
            SELECT 
              (SELECT COUNT(*) FROM e_zwich_withdrawals WHERE branch_id::text = ${effectiveBranchId}) +
              (SELECT COUNT(*) FROM e_zwich_card_issuances WHERE branch_id::text = ${effectiveBranchId}) as count
          `;
        } else {
          ezwichCount = await sql`
            SELECT 
              (SELECT COUNT(*) FROM e_zwich_withdrawals) +
              (SELECT COUNT(*) FROM e_zwich_card_issuances) as count
          `;
        }

        const ezwichCountNum = Number.parseInt(ezwichCount[0]?.count || "0");

        if (ezwichCountNum > 0) {
          // Get withdrawals
          let withdrawals = [];
          if (effectiveBranchId && effectiveBranchId !== "all") {
            withdrawals = await sql`
              SELECT 
                ew.id, 'withdrawal' as type, ew.amount, ew.fee, ew.customer_name, ew.customer_phone as phone_number, 
                ew.partner_bank as provider, ew.status, ew.created_at as date, ew.branch_id, ew.user_id, ew.reference,
                b.name as branch_name
              FROM e_zwich_withdrawals ew
              LEFT JOIN branches b ON ew.branch_id = b.id
              WHERE ew.branch_id::text = ${effectiveBranchId}
              ORDER BY ew.created_at DESC
            `;
          } else {
            withdrawals = await sql`
              SELECT 
                ew.id, 'withdrawal' as type, ew.amount, ew.fee, ew.customer_name, ew.customer_phone as phone_number, 
                ew.partner_bank as provider, ew.status, ew.created_at as date, ew.branch_id, ew.user_id, ew.reference,
                b.name as branch_name
              FROM e_zwich_withdrawals ew
              LEFT JOIN branches b ON ew.branch_id = b.id
              ORDER BY ew.created_at DESC
            `;
          }

          // Get card issuances
          let cardIssuances = [];
          if (effectiveBranchId && effectiveBranchId !== "all") {
            cardIssuances = await sql`
              SELECT 
                eci.id, 'card_issuance' as type, eci.fee_charged as amount, eci.fee_charged as fee, eci.customer_name, eci.customer_phone as phone_number, 
                eci.partner_bank as provider, eci.status, eci.created_at as date, eci.branch_id, eci.issued_by as user_id, eci.reference,
                b.name as branch_name
              FROM e_zwich_card_issuances eci
              LEFT JOIN branches b ON eci.branch_id = b.id
              WHERE eci.branch_id::text = ${effectiveBranchId}
              ORDER BY eci.created_at DESC
            `;
          } else {
            cardIssuances = await sql`
              SELECT 
                eci.id, 'card_issuance' as type, eci.fee_charged as amount, eci.fee_charged as fee, eci.customer_name, eci.customer_phone as phone_number, 
                eci.partner_bank as provider, eci.status, eci.created_at as date, eci.branch_id, eci.issued_by as user_id, eci.reference,
                b.name as branch_name
              FROM e_zwich_card_issuances eci
              LEFT JOIN branches b ON eci.branch_id = b.id
              ORDER BY eci.created_at DESC
            `;
          }

          // Combine and sort by date
          ezwichData = [...withdrawals, ...cardIssuances]
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .slice(0, limit);
        }

        totalCount += ezwichCountNum;
        if (ezwichData) {
          transactionsResult.push(
            ...ezwichData.map((tx: any) => ({
              ...tx,
              source_module: "e_zwich",
            }))
          );
        }
        console.log(`E-Zwich transactions: ${ezwichCountNum}`);
      } catch (error) {
        console.warn("⚠️ E-Zwich transactions query failed:", error);
      }

      // 4. Power Transactions
      try {
        let powerCount, powerData;
        if (effectiveBranchId && effectiveBranchId !== "all") {
          powerCount =
            await sql`SELECT COUNT(*) as count FROM power_transactions WHERE branch_id::text = ${effectiveBranchId}`;
          if (powerCount[0]?.count > 0) {
            powerData = await sql`
              SELECT 
                pt.id, pt.type, pt.amount, pt.commission as fee, pt.customer_name, pt.customer_phone as phone_number, 
                pt.provider, pt.status, pt.created_at as date, pt.branch_id, pt.user_id, pt.reference,
                b.name as branch_name
              FROM power_transactions pt
              LEFT JOIN branches b ON pt.branch_id = b.id
              WHERE pt.branch_id::text = ${effectiveBranchId}
              ORDER BY pt.created_at DESC 
              LIMIT ${limit}
            `;
          }
        } else {
          powerCount =
            await sql`SELECT COUNT(*) as count FROM power_transactions`;
          if (powerCount[0]?.count > 0) {
            powerData = await sql`
              SELECT 
                pt.id, pt.type, pt.amount, pt.commission as fee, pt.customer_name, pt.customer_phone as phone_number, 
                pt.provider, pt.status, pt.created_at as date, pt.branch_id, pt.user_id, pt.reference,
                b.name as branch_name
              FROM power_transactions pt
              LEFT JOIN branches b ON pt.branch_id = b.id
              ORDER BY pt.created_at DESC 
              LIMIT ${limit}
            `;
          }
        }

        const powerCountNum = Number.parseInt(powerCount[0]?.count || "0");
        totalCount += powerCountNum;
        if (powerData) {
          transactionsResult.push(
            ...powerData.map((tx: any) => ({ ...tx, source_module: "power" }))
          );
        }
        console.log(`Power transactions: ${powerCountNum}`);
      } catch (error) {
        console.warn("⚠️ Power transactions query failed:", error);
      }

      // 5. Jumia Transactions
      try {
        let jumiaCount, jumiaData;
        if (effectiveBranchId && effectiveBranchId !== "all") {
          jumiaCount =
            await sql`SELECT COUNT(*) as count FROM jumia_transactions WHERE branch_id::text = ${effectiveBranchId}`;
          if (jumiaCount[0]?.count > 0) {
            jumiaData = await sql`
              SELECT 
                jt.id, jt.transaction_type as type, jt.amount, jt.fee, jt.customer_name, jt.customer_phone as phone_number, 
                'Jumia' as provider, jt.status, jt.created_at as date, jt.branch_id, jt.user_id, jt.transaction_id as reference,
                b.name as branch_name
              FROM jumia_transactions jt
              LEFT JOIN branches b ON jt.branch_id = b.id
              WHERE jt.branch_id::text = ${effectiveBranchId}
              ORDER BY jt.created_at DESC 
              LIMIT ${limit}
            `;
          }
        } else {
          jumiaCount =
            await sql`SELECT COUNT(*) as count FROM jumia_transactions`;
          if (jumiaCount[0]?.count > 0) {
            jumiaData = await sql`
              SELECT 
                jt.id, jt.transaction_type as type, jt.amount, jt.fee, jt.customer_name, jt.customer_phone as phone_number, 
                'Jumia' as provider, jt.status, jt.created_at as date, jt.branch_id, jt.user_id, jt.transaction_id as reference,
                b.name as branch_name
              FROM jumia_transactions jt
              LEFT JOIN branches b ON jt.branch_id = b.id
              ORDER BY jt.created_at DESC 
              LIMIT ${limit}
            `;
          }
        }

        const jumiaCountNum = Number.parseInt(jumiaCount[0]?.count || "0");
        totalCount += jumiaCountNum;
        if (jumiaData) {
          transactionsResult.push(
            ...jumiaData.map((tx: any) => ({ ...tx, source_module: "jumia" }))
          );
        }
        console.log(`Jumia transactions: ${jumiaCountNum}`);
      } catch (error) {
        console.warn("⚠️ Jumia transactions query failed:", error);
      }

      console.log("All table queries executed successfully");
      console.log("Raw results:", {
        transactionsResultLength: transactionsResult.length,
        totalCount,
      });
    } catch (queryError) {
      console.error("Query execution failed:", queryError);
      // Set empty results instead of throwing
      transactionsResult = [];
      totalCount = 0;
    }

    // Ensure we have arrays, even if empty
    const transactions = Array.isArray(transactionsResult)
      ? transactionsResult
      : [];
    const totalPages = Math.ceil(totalCount / limit);

    console.log("Processed results:", {
      transactionsCount: transactions.length,
      totalCount,
      totalPages,
    });

    // Transform results for consistent format
    const formattedTransactions = transactions.map((tx: any) => ({
      id: tx.id,
      customer_name: tx.customer_name || "N/A",
      phone_number: tx.phone_number || "N/A",
      amount: Number(tx.amount) || 0,
      fee: Number(tx.fee) || 0,
      type: tx.type || "N/A",
      status: tx.status || "N/A",
      reference: tx.reference || "N/A",
      provider: tx.provider || "N/A",
      created_at: tx.date,
      branch_id: tx.branch_id,
      branch_name: tx.branch_name,
      processed_by: tx.user_id,
      service_type: tx.source_module,
    }));

    // Sort by created_at in descending order (latest first)
    formattedTransactions.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      data: formattedTransactions,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
