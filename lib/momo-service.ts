import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface MoMoTransactionData {
  amount: number;
  phoneNumber: string;
  reference: string;
  description?: string;
  transactionType: "send" | "receive";
  provider?: string;
  status?: string;
  branchId?: string;
}

export async function createMoMoTransaction(
  data: MoMoTransactionData,
  request: Request
) {
  try {
    const user = await getCurrentUser(request as any);

    // Check if cash-in-till account exists for this branch
    const cashInTillAccount = await sql`
      SELECT id FROM float_accounts 
      WHERE branch_id = ${data.branchId || user.branchId}
        AND account_type = 'cash-in-till'
        AND is_active = true
      LIMIT 1
    `;

    if (cashInTillAccount.length === 0) {
      throw new Error(
        "No active cash-in-till account found for this branch. Please contact your administrator."
      );
    }

    const result = await sql`
      INSERT INTO momo_transactions (
        amount,
        phone_number,
        reference,
        description,
        transaction_type,
        provider,
        status,
        branch_id,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${data.amount},
        ${data.phoneNumber},
        ${data.reference},
        ${data.description || null},
        ${data.transactionType},
        ${data.provider || "momo"},
        ${data.status || "completed"},
        ${data.branchId || user.branchId},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    return result[0] || null;
  } catch (error) {
    console.error("Error creating MoMo transaction:", error);
    throw error; // Re-throw to handle in the API route
  }
}

export async function getAllMoMoTransactions() {
  try {
    const result = await sql`
      SELECT 
        id,
        amount,
        phone_number,
        reference,
        description,
        transaction_type,
        provider,
        status,
        branch_id,
        created_at,
        updated_at
      FROM momo_transactions
      ORDER BY created_at DESC
    `;

    return result || [];
  } catch (error) {
    console.error("Error getting all MoMo transactions:", error);
    return [];
  }
}

export async function getMoMoTransactions(filters: any) {
  try {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.type) {
      whereConditions.push(`transaction_type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.provider) {
      whereConditions.push(`provider = $${paramIndex}`);
      params.push(filters.provider);
      paramIndex++;
    }

    if (filters.branchId) {
      whereConditions.push(`branch_id = $${paramIndex}`);
      params.push(filters.branchId);
      paramIndex++;
    }

    if (filters.startDate) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const query = `
      SELECT 
        id,
        amount,
        phone_number,
        reference,
        description,
        transaction_type,
        provider,
        status,
        branch_id,
        created_at,
        updated_at
      FROM momo_transactions
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const result = await sql.unsafe(query, params);
    return result || [];
  } catch (error) {
    console.error("Error getting MoMo transactions with filters:", error);
    return [];
  }
}
