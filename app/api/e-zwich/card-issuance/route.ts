import { type NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { AuditLoggerService } from "@/lib/services/audit-logger-service";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";
import { NotificationService } from "@/lib/services/notification-service";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const limit = searchParams.get("limit") || "50";

    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Branch ID is required" },
        { status: 400 }
      );
    }

    // Ensure card issuance table exists
    await sql`
      CREATE TABLE IF NOT EXISTS ezwich_card_issuance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_number VARCHAR(20) UNIQUE NOT NULL,
        batch_id UUID,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_email VARCHAR(255),
        date_of_birth DATE,
        gender VARCHAR(10),
        id_type VARCHAR(50),
        id_number VARCHAR(50),
        id_expiry_date DATE,
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        region VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Ghana',
        card_status VARCHAR(20) DEFAULT 'active',
        issue_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE,
        branch_id VARCHAR(100) NOT NULL,
        issued_by VARCHAR(100) NOT NULL,
        fee_charged DECIMAL(10,2) DEFAULT 15.00,
        customer_photo TEXT,
        id_front_image TEXT,
        id_back_image TEXT,
        payment_method VARCHAR(50),
        partner_bank VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const issuances = await sql`
      SELECT 
        ci.*,
        cb.batch_code,
        cb.card_type as batch_card_type
      FROM ezwich_card_issuance ci
      LEFT JOIN ezwich_card_batches cb ON ci.batch_id = cb.id
      WHERE ci.branch_id = ${branchId}
      ORDER BY ci.created_at DESC
      LIMIT ${Number.parseInt(limit)}
    `;

    return NextResponse.json({
      success: true,
      data: issuances,
    });
  } catch (error) {
    console.error("Error fetching card issuances:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch card issuances" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract form data
    const card_number = formData.get("card_number") as string;
    const customer_name = formData.get("customer_name") as string;
    const customer_phone = formData.get("customer_phone") as string;
    const customer_email = formData.get("customer_email") as string;
    const date_of_birth = formData.get("date_of_birth") as string;
    const gender = formData.get("gender") as string;
    const id_type = formData.get("id_type") as string;
    const id_number = formData.get("id_number") as string;
    const id_expiry_date = formData.get("id_expiry_date") as string;
    const address_line1 = formData.get("address_line1") as string;
    const city = formData.get("city") as string;
    const region = formData.get("region") as string;
    const card_type = formData.get("card_type") as string;
    const partner_bank = formData.get("partner_bank") as string;
    const partner_account_id = formData.get("partner_account_id") as string;
    const payment_method = formData.get("payment_method") as string;
    const fee = formData.get("fee") as string;
    const notes = formData.get("notes") as string;
    const user_id = formData.get("user_id") as string;
    const branch_id = formData.get("branch_id") as string;
    const processed_by = formData.get("processed_by") as string;

    // Handle file uploads
    const customer_photo = formData.get("customer_photo") as File | null;
    const id_front_image = formData.get("id_front_image") as File | null;
    const id_back_image = formData.get("id_back_image") as File | null;

    if (
      !card_number ||
      !customer_name ||
      !customer_phone ||
      !branch_id ||
      !processed_by
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS ezwich_card_issuance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_number VARCHAR(20) UNIQUE NOT NULL,
        batch_id UUID,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_email VARCHAR(255),
        date_of_birth DATE,
        gender VARCHAR(10),
        id_type VARCHAR(50),
        id_number VARCHAR(50),
        id_expiry_date DATE,
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        region VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Ghana',
        card_status VARCHAR(20) DEFAULT 'active',
        issue_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE,
        branch_id VARCHAR(100) NOT NULL,
        issued_by VARCHAR(100) NOT NULL,
        fee_charged DECIMAL(10,2) DEFAULT 15.00,
        customer_photo TEXT,
        id_front_image TEXT,
        id_back_image TEXT,
        payment_method VARCHAR(50),
        partner_bank VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Check if card number already exists
    const existingCard = await sql`
      SELECT id FROM ezwich_card_issuance WHERE card_number = ${card_number}
    `;

    if (existingCard.length > 0) {
      return NextResponse.json(
        { success: false, error: "Card number already exists" },
        { status: 400 }
      );
    }

    // Use the provided batch_id or find an available batch for the card type
    let batch_id = formData.get("batch_id") as string;

    if (!batch_id) {
      // Auto-select batch if not provided (fallback)
      const availableBatch = await sql`
        SELECT id, batch_code FROM ezwich_card_batches 
        WHERE branch_id = ${branch_id} 
        AND card_type = ${card_type || "standard"}
        AND quantity_available > 0
        ORDER BY created_at ASC
        LIMIT 1
      `;

      if (availableBatch.length === 0) {
        return NextResponse.json(
          { success: false, error: "No available batches for this card type" },
          { status: 400 }
        );
      }

      batch_id = availableBatch[0].id;
    } else {
      // Validate the provided batch_id
      const batchValidation = await sql`
        SELECT id, batch_code, quantity_available, card_type FROM ezwich_card_batches 
        WHERE id = ${batch_id} 
        AND branch_id = ${branch_id}
        AND quantity_available > 0
      `;

      if (batchValidation.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Selected batch is not available or has no cards remaining",
          },
          { status: 400 }
        );
      }

      // Check if card type matches (if specified)
      if (card_type && batchValidation[0].card_type !== card_type) {
        return NextResponse.json(
          {
            success: false,
            error: `Selected batch is for ${batchValidation[0].card_type} cards, but ${card_type} was requested`,
          },
          { status: 400 }
        );
      }
    }

    // Get batch details for response
    const batchDetails = await sql`
      SELECT id, batch_code, quantity_available, card_type, partner_bank_name 
      FROM ezwich_card_batches 
      WHERE id = ${batch_id}
    `;

    // Convert files to base64 if provided
    let customer_photo_base64 = null;
    let id_front_image_base64 = null;
    let id_back_image_base64 = null;

    if (customer_photo) {
      const buffer = await customer_photo.arrayBuffer();
      customer_photo_base64 = Buffer.from(buffer).toString("base64");
    }

    if (id_front_image) {
      const buffer = await id_front_image.arrayBuffer();
      id_front_image_base64 = Buffer.from(buffer).toString("base64");
    }

    if (id_back_image) {
      const buffer = await id_back_image.arrayBuffer();
      id_back_image_base64 = Buffer.from(buffer).toString("base64");
    }

    // Create the card issuance
    const result = await sql`
      INSERT INTO ezwich_card_issuance (
        card_number,
        batch_id,
        customer_name,
        customer_phone,
        customer_email,
        date_of_birth,
        gender,
        id_type,
        id_number,
        id_expiry_date,
        address_line1,
        city,
        region,
        card_status,
        issue_date,
        expiry_date,
        branch_id,
        issued_by,
        fee_charged,
        customer_photo,
        id_front_image,
        id_back_image,
        payment_method,
        partner_bank,
        notes
      ) VALUES (
        ${card_number},
        ${batch_id},
        ${customer_name},
        ${customer_phone},
        ${customer_email || null},
        ${date_of_birth ? new Date(date_of_birth) : null},
        ${gender || null},
        ${id_type || null},
        ${id_number || null},
        ${id_expiry_date ? new Date(id_expiry_date) : null},
        ${address_line1 || null},
        ${city || null},
        ${region || null},
        'active',
        CURRENT_DATE,
        ${
          new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        },
        ${branch_id},
        ${processed_by},
        ${Number.parseFloat(fee || "15.00")},
        ${customer_photo_base64},
        ${id_front_image_base64},
        ${id_back_image_base64},
        ${payment_method || null},
        ${partner_bank || null},
        ${notes || null}
      )
      RETURNING *
    `;

    const newIssuance = result[0];

    // Update batch quantity
    await sql`
      UPDATE ezwich_card_batches 
      SET quantity_issued = quantity_issued + 1
      WHERE id = ${batch_id}
    `;

    // Create GL entries for card issuance
    try {
      await UnifiedGLPostingService.createGLEntries({
        transactionId: newIssuance.id,
        sourceModule: "e-zwich",
        transactionType: "card_issuance",
        amount: Number(newIssuance.fee_charged),
        fee: 0, // If you have a separate fee, set it here
        customerName: newIssuance.customer_name,
        reference: newIssuance.card_number,
        processedBy: processed_by,
        branchId: branch_id,
        branchName: null, // If you have branch name, set it here
        metadata: {
          card_number: newIssuance.card_number,
          batch_id: newIssuance.batch_id,
          partner_bank: partner_bank || null,
          payment_method: payment_method || "cash",
        },
      });
    } catch (glError) {
      console.error("GL posting failed for card issuance:", glError);
      // Continue with issuance even if GL posting fails
    }

    // Update float account balance if partner account is specified
    if (partner_account_id && fee) {
      try {
        const feeAmount = Number.parseFloat(fee);
        await sql`
          UPDATE float_accounts 
          SET current_balance = current_balance + ${feeAmount},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${partner_account_id}
        `;
        console.log(
          `🔄 [CARD ISSUANCE] Updated float account ${partner_account_id} balance by ${feeAmount}`
        );
      } catch (floatError) {
        console.error("Failed to update float account balance:", floatError);
        // Continue with issuance even if float update fails
      }
    }

    // Log audit
    await AuditLoggerService.log({
      userId: processed_by,
      username: "System User",
      actionType: "card_issuance",
      entityType: "ezwich_card",
      entityId: newIssuance.id,
      description: "E-Zwich card issued successfully",
      details: {
        card_number: newIssuance.card_number,
        customer_name: newIssuance.customer_name,
        customer_phone: newIssuance.customer_phone,
        fee_charged: newIssuance.fee_charged,
        payment_method: payment_method,
        partner_bank: partner_bank,
      },
      severity: "medium",
      branchId: branch_id,
    });

    // Send SMS notification to customer
    if (customer_phone) {
      try {
        await NotificationService.sendNotification({
          type: "transaction",
          title: "E-Zwich Card Issuance Successful",
          message: `Thank you for using our service! Your E-Zwich card ${newIssuance.card_number} has been issued successfully. Fee: GHS ${newIssuance.fee_charged}`,
          phone: customer_phone,
          userId: processed_by,
          branchId: branch_id,
          metadata: {
            transactionId: newIssuance.id,
            type: "card_issuance",
            amount: newIssuance.fee_charged,
            cardNumber: newIssuance.card_number,
            customerName: newIssuance.customer_name,
            reference: newIssuance.card_number,
          },
          priority: "medium",
        });
      } catch (notificationError) {
        console.error("Failed to send SMS notification:", notificationError);
        // Continue with issuance even if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      data: newIssuance,
      cardId: newIssuance.id,
      batchInfo: batchDetails[0]
        ? {
            batchId: batchDetails[0].id,
            batchCode: batchDetails[0].batch_code,
            cardType: batchDetails[0].card_type,
            partnerBank: batchDetails[0].partner_bank_name,
            remainingCards: batchDetails[0].quantity_available - 1, // After deduction
          }
        : null,
      message: `Card issued successfully from batch ${
        batchDetails[0]?.batch_code || "Unknown"
      }`,
    });
  } catch (error) {
    console.error("Error creating card issuance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create card issuance" },
      { status: 500 }
    );
  }
}
