import { neon } from "@neondatabase/serverless";
import { UnifiedGLPostingService } from "./services/unified-gl-posting-service";
import { NotificationService } from "@/lib/services/notification-service";

const sql = neon(process.env.DATABASE_URL!);

export interface CardBatch {
  id: string;
  batch_code: string;
  quantity_received: number;
  quantity_available: number;
  card_type: string;
  expiry_date: string;
  status: string;
  branch_id: string;
  created_by: string;
  created_at: string;
  notes?: string;
}

export interface CardIssuance {
  id: string;
  card_number: string;
  batch_id: string;
  customer_name: string;
  customer_phone: string;
  customer_id_number: string;
  customer_id_type: string;
  issued_by: string;
  issued_at: string;
  status: string;
  branch_id: string;
}

export interface WithdrawalTransaction {
  id: string;
  card_number: string;
  amount: number;
  fee: number;
  customer_name: string;
  customer_phone: string;
  processed_by: string;
  processed_at: string;
  status: string;
  branch_id: string;
  reference_number: string;
}

export async function ensureEZwichTables() {
  try {
    // Create card_batches table
    await sql`
      CREATE TABLE IF NOT EXISTS card_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_code VARCHAR(50) UNIQUE NOT NULL,
        quantity_received INTEGER NOT NULL,
        quantity_available INTEGER NOT NULL,
        card_type VARCHAR(20) NOT NULL DEFAULT 'Standard',
        expiry_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'received',
        branch_id UUID NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `;

    // Create card_issuances table
    await sql`
      CREATE TABLE IF NOT EXISTS card_issuances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_number VARCHAR(20) UNIQUE NOT NULL,
        batch_id UUID REFERENCES card_batches(id),
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(15) NOT NULL,
        customer_id_number VARCHAR(50) NOT NULL,
        customer_id_type VARCHAR(20) NOT NULL,
        issued_by VARCHAR(100) NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        branch_id UUID NOT NULL
      )
    `;

    // Create withdrawal_transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS withdrawal_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_number VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(15) NOT NULL,
        processed_by VARCHAR(100) NOT NULL,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        branch_id UUID NOT NULL,
        reference_number VARCHAR(50) UNIQUE NOT NULL
      )
    `;

    console.log("E-Zwich tables ensured successfully");
    return true;
  } catch (error) {
    console.error("Error ensuring E-Zwich tables:", error);
    throw error;
  }
}

export async function getCardBatches(branchId: string): Promise<CardBatch[]> {
  try {
    await ensureEZwichTables();

    const batches = await sql`
      SELECT * FROM card_batches 
      WHERE branch_id = ${branchId} 
      ORDER BY created_at DESC
    `;

    return batches.map((batch) => ({
      ...batch,
      created_at: batch.created_at.toISOString(),
      expiry_date: batch.expiry_date.toISOString().split("T")[0],
    }));
  } catch (error) {
    console.error("Error fetching card batches:", error);
    throw new Error(
      `Failed to fetch card batches: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function createCardBatch(batchData: {
  batch_code: string;
  quantity_received: number;
  card_type: string;
  expiry_date: string;
  status?: string;
  branch_id: string;
  created_by: string;
  notes?: string;
}): Promise<CardBatch> {
  try {
    await ensureEZwichTables();

    // Validate required fields
    if (
      !batchData.batch_code ||
      !batchData.quantity_received ||
      !batchData.branch_id ||
      !batchData.created_by
    ) {
      throw new Error(
        "Missing required fields: batch_code, quantity_received, branch_id, created_by"
      );
    }

    // Check if batch code already exists
    const existingBatch = await sql`
      SELECT id FROM card_batches WHERE batch_code = ${batchData.batch_code}
    `;

    if (existingBatch.length > 0) {
      throw new Error(`Batch code ${batchData.batch_code} already exists`);
    }

    const result = await sql`
      INSERT INTO card_batches (
        batch_code, 
        quantity_received, 
        quantity_available,
        card_type, 
        expiry_date, 
        status, 
        branch_id, 
        created_by, 
        notes
      ) VALUES (
        ${batchData.batch_code},
        ${batchData.quantity_received},
        ${batchData.quantity_received},
        ${batchData.card_type},
        ${batchData.expiry_date},
        ${batchData.status || "received"},
        ${batchData.branch_id},
        ${batchData.created_by},
        ${batchData.notes || null}
      )
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error("Failed to create card batch - no data returned");
    }

    const newBatch = result[0];
    return {
      ...newBatch,
      created_at: newBatch.created_at.toISOString(),
      expiry_date: newBatch.expiry_date.toISOString().split("T")[0],
    };
  } catch (error) {
    console.error("Error creating card batch:", error);
    throw new Error(
      `Failed to create card batch: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getCardIssuances(
  branchId: string
): Promise<CardIssuance[]> {
  try {
    await ensureEZwichTables();

    const issuances = await sql`
      SELECT ci.*, cb.batch_code 
      FROM card_issuances ci
      LEFT JOIN card_batches cb ON ci.batch_id = cb.id
      WHERE ci.branch_id = ${branchId} 
      ORDER BY ci.issued_at DESC
    `;

    return issuances.map((issuance) => ({
      ...issuance,
      issued_at: issuance.issued_at.toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching card issuances:", error);
    throw new Error(
      `Failed to fetch card issuances: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function createCardIssuance(issuanceData: {
  card_number: string;
  batch_id: string;
  customer_name: string;
  customer_phone: string;
  customer_id_number: string;
  customer_id_type: string;
  issued_by: string;
  branch_id: string;
}): Promise<CardIssuance> {
  try {
    await ensureEZwichTables();

    // Check if card number already exists
    const existingCard = await sql`
      SELECT id FROM card_issuances WHERE card_number = ${issuanceData.card_number}
    `;

    if (existingCard.length > 0) {
      throw new Error(`Card number ${issuanceData.card_number} already exists`);
    }

    // Check if batch has available cards
    const batch = await sql`
      SELECT quantity_available FROM card_batches WHERE id = ${issuanceData.batch_id}
    `;

    if (batch.length === 0) {
      throw new Error("Batch not found");
    }

    if (batch[0].quantity_available <= 0) {
      throw new Error("No cards available in this batch");
    }

    // Create the issuance
    const result = await sql`
      INSERT INTO card_issuances (
        card_number, batch_id, customer_name, customer_phone, 
        customer_id_number, customer_id_type, issued_by, branch_id
      ) VALUES (
        ${issuanceData.card_number}, ${issuanceData.batch_id}, ${issuanceData.customer_name},
        ${issuanceData.customer_phone}, ${issuanceData.customer_id_number}, 
        ${issuanceData.customer_id_type}, ${issuanceData.issued_by}, ${issuanceData.branch_id}
      )
      RETURNING *
    `;

    // Update batch quantity
    await sql`
      UPDATE card_batches 
      SET quantity_available = quantity_available - 1 
      WHERE id = ${issuanceData.batch_id}
    `;

    const newIssuance = result[0];
    return {
      ...newIssuance,
      issued_at: newIssuance.issued_at.toISOString(),
    };
  } catch (error) {
    console.error("Error creating card issuance:", error);
    throw new Error(
      `Failed to create card issuance: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getWithdrawalTransactions(
  branchId: string
): Promise<WithdrawalTransaction[]> {
  try {
    await ensureEZwichTables();

    const withdrawals = await sql`
      SELECT * FROM withdrawal_transactions 
      WHERE branch_id = ${branchId} 
      ORDER BY processed_at DESC
    `;

    return withdrawals.map((withdrawal) => ({
      ...withdrawal,
      processed_at: withdrawal.processed_at.toISOString(),
      amount: Number.parseFloat(withdrawal.amount),
      fee: Number.parseFloat(withdrawal.fee),
    }));
  } catch (error) {
    console.error("Error fetching withdrawal transactions:", error);
    throw new Error(
      `Failed to fetch withdrawal transactions: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function createWithdrawalTransaction(withdrawalData: {
  card_number: string;
  amount: number;
  fee: number;
  customer_name: string;
  customer_phone: string;
  processed_by: string;
  branch_id: string;
  reference_number: string;
}): Promise<WithdrawalTransaction> {
  try {
    await ensureEZwichTables();

    const result = await sql`
      INSERT INTO withdrawal_transactions (
        card_number, amount, fee, customer_name, customer_phone,
        processed_by, branch_id, reference_number
      ) VALUES (
        ${withdrawalData.card_number}, ${withdrawalData.amount}, ${withdrawalData.fee},
        ${withdrawalData.customer_name}, ${withdrawalData.customer_phone},
        ${withdrawalData.processed_by}, ${withdrawalData.branch_id}, ${withdrawalData.reference_number}
      )
      RETURNING *
    `;

    const newWithdrawal = result[0];

    // Unified GL Posting
    try {
      await UnifiedGLPostingService.createGLEntries({
        transactionId: newWithdrawal.id,
        sourceModule: "e_zwich",
        transactionType: "withdrawal",
        amount: Number(newWithdrawal.amount),
        fee: Number(newWithdrawal.fee),
        customerName: newWithdrawal.customer_name,
        reference: newWithdrawal.reference_number,
        processedBy: newWithdrawal.processed_by,
        branchId: newWithdrawal.branch_id,
        metadata: { card_number: newWithdrawal.card_number },
      });
    } catch (glError) {
      console.error("[GL] Failed to post E-Zwich withdrawal to GL:", glError);
    }

    if (withdrawalData.customer_phone) {
      await NotificationService.sendNotification({
        type: "transaction",
        title: "E-Zwich Withdrawal Alert",
        message: `Thank you for using our service! Your E-Zwich withdrawal of GHS ${withdrawalData.amount} was successful.`,
        phone: withdrawalData.customer_phone,
        userId: withdrawalData.processed_by,
        metadata: { ...withdrawalData },
      });
    }
    if (withdrawalData.processed_by) {
      await NotificationService.sendNotification({
        type: "transaction",
        title: "Transaction Processed",
        message: `Your E-Zwich withdrawal to ${withdrawalData.customer_name} was successful. Amount: GHS ${withdrawalData.amount}.`,
        userId: withdrawalData.processed_by,
        metadata: { ...withdrawalData },
      });
    }

    return {
      ...newWithdrawal,
      processed_at: newWithdrawal.processed_at.toISOString(),
      amount: Number.parseFloat(newWithdrawal.amount),
      fee: Number.parseFloat(newWithdrawal.fee),
    };
  } catch (error) {
    console.error("Error creating withdrawal transaction:", error);
    throw new Error(
      `Failed to create withdrawal transaction: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getEZwichStatistics(branchId: string) {
  try {
    await ensureEZwichTables();

    const [batchStats, issuanceStats, withdrawalStats] = await Promise.all([
      sql`
        SELECT 
          COUNT(*) as total_batches,
          SUM(quantity_received) as total_cards_received,
          SUM(quantity_available) as total_cards_available
        FROM card_batches 
        WHERE branch_id = ${branchId}
      `,
      sql`
        SELECT COUNT(*) as total_issued
        FROM card_issuances 
        WHERE branch_id = ${branchId}
      `,
      sql`
        SELECT 
          COUNT(*) as total_withdrawals,
          SUM(amount) as total_withdrawal_amount,
          SUM(fee) as total_fees
        FROM withdrawal_transactions 
        WHERE branch_id = ${branchId}
      `,
    ]);

    return {
      batches: {
        total: Number.parseInt(batchStats[0]?.total_batches || "0"),
        totalCardsReceived: Number.parseInt(
          batchStats[0]?.total_cards_received || "0"
        ),
        totalCardsAvailable: Number.parseInt(
          batchStats[0]?.total_cards_available || "0"
        ),
      },
      issuances: {
        total: Number.parseInt(issuanceStats[0]?.total_issued || "0"),
      },
      withdrawals: {
        total: Number.parseInt(withdrawalStats[0]?.total_withdrawals || "0"),
        totalAmount: Number.parseFloat(
          withdrawalStats[0]?.total_withdrawal_amount || "0"
        ),
        totalFees: Number.parseFloat(withdrawalStats[0]?.total_fees || "0"),
      },
    };
  } catch (error) {
    console.error("Error fetching E-Zwich statistics:", error);
    throw new Error(
      `Failed to fetch E-Zwich statistics: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
