import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: cardIssuanceId } = await params;

    // Get card issuance with batch information
    const cardIssuance = await sql`
      SELECT 
        ci.id,
        ci.card_number,
        ci.customer_name,
        ci.fee_charged,
        ci.issued_by,
        ci.issue_date,
        cb.id as batch_id,
        cb.batch_code,
        cb.card_type,
        cb.partner_bank_name,
        cb.quantity_received,
        cb.quantity_issued,
        cb.quantity_available,
        cb.created_at as batch_created_at
      FROM ezwich_card_issuance ci
      LEFT JOIN ezwich_card_batches cb ON ci.batch_id = cb.id
      WHERE ci.id = ${cardIssuanceId}
    `;

    if (cardIssuance.length === 0) {
      return NextResponse.json(
        { success: false, error: "Card issuance not found" },
        { status: 404 }
      );
    }

    const issuance = cardIssuance[0];

    return NextResponse.json({
      success: true,
      data: {
        cardIssuance: {
          id: issuance.id,
          cardNumber: issuance.card_number,
          customerName: issuance.customer_name,
          feeCharged: issuance.fee_charged,
          issuedBy: issuance.issued_by,
          issueDate: issuance.issue_date,
        },
        batchInfo: issuance.batch_id
          ? {
              batchId: issuance.batch_id,
              batchCode: issuance.batch_code,
              cardType: issuance.card_type,
              partnerBank: issuance.partner_bank_name,
              totalReceived: issuance.quantity_received,
              totalIssued: issuance.quantity_issued,
              remainingAvailable: issuance.quantity_available,
              batchCreatedAt: issuance.batch_created_at,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching card issuance batch info:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch batch information" },
      { status: 500 }
    );
  }
}
