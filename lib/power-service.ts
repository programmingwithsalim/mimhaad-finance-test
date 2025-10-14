import { neon } from "@neondatabase/serverless";
import { NotificationService } from "@/lib/services/notification-service";

const sql = neon(process.env.DATABASE_URL!);

export interface PowerTransaction {
  id: string;
  reference: string;
  meterNumber: string;
  provider: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  status: string;
  createdAt: string;
  branchId: string;
  userId: string;
  type: "sale" | "purchase";
}

export interface CreatePowerSaleData {
  meterNumber: string;
  provider: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
  branchId: string;
  userId: string;
  reference: string;
}

// Ensure power transactions table exists
async function ensurePowerTransactionsTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS power_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference VARCHAR(100) UNIQUE NOT NULL,
        meter_number VARCHAR(50) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'completed',
        type VARCHAR(20) DEFAULT 'sale',
        branch_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("Power transactions table ensured");
  } catch (error) {
    console.error("Error creating power transactions table:", error);
    throw error;
  }
}

export async function createPowerSale(
  data: CreatePowerSaleData
): Promise<PowerTransaction> {
  try {
    console.log("[POWER] Creating power sale:", data);

    // Ensure table exists
    await ensurePowerTransactionsTable();

    const result = await sql`
      INSERT INTO power_transactions (
        reference,
        meter_number,
        provider,
        amount,
        customer_name,
        customer_phone,
        status,
        type,
        branch_id,
        user_id
      ) VALUES (
        ${data.reference},
        ${data.meterNumber},
        ${data.provider},
        ${data.amount},
        ${data.customerName || ""},
        ${data.customerPhone || ""},
        'completed',
        'sale',
        ${data.branchId},
        ${data.userId}
      ) RETURNING *
    `;

    if (!result || result.length === 0) {
      throw new Error("Failed to create power transaction");
    }

    const transaction = result[0];

    console.log("[POWER] Power sale created successfully:", transaction.id);

    if (data.customerPhone) {
      await NotificationService.sendNotification({
        type: "transaction",
        title: "Power Sale Alert",
        message: `Thank you for using our service! Your power sale of GHS ${data.amount} was successful.`,
        phone: data.customerPhone,
        userId: data.userId,
        metadata: { ...data },
      });
    }
    if (data.userId) {
      await NotificationService.sendNotification({
        type: "transaction",
        title: "Transaction Processed",
        message: `Your power sale to ${data.customerName} was successful. Amount: GHS ${data.amount}.`,
        userId: data.userId,
        metadata: { ...data },
      });
    }

    return {
      id: transaction.id,
      reference: transaction.reference,
      meterNumber: transaction.meter_number,
      provider: transaction.provider,
      amount: Number(transaction.amount),
      customerName: transaction.customer_name || "",
      customerPhone: transaction.customer_phone || "",
      status: transaction.status,
      createdAt: transaction.created_at,
      branchId: transaction.branch_id,
      userId: transaction.user_id,
      type: transaction.type,
    };
  } catch (error) {
    console.error("[POWER] Error creating power sale:", error);
    throw error;
  }
}

export async function getPowerTransactions(filters: {
  branchId?: string;
  type?: "sale" | "purchase";
  startDate?: string;
  endDate?: string;
  provider?: string;
  limit?: number;
  offset?: number;
}): Promise<PowerTransaction[]> {
  try {
    console.log("[POWER] Fetching power transactions with filters:", filters);

    // Ensure table exists
    await ensurePowerTransactionsTable();

    const {
      branchId,
      type,
      startDate,
      endDate,
      provider,
      limit = 50,
      offset = 0,
    } = filters;

    let query = sql`
      SELECT 
        id,
        reference,
        meter_number,
        provider,
        amount,
        customer_name,
        customer_phone,
        status,
        type,
        branch_id,
        user_id,
        created_at
      FROM power_transactions 
      WHERE 1=1
    `;

    // Apply filters
    if (branchId) {
      query = sql`${query} AND branch_id = ${branchId}`;
    }

    if (type) {
      query = sql`${query} AND type = ${type}`;
    }

    if (provider) {
      query = sql`${query} AND provider = ${provider}`;
    }

    if (startDate) {
      query = sql`${query} AND created_at >= ${startDate}`;
    }

    if (endDate) {
      query = sql`${query} AND created_at <= ${endDate}`;
    }

    // Add ordering and pagination
    query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const result = await query;

    console.log(
      `[POWER] Found ${
        Array.isArray(result) ? result.length : 0
      } power transactions`
    );

    // Ensure result is an array
    if (!Array.isArray(result)) {
      console.error("[POWER] Query result is not an array:", typeof result);
      return [];
    }

    return result.map((row: any) => ({
      id: row.id,
      reference: row.reference,
      meterNumber: row.meter_number,
      provider: row.provider,
      amount: Number(row.amount),
      customerName: row.customer_name || "",
      customerPhone: row.customer_phone || "",
      status: row.status,
      createdAt: row.created_at,
      branchId: row.branch_id,
      userId: row.user_id,
      type: row.type,
    }));
  } catch (error) {
    console.error("[POWER] Error fetching power transactions:", error);
    return [];
  }
}

