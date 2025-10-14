import { neon } from "@neondatabase/serverless";
import type {
  Commission,
  CommissionInput,
  CommissionFilters,
  CommissionStatistics,
  CommissionStatus,
} from "./commission-types";

const sql = neon(process.env.DATABASE_URL!);

// Check if commission tables exist
async function checkTablesExist(): Promise<boolean> {
  try {
    await sql`SELECT 1 FROM commissions LIMIT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

// Check if branch columns exist
async function checkBranchColumnsExist(): Promise<boolean> {
  try {
    await sql`SELECT branch_id FROM commissions LIMIT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

// Check if reference already exists
async function checkReferenceExists(reference: string): Promise<boolean> {
  try {
    const result = await sql`
      SELECT 1 FROM commissions WHERE reference = ${reference} LIMIT 1
    `;
    return result.length > 0;
  } catch (error) {
    console.error("Error checking reference:", error);
    return false;
  }
}

// Initialize commission tables if they don't exist
async function initializeTables(): Promise<void> {
  try {
    console.log("Initializing commission tables...");

    // Create commissions table with branch fields
    await sql`
      CREATE TABLE IF NOT EXISTS commissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source VARCHAR(50) NOT NULL,
          source_name VARCHAR(255) NOT NULL,
          amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
          month DATE NOT NULL,
          reference VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
          gl_account VARCHAR(20),
          gl_account_name VARCHAR(255),
          branch_id UUID REFERENCES branches(id),
          branch_name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID NOT NULL,
          created_by_name VARCHAR(255) NOT NULL,
          updated_by UUID,
          updated_by_name VARCHAR(255),
          approved_by UUID,
          approved_by_name VARCHAR(255),
          approved_at TIMESTAMP WITH TIME ZONE,
          approval_comments TEXT
      )
    `;

    // Create commission payments table
    await sql`
      CREATE TABLE IF NOT EXISTS commission_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
          method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
          received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          bank_account VARCHAR(255),
          reference_number VARCHAR(255),
          notes TEXT,
          processed_by_id VARCHAR(255) NOT NULL,
          processed_by_name VARCHAR(255) NOT NULL,
          processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create commission comments table
    await sql`
      CREATE TABLE IF NOT EXISTS commission_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by_id VARCHAR(255) NOT NULL,
          created_by_name VARCHAR(255) NOT NULL
      )
    `;

    // Create commission metadata table for additional fields
    await sql`
      CREATE TABLE IF NOT EXISTS commission_metadata (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
          transaction_volume INTEGER,
          commission_rate VARCHAR(20),
          settlement_period VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    await sql`CREATE INDEX IF NOT EXISTS idx_commissions_source ON commissions(source)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_commissions_month ON commissions(month)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_commissions_branch_id ON commissions(branch_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_commissions_created_at ON commissions(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_commission_comments_commission_id ON commission_comments(commission_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_commission_metadata_commission_id ON commission_metadata(commission_id)`;

    // Create updated_at trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;

    // Create trigger
    await sql`
      DROP TRIGGER IF EXISTS update_commissions_updated_at ON commissions
    `;
    await sql`
      CREATE TRIGGER update_commissions_updated_at 
          BEFORE UPDATE ON commissions 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
    `;

    console.log("Commission tables initialized successfully");
  } catch (error) {
    console.error("Error initializing commission tables:", error);
    throw error;
  }
}

// Get all commissions with optional filters and branch awareness
export async function getCommissions(
  filters?: CommissionFilters,
  userBranchId?: string,
  canViewAllBranches?: boolean
): Promise<Commission[]> {
  try {
    console.log("Starting getCommissions with filters:", filters);
    console.log(
      "Branch filtering - userBranchId:",
      userBranchId,
      "canViewAllBranches:",
      canViewAllBranches
    );

    // Check if tables exist, initialize if not
    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      console.log("Commission tables don't exist, initializing...");
      await initializeTables();
      return [];
    }

    // Check if branch columns exist, add them if not
    const branchColumnsExist = await checkBranchColumnsExist();
    if (!branchColumnsExist) {
      console.log("Branch columns don't exist, adding them...");
      await sql`
        ALTER TABLE commissions 
        ADD COLUMN IF NOT EXISTS branch_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255)
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_commissions_branch_id ON commissions(branch_id)`;
    }

    let baseQuery = `
      SELECT 
        c.*,
        cp.status as payment_status,
        cp.method as payment_method,
        cp.received_at as payment_received_at,
        cp.bank_account as payment_bank_account,
        cp.reference_number as payment_reference_number,
        cp.notes as payment_notes,
        cp.processed_by_id as payment_processed_by_id,
        cp.processed_by_name as payment_processed_by_name,
        cp.processed_at as payment_processed_at,
        cm.transaction_volume,
        cm.commission_rate,
        cm.settlement_period
      FROM commissions c
      LEFT JOIN commission_payments cp ON c.id = cp.commission_id
      LEFT JOIN commission_metadata cm ON c.id = cm.commission_id
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // IMPORTANT: Only admins can view all branches, everyone else sees only their branch
    if (!canViewAllBranches && userBranchId) {
      conditions.push(`(c.branch_id = $${paramIndex} OR c.branch_id IS NULL)`);
      params.push(userBranchId);
      paramIndex++;
      console.log(`Filtering by branch: ${userBranchId}`);
    } else if (canViewAllBranches) {
      console.log("Admin user - showing all branches");
    }

    // Apply other filters
    if (filters) {
      if (
        filters.source &&
        filters.source.length > 0 &&
        !filters.source.includes("all")
      ) {
        conditions.push(`c.source = ANY($${paramIndex})`);
        params.push(filters.source);
        paramIndex++;
      }

      if (
        filters.status &&
        filters.status.length > 0 &&
        !filters.status.includes("all")
      ) {
        conditions.push(`c.status = ANY($${paramIndex})`);
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.search) {
        conditions.push(
          `(c.reference ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex} OR c.source_name ILIKE $${paramIndex})`
        );
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters.startDate) {
        conditions.push(`c.month >= $${paramIndex}`);
        params.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        conditions.push(`c.month <= $${paramIndex}`);
        params.push(filters.endDate);
        paramIndex++;
      }

      if (filters.branchId && canViewAllBranches) {
        conditions.push(`c.branch_id = $${paramIndex}`);
        params.push(filters.branchId);
        paramIndex++;
      }
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(" AND ")}`;
    }

    baseQuery += ` ORDER BY c.created_at DESC`;

    console.log("Final query:", baseQuery);
    console.log("Query params:", params);

    // Build query with proper Neon template literals
    let rows;

    if (!canViewAllBranches && userBranchId) {
      // Non-admin users see only their branch
      if (filters && filters.search) {
        const searchPattern = `%${filters.search}%`;
        rows = await sql`
          SELECT c.*
          FROM commissions c
          WHERE (c.branch_id = ${userBranchId} OR c.branch_id IS NULL)
            AND (c.reference ILIKE ${searchPattern} OR c.description ILIKE ${searchPattern} OR c.source_name ILIKE ${searchPattern})
          ORDER BY c.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT c.*
          FROM commissions c
          WHERE (c.branch_id = ${userBranchId} OR c.branch_id IS NULL)
          ORDER BY c.created_at DESC
        `;
      }
    } else {
      // Admin users see all branches
      if (filters && filters.search) {
        const searchPattern = `%${filters.search}%`;
        rows = await sql`
          SELECT c.*
          FROM commissions c
          WHERE (c.reference ILIKE ${searchPattern} OR c.description ILIKE ${searchPattern} OR c.source_name ILIKE ${searchPattern})
          ORDER BY c.created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT c.*
          FROM commissions c
          ORDER BY c.created_at DESC
        `;
      }
    }

    console.log(`Query returned ${rows.length} commissions`);

    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      sourceName: row.source_name,
      amount: Number.parseFloat(row.amount),
      month: row.month,
      reference: row.reference,
      description: row.description,
      status: row.status as CommissionStatus,
      glAccount: row.gl_account,
      glAccountName: row.gl_account_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: {
        id: row.created_by,
        name: row.created_by_name,
      },
      updatedBy: row.updated_by
        ? {
            id: row.updated_by,
            name: row.updated_by_name,
          }
        : undefined,
      payment: row.payment_status
        ? {
            status: row.payment_status,
            method: row.payment_method,
            receivedAt: row.payment_received_at,
            bankAccount: row.payment_bank_account,
            referenceNumber: row.payment_reference_number,
            notes: row.payment_notes,
          }
        : undefined,
      metadata: {
        transactionVolume: row.transaction_volume,
        commissionRate: row.commission_rate,
        settlementPeriod: row.settlement_period,
      },
      comments: [],
      attachments: [],
    }));
  } catch (error) {
    console.error("Error fetching commissions:", error);
    throw new Error("Failed to fetch commissions");
  }
}

