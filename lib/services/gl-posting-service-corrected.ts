import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

export interface GLPostingData {
  accountId: string;
  debit?: number;
  credit?: number;
  description: string;
  reference?: string;
  branchId?: string;
}

export interface GLPostingResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

export class GLPostingService {
  static async createGLPosting(
    postings: GLPostingData[],
    request: Request
  ): Promise<GLPostingResult> {
    try {
      const user = await getCurrentUser(request);

      // Validate that debits equal credits
      const totalDebits = postings.reduce(
        (sum, posting) => sum + (posting.debit || 0),
        0
      );
      const totalCredits = postings.reduce(
        (sum, posting) => sum + (posting.credit || 0),
        0
      );

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        return {
          success: false,
          error: "Debits and credits must be equal",
        };
      }

      // Create GL entry
      const glEntryResult = await sql`
        INSERT INTO gl_entries (created_by, created_at, updated_at)
        VALUES (${user.id}, NOW(), NOW())
        RETURNING id
      `;

      const glEntryId = glEntryResult[0].id;

      // Create GL entry details
      for (const posting of postings) {
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
            ${posting.accountId},
            ${posting.debit || 0},
            ${posting.credit || 0},
            ${posting.description},
            ${posting.reference || null},
            ${posting.branchId || user.branchId},
            NOW(),
            NOW()
          )
        `;
      }

      return {
        success: true,
        entryId: glEntryId,
      };
    } catch (error) {
      console.error("Error creating GL posting:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async getGLAccountBalance(
    accountId: string,
    branchId?: string
  ): Promise<number> {
    try {
      let query = sql`
        SELECT 
          COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as balance
        FROM gl_entry_details ged
        JOIN gl_entries ge ON ged.gl_entry_id = ge.id
        WHERE ged.gl_account_id = ${accountId}
      `;

      if (branchId) {
        query = sql`
          SELECT 
            COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0) as balance
          FROM gl_entry_details ged
          JOIN gl_entries ge ON ged.gl_entry_id = ge.id
          WHERE ged.gl_account_id = ${accountId}
          AND ged.branch_id = ${branchId}
        `;
      }

      const result = await query;
      return Number(result[0]?.balance || 0);
    } catch (error) {
      console.error("Error getting GL account balance:", error);
      return 0;
    }
  }
}
