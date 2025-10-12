import { sql } from "@/lib/db";
import { logger, LogCategory } from "@/lib/logger";

export class FloatAccountGLService {
  /**
   * Create GL entries for float account withdrawal
   */
  static async createWithdrawalGLEntries(
    floatAccountId: string,
    amount: number,
    transactionType: string,
    userId: string,
    branchId: string,
    description: string
  ) {
    try {
      // Get float account details
      const [floatAccount] = await sql`
        SELECT * FROM float_accounts WHERE id = ${floatAccountId}
      `;

      if (!floatAccount) {
        throw new Error("Float account not found");
      }

      // Get GL mappings for this float account
      const mappings = await sql`
        SELECT 
          gm.gl_account_id,
          gm.mapping_type,
          ga.code as account_code,
          ga.name as account_name
        FROM gl_mappings gm
        JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.float_account_id = ${floatAccountId}
        AND gm.is_active = true
        AND gm.mapping_type = 'withdrawal'
      `;

      if (mappings.length === 0) {
        await logger.warn(
          LogCategory.GL_ENTRY,
          `No GL mappings found for float account withdrawal`,
          {
            floatAccountId,
            transactionType,
            amount,
          },
          { entityId: floatAccountId }
        );
        return;
      }

      // Create GL transaction
      const [glTransaction] = await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_type, amount, reference, created_by, branch_id, metadata
        ) VALUES (
          gen_random_uuid(),
          CURRENT_DATE,
          'float_accounts',
          ${transactionType},
          ${amount},
          ${description},
          ${userId},
          ${branchId},
          ${JSON.stringify({
            floatAccountId,
            floatAccountType: floatAccount.account_type,
          })}
        ) RETURNING id
      `;

      // Create GL journal entries
      for (const mapping of mappings) {
        if (mapping.mapping_type === "debit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              ${amount},
              0,
              ${description}
            )
          `;
        } else if (mapping.mapping_type === "credit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              0,
              ${amount},
              ${description}
            )
          `;
        }
      }

      await logger.logGLEntry(
        glTransaction.id,
        `Created GL entries for float account withdrawal`,
        {
          floatAccountId,
          amount,
          transactionType,
          glTransactionId: glTransaction.id,
        },
        { entityId: floatAccountId }
      );
    } catch (error) {
      await logger.error(
        LogCategory.GL_ENTRY,
        "Error creating withdrawal GL entries",
        error as Error,
        {
          floatAccountId,
          amount,
          transactionType,
        },
        { entityId: floatAccountId }
      );
      throw error;
    }
  }

  /**
   * Create GL entries for float account recharge/deposit
   */
  static async createRechargeGLEntries(
    floatAccountId: string,
    amount: number,
    transactionType: string,
    userId: string,
    branchId: string,
    description: string
  ) {
    try {
      // Get float account details
      const [floatAccount] = await sql`
        SELECT * FROM float_accounts WHERE id = ${floatAccountId}
      `;

      if (!floatAccount) {
        throw new Error("Float account not found");
      }

      // Get GL mappings for this float account
      const mappings = await sql`
        SELECT 
          gm.gl_account_id,
          gm.mapping_type,
          ga.code as account_code,
          ga.name as account_name
        FROM gl_mappings gm
        JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.float_account_id = ${floatAccountId}
        AND gm.is_active = true
        AND gm.mapping_type = 'recharge'
      `;

      if (mappings.length === 0) {
        await logger.warn(
          LogCategory.GL_ENTRY,
          `No GL mappings found for float account recharge`,
          {
            floatAccountId,
            transactionType,
            amount,
          },
          { entityId: floatAccountId }
        );
        return;
      }

      // Create GL transaction
      const [glTransaction] = await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_type, amount, reference, created_by, branch_id, metadata
        ) VALUES (
          gen_random_uuid(),
          CURRENT_DATE,
          'float_accounts',
          ${transactionType},
          ${amount},
          ${description},
          ${userId},
          ${branchId},
          ${JSON.stringify({
            floatAccountId,
            floatAccountType: floatAccount.account_type,
          })}
        ) RETURNING id
      `;