// Create a new commission with branch information
export async function createCommission(
  input: CommissionInput,
  userId: string,
  userName: string,
  branchId?: string,
  branchName?: string,
  userRole?: string
): Promise<Commission> {
  try {
    // Ensure tables exist
    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      await initializeTables();
    }

    // Check if branch columns exist
    const branchColumnsExist = await checkBranchColumnsExist();
    if (!branchColumnsExist) {
      await sql`
        ALTER TABLE commissions 
        ADD COLUMN IF NOT EXISTS branch_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS branch_name VARCHAR(255)
      `;
    }

    // Check if reference already exists
    const referenceExists = await checkReferenceExists(input.reference);
    if (referenceExists) {
      throw new Error(
        `A commission with reference "${input.reference}" already exists. Please use a unique reference number.`
      );
    }

    // Format the month to ensure it's a valid date
    let formattedMonth = input.month;
    if (typeof input.month === "string" && input.month.match(/^\d{4}-\d{2}$/)) {
      // If it's in YYYY-MM format, add -01 to make it a valid date
      formattedMonth = `${input.month}-01`;
    }

    // Ensure amount is a number and convert to string for PostgreSQL DECIMAL
    const amountValue =
      typeof input.amount === "number"
        ? input.amount
        : Number.parseFloat(input.amount?.toString() || "0");
    const amountString = amountValue.toFixed(2);

    // Default to pending - requires approval before payment
    const status = "pending";

    // Use explicit type casting in the SQL query
    const result = await sql`
      INSERT INTO commissions (
        source, source_name, amount, month, reference, description, 
        gl_account, gl_account_name, branch_id, branch_name,
        status, created_by, created_by_name
      ) VALUES (
        ${input.source}::VARCHAR, 
        ${input.sourceName}::VARCHAR, 
        ${amountString}::DECIMAL(15,2), 
        ${formattedMonth}::DATE, 
        ${input.reference}::VARCHAR, 
        ${input.description || null}::TEXT, 
        ${input.glAccount || null}::VARCHAR, 
        ${input.glAccountName || null}::VARCHAR, 
        ${branchId || null}::UUID, 
        ${branchName || null}::VARCHAR,
        ${status}::VARCHAR, 
        ${userId}::UUID, 
        ${userName}::VARCHAR
      ) RETURNING *
    `;

    const commission = result[0];

    // Note: Float account will be credited when commission is APPROVED, not at creation
    console.log(`COMMISSION CREATED: Status = pending (awaiting approval)`);
    console.log(`Amount: GHS ${amountValue}, Float Account: ${input.source}`);

    // Basic validation
    if (amountValue <= 0) {
      console.error(`Invalid commission amount: ${amountValue}`);
      await sql`DELETE FROM commissions WHERE id = ${commission.id}::UUID`;
      throw new Error(
        `Invalid commission amount: ${amountValue}. Commission creation cancelled.`
      );
    }

    if (!input.source) {
      console.error(`No float account specified`);
      await sql`DELETE FROM commissions WHERE id = ${commission.id}::UUID`;
      throw new Error(
        `No float account specified. Commission creation cancelled.`
      );
    }

    // Verify float account exists (but don't credit yet)
    const floatAccountCheck = await sql`
      SELECT id, current_balance, account_name 
      FROM float_accounts 
      WHERE id = ${input.source}::UUID
    `;

    if (floatAccountCheck.length === 0) {
      console.error(`Float account not found: ${input.source}`);
      await sql`DELETE FROM commissions WHERE id = ${commission.id}::UUID`;
      throw new Error(
        `Float account not found: ${input.source}. Commission creation cancelled.`
      );
    }

    const floatAccount = floatAccountCheck[0];
    console.log(`Float account verified: ${floatAccount.account_name}`);
    console.log(
      `💡 Commission created as PENDING - will credit float account upon approval`
    );

    const createdCommission = await getCommissionById(commission.id);

    return createdCommission as Commission;
  } catch (error) {
    console.error("Error creating commission:", error);

    if (error instanceof Error) {
      if (
        error.message.includes(
          'duplicate key value violates unique constraint "commissions_reference_key"'
        )
      ) {
        throw new Error(
          `A commission with reference "${input.reference}" already exists. Please use a unique reference number.`
        );
      }
      throw error;
    }

    throw new Error("Failed to create commission");
  }
}

