import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Upload receipt
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: commissionId } = await params;

    // Check if commission exists
    const commission = await sql`
      SELECT id, source_name FROM commissions WHERE id = ${commissionId}
    `;

    if (commission.length === 0) {
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const receiptFile = formData.get("receipt") as File;

    if (!receiptFile) {
      return NextResponse.json(
        { error: "No receipt file provided" },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    if (receiptFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(receiptFile.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: images, PDF, Word documents" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await receiptFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Update commission with receipt data
    await sql`
      UPDATE commissions 
      SET 
        receipt_filename = ${receiptFile.name},
        receipt_size = ${receiptFile.size},
        receipt_type = ${receiptFile.type},
        receipt_data = ${base64},
        updated_at = NOW()
      WHERE id = ${commissionId}
    `;

    console.log(
      "✅ [COMMISSION] Receipt uploaded for commission:",
      commissionId
    );

    return NextResponse.json({
      success: true,
      message: "Receipt uploaded successfully",
      filename: receiptFile.name,
      size: receiptFile.size,
    });
  } catch (error) {
    console.error("❌ [COMMISSION] Error uploading receipt:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload receipt",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Download receipt
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string  }> }
) {
  try {
    const { id: commissionId } = await params;

    // Get commission with receipt data
    const commission = await sql`
      SELECT receipt_filename, receipt_size, receipt_type, receipt_data 
      FROM commissions 
      WHERE id = ${commissionId}
    `;

    if (commission.length === 0) {
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      );
    }

    const receipt = commission[0];

    if (!receipt.receipt_data) {
      return NextResponse.json(
        { error: "No receipt found for this commission" },
        { status: 404 }
      );
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(receipt.receipt_data, "base64");

    // Create response with appropriate headers
    const response = new NextResponse(buffer);
    response.headers.set(
      "Content-Type",
      receipt.receipt_type || "application/octet-stream"
    );
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="${receipt.receipt_filename || "receipt"}"`
    );
    response.headers.set(
      "Content-Length",
      receipt.receipt_size?.toString() || buffer.length.toString()
    );

    return response;
  } catch (error) {
    console.error("❌ [COMMISSION] Error downloading receipt:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to download receipt",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
