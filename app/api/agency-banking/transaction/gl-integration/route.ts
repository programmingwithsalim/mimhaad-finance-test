import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";

const sql = neon(process.env.DATABASE_URL!);

// Helper function to create agency banking transaction
async function createAgencyBankingTransaction(transactionData: any) {
  try {
    const transaction = await sql`
      INSERT INTO agency_banking_transactions (
        type, amount, fee, customer_name, account_number, partner_bank,
        partner_bank_code, partner_bank_id, reference, branch_id, user_id,
        cash_till_affected, float_affected
      ) VALUES (
        ${transactionData.type}, ${transactionData.amount}, ${transactionData.fee},
        ${transactionData.customerName}, ${transactionData.accountNumber},
        ${transactionData.partnerBank}, ${transactionData.partnerBankCode},
        ${transactionData.partnerBankId}, ${transactionData.reference},
        ${transactionData.branchId}, ${transactionData.userId},
        ${transactionData.cashTillAffected}, ${transactionData.floatAffected}
      ) RETURNING *
    `;
    return transaction[0];
  } catch (error) {
    console.error("Error creating agency banking transaction:", error);
    throw error;
  }
}

// Helper function to complete agency banking transaction
async function completeAgencyBankingTransaction(
  transactionId: string,
  status: string
) {
  try {
    const transaction = await sql`
      UPDATE agency_banking_transactions 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${transactionId}
      RETURNING *
    `;
    return transaction[0];
  } catch (error) {
    console.error("Error completing agency banking transaction:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Create the transaction
    const transaction = await createAgencyBankingTransaction({
      type: data.transactionType,
      amount: Number.parseFloat(data.amount),
      fee: data.fee ? Number.parseFloat(data.fee) : 0,
      customerName: data.customerName,
      accountNumber: data.accountNumber,
      partnerBank: data.partnerBank,
      partnerBankCode: data.partnerBankCode,
      reference: data.reference,
      branchId: data.branchId,
      userId: data.userId,
      cashTillAffected: data.cashTillAffected || 0,
      floatAffected: data.floatAffected || 0,
      metadata: data.metadata,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Failed to create Agency Banking transaction" },
        { status: 500 }
      );
    }

    // Complete the transaction (this will generate GL entries)
    const completedTransaction = await completeAgencyBankingTransaction(
      transaction.id,
      "completed"
    );

    if (!completedTransaction) {
      return NextResponse.json(
        { error: "Failed to complete Agency Banking transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transaction processed successfully with GL entries",
      transaction: completedTransaction,
    });
  } catch (error) {
    console.error(
      "Error processing Agency Banking transaction with GL integration:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process Agency Banking transaction",
      },
      { status: 500 }
    );
  }
}