// Get a single commission by ID
export async function getCommissionById(
  id: string
): Promise<Commission | null> {
  try {
    console.log("Fetching commission by ID:", id);

    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      return null;
    }

    const rows = await sql`
      SELECT 
        c.*
      FROM commissions c
      WHERE c.id = ${id}::UUID
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return {
      id: row.id,
      source: row.source,
      sourceName: row.source_name,
      amount: Number.parseFloat(row.amount),
      month: row.month,
      reference: row.reference,
      description: row.description,
      status: row.status as CommissionStatus,
      glAccount: row.gl_account,
      glAccountName: row.gl_account_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: {
        id: row.created_by,
        name: row.created_by_name,
      },
      updatedBy: row.updated_by
        ? {
            id: row.updated_by,
            name: row.updated_by_name,
          }
        : undefined,
      payment: row.payment_status
        ? {
            status: row.payment_status,
            method: row.payment_method,
            receivedAt: row.payment_received_at,
            bankAccount: row.payment_bank_account,
            referenceNumber: row.payment_reference_number,
            notes: row.payment_notes,
          }
        : undefined,
      metadata: {
        transactionVolume: row.transaction_volume,
        commissionRate: row.commission_rate,
        settlementPeriod: row.settlement_period,
      },
      comments: [],
      attachments: [],
    };
  } catch (error) {
    console.error("Error fetching commission by ID:", error);
    return null;
  }
}

// Update an existing commission
export async function updateCommission(
  id: string,
  updates: Partial<CommissionInput & { status?: CommissionStatus }>,
  userId?: string,
  userName?: string
): Promise<Commission | null> {
  try {
    console.log("Updating commission:", id, "with updates:", updates);

    // Prepare update data
    const updateData: any = {};

    if (updates.status && userId && userName) {
      updateData.status = updates.status;
      updateData.updated_by = userId;
      updateData.updated_by_name = userName;
    }

    if (updates.amount !== undefined) {
      updateData.amount =
        typeof updates.amount === "number"
          ? updates.amount
          : Number.parseFloat(updates.amount?.toString() || "0");
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    if (updates.source) {
      updateData.source = updates.source;
    }

    if (updates.sourceName) {
      updateData.source_name = updates.sourceName;
    }

    if (updates.reference) {
      updateData.reference = updates.reference;
    }

    if (updates.month) {
      let formattedMonth = updates.month;
      if (
        typeof updates.month === "string" &&
        updates.month.match(/^\d{4}-\d{2}$/)
      ) {
        formattedMonth = `${updates.month}-01`;
      }
      updateData.month = formattedMonth;
    }

    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Check if there are any actual updates to make
    const hasUpdates = Object.keys(updateData).length > 1; // More than just updated_at

    if (!hasUpdates) {
      console.log("No fields to update");
      return await getCommissionById(id);
    }

    console.log("Update data:", updateData);

    // Get original commission data BEFORE update for float account adjustments
    const originalCommission = await getCommissionById(id);
    if (!originalCommission) {
      console.log("Commission not found for update:", id);
      return null;
    }

    // Use a single comprehensive update query with all possible fields
    const result = await sql`
      UPDATE commissions 
      SET 
        status = COALESCE(${
          updates.status && userId && userName ? updateData.status : null
        }, status),
        updated_by = COALESCE(${
          updates.status && userId && userName ? updateData.updated_by : null
        }::UUID, updated_by),
        updated_by_name = COALESCE(${
          updates.status && userId && userName
            ? updateData.updated_by_name
            : null
        }, updated_by_name),
        amount = COALESCE(${
          updates.amount !== undefined ? updateData.amount : null
        }, amount),
        description = COALESCE(${
          updates.description !== undefined ? updateData.description : null
        }, description),
        notes = COALESCE(${
          updates.notes !== undefined ? updateData.notes : null
        }, notes),
        source = COALESCE(${updates.source ? updateData.source : null}, source),
        source_name = COALESCE(${
          updates.sourceName ? updateData.source_name : null
        }, source_name),
        reference = COALESCE(${
          updates.reference ? updateData.reference : null
        }, reference),
        month = COALESCE(${updates.month ? updateData.month : null}, month),
        updated_at = NOW()
      WHERE id = ${id}::UUID
      RETURNING id
    `;

    if (result.length === 0) {
      console.log("Commission not found or no rows updated:", id);
      return null;
    }

    // Handle float account adjustments if amount or source changed
    if (
      originalCommission &&
      (updates.amount !== undefined || updates.source)
    ) {
      try {
        const oldAmount = Number(originalCommission.amount) || 0;
        const newAmount =
          updates.amount !== undefined ? Number(updateData.amount) : oldAmount;
        const oldSource = originalCommission.source;
        const newSource = updates.source || oldSource;

        // If amount changed, adjust the float account
        if (updates.amount !== undefined && newAmount !== oldAmount) {
          const amountDifference = newAmount - oldAmount;
          console.log(
            `Adjusting float account ${newSource} by ${amountDifference}`
          );

          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${amountDifference}::DECIMAL(15,2),
                updated_at = NOW()
            WHERE id = ${newSource}::UUID
          `;

          // Create GL entry for the adjustment
          if (amountDifference !== 0) {
            const { GLPostingService } = await import(
              "@/lib/services/gl-posting-service"
            );
            await GLPostingService.createCommissionPaymentGLEntries({
              commissionId: id,
              source: newSource,
              reference: originalCommission.reference + "_ADJUSTMENT",
              amount: amountDifference,
              paymentMethod: "commission_adjustment",
              createdBy: userId || "system",
            });
          }
        }

        // If source changed, move the amount from old to new float account
        if (updates.source && newSource !== oldSource) {
          console.log(
            `Moving commission amount from ${oldSource} to ${newSource}`
          );

          // Deduct from old account
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance - ${newAmount}::DECIMAL(15,2),
                updated_at = NOW()
            WHERE id = ${oldSource}::UUID
          `;

          // Add to new account
          await sql`
            UPDATE float_accounts 
            SET current_balance = current_balance + ${newAmount}::DECIMAL(15,2),
                updated_at = NOW()
            WHERE id = ${newSource}::UUID
          `;

          // Create GL entries for the transfer
          const { GLPostingService } = await import(
            "@/lib/services/gl-posting-service"
          );
          await GLPostingService.createCommissionPaymentGLEntries({
            commissionId: id,
            source: oldSource,
            reference: originalCommission.reference + "_TRANSFER_OUT",
            amount: -newAmount,
            paymentMethod: "commission_transfer",
            createdBy: userId || "system",
          });
          await GLPostingService.createCommissionPaymentGLEntries({
            commissionId: id,
            source: newSource,
            reference: originalCommission.reference + "_TRANSFER_IN",
            amount: newAmount,
            paymentMethod: "commission_transfer",
            createdBy: userId || "system",
          });
        }

        console.log("Float account adjustments completed");
      } catch (adjustmentError) {
        console.error("Error adjusting float accounts:", adjustmentError);
        // Don't fail the update if float adjustments fail
      }
    }

    console.log("Commission updated successfully:", id);
    return await getCommissionById(id);
  } catch (error) {
    console.error("Error updating commission:", error);
    throw new Error("Failed to update commission");
  }
}

// Delete a commission
export async function deleteCommission(id: string): Promise<boolean> {
  try {
    console.log("Deleting commission with ID:", id);

    // First check if the commission exists
    const commission = await getCommissionById(id);
    if (!commission) {
      console.log("Commission not found for deletion:", id);
      return false;
    }

    console.log("Found commission for deletion:", commission.reference);

    // Reverse the float account credit before deletion
    const commissionAmount = Number(commission.amount) || 0;
    if (commissionAmount > 0 && commission.source) {
      try {
        console.log(
          `Reversing float account credit: ${commission.source} by ${commissionAmount}`
        );

        // Deduct the commission amount from the float account
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance - ${commissionAmount}::DECIMAL(15,2),
              updated_at = NOW()
          WHERE id = ${commission.source}::UUID
        `;

        // Create GL entry for the reversal
        const { GLPostingService } = await import(
          "@/lib/services/gl-posting-service"
        );
        await GLPostingService.createCommissionPaymentGLEntries({
          commissionId: id,
          source: commission.source,
          reference: commission.reference + "_REVERSAL",
          amount: -commissionAmount,
          paymentMethod: "commission_deletion",
          createdBy: "system",
        });

        console.log(
          `Successfully reversed float account credit for ${commission.source}`
        );
      } catch (reverseError) {
        console.error("Error reversing float account credit:", reverseError);
        // Don't fail the deletion if reversal fails
        console.log(
          "Continuing with commission deletion despite reversal failure"
        );
      }
    }

    // Delete related records first (only if tables exist)
    try {
      // Only try to delete from tables that actually exist
      // Skip commission_metadata, commission_payments, commission_comments as they don't exist
      console.log("Skipping deletion of related records (tables don't exist)");
    } catch (error) {
      console.error("Error deleting related commission records:", error);
      // Continue with main deletion even if related deletions fail
    }

    // Now delete the main commission record
    const result =
      await sql`DELETE FROM commissions WHERE id = ${id}::UUID RETURNING id`;

    console.log("Delete result:", result);

    // Check if any rows were affected
    const deleted = result && result.length > 0;
    console.log(`Commission deleted: ${deleted}`);

    return deleted;
  } catch (error) {
    console.error("Error deleting commission:", error);
    throw new Error(
      `Failed to delete commission: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Mark commission as paid
export async function markCommissionPaid(
  id: string,
  userId: string,
  userName: string,
  paymentInfo: any
): Promise<Commission | null> {
  try {
    await sql`
      UPDATE commissions 
      SET status = 'paid'::VARCHAR, 
          updated_by = ${userId}::UUID, 
          updated_by_name = ${userName}::VARCHAR,
          updated_at = NOW()
      WHERE id = ${id}::UUID AND status IN ('pending', 'approved')
    `;

    // // Try to insert payment record (optional - don't fail if table doesn't exist)
    // try {
    //   await sql`
    //     INSERT INTO commission_payments (
    //       commission_id, method, received_at, bank_account, reference_number,
    //       notes, processed_by_id, processed_by_name
    //     ) VALUES (
    //       ${id}::UUID,
    //       ${paymentInfo.method || "bank_transfer"}::VARCHAR,
    //       ${
    //         paymentInfo.receivedAt || new Date().toISOString()
    //       }::TIMESTAMP WITH TIME ZONE,
    //       ${paymentInfo.bankAccount || null}::VARCHAR,
    //       ${paymentInfo.referenceNumber || null}::VARCHAR,
    //       ${paymentInfo.notes || null}::TEXT,
    //       ${userId}::UUID,
    //       ${userName}::VARCHAR
    //     )
    //   `;
    //   console.log("Payment record created successfully");
    // } catch (paymentError) {
    //   console.warn(
    //     "Failed to create payment record (table may not exist):",
    //     paymentError
    //   );
    //   // Continue - payment marking succeeded even if payment record failed
    // }

    return await getCommissionById(id);
  } catch (error) {
    console.error("Error marking commission as paid:", error);
    throw new Error("Failed to mark commission as paid");
  }
}

