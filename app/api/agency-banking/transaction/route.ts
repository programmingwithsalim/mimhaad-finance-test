import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth-service";
import { NotificationService } from "@/lib/services/notification-service";
import { CustomerNotificationService } from "@/lib/services/customer-notification-service";
import { AuditLoggerService } from "@/lib/services/audit-logger-service";
import { GLPostingService } from "@/lib/services/gl-posting-service";
import { v4 as uuidv4 } from "uuid";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";

// Helper function to get user's full name
async function getUserFullName(userId: string): Promise<string> {
  try {
    if (!userId || userId === "unknown" || userId === "System") {
      return "System User";
    }

    // Check if userId is an email address (contains @)
    if (userId.includes("@")) {
      // Try to find user by email
      const users = await sql`
        SELECT first_name, last_name, email FROM users WHERE email = ${userId}
      `;

      if (users && users.length > 0) {
        const { first_name, last_name, email } = users[0];
        if (first_name && last_name) {
          return `${first_name} ${last_name}`;
        } else if (first_name) {
          return first_name;
        } else if (last_name) {
          return last_name;
        } else if (email) {
          return email;
        }
      }

      // If email not found, return the email as fallback
      return userId;
    }

    // Try to find user by UUID
    const users = await sql`
      SELECT first_name, last_name, email FROM users WHERE id = ${userId}
    `;

    if (users && users.length > 0) {
      const { first_name, last_name, email } = users[0];
      if (first_name && last_name) {
        return `${first_name} ${last_name}`;
      } else if (first_name) {
        return first_name;
      } else if (last_name) {
        return last_name;
      } else if (email) {
        return email;
      }
    }

    return "Unknown User";
  } catch (error) {
    console.error(`Failed to get user name for ID ${userId}:`, error);
    return "Unknown User";
  }
}

interface AgencyBankingTransactionData {
  type: "deposit" | "withdrawal" | "interbank" | "commission";
  amount: number;
  fee: number;
  customerName: string;
  accountNumber: string;
  partnerBankId: string;
  partnerBankName: string;
  partnerBankCode: string;
  reference?: string;
  description?: string;
  branchId: string;
  userId: string;
  branchName?: string;
  customerPhone?: string;
  notes?: string;
}