      // Create GL journal entries
      for (const mapping of mappings) {
        if (mapping.mapping_type === "debit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              ${amount},
              0,
              ${description}
            )
          `;
        } else if (mapping.mapping_type === "credit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              0,
              ${amount},
              ${description}
            )
          `;
        }
      }

      await logger.logGLEntry(
        glTransaction.id,
        `Created GL entries for float account recharge`,
        {
          floatAccountId,
          amount,
          transactionType,
          glTransactionId: glTransaction.id,
        },
        { entityId: floatAccountId }
      );
    } catch (error) {
      await logger.error(
        LogCategory.GL_ENTRY,
        "Error creating recharge GL entries",
        error as Error,
        {
          floatAccountId,
          amount,
          transactionType,
        },
        { entityId: floatAccountId }
      );
      throw error;
    }
  }

  /**
   * Create initial GL entries when float account is created
   */
  static async createInitialGLEntries(
    floatAccountId: string,
    initialBalance: number,
    userId: string,
    branchId: string
  ) {
    try {
      // Get float account details
      const [floatAccount] = await sql`
        SELECT * FROM float_accounts WHERE id = ${floatAccountId}
      `;

      if (!floatAccount) {
        throw new Error("Float account not found");
      }

      // Get GL mappings for initial balance
      const mappings = await sql`
        SELECT 
          gm.gl_account_id,
          gm.mapping_type,
          ga.code as account_code,
          ga.name as account_name
        FROM gl_mappings gm
        JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.float_account_id = ${floatAccountId}
        AND gm.is_active = true
        AND gm.mapping_type = 'initial'
      `;

      if (mappings.length === 0) {
        await logger.warn(
          LogCategory.GL_ENTRY,
          `No GL mappings found for float account initial balance`,
          {
            floatAccountId,
            initialBalance,
          },
          { entityId: floatAccountId }
        );
        return;
      }

      // Create GL transaction
      const [glTransaction] = await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_type, amount, reference, created_by, branch_id, metadata
        ) VALUES (
          gen_random_uuid(),
          CURRENT_DATE,
          'float_accounts',
          'initial_balance',
          ${initialBalance},
          'Initial float account balance',
          ${userId},
          ${branchId},
          ${JSON.stringify({
            floatAccountId,
            floatAccountType: floatAccount.account_type,
          })}
        ) RETURNING id
      `;

      // Create GL journal entries
      for (const mapping of mappings) {
        if (mapping.mapping_type === "debit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              ${initialBalance},
              0,
              'Initial float account balance'
            )
          `;
        } else if (mapping.mapping_type === "credit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              0,
              ${initialBalance},
              'Initial float account balance'
            )
          `;
        }
      }

      await logger.logGLEntry(
        glTransaction.id,
        `Created initial GL entries for float account`,
        {
          floatAccountId,
          initialBalance,
          glTransactionId: glTransaction.id,
        },
        { entityId: floatAccountId }
      );
    } catch (error) {
      await logger.error(
        LogCategory.GL_ENTRY,
        "Error creating initial GL entries",
        error as Error,
        {
          floatAccountId,
          initialBalance,
        },
        { entityId: floatAccountId }
      );
      throw error;
    }
  }

  /**
   * Create GL entries for balance adjustment
   */
  static async createBalanceAdjustmentGLEntries(
    floatAccountId: string,
    amount: number,
    description: string,
    userId: string,
    branchId: string,
    reference: string
  ) {
    try {
      // Get float account details
      const [floatAccount] = await sql`
        SELECT * FROM float_accounts WHERE id = ${floatAccountId}
      `;

      if (!floatAccount) {
        throw new Error("Float account not found");
      }

      // Get GL mappings for balance adjustment
      const mappings = await sql`
        SELECT 
          gm.gl_account_id,
          gm.mapping_type,
          ga.code as account_code,
          ga.name as account_name
        FROM gl_mappings gm
        JOIN gl_accounts ga ON gm.gl_account_id = ga.id
        WHERE gm.float_account_id = ${floatAccountId}
        AND gm.is_active = true
        AND gm.mapping_type = 'adjustment'
      `;

      if (mappings.length === 0) {
        await logger.warn(
          LogCategory.GL_ENTRY,
          `No GL mappings found for float account balance adjustment`,
          {
            floatAccountId,
            amount,
            description,
          },
          { entityId: floatAccountId }
        );
        return;
      }

      // Create GL transaction
      const [glTransaction] = await sql`
        INSERT INTO gl_transactions (
          id, date, source_module, source_transaction_type, amount, reference, created_by, branch_id, metadata
        ) VALUES (
          gen_random_uuid(),
          CURRENT_DATE,
          'float_accounts',
          'balance_adjustment',
          ${Math.abs(amount)},
          ${reference},
          ${userId},
          ${branchId},
          ${JSON.stringify({
            floatAccountId,
            floatAccountType: floatAccount.account_type,
            adjustment: amount,
          })}
        ) RETURNING id
      `;

      // Create GL journal entries
      for (const mapping of mappings) {
        if (mapping.mapping_type === "debit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              ${Math.abs(amount)},
              0,
              ${description}
            )
          `;
        } else if (mapping.mapping_type === "credit") {
          await sql`
            INSERT INTO gl_journal_entries (
              transaction_id, account_id, debit, credit, description
            ) VALUES (
              ${glTransaction.id},
              ${mapping.gl_account_id},
              0,
              ${Math.abs(amount)},
              ${description}
            )
          `;
        }
      }

      await logger.logGLEntry(
        glTransaction.id,
        `Created balance adjustment GL entries for float account`,
        {
          floatAccountId,
          amount,
          description,
          reference,
          glTransactionId: glTransaction.id,
        },
        { entityId: floatAccountId }
      );
    } catch (error) {
      await logger.error(
        LogCategory.GL_ENTRY,
        "Error creating balance adjustment GL entries",
        error as Error,
        {
          floatAccountId,
          amount,
          description,
          reference,
        },
        { entityId: floatAccountId }
      );
      throw error;
    }
  }
}