// Add comment to commission
export async function addComment(
  id: string,
  userId: string,
  userName: string,
  text: string
): Promise<Commission | null> {
  try {
    await sql`
      INSERT INTO commission_comments (commission_id, text, created_by_id, created_by_name)
      VALUES (${id}::UUID, ${text}::TEXT, ${userId}::VARCHAR, ${userName}::VARCHAR)
    `;

    return await getCommissionById(id);
  } catch (error) {
    console.error("Error adding comment:", error);
    throw new Error("Failed to add comment");
  }
}

// Get commission statistics with branch awareness
export async function getCommissionStatistics(
  userBranchId?: string,
  canViewAllBranches?: boolean
): Promise<CommissionStatistics> {
  try {
    const tablesExist = await checkTablesExist();
    if (!tablesExist) {
      await initializeTables();
      return {
        totalAmount: 0,
        totalCount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        paidAmount: 0,
        paidCount: 0,
        bySource: {},
        byMonth: {},
      };
    }

    let whereClause = "";
    const params: any[] = [];

    // Apply branch filtering for non-admin users
    if (!canViewAllBranches && userBranchId) {
      whereClause = "WHERE (branch_id = $1 OR branch_id IS NULL)";
      params.push(userBranchId);
    }

    // Build statistics queries with proper Neon template literals
    let stats, sourceStats, monthStats;

    if (!canViewAllBranches && userBranchId) {
      stats = await sql`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as paid_amount
        FROM commissions
        WHERE (branch_id = ${userBranchId} OR branch_id IS NULL)
      `;

      sourceStats = await sql`
        SELECT 
          source,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM commissions
        WHERE (branch_id = ${userBranchId} OR branch_id IS NULL)
        GROUP BY source
      `;

      monthStats = await sql`
        SELECT 
          month,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM commissions
        WHERE (branch_id = ${userBranchId} OR branch_id IS NULL)
        GROUP BY month
        ORDER BY month
      `;
    } else {
      stats = await sql`
        SELECT 
          COUNT(*) as total_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) as paid_amount
        FROM commissions
      `;

      sourceStats = await sql`
        SELECT 
          source,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM commissions
        GROUP BY source
      `;

      monthStats = await sql`
        SELECT 
          month,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as amount
        FROM commissions
        GROUP BY month
        ORDER BY month
      `;
    }

    const statsResult = Array.isArray(stats) ? stats : stats.rows || [];
    const sourceResult = Array.isArray(sourceStats)
      ? sourceStats
      : sourceStats.rows || [];
    const monthResult = Array.isArray(monthStats)
      ? monthStats
      : monthStats.rows || [];

    const row = statsResult[0] || {};

    return {
      totalAmount: Number.parseFloat(row.total_amount || 0),
      totalCount: Number.parseInt(row.total_count || 0),
      pendingAmount: Number.parseFloat(row.pending_amount || 0),
      pendingCount: Number.parseInt(row.pending_count || 0),
      paidAmount: Number.parseFloat(row.paid_amount || 0),
      paidCount: Number.parseInt(row.paid_count || 0),
      bySource: sourceResult.reduce((acc, row) => {
        acc[row.source] = {
          count: Number.parseInt(row.count),
          amount: Number.parseFloat(row.amount),
        };
        return acc;
      }, {} as Record<string, { count: number; amount: number }>),
      byMonth: monthResult.reduce((acc, row) => {
        acc[row.month] = {
          count: Number.parseInt(row.count),
          amount: Number.parseFloat(row.amount),
        };
        return acc;
      }, {} as Record<string, { count: number; amount: number }>),
    };
  } catch (error) {
    console.error("Error fetching commission statistics:", error);
    throw new Error("Failed to fetch commission statistics");
  }
}