async function ensureSchemaExists() {
  try {
    // Check if the table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agency_banking_transactions'
      );
    `;

    if (!tableExists[0].exists) {
      console.log("🏗️ Agency banking table doesn't exist, creating it...");

      // Initialize the schema
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        }/api/db/init-agency-banking`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to initialize agency banking schema");
      }
    }

    // Ensure notifications table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          branch_id VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          priority VARCHAR(20) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'unread',
          read_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } catch (tableError) {
      console.error("Error creating notifications table:", tableError);
    }
  } catch (error) {
    console.error("Error ensuring schema exists:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      amount,
      partner_bank_id,
      type,
      account_number,
      reference,
      notes,
      fee, // Allow fee to be passed from frontend
    } = body;

    const { user } = session;
    await ensureSchemaExists();

    // Validate input data
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (account_number && account_number.length > 15) {
      return NextResponse.json(
        { error: "Account number cannot be more than 15 characters" },
        { status: 400 }
      );
    }

    if (!customer_name || customer_name.trim() === "") {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    if (
      !type ||
      ![
        "deposit",
        "withdrawal",
        "interbank",
        "interbank_transfer",
        "commission",
      ].includes(type)
    ) {
      return NextResponse.json(
        { error: "Valid transaction type is required" },
        { status: 400 }
      );
    }

    if (!partner_bank_id) {
      return NextResponse.json(
        { error: "Partner bank is required" },
        { status: 400 }
      );
    }

    // Check if cash-in-till account exists for this branch
    const cashInTillAccount = await sql`
      SELECT id FROM float_accounts 
      WHERE branch_id = ${user.branchId}
        AND account_type = 'cash-in-till'
        AND is_active = true
      LIMIT 1
    `;

    if (cashInTillAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active cash-in-till account found for this branch. Please contact your administrator.",
        },
        { status: 400 }
      );
    }

    // 1. Fetch available partner bank (float account) for this branch
    const floatAccounts = await sql`
      SELECT * FROM float_accounts
      WHERE branch_id = ${user.branchId}
        AND account_type = 'agency-banking'
        AND is_active = true
    `;
    const partnerBank = floatAccounts.find(
      (fa: any) => fa.id === partner_bank_id
    );
    if (!partnerBank) {
      return NextResponse.json(
        { error: "Selected partner bank not found for this branch." },
        { status: 400 }
      );
    }

    // 2. Handle fee - use provided fee or calculate default
    let transactionFee = 0;
    if (fee !== undefined && fee !== null) {
      // Use the fee provided by the user (allows flexibility)
      transactionFee = Number(fee) || 0;
    } else {
      // Fallback to auto-calculation if no fee provided
      try {
        const feeRes = await fetch(
          `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/api/agency-banking/calculate-fee`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount,
              transactionType: type,
              partnerBankId: partner_bank_id,
            }),
          }
        );
        const feeData = await feeRes.json();
        transactionFee = Number(feeData.fee) || 0;
      } catch (err) {
        console.error("Failed to fetch fee from fee_config:", err);
        transactionFee = 0;
      }
    }

    // 3. Calculate cash till and float effects according to correct business logic
    let cashTillAffected = 0;
    let floatAffected = 0;

    switch (type) {
      case "deposit":
        // Deposit: Customer gives us cash + fee, we send amount to customer's bank account
        // Cash in till increases by amount + fee (we receive cash + fee)
        // Bank float decreases by amount only (we send only the amount to customer's account)
        cashTillAffected = amount + transactionFee;
        floatAffected = -amount; // Only the amount, not the fee
        break;

      case "withdrawal":
        // Withdrawal: Customer gives us amount from bank account, we give cash to customer
        // Cash in till decreases by amount only (we pay only the amount in cash)
        // Bank float increases by amount only (we receive only the amount from customer's account)
        // Fee is added to cash in till (we keep the fee as revenue)
        cashTillAffected = -amount + transactionFee; // We pay amount in cash, but keep fee
        floatAffected = amount; // Only the amount, not the fee
        break;

      case "interbank":
      case "interbank_transfer":
        // Interbank Transfer: Customer gives us cash + fee, we send amount to customer's other bank
        // Cash in till increases by amount + fee (we receive cash + fee)
        // Bank float decreases by amount only (we send only the amount to customer's other bank)
        cashTillAffected = amount + transactionFee;
        floatAffected = -amount; // Only the amount, not the fee
        break;

      case "commission":
        // Commission: Direct commission payment
        cashTillAffected = amount;
        floatAffected = 0;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid transaction type" },
          { status: 400 }
        );
    }

    // 4. Validate balances before processing
    if (floatAffected < 0) {
      // Check if we have enough float balance for the amount (not including fee)
      const requiredFloat = Math.abs(floatAffected);
      if (partnerBank.current_balance < requiredFloat) {
        return NextResponse.json(
          {
            error: `Insufficient bank float balance. Required: ${requiredFloat}, Available: ${partnerBank.current_balance}`,
          },
          { status: 400 }
        );
      }
    }

    if (cashTillAffected < 0) {
      // Check if we have enough cash in till for the amount (not including fee)
      const cashTillAccounts = await sql`
        SELECT * FROM float_accounts 
        WHERE account_type = 'cash-in-till' AND branch_id = ${user.branchId} AND is_active = true
      `;
      if (cashTillAccounts.length > 0) {
        const cashTill = cashTillAccounts[0];
        const requiredCash = Math.abs(cashTillAffected);
        if (cashTill.current_balance < requiredCash) {
          return NextResponse.json(
            {
              error: `Insufficient cash in till balance. Required: ${requiredCash}, Available: ${cashTill.current_balance}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 5. Create the transaction record
    const transactionId = uuidv4();
    const now = new Date().toISOString();
    await sql`
        INSERT INTO agency_banking_transactions (
          id, type, amount, fee, customer_name, account_number,
          partner_bank, partner_bank_code, partner_bank_id,
          reference, status, date, branch_id, user_id,
          cash_till_affected, float_affected, created_at, updated_at
        ) VALUES (
        ${transactionId}, ${type}, ${amount}, ${transactionFee},
          ${customer_name}, ${account_number || ""},
        ${partnerBank.account_name || partnerBank.provider || ""},
        ${partnerBank.account_number || ""},
        ${partnerBank.id},
                    ${reference || `AGENCY-${Date.now()}`}, 'completed', ${now},
        ${user.branchId},
          ${user.id},
          ${cashTillAffected}, ${floatAffected}, ${now}, ${now}
        )
      `;

    // 6. Update float and cash till balances
    if (floatAffected !== 0) {
      await sql`
            UPDATE float_accounts 
        SET current_balance = current_balance + ${floatAffected}, updated_at = NOW()
        WHERE id = ${partnerBank.id}
      `;
    }
    if (cashTillAffected !== 0) {
      await sql`
            UPDATE float_accounts 
        SET current_balance = current_balance + ${cashTillAffected}, updated_at = NOW()
        WHERE account_type = 'cash-in-till' AND branch_id = ${user.branchId} AND is_active = true
      `;
    }

    // 6.5. Get Cash-in-Till account ID for GL posting
    let cashTillAccountId = null;
    if (cashTillAffected !== 0) {
      const cashTillAccounts = await sql`
        SELECT id FROM float_accounts 
        WHERE account_type = 'cash-in-till' 
        AND branch_id = ${user.branchId} 
        AND is_active = true
        LIMIT 1
      `;
      if (cashTillAccounts.length > 0) {
        cashTillAccountId = cashTillAccounts[0].id;
      }
    }

    // 7. Create GL entries
    await UnifiedGLPostingService.createGLEntries({
      transactionId,
      sourceModule: "agency_banking",
      transactionType: type,
      amount,
      fee: transactionFee,
      customerName: customer_name,
      reference: reference || `AGENCY-${Date.now()}`,
      processedBy: user.id,
      branchId: user.branchId,
      branchName: user.branchName || "",
      metadata: {
        partnerBank: partnerBank.account_name || partnerBank.provider || "",
        partnerBankCode: partnerBank.account_number || "",
        customerName: customer_name,
        accountNumber: account_number,
        amount,
        fee: transactionFee,
        reference: reference || `AGENCY-${Date.now()}`,
        cashTillAffected,
        floatAffected,
        cashTillAccountId,
        floatAccountId: partnerBank.id,
      },
    });

    // 8. Log audit
    const userName = await getUserFullName(user.id);
    await AuditLoggerService.log({
      userId: user.id,
      username: userName,
      actionType: `agency_banking_${type}`,
      entityType: "transaction",
      entityId: transactionId,
      description: `Agency banking ${type} transaction processed`,
      branchId: user.branchId,
      branchName: user.branchName || "",
      status: "success",
      severity: "low",
      details: {
        amount,
        fee: transactionFee,
        partnerBank: partnerBank.account_name || partnerBank.provider || "",
        customerName: customer_name,
        accountNumber: account_number,
        cashTillAffected,
        floatAffected,
      },
    });

    // 9. Send customer notification (mandatory - not dependent on user preferences)
    if (customer_phone) {
      try {
        await CustomerNotificationService.sendTransactionSuccessNotification(
          customer_phone,
          customer_name || "Customer",
          {
            amount: amount,
            service: "agency_banking",
            reference: reference || `AGENCY-${Date.now()}`,
            transactionId: transactionId,
          }
        );
      } catch (notificationError) {
        console.error(
          "Failed to send customer notification:",
          notificationError
        );
        // Continue with transaction even if notification fails
      }
    }

    // 10. Send user notification (optional - based on user preferences)
    try {
      await NotificationService.sendTransactionAlert(user.id, {
        type: type,
        amount: amount,
        service: "agency_banking",
        reference: reference || `AGENCY-${Date.now()}`,
        branchId: user.branchId,
      });
    } catch (notificationError) {
      console.error("Failed to send user notification:", notificationError);
      // Continue with transaction even if notification fails
    }

    return NextResponse.json({
      success: true,
      message: "Agency banking transaction processed successfully",
      transaction: {
        id: transactionId,
        type,
        amount,
        fee: transactionFee,
        customer_name,
        account_number,
        partner_bank: partnerBank.account_name || partnerBank.provider || "",
        reference: reference || `AGENCY-${Date.now()}`,
        status: "completed",
        cash_till_affected: cashTillAffected,
        float_affected: floatAffected,
      },
    });
  } catch (error) {
    console.error("Error processing agency banking transaction:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process agency banking transaction",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId") || session.user.branchId;
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const offset = (page - 1) * limit;

    // Ensure table exists
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS agency_banking_transactions (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          fee DECIMAL(10,2) DEFAULT 0,
          customer_name VARCHAR(255) NOT NULL,
          account_number VARCHAR(100),
          partner_bank VARCHAR(255) NOT NULL,
          partner_bank_code VARCHAR(50),
          partner_bank_id VARCHAR(255),
          reference VARCHAR(100),
          status VARCHAR(20) DEFAULT 'completed',
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          branch_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          cash_till_affected DECIMAL(10,2) DEFAULT 0,
          float_affected DECIMAL(10,2) DEFAULT 0,
          gl_entry_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
    } catch (tableError) {
      console.error(
        "Error creating agency_banking_transactions table:",
        tableError
      );
    }

    let transactions: any[] = [];
    let total = 0;
    try {
      transactions = await sql`
        SELECT 
          id,
          type,
          amount,
          fee,
          customer_name,
          account_number,
          partner_bank,
          reference,
          status,
          date,
          branch_id,
          user_id,
          cash_till_affected,
          float_affected,
          created_at
        FROM agency_banking_transactions 
        WHERE branch_id = ${branchId}
        ORDER BY created_at DESC 
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      // Get total count for pagination
      const countResult = await sql`
        SELECT COUNT(*)::int as count FROM agency_banking_transactions WHERE branch_id = ${branchId}
      `;
      total = countResult[0]?.count || 0;
    } catch (queryError) {
      console.error("Error querying agency_banking_transactions:", queryError);
      transactions = [];
    }

    return NextResponse.json({
      success: true,
      transactions,
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching agency banking transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch agency banking transactions",
        transactions: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}

// Helper function to get or create GL account
async function getOrCreateGLAccount(
  code: string,
  name: string,
  type: string
): Promise<any> {
  try {
    // Try to get existing account
    const existing = await sql`
      SELECT id, code, name, type
      FROM gl_accounts
      WHERE code = ${code} AND is_active = true
    `;

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new account
    const accountId = uuidv4();
    const result = await sql`
      INSERT INTO gl_accounts (id, code, name, type, balance, is_active)
      VALUES (${accountId}, ${code}, ${name}, ${type}, 0, true)
      RETURNING id, code, name, type
    `;

    console.log(`Created GL account: ${code} - ${name}`);
    return result[0];
  } catch (error) {
    console.error(`Failed to get or create GL account ${code}:`, error);
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id, ...updateData } = await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }
    // Fetch the existing transaction
    const existingRows =
      await sql`SELECT * FROM agency_banking_transactions WHERE id = ${id}`;
    if (!existingRows.length) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    const existing = existingRows[0];
    // Reverse previous balances
    if (existing.float_affected) {
      await sql`UPDATE float_accounts SET current_balance = current_balance - ${existing.float_affected} WHERE id = ${existing.partner_bank_id}`;
    }
    if (existing.cash_till_affected) {
      await sql`UPDATE float_accounts SET current_balance = current_balance - ${existing.cash_till_affected} WHERE account_type = 'cash-in-till' AND branch_id = ${existing.branch_id}`;
    }
    // Remove old GL entries
    await UnifiedGLPostingService.deleteGLEntries({
      transactionId: id,
      sourceModule: "agency_banking",
    });
    // Calculate new values
    const {
      amount,
      type,
      partner_bank_id,
      account_number,
      customer_name,
      reference,
      notes,
      fee, // Allow fee to be updated
    } = updateData;

    // Fetch partner bank
    const floatAccounts =
      await sql`SELECT * FROM float_accounts WHERE id = ${partner_bank_id} AND is_active = true`;
    const partnerBank = floatAccounts[0];

    // Handle fee - use provided fee or calculate default
    let transactionFee = 0;
    if (fee !== undefined && fee !== null) {
      // Use the fee provided by the user (allows flexibility)
      transactionFee = Number(fee) || 0;
    } else {
      // Fallback to auto-calculation if no fee provided
      try {
        const feeRes = await fetch(
          `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/api/agency-banking/calculate-fee`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount,
              transactionType: type,
              partnerBankId: partner_bank_id,
            }),
          }
        );
        const feeData = await feeRes.json();
        transactionFee = Number(feeData.fee) || 0;
      } catch (err) {
        transactionFee = 0;
      }
    }
    // Calculate new cash till and float effects
    let cashTillAffected = 0;
    let floatAffected = 0;

    switch (type) {
      case "deposit":
        // Deposit: Customer gives us cash + fee, we send amount to customer's bank account
        // Cash in till increases by amount + fee (we receive cash + fee)
        // Bank float decreases by amount only (we send only the amount to customer's account)
        cashTillAffected = amount + transactionFee;
        floatAffected = -amount; // Only the amount, not the fee
        break;

      case "withdrawal":
        // Withdrawal: Customer gives us amount from bank account, we give cash to customer
        // Cash in till decreases by amount only (we pay only the amount in cash)
        // Bank float increases by amount only (we receive only the amount from customer's account)
        // Fee is added to cash in till (we keep the fee as revenue)
        cashTillAffected = -amount + transactionFee; // We pay amount in cash, but keep fee
        floatAffected = amount; // Only the amount, not the fee
        break;

      case "interbank":
      case "interbank_transfer":
        // Interbank Transfer: Customer gives us cash + fee, we send amount to customer's other bank
        // Cash in till increases by amount + fee (we receive cash + fee)
        // Bank float decreases by amount only (we send only the amount to customer's other bank)
        cashTillAffected = amount + transactionFee;
        floatAffected = -amount; // Only the amount, not the fee
        break;

      case "commission":
        // Commission: Direct commission payment
        cashTillAffected = amount;
        floatAffected = 0;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid transaction type" },
          { status: 400 }
        );
    }
    // Validate balances before updating
    if (floatAffected < 0) {
      const requiredFloat = Math.abs(floatAffected);
      if (partnerBank.current_balance < requiredFloat) {
        return NextResponse.json(
          {
            error: `Insufficient bank float balance. Required: ${requiredFloat}, Available: ${partnerBank.current_balance}`,
          },
          { status: 400 }
        );
      }
    }

    if (cashTillAffected < 0) {
      const cashTillAccounts = await sql`
        SELECT * FROM float_accounts 
        WHERE account_type = 'cash-in-till' AND branch_id = ${existing.branch_id} AND is_active = true
      `;
      if (cashTillAccounts.length > 0) {
        const cashTill = cashTillAccounts[0];
        const requiredCash = Math.abs(cashTillAffected);
        if (cashTill.current_balance < requiredCash) {
          return NextResponse.json(
            {
              error: `Insufficient cash in till balance. Required: ${requiredCash}, Available: ${cashTill.current_balance}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update transaction
    await sql`
      UPDATE agency_banking_transactions SET
        type = ${type},
        amount = ${amount},
        fee = ${transactionFee},
        customer_name = ${customer_name},
        account_number = ${account_number},
        partner_bank = ${
          partnerBank.account_name || partnerBank.provider || ""
        },
        partner_bank_code = ${partnerBank.account_number || ""},
        partner_bank_id = ${partnerBank.id},
        reference = ${reference || existing.reference},
        notes = ${notes || existing.notes},
        cash_till_affected = ${cashTillAffected},
        float_affected = ${floatAffected},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Update balances
    if (floatAffected !== 0) {
      await sql`UPDATE float_accounts SET current_balance = current_balance + ${floatAffected} WHERE id = ${partnerBank.id}`;
    }
    if (cashTillAffected !== 0) {
      await sql`UPDATE float_accounts SET current_balance = current_balance + ${cashTillAffected} WHERE account_type = 'cash-in-till' AND branch_id = ${existing.branch_id}`;
    }

    // Re-post GL
    await UnifiedGLPostingService.createGLEntries({
      transactionId: id,
      sourceModule: "agency_banking",
      transactionType: type,
      amount,
      fee: transactionFee,
      customerName: customer_name,
      reference: reference || existing.reference,
      processedBy: session.user.id,
      branchId: existing.branch_id,
      branchName: session.user.branchName || "",
      metadata: {
        partnerBank: partnerBank.account_name || partnerBank.provider || "",
        partnerBankCode: partnerBank.account_number || "",
        customerName: customer_name,
        accountNumber: account_number,
        amount,
        fee: transactionFee,
        reference: reference || existing.reference,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error editing agency banking transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }
    // Fetch the transaction
    const existingRows =
      await sql`SELECT * FROM agency_banking_transactions WHERE id = ${id}`;
    if (!existingRows.length) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }
    const existing = existingRows[0];
    // Reverse balances
    if (existing.float_affected) {
      await sql`UPDATE float_accounts SET current_balance = current_balance - ${existing.float_affected} WHERE id = ${existing.partner_bank_id}`;
    }
    if (existing.cash_till_affected) {
      await sql`UPDATE float_accounts SET current_balance = current_balance - ${existing.cash_till_affected} WHERE account_type = 'cash-in-till' AND branch_id = ${existing.branch_id}`;
    }
    // Remove GL entries
    await UnifiedGLPostingService.deleteGLEntries({
      transactionId: id,
      sourceModule: "agency_banking",
    });
    // Delete transaction
    await sql`DELETE FROM agency_banking_transactions WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agency banking transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
