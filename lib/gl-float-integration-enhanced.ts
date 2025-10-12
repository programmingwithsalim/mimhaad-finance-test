import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface FloatGLMappingData {
  floatAccountId: string;
  glAccountId: string;
  mappingType: "debit" | "credit";
  description?: string;
  branchId?: string;
}

export interface FloatGLMappingResult {
  success: boolean;
  mappingId?: string;
  error?: string;
}

export class GLFloatIntegrationEnhanced {
  static async createFloatGLMapping(
    mappingData: FloatGLMappingData,
    request: Request
  ): Promise<FloatGLMappingResult> {
    try {
      const user = await getCurrentUser(request);

      // Check if mapping already exists
      const existingMapping = await sql`
        SELECT id FROM float_gl_mappings 
        WHERE float_account_id = ${mappingData.floatAccountId}
        AND gl_account_id = ${mappingData.glAccountId}
        AND mapping_type = ${mappingData.mappingType}
        AND branch_id = ${mappingData.branchId || user.branchId}
      `;

      if (existingMapping.length > 0) {
        return {
          success: false,
          error: "Mapping already exists",
        };
      }

      const result = await sql`
        INSERT INTO float_gl_mappings (
          float_account_id,
          gl_account_id,
          mapping_type,
          description,
          branch_id,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          ${mappingData.floatAccountId},
          ${mappingData.glAccountId},
          ${mappingData.mappingType},
          ${mappingData.description || null},
          ${mappingData.branchId || user.branchId},
          ${user.id},
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return {
        success: true,
        mappingId: result[0].id,
      };
    } catch (error) {
      console.error("Error creating float GL mapping:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getFloatGLMappings(
    filters: {
      branchId?: string;
      floatAccountId?: string;
      glAccountId?: string;
      mappingType?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ mappings: any[]; pagination: any }> {
    try {
      const {
        branchId,
        floatAccountId,
        glAccountId,
        mappingType,
        page = 1,
        limit = 50,
      } = filters;

      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramIndex = 1;

      if (branchId) {
        whereConditions.push(`fgm.branch_id = $${paramIndex}`);
        params.push(branchId);
        paramIndex++;
      }

      if (floatAccountId) {
        whereConditions.push(`fgm.float_account_id = $${paramIndex}`);
        params.push(floatAccountId);
        paramIndex++;
      }

      if (glAccountId) {
        whereConditions.push(`fgm.gl_account_id = $${paramIndex}`);
        params.push(glAccountId);
        paramIndex++;
      }

      if (mappingType) {
        whereConditions.push(`fgm.mapping_type = $${paramIndex}`);
        params.push(mappingType);
        paramIndex++;
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM float_gl_mappings fgm 
        ${whereClause}
      `;
      const countResult = await sql.unsafe(countQuery, params);
      const total = Number(countResult[0]?.total || 0);

      // Get paginated results
      const offset = (page - 1) * limit;
      const mappingsQuery = `
        SELECT 
          fgm.id,
          fgm.mapping_type,
          fgm.description,
          fgm.created_at,
          fgm.updated_at,
          fa.account_name as float_account_name,
          fa.account_number as float_account_number,
          ga.account_name as gl_account_name,
          ga.account_number as gl_account_number,
          b.name as branch_name,
          u.username as created_by
        FROM float_gl_mappings fgm
        LEFT JOIN float_accounts fa ON fgm.float_account_id = fa.id
        LEFT JOIN gl_accounts ga ON fgm.gl_account_id = ga.id
        LEFT JOIN branches b ON fgm.branch_id = b.id
        LEFT JOIN users u ON fgm.created_by = u.id
        ${whereClause}
        ORDER BY fgm.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const mappingsParams = [...params, limit, offset];
      const mappingsResult = await sql.unsafe(mappingsQuery, mappingsParams);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };

      return {
        mappings: mappingsResult,
        pagination,
      };
    } catch (error) {
      console.error("Error getting float GL mappings:", error);
      return {
        mappings: [],
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

  static async updateFloatGLMapping(
    mappingId: string,
    mappingData: Partial<FloatGLMappingData>,
    request: Request
  ): Promise<FloatGLMappingResult> {
    try {
      const user = await getCurrentUser(request);

      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (mappingData.description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        params.push(mappingData.description);
        paramIndex++;
      }

      if (mappingData.mappingType !== undefined) {
        updateFields.push(`mapping_type = $${paramIndex}`);
        params.push(mappingData.mappingType);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE float_gl_mappings 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id
      `;
      params.push(mappingId);

      const result = await sql.unsafe(updateQuery, params);

      if (result.length === 0) {
        return {
          success: false,
          error: "Float GL mapping not found",
        };
      }

      return {
        success: true,
        mappingId: result[0].id,
      };
    } catch (error) {
      console.error("Error updating float GL mapping:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async deleteFloatGLMapping(
    mappingId: string,
    request: Request
  ): Promise<FloatGLMappingResult> {
    try {
      const user = await getCurrentUser(request);

      const result = await sql`
        DELETE FROM float_gl_mappings 
        WHERE id = ${mappingId}
        RETURNING id
      `;

      if (result.length === 0) {
        return {
          success: false,
          error: "Float GL mapping not found",
        };
      }

      return {
        success: true,
        mappingId: result[0].id,
      };
    } catch (error) {
      console.error("Error deleting float GL mapping:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getFloatAccountGLBalance(
    floatAccountId: string,
    branchId?: string
  ): Promise<number> {
    try {
      // Get all GL mappings for this float account
      const mappings = await sql`
        SELECT gl_account_id, mapping_type
        FROM float_gl_mappings
        WHERE float_account_id = ${floatAccountId}
        ${branchId ? sql`AND branch_id = ${branchId}` : sql``}
      `;

      let totalBalance = 0;

      for (const mapping of mappings) {
        // Get GL account balance
        const balance = await sql`
          SELECT 
            COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as balance
          FROM gl_entry_details ged
          JOIN gl_entries ge ON ged.gl_entry_id = ge.id
          WHERE ged.gl_account_id = ${mapping.gl_account_id}
          ${branchId ? sql`AND ged.branch_id = ${branchId}` : sql``}
        `;

        const glBalance = Number(balance[0]?.balance || 0);

        // Apply mapping type
        if (mapping.mapping_type === "debit") {
          totalBalance += glBalance;
        } else {
          totalBalance -= glBalance;
        }
      }

      return totalBalance;
    } catch (error) {
      console.error("Error getting float account GL balance:", error);
      return 0;
    }
  }

  static async autoMapFloatTransaction(
    floatTransactionId: string,
    request: Request
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await getCurrentUser(request);

      // Get float transaction details
      const transaction = await sql`
        SELECT 
          ft.id,
          ft.amount,
          ft.transaction_type,
          ft.float_account_id,
          fa.account_name as float_account_name
        FROM float_transactions ft
        LEFT JOIN float_accounts fa ON ft.float_account_id = fa.id
        WHERE ft.id = ${floatTransactionId}
      `;

      if (transaction.length === 0) {
        return {
          success: false,
          message: "Float transaction not found",
        };
      }

      const tx = transaction[0];

      // Get GL mappings for this float account
      const mappings = await sql`
        SELECT gl_account_id, mapping_type
        FROM float_gl_mappings
        WHERE float_account_id = ${tx.float_account_id}
        AND branch_id = ${user.branchId}
      `;

      if (mappings.length === 0) {
        return {
          success: false,
          message: "No GL mappings found for this float account",
        };
      }

      // Create GL entry
      const glEntryResult = await sql`
        INSERT INTO gl_entries (created_by, created_at, updated_at)
        VALUES (${user.id}, NOW(), NOW())
        RETURNING id
      `;

      const glEntryId = glEntryResult[0].id;

      // Create GL entry details based on mappings
      for (const mapping of mappings) {
        const isDebit =
          tx.transaction_type === "credit"
            ? mapping.mapping_type === "debit"
            : mapping.mapping_type === "credit";

        await sql`
          INSERT INTO gl_entry_details (
            gl_entry_id,
            gl_account_id,
            debit_amount,
            credit_amount,
            description,
            reference,
            branch_id,
            created_at,
            updated_at
          )
          VALUES (
            ${glEntryId},
            ${mapping.gl_account_id},
            ${isDebit ? tx.amount : 0},
            ${isDebit ? 0 : tx.amount},
            ${`Auto-mapped from ${tx.float_account_name} transaction`},
            ${`FT-${tx.id}`},
            ${user.branchId},
            NOW(),
            NOW()
          )
        `;
      }

      return {
        success: true,
        message: "Float transaction auto-mapped to GL accounts",
      };
    } catch (error) {
      console.error("Error auto-mapping float transaction:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
