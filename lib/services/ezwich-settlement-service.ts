import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface EZwichSettlementData {
  batchId: string;
  amount: number;
  reference: string;
  description?: string;
}

export interface SettlementResult {
  success: boolean;
  settlementId?: string;
  error?: string;
}

export class EZwichSettlementService {
  static async processSettlement(
    settlementData: EZwichSettlementData,
    request: Request
  ): Promise<SettlementResult> {
    try {
      const user = await getCurrentUser(request);

      // Verify batch exists and is eligible for settlement
      const batchResult = await sql`
        SELECT id, status, total_amount, settled_amount
        FROM ezwich_batches
        WHERE id = ${settlementData.batchId}
      `;

      if (batchResult.length === 0) {
        return {
          success: false,
          error: "Batch not found",
        };
      }

      const batch = batchResult[0];

      if (batch.status !== "completed") {
        return {
          success: false,
          error: "Batch is not eligible for settlement",
        };
      }

      const remainingAmount = batch.total_amount - (batch.settled_amount || 0);

      if (settlementData.amount > remainingAmount) {
        return {
          success: false,
          error: "Settlement amount exceeds remaining batch amount",
        };
      }

      // Create settlement record
      const settlementResult = await sql`
        INSERT INTO ezwich_settlements (
          batch_id,
          amount,
          reference,
          description,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${settlementData.batchId},
          ${settlementData.amount},
          ${settlementData.reference},
          ${settlementData.description || null},
          ${user.id},
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      const settlementId = settlementResult[0].id;

      // Update batch settled amount
      await sql`
        UPDATE ezwich_batches
        SET 
          settled_amount = COALESCE(settled_amount, 0) + ${settlementData.amount},
          updated_at = NOW()
        WHERE id = ${settlementData.batchId}
      `;

      // Check if batch is fully settled
      const updatedBatch = await sql`
        SELECT total_amount, settled_amount
        FROM ezwich_batches
        WHERE id = ${settlementData.batchId}
      `;

      if (updatedBatch[0].settled_amount >= updatedBatch[0].total_amount) {
        await sql`
          UPDATE ezwich_batches
          SET status = 'settled', updated_at = NOW()
          WHERE id = ${settlementData.batchId}
        `;
      }

      return {
        success: true,
        settlementId,
      };
    } catch (error) {
      console.error("Error processing E-Zwich settlement:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getSettlementsByBatch(batchId: string): Promise<any[]> {
    try {
      const result = await sql`
        SELECT 
          s.id,
          s.amount,
          s.reference,
          s.description,
          s.created_at,
          u.username as created_by
        FROM ezwich_settlements s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.batch_id = ${batchId}
        ORDER BY s.created_at DESC
      `;

      return result;
    } catch (error) {
      console.error("Error getting settlements by batch:", error);
      return [];
    }
  }

  static async getBatchSettlementSummary(batchId: string): Promise<any> {
    try {
      const result = await sql`
        SELECT 
          b.total_amount,
          b.settled_amount,
          COALESCE(b.settled_amount, 0) as settled_amount,
          b.total_amount - COALESCE(b.settled_amount, 0) as remaining_amount,
          COUNT(s.id) as settlement_count
        FROM ezwich_batches b
        LEFT JOIN ezwich_settlements s ON b.id = s.batch_id
        WHERE b.id = ${batchId}
        GROUP BY b.id, b.total_amount, b.settled_amount
      `;

      return result[0] || null;
    } catch (error) {
      console.error("Error getting batch settlement summary:", error);
      return null;
    }
  }
}