// Approve a commission
export async function approveCommission(
  id: string,
  userId: string,
  userName: string,
  notes?: string
): Promise<Commission | null> {
  try {
    await sql`
      UPDATE commissions 
      SET status = 'approved'::VARCHAR,
          approved_by = ${userId}::UUID,
          approved_by_name = ${userName}::VARCHAR,
          approved_at = CURRENT_TIMESTAMP,
          approval_comments = ${notes || "Commission approved"}::TEXT,
          updated_at = NOW()
      WHERE id = ${id}::UUID AND status = 'pending'
    `;

    return await getCommissionById(id);
  } catch (error) {
    console.error("Error approving commission:", error);
    throw new Error("Failed to approve commission");
  }
}

// Reject a commission
export async function rejectCommission(
  id: string,
  userId: string,
  userName: string,
  reason: string
): Promise<Commission | null> {
  try {
    await sql`
      UPDATE commissions 
      SET status = 'rejected'::VARCHAR,
          approved_by = ${userId}::UUID,
          approved_by_name = ${userName}::VARCHAR,
          approved_at = CURRENT_TIMESTAMP,
          approval_comments = ${reason || "Commission rejected"}::TEXT,
          updated_at = NOW()
      WHERE id = ${id}::UUID AND status = 'pending'
    `;

    // Add rejection comment

    return await getCommissionById(id);
  } catch (error) {
    console.error("Error rejecting commission:", error);
    throw new Error("Failed to reject commission");
  }
}