export async function getPowerStatistics(branchId?: string) {
  try {
    await ensurePowerTransactionsTable();

    const today = new Date().toISOString().split("T")[0];

    let query = sql`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_volume,
        COALESCE(SUM(amount * 0.02), 0) as total_commission,
        COUNT(CASE WHEN DATE(created_at) = ${today} THEN 1 END) as today_transactions,
        COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount ELSE 0 END), 0) as today_volume,
        COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.02 ELSE 0 END), 0) as today_commission
      FROM power_transactions
    `;

    if (branchId) {
      query = sql`
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount), 0) as total_volume,
          COALESCE(SUM(amount * 0.02), 0) as total_commission,
          COUNT(CASE WHEN DATE(created_at) = ${today} THEN 1 END) as today_transactions,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount ELSE 0 END), 0) as today_volume,
          COALESCE(SUM(CASE WHEN DATE(created_at) = ${today} THEN amount * 0.02 ELSE 0 END), 0) as today_commission
        FROM power_transactions
        WHERE branch_id = ${branchId}
      `;
    }

    const result = await query;

    if (result && result.length > 0) {
      const stats = result[0];
      return {
        totalTransactions: Number(stats.total_transactions || 0),
        totalVolume: Number(stats.total_volume || 0),
        totalCommission: Number(stats.total_commission || 0),
        todayTransactions: Number(stats.today_transactions || 0),
        todayVolume: Number(stats.today_volume || 0),
        todayCommission: Number(stats.today_commission || 0),
      };
    }

    return {
      totalTransactions: 0,
      totalVolume: 0,
      totalCommission: 0,
      todayTransactions: 0,
      todayVolume: 0,
      todayCommission: 0,
    };
  } catch (error) {
    console.error("Error getting power statistics:", error);
    return {
      totalTransactions: 0,
      totalVolume: 0,
      totalCommission: 0,
      todayTransactions: 0,
      todayVolume: 0,
      todayCommission: 0,
    };
  }
}

// Update a power transaction by id
export async function updatePowerTransaction(
  id: string,
  updateData: Partial<PowerTransaction>
): Promise<PowerTransaction> {
  await ensurePowerTransactionsTable();
  const setClauses = Object.keys(updateData)
    .map(
      (key, idx) =>
        `${key.replace(/([A-Z])/g, "_$1").toLowerCase()} = $${idx + 2}`
    )
    .join(", ");
  const values = [id, ...Object.values(updateData)];
  const result = await sql.raw(
    `UPDATE power_transactions SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    values
  );
  if (!result || !result[0])
    throw new Error("Failed to update power transaction");
  const row = result[0];
  return {
    id: row.id,
    reference: row.reference,
    meterNumber: row.meter_number,
    provider: row.provider,
    amount: Number(row.amount),
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    status: row.status,
    createdAt: row.created_at,
    branchId: row.branch_id,
    userId: row.user_id,
    type: row.type,
  };
}

// Delete a power transaction by id (hard delete)
export async function deletePowerTransaction(
  id: string
): Promise<{ id: string }> {
  await ensurePowerTransactionsTable();
  await sql`DELETE FROM power_transactions WHERE id = ${id}`;
  return { id };
}
