import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { AuditLoggerService } from "@/lib/services/audit-logger-service";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  let requestData: any = null;
  let receiptFile: File | null = null;

  try {
    // Check if the request is multipart/form-data (file upload) or JSON
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      requestData = Object.fromEntries(formData.entries());
      receiptFile = formData.get("receipt") as File;

      console.log("📝 [COMMISSION] FormData received:", {
        ...requestData,
        receiptFile: receiptFile
          ? `${receiptFile.name} (${receiptFile.size} bytes)`
          : null,
      });
    } else {
      requestData = await request.json();
      console.log(
        "📝 [COMMISSION] JSON request data:",
        JSON.stringify(requestData, null, 2)
      );
    }

    // Extract user context from headers
    const userId = request.headers.get("x-user-id") || requestData.createdBy;
    const userName =
      request.headers.get("x-user-name") || requestData.createdByName;
    const userRole = request.headers.get("x-user-role") || requestData.userRole;
    const branchId = request.headers.get("x-branch-id") || requestData.branchId;
    const branchName =
      request.headers.get("x-branch-name") || requestData.branchName;

    console.log("📝 [COMMISSION] User context:", {
      userId,
      userName,
      userRole,
      branchId,
      branchName,
    });

    // Validate required fields
    const {
      source,
      sourceName,
      reference,
      month,
      amount,
      transactionVolume,
      commissionRate,
      description,
      notes,
      status = "pending", // Default to pending for approval
    } = requestData;

    if (!source || !sourceName || !reference || !month || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate user context
    if (!userId || !branchId) {
      return NextResponse.json(
        { error: "User context is required" },
        { status: 400 }
      );
    }

    // Generate proper UUID for commission ID
    const { v4: uuidv4 } = await import("uuid");
    const commissionId = uuidv4();

    console.log("📝 [COMMISSION] Creating commission with ID:", commissionId);

    // Log commission creation attempt
    await AuditLoggerService.log({
      userId,
      username: userName || "Unknown User",
      actionType: "commission_creation_attempt",
      entityType: "commission",
      entityId: commissionId,
      description: `Attempting to create commission for ${sourceName}`,
      details: {
        source,
        sourceName,
        reference,
        month,
        amount: Number(amount),
        transactionVolume: Number(transactionVolume || 0),
        commissionRate: Number(commissionRate || 0),
        status,
      },
      severity: "medium",
      branchId,
      branchName: branchName || "Unknown Branch",
      status: "success",
    });

    // Insert commission into database
    // Use the database service function instead of direct SQL
    // This ensures float account crediting happens atomically
    const { createCommission } = await import(
      "@/lib/commission-database-service"
    );

    console.log(
      "🏦 [COMMISSION] Creating commission with float account crediting..."
    );

    const commissionInput = {
      source,
      sourceName,
      reference,
      month,
      amount: Number(amount),
      description: description || "",
      notes: notes || "",
      metadata: {
        transactionVolume: Number(transactionVolume || 0),
        commissionRate: Number(commissionRate || 0),
        settlementPeriod: "monthly",
      },
    };

    const commission = await createCommission(
      commissionInput,
      userId,
      userName || "Unknown User",
      branchId,
      branchName || "Unknown Branch",
      userRole
    );

    console.log(
      "✅ [COMMISSION] Commission created:",
      commission.id,
      "Status:",
      commission.status || "pending"
    );

    // Create GL entries for pending commission (adds to Accounts Receivable)
    if ((commission.status || "pending") === "pending") {
      try {
        // Get Accounts Receivable GL account
        const arAccountResult = await sql`
          SELECT id, code, name FROM gl_accounts 
          WHERE code IN ('1200', '1201') 
          AND type = 'Asset'
          ORDER BY code ASC
          LIMIT 1
        `;

        if (arAccountResult.length > 0) {
          const arAccount = arAccountResult[0];

          // Get Commission Income GL account
          const commissionIncomeResult = await sql`
            SELECT id, code, name FROM gl_accounts 
            WHERE code IN ('4002', '4200', '4100')
            AND type = 'Revenue'
            ORDER BY code ASC
            LIMIT 1
          `;

          if (commissionIncomeResult.length > 0) {
            const incomeAccount = commissionIncomeResult[0];

            // Create GL transaction
            const glTransactionId = await sql`SELECT gen_random_uuid() as id`;
            const glId = glTransactionId[0].id;

            await sql`
              INSERT INTO gl_transactions (
                id, date, source_module, source_transaction_id, source_transaction_type,
                description, status, created_by, branch_id, metadata
              ) VALUES (
                ${glId},
                ${month}::date,
                'commissions',
                ${commission.id},
                'commission_pending',
                ${`Pending Commission: ${
                  description || sourceName || "Commission Revenue"
                }`},
                'posted',
                ${userId},
                ${branchId},
                ${JSON.stringify({
                  source,
                  sourceName,
                  reference,
                  transactionVolume: Number(transactionVolume || 0),
                  commissionRate: Number(commissionRate || 0),
                })}
              )
            `;

            // Create journal entries: Debit Accounts Receivable, Credit Commission Income
            await sql`
              INSERT INTO gl_journal_entries (
                id, transaction_id, account_id, account_code, debit, credit, description
              ) VALUES 
              (gen_random_uuid(), ${glId}, ${arAccount.id}, ${
              arAccount.code
            }, ${Number(
              amount
            )}, 0, 'Accounts Receivable - pending commission'),
              (gen_random_uuid(), ${glId}, ${incomeAccount.id}, ${
              incomeAccount.code
            }, 0, ${Number(amount)}, 'Commission revenue recognized')
            `;

            console.log(
              `✅ Created GL entries for pending commission - Debit: ${arAccount.name}, Credit: ${incomeAccount.name}`
            );
          }
        }
      } catch (glError) {
        console.error(
          "Failed to create GL entries for pending commission:",
          glError
        );
        // Don't fail the commission creation if GL posting fails
      }
    }

    // Ensure the commission object has all required fields
    const formattedCommission = {
      id: commission.id,
      source: commission.source,
      sourceName: commission.source_name,
      amount: Number(commission.amount),
      month: commission.month,
      reference: commission.reference,
      description: commission.description,
      status: commission.status || "paid",
      glAccount: commission.gl_account || "",
      glAccountName: commission.gl_account_name || "",
      branchId: commission.branch_id,
      branchName: commission.branch_name,
      createdAt: commission.created_at,
      updatedAt: commission.updated_at,
      createdBy: {
        id: commission.created_by,
        name: commission.created_by_name,
      },
      updatedBy: commission.updated_by_id
        ? {
            id: commission.updated_by_id,
            name: commission.updated_by_name,
          }
        : undefined,
      payment: commission.payment_status
        ? {
            status: commission.payment_status,
            method: commission.payment_method,
            receivedAt: commission.payment_received_at,
            bankAccount: commission.payment_bank_account,
            referenceNumber: commission.payment_reference_number,
            notes: commission.payment_notes,
          }
        : undefined,
      metadata: {
        transactionVolume: Number(commission.transaction_volume || 0),
        commissionRate: Number(commission.commission_rate || 0),
        settlementPeriod: commission.settlement_period,
      },
      comments: [],
      attachments: [],
    };

    // Handle receipt file upload if provided
    if (receiptFile) {
      try {
        console.log(
          "📎 [COMMISSION] Processing receipt file:",
          receiptFile.name
        );

        // Convert file to base64 for storage (simple approach)
        const arrayBuffer = await receiptFile.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");

        // Store receipt metadata in database
        await sql`
          UPDATE commissions 
          SET 
            receipt_filename = ${receiptFile.name},
            receipt_size = ${receiptFile.size},
            receipt_type = ${receiptFile.type},
            receipt_data = ${base64},
            updated_at = NOW()
          WHERE id = ${commission.id}
        `;

        console.log("✅ [COMMISSION] Receipt file stored successfully");
      } catch (fileError) {
        console.error(
          "❌ [COMMISSION] Failed to store receipt file:",
          fileError
        );
        // Don't fail the commission creation if file upload fails
        await AuditLoggerService.log({
          userId,
          username: userName || "Unknown User",
          actionType: "commission_receipt_upload_failure",
          entityType: "commission",
          entityId: commission.id,
          description: "Failed to upload receipt file",
          details: {
            error:
              fileError instanceof Error
                ? fileError.message
                : "Unknown file error",
            fileName: receiptFile.name,
            fileSize: receiptFile.size,
          },
          severity: "medium",
          branchId,
          branchName: branchName || "Unknown Branch",
          status: "failure",
          errorMessage:
            fileError instanceof Error
              ? fileError.message
              : "Unknown file error",
        });
      }
    }

    // Create GL entries for the commission
    console.log("📊 [COMMISSION] Creating GL entries for commission...");

    try {
      // Get the float account type to determine GL transaction type
      const floatAccountResult = await sql`
        SELECT account_type, provider 
        FROM float_accounts 
        WHERE id = ${commission.source}
      `;

      let transactionType = "agency_banking"; // default
      if (floatAccountResult.length > 0) {
        const accountType = floatAccountResult[0].account_type?.toLowerCase();
        switch (accountType) {
          case "momo":
            transactionType = "momo";
            break;
          case "agency-banking":
            transactionType = "agency_banking";
            break;
          case "power":
            transactionType = "power";
            break;
          case "e-zwich":
            transactionType = "e_zwich";
            break;
          case "jumia":
            transactionType = "jumia";
            break;
          default:
            transactionType = "agency_banking";
        }
      }

      console.log(`📊 [COMMISSION] Using transaction type: ${transactionType}`);

      // Create GL entries for commission income
      await UnifiedGLPostingService.createCommissionGLEntries({
        transactionId: commission.id,
        sourceModule: "commissions",
        transactionType: transactionType,
        amount: Number(commission.amount),
        fee: 0,
        customerName: commission.source_name,
        reference: commission.reference,
        processedBy: userId,
        branchId: branchId,
        branchName: branchName || "Unknown Branch",
        metadata: {
          source: commission.source,
          sourceName: commission.source_name,
          month: commission.month,
          status: commission.status,
          transactionVolume: Number(transactionVolume || 0),
          commissionRate: Number(commissionRate || 0),
          description: commission.description,
          floatAccountType: floatAccountResult[0]?.account_type,
          floatAccountProvider: floatAccountResult[0]?.provider,
        },
      });

      console.log("✅ [COMMISSION] GL entries created successfully");
    } catch (glError) {
      console.error("❌ [COMMISSION] Failed to create GL entries:", glError);

      // Log the GL error but don't fail the commission creation
      // since the float account has already been credited
      await AuditLoggerService.log({
        userId,
        username: userName || "Unknown User",
        actionType: "commission_gl_failure",
        entityType: "commission",
        entityId: commission.id,
        description: `Failed to create GL entries for commission ${commission.reference}`,
        details: {
          error:
            glError instanceof Error ? glError.message : "Unknown GL error",
          commissionId: commission.id,
          amount: Number(commission.amount),
        },
        severity: "high",
        branchId,
        branchName: branchName || "Unknown Branch",
        status: "failure",
        errorMessage:
          glError instanceof Error ? glError.message : "Unknown GL error",
      });
    }

    // Log successful commission creation
    await AuditLoggerService.log({
      userId,
      username: userName || "Unknown User",
      actionType: "commission_created",
      entityType: "commission",
      entityId: commission.id,
      description: `Successfully created commission for ${commission.source_name}`,
      details: {
        commissionId: commission.id,
        source: commission.source,
        sourceName: commission.source_name,
        amount: Number(commission.amount),
        reference: commission.reference,
        status: commission.status,
      },
      severity: Number(commission.amount) > 10000 ? "high" : "medium",
      branchId,
      branchName: branchName || "Unknown Branch",
      status: "success",
    });

    return NextResponse.json({
      success: true,
      message: "Commission created successfully",
      commission: formattedCommission,
    });
  } catch (error: any) {
    console.error("❌ [COMMISSION] Error creating commission:", error);

    // Log the error
    try {
      if (requestData) {
        await AuditLoggerService.log({
          userId: requestData.createdBy || "unknown",
          username: requestData.createdByName || "unknown",
          actionType: "commission_creation_failure",
          entityType: "commission",
          description: "Failed to create commission",
          details: {
            error: error.message,
            stack: error.stack,
            requestData,
          },
          severity: "critical",
          branchId: requestData.branchId || "unknown",
          branchName: requestData.branchName || "Unknown Branch",
          status: "failure",
          errorMessage: error.message,
        });
      }
    } catch (auditError) {
      console.error(
        "❌ [COMMISSION] Failed to log error to audit:",
        auditError
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create commission",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    // Get user context from headers for branch filtering
    const userBranchId = request.headers.get("x-branch-id");
    const userRole = request.headers.get("x-user-role");

    // If no specific branchId provided, use user's branch (unless admin)
    const effectiveBranchId =
      branchId || (userRole === "admin" ? null : userBranchId);

    console.log(
      "📝 [COMMISSION] Executing query with branch filtering:",
      effectiveBranchId
    );

    // Build query based on conditions
    let commissions;

    if (source && status && startDate && endDate && effectiveBranchId) {
      const sources = source.split(",");
      const statuses = status.split(",");
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE source = ANY(${sources})
        AND status = ANY(${statuses})
        AND month >= ${startDate}
        AND month <= ${endDate}
        AND branch_id = ${effectiveBranchId}
        ORDER BY created_at DESC
      `;
    } else if (source && status && startDate && endDate) {
      const sources = source.split(",");
      const statuses = status.split(",");
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE source = ANY(${sources})
        AND status = ANY(${statuses})
        AND month >= ${startDate}
        AND month <= ${endDate}
        ORDER BY created_at DESC
      `;
    } else if (source && status && effectiveBranchId) {
      const sources = source.split(",");
      const statuses = status.split(",");
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE source = ANY(${sources})
        AND status = ANY(${statuses})
        AND branch_id = ${effectiveBranchId}
        ORDER BY created_at DESC
      `;
    } else if (source && status) {
      const sources = source.split(",");
      const statuses = status.split(",");
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE source = ANY(${sources})
        AND status = ANY(${statuses})
        ORDER BY created_at DESC
      `;
    } else if (startDate && endDate && effectiveBranchId) {
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE month >= ${startDate}
        AND month <= ${endDate}
        AND branch_id = ${effectiveBranchId}
        ORDER BY created_at DESC
      `;
    } else if (startDate && endDate) {
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE month >= ${startDate}
        AND month <= ${endDate}
        ORDER BY created_at DESC
      `;
    } else if (effectiveBranchId) {
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        WHERE branch_id = ${effectiveBranchId}
        ORDER BY created_at DESC
      `;
    } else {
      commissions = await sql`
        SELECT 
          id,
          source,
          source_name as "sourceName",
          reference,
          month,
          amount,
          transaction_volume as "transactionVolume",
          commission_rate as "commissionRate",
          description,
          notes,
          status,
          created_by as "createdBy",
          created_by_name as "createdByName",
          branch_id as "branchId",
          branch_name as "branchName",
          created_at as "createdAt",
          updated_at as "updatedAt",
          receipt_filename,
          receipt_size,
          receipt_type
        FROM commissions
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json(commissions);
  } catch (error: any) {
    console.error("❌ [COMMISSION] Error fetching commissions:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to fetch commissions",
      },
      { status: 500 }
    );
  }
}
