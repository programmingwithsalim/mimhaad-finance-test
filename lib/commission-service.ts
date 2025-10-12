import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface CommissionData {
  transactionId: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  description?: string;
  branchId?: string;
}

export interface CommissionResult {
  success: boolean;
  commissionId?: string;
  error?: string;
}

export class CommissionService {
  static async createCommission(
    commissionData: CommissionData,
    request: Request
  ): Promise<CommissionResult> {
    try {
      const user = await getCurrentUser(request);

      const result = await sql`
        INSERT INTO commissions (
          transaction_id,
          amount,
          commission_rate,
          commission_amount,
          description,
          branch_id,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${commissionData.transactionId},
          ${commissionData.amount},
          ${commissionData.commissionRate},
          ${commissionData.commissionAmount},
          ${commissionData.description || null},
          ${commissionData.branchId || user.branchId},
          ${user.id},
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        commissionId: result[0].id,
      };
    } catch (error) {
      console.error("Error creating commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getCommissions(
    filters: {
      branchId?: string;
      transactionId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ commissions: any[]; pagination: any }> {
    try {
      const {
        branchId,
        transactionId,
        startDate,
        endDate,
        page = 1,
        limit = 50,
      } = filters;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (branchId) {
        whereConditions.push(`c.branch_id = $${paramIndex}`);
        params.push(branchId);
        paramIndex++;
      }

      if (transactionId) {
        whereConditions.push(`c.transaction_id = $${paramIndex}`);
        params.push(transactionId);
        paramIndex++;
      }

      if (startDate) {
        whereConditions.push(`c.created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`c.created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM commissions c 
        ${whereClause}
      `;
      const countResult = await sql.unsafe(countQuery, params);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const offset = (page - 1) * limit;
      const commissionsQuery = `
        SELECT 
          c.id,
          c.transaction_id,
          c.amount,
          c.commission_rate,
          c.commission_amount,
          c.description,
          c.created_at,
          c.updated_at,
          t.transaction_type,
          t.reference as transaction_reference,
          b.name as branch_name,
          u.username as created_by
        FROM commissions c
        LEFT JOIN transactions t ON c.transaction_id = t.id
        LEFT JOIN branches b ON c.branch_id = b.id
        LEFT JOIN users u ON c.created_by = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const commissionsParams = [...params, limit, offset];
      const commissionsResult = await sql.unsafe(
        commissionsQuery,
        commissionsParams
      );

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        commissions: commissionsResult,
        pagination,
      };
    } catch (error) {
      console.error("Error getting commissions:", error);
      return {
        commissions: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  static async updateCommission(
    commissionId: string,
    commissionData: Partial<CommissionData>,
    request: Request
  ): Promise<CommissionResult> {
    try {
      const user = await getCurrentUser(request);

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (commissionData.amount !== undefined) {
        updateFields.push(`amount = $${paramIndex}`);
        params.push(commissionData.amount);
        paramIndex++;
      }

      if (commissionData.commissionRate !== undefined) {
        updateFields.push(`commission_rate = $${paramIndex}`);
        params.push(commissionData.commissionRate);
        paramIndex++;
      }

      if (commissionData.commissionAmount !== undefined) {
        updateFields.push(`commission_amount = $${paramIndex}`);
        params.push(commissionData.commissionAmount);
        paramIndex++;
      }

      if (commissionData.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        params.push(commissionData.description);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE commissions 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id
      `;
      params.push(commissionId);

      const result = await sql.unsafe(updateQuery, params);

      if (result.length === 0) {
        return {
          success: false,
          error: "Commission not found",
        };
      }

      return {
        success: true,
        commissionId: result[0].id,
      };
    } catch (error) {
      console.error("Error updating commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async deleteCommission(
    commissionId: string,
    request: Request
  ): Promise<CommissionResult> {
    try {
      const user = await getCurrentUser(request);

      const result = await sql`
        DELETE FROM commissions 
        WHERE id = ${commissionId}
        RETURNING id
      `;

      if (result.length === 0) {
        return {
          success: false,
          error: "Commission not found",
        };
      }

      return {
        success: true,
        commissionId: result[0].id,
      };
    } catch (error) {
      console.error("Error deleting commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getCommissionStatistics(branchId?: string): Promise<any> {
    try {
      let whereClause = "";
      let params: any[] = [];

      if (branchId) {
        whereClause = "WHERE c.branch_id = $1";
        params.push(branchId);
      }

      // Get total commissions
      const totalCommissionsResult = await sql.unsafe(
        `SELECT COUNT(*) as total, SUM(commission_amount) as total_amount FROM commissions c ${whereClause}`,
        params
      );
      const totalCommissions = Number(totalCommissionsResult[0]?.total || 0);
      const totalAmount = Number(totalCommissionsResult[0]?.total_amount || 0);

      // Get commissions by transaction type
      const commissionsByTypeResult = await sql.unsafe(
        `SELECT 
          t.transaction_type,
          COUNT(c.id) as count,
          SUM(c.commission_amount) as total_amount,
          AVG(c.commission_rate) as avg_rate
        FROM commissions c
        LEFT JOIN transactions t ON c.transaction_id = t.id
        ${whereClause}
        GROUP BY t.transaction_type
        ORDER BY total_amount DESC`,
        params
      );

      // Get monthly commissions for last 6 months
      const monthlyCommissionsResult = await sql.unsafe(
        `SELECT 
          DATE_TRUNC('month', c.created_at) as month,
          COUNT(*) as count,
          SUM(c.commission_amount) as total_amount
        FROM commissions c
        ${whereClause}
        AND c.created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', c.created_at)
        ORDER BY month DESC`,
        params
      );

      return {
        totalCommissions,
        totalAmount,
        commissionsByType: commissionsByTypeResult,
        monthlyCommissions: monthlyCommissionsResult,
      };
    } catch (error) {
      console.error("Error getting commission statistics:", error);
      return {
        totalCommissions: 0,
        totalAmount: 0,
        commissionsByType: [],
        monthlyCommissions: [],
      };
    }
  }

  static async calculateCommission(
    transactionAmount: number,
    transactionType: string,
    branchId: string
  ): Promise<{ rate: number; amount: number }> {
    try {
      // Get commission rate for transaction type and branch
      const rateResult = await sql`
        SELECT commission_rate
        FROM commission_rates
        WHERE transaction_type = ${transactionType}
        AND branch_id = ${branchId}
        AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;

      let rate = 0;
      if (rateResult.length > 0) {
        rate = Number(rateResult[0].commission_rate);
      }

      const amount = (transactionAmount * rate) / 100;

      return { rate, amount };
    } catch (error) {
      console.error("Error calculating commission:", error);
      return { rate: 0, amount: 0 };
    }
  }

  static async autoCreateCommission(
    transactionId: string,
    transactionAmount: number,
    transactionType: string,
    request: Request
  ): Promise<CommissionResult> {
    try {
      const user = await getCurrentUser(request);

      // Calculate commission
      const { rate, amount } = await this.calculateCommission(
        transactionAmount,
        transactionType,
        user.branchId
      );

      if (amount <= 0) {
        return {
          success: true,
          commissionId: undefined, // No commission to create
        };
      }

      // Create commission record
      return await this.createCommission(
        {
          transactionId,
          amount: transactionAmount,
          commissionRate: rate,
          commissionAmount: amount,
          description: `Auto-generated commission for ${transactionType} transaction`,
          branchId: user.branchId,
        },
        request
      );
    } catch (error) {
      console.error("Error auto-creating commission:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
