import { type NextRequest, NextResponse } from "next/server";
import {
  updateCommission,
  getCommissionById,
  deleteCommission,
} from "@/lib/commission-database-service";
import { getCurrentUser } from "@/lib/auth-utils";
import { UnifiedGLPostingService } from "@/lib/services/unified-gl-posting-service";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // COMMISSION EDITING IS DISABLED FOR BUSINESS REASONS
  // Once a commission is created and credited to float account,
  // it should not be editable to maintain accounting integrity
  return NextResponse.json(
    {
      error: "Commission editing is disabled",
      message:
        "Commissions cannot be edited once created to maintain accounting integrity. Please create a new commission if needed or contact administrator.",
      code: "COMMISSION_EDITING_DISABLED",
    },
    { status: 403 }
  );

  /*
  // ORIGINAL CODE - DISABLED
  try {
    console.log("PUT request for commission ID:", (await params).id);

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test((await params).id)) {
      console.log("Invalid commission ID format:", (await params).id);
      return NextResponse.json(
        { error: "Invalid commission ID format" },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log("Received commission update request:", body);

    // Get user info with better error handling
    let user;
    try {
      user = getCurrentUser(request);
      console.log("Successfully got current user for update:", user);
    } catch (error) {
      console.log(
        "Could not get current user from request, trying alternative methods..."
      );

      // Try to get from request body if provided
      if (body.updatedBy && body.branchId) {
        user = {
          id: body.updatedBy,
          name: body.updatedByName || "Unknown User",
          username: body.updatedByName || "Unknown User",
          role: body.userRole || "manager",
          branchId: body.branchId,
          branchName: body.branchName || "Unknown Branch",
        };
        console.log("Got user from request body:", user);
      } else {
        console.log("Using development fallback user for update");
        user = {
          id: "dev-admin-001",
          name: "Development Admin",
          username: "dev-admin",
          role: "admin",
          branchId: "main-branch",
          branchName: "Main Branch",
        };
      }
    }

    // Check if commission exists and get current state
    const existingCommission = await getCommissionById((await params).id);
    if (!existingCommission) {
      console.log("Commission not found for update:", (await params).id);
      console.log(
        "Available commissions count:",
        await sql`SELECT COUNT(*) FROM commissions`
      );
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      );
    }

    console.log("Found commission for update:", existingCommission.reference);

    // Update the commission
    const updatedCommission = await updateCommission(
      (
        await params
      ).id,
      body,
      user.id,
      user.name
    );

    if (!updatedCommission) {
      console.log("Commission update failed");
      return NextResponse.json(
        { error: "Failed to update commission" },
        { status: 500 }
      );
    }

    console.log(
      "Commission updated successfully:",
      updatedCommission.reference
    );

    // Handle GL updates for commission changes
    try {
      console.log("Processing GL updates for commission changes");

      // Get the float account to determine the correct transaction type
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);

      const floatAccount = await sql`
        SELECT account_type FROM float_accounts WHERE id = ${updatedCommission.source}
      `;

      // Map float account type to GL transaction type
      const getCommissionTransactionType = (accountType: string): string => {
        switch (accountType.toLowerCase()) {
          case "momo":
            return "momo_float";
          case "agency-banking":
            return "agency_banking_float";
          case "power":
            return "power_float";
          case "e-zwich":
            return "e_zwich_float";
          case "jumia":
            return "jumia_float";
          default:
            return "agency_banking_float";
        }
      };

      const transactionType =
        floatAccount.length > 0
          ? getCommissionTransactionType(floatAccount[0].account_type)
          : "agency_banking_float";

      console.log("Using GL transaction type for updates:", transactionType);

      // Check what fields changed and handle GL updates accordingly
      const changes = {
        amount:
          body.amount !== undefined &&
          body.amount !== existingCommission.amount,
        status: body.status && body.status !== existingCommission.status,
        source: body.source && body.source !== existingCommission.source,
        sourceName:
          body.sourceName && body.sourceName !== existingCommission.sourceName,
      };

      console.log("Detected changes:", changes);

      // Handle amount changes
      if (changes.amount) {
        const oldAmount = existingCommission.amount;
        const newAmount = Number(body.amount);

        console.log(`Amount changed from ${oldAmount} to ${newAmount}`);

        if (oldAmount !== newAmount) {
          // Reverse the old amount
          await UnifiedGLPostingService.createCommissionReversalGLEntries({
            transactionId: `${existingCommission.id}-reversal-${Date.now()}`,
            sourceModule: "commissions",
            transactionType: transactionType,
            amount: oldAmount,
            fee: 0,
            customerName: existingCommission.sourceName,
            reference: `${existingCommission.reference}-REVERSAL`,
            processedBy: user.id,
            branchId: user.branchId,
            branchName: user.branchName,
            metadata: {
              source: existingCommission.source,
              sourceName: existingCommission.sourceName,
              month: existingCommission.month,
              reversalReason: `Commission amount updated from ${oldAmount} to ${newAmount}`,
              originalStatus: existingCommission.status,
              wasPaid: existingCommission.status === "paid",
              originalTransactionType: transactionType,
            },
          });

          // Post the new amount
          await UnifiedGLPostingService.createCommissionGLEntries({
            transactionId: `${existingCommission.id}-update-${Date.now()}`,
            sourceModule: "commissions",
            transactionType: transactionType,
            amount: newAmount,
            fee: 0,
            customerName: updatedCommission.sourceName,
            reference: updatedCommission.reference,
            processedBy: user.id,
            branchId: user.branchId,
            branchName: user.branchName,
            metadata: {
              source: updatedCommission.source,
              sourceName: updatedCommission.sourceName,
              month: updatedCommission.month,
              status: updatedCommission.status,
              wasPaid: updatedCommission.status === "paid",
              originalTransactionType: transactionType,
              updateReason: "Commission amount updated",
            },
          });

          console.log("GL entries updated for amount change");
        }
      }

      // Handle status changes (pending to paid)
      if (
        changes.status &&
        existingCommission.status === "pending" &&
        body.status === "paid"
      ) {
        console.log("Commission status changed from pending to paid");

        // Create payment GL entries
        await UnifiedGLPostingService.createCommissionPaymentGLEntries({
          transactionId: `${existingCommission.id}-payment-${Date.now()}`,
          sourceModule: "commissions",
          transactionType: transactionType,
          amount: updatedCommission.amount,
          paymentMethod: body.paymentMethod || "bank_transfer",
          customerName: updatedCommission.sourceName,
          reference: `${updatedCommission.reference}-PAYMENT`,
          processedBy: user.id,
          branchId: user.branchId,
          branchName: user.branchName,
          metadata: {
            source: updatedCommission.source,
            sourceName: updatedCommission.sourceName,
            month: updatedCommission.month,
            paymentDate: new Date().toISOString(),
            originalTransactionType: transactionType,
            paymentReference: body.paymentReference || "Manual payment",
          },
        });

        console.log("Payment GL entries created");
      }

      // Handle source changes (float account changes)
      if (changes.source) {
        const oldSource = existingCommission.source;
        const newSource = body.source;

        console.log(`Source changed from ${oldSource} to ${newSource}`);

        // Get the old float account type
        const oldFloatAccount = await sql`
          SELECT account_type FROM float_accounts WHERE id = ${oldSource}
        `;

        const oldTransactionType =
          oldFloatAccount.length > 0
            ? getCommissionTransactionType(oldFloatAccount[0].account_type)
            : "agency_banking_float";

        // Reverse the old source
        await UnifiedGLPostingService.createCommissionReversalGLEntries({
          transactionId: `${
            existingCommission.id
          }-source-reversal-${Date.now()}`,
          sourceModule: "commissions",
          transactionType: oldTransactionType,
          amount: updatedCommission.amount,
          fee: 0,
          customerName: existingCommission.sourceName,
          reference: `${existingCommission.reference}-SOURCE-REVERSAL`,
          processedBy: user.id,
          branchId: user.branchId,
          branchName: user.branchName,
          metadata: {
            source: oldSource,
            sourceName: existingCommission.sourceName,
            month: existingCommission.month,
            reversalReason: `Commission source changed from ${oldSource} to ${newSource}`,
            originalStatus: existingCommission.status,
            wasPaid: existingCommission.status === "paid",
            originalTransactionType: oldTransactionType,
          },
        });

        // Post to the new source
        await UnifiedGLPostingService.createCommissionGLEntries({
          transactionId: `${existingCommission.id}-source-update-${Date.now()}`,
          sourceModule: "commissions",
          transactionType: transactionType,
          amount: updatedCommission.amount,
          fee: 0,
          customerName: updatedCommission.sourceName,
          reference: updatedCommission.reference,
          processedBy: user.id,
          branchId: user.branchId,
          branchName: user.branchName,
          metadata: {
            source: newSource,
            sourceName: updatedCommission.sourceName,
            month: updatedCommission.month,
            status: updatedCommission.status,
            wasPaid: updatedCommission.status === "paid",
            originalTransactionType: transactionType,
            updateReason: "Commission source updated",
          },
        });

        console.log("GL entries updated for source change");
      }

      console.log("All GL updates completed successfully");
    } catch (glError) {
      console.error("Error processing GL updates:", glError);
      // Don't fail the update operation if GL posting fails
      // The commission is already updated, so we just log the error
    }

    // Log audit trail for commission update
    try {
      const { AuditLogger } = await import("@/lib/audit-logger");

      AuditLogger.log({
        userId: user.id,
        username: user.name,
        actionType: "update",
        entityType: "commission",
        entityId: updatedCommission.id,
        description: `Commission updated - ${updatedCommission.source} - ${updatedCommission.reference}`,
        details: {
          source: updatedCommission.source,
          reference: updatedCommission.reference,
          month: updatedCommission.month,
          amount: updatedCommission.amount,
          status: updatedCommission.status,
          branchId: updatedCommission.branchId,
          branchName: updatedCommission.branchName,
          changes: body,
        },
        severity: "medium",
        branchId: updatedCommission.branchId,
        branchName: updatedCommission.branchName,
        status: "success",
      });
    } catch (auditError) {
      console.error("Failed to log audit trail:", auditError);
    }

    return NextResponse.json(updatedCommission);
  } catch (error) {
    console.error("Error in PUT /api/commissions/[id]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update commission",
      },
      { status: 500 }
    );
  }
  */
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("DELETE request for commission ID:", (await params).id);

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test((await params).id)) {
      console.log("Invalid commission ID format:", (await params).id);
      return NextResponse.json(
        { error: "Invalid commission ID format" },
        { status: 400 }
      );
    }

    // Get user info
    let user;
    try {
      user = getCurrentUser(request);
    } catch (error) {
      console.log("Using development fallback user for delete");
      user = {
        id: "dev-admin-001",
        name: "Development Admin",
        username: "dev-admin",
        role: "admin",
        branchId: "main-branch",
        branchName: "Main Branch",
      };
    }

    // Check if commission exists
    const existingCommission = await getCommissionById((await params).id);
    if (!existingCommission) {
      console.log("Commission not found for delete:", (await params).id);
      console.log(
        "Available commissions count:",
        await sql`SELECT COUNT(*) FROM commissions`
      );
      return NextResponse.json(
        { error: "Commission not found" },
        { status: 404 }
      );
    }

    console.log("Found commission for delete:", existingCommission.reference);

    // Delete the commission
    const success = await deleteCommission((await params).id);

    if (!success) {
      console.log("Commission delete failed");
      return NextResponse.json(
        { error: "Failed to delete commission" },
        { status: 500 }
      );
    }

    console.log(
      "Commission deleted successfully:",
      existingCommission.reference
    );

    // Create GL reversal entry to balance the books
    try {
      console.log("Creating GL reversal entry for deleted commission");

      // Determine the reason based on commission status
      const reason =
        existingCommission.status === "paid"
          ? "Paid commission deleted by user"
          : "Pending commission deleted by user";

      // Get the float account to determine the correct transaction type
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);

      const floatAccount = await sql`
        SELECT account_type FROM float_accounts WHERE id = ${existingCommission.source}
      `;

      // Map float account type to GL transaction type (same logic as commission creation)
      const getCommissionTransactionType = (accountType: string): string => {
        switch (accountType.toLowerCase()) {
          case "momo":
            return "momo_float";
          case "agency-banking":
            return "agency_banking_float";
          case "power":
            return "power_float";
          case "e-zwich":
            return "e_zwich_float";
          case "jumia":
            return "jumia_float";
          default:
            return "agency_banking_float"; // Default fallback
        }
      };

      const transactionType =
        floatAccount.length > 0
          ? getCommissionTransactionType(floatAccount[0].account_type)
          : "agency_banking_float";

      console.log("Using GL transaction type for reversal:", transactionType);
      console.log(
        "Float account type:",
        floatAccount.length > 0 ? floatAccount[0].account_type : "not found"
      );
      console.log("Branch ID:", user.branchId);
      console.log("Float account ID:", existingCommission.source);

      // Debug: Check if mappings exist without float account filter
      const allMappings = await sql`
        SELECT mapping_type, gl_account_id, float_account_id
        FROM gl_mappings
        WHERE transaction_type = ${transactionType}
          AND branch_id = ${user.branchId}
          AND is_active = true
      `;
      console.log(`🔷 [GL] All mappings for ${transactionType}:`, allMappings);

      // Use the unified GL posting service for commission reversal
      const glResult =
        await UnifiedGLPostingService.createCommissionReversalGLEntries({
          transactionId: existingCommission.id,
          sourceModule: "commissions",
          transactionType: transactionType, // Use the correct transaction type
          amount: existingCommission.amount,
          fee: 0, // Commissions typically don't have fees
          customerName: existingCommission.sourceName,
          reference: existingCommission.reference,
          processedBy: user.id,
          branchId: user.branchId,
          branchName: user.branchName,
          metadata: {
            source: existingCommission.source,
            sourceName: existingCommission.sourceName,
            month: existingCommission.month,
            reversalReason: reason,
            originalStatus: existingCommission.status,
            paymentMethod: existingCommission.payment?.method || "unknown",
            wasPaid: existingCommission.status === "paid",
            originalTransactionType: transactionType,
          },
        });

      if (glResult.success) {
        console.log(
          "GL reversal entry created successfully:",
          glResult.glTransactionId
        );
      } else {
        console.error("Failed to create GL reversal entry:", glResult.error);
        // Don't fail the delete operation if GL posting fails
        // The commission is already deleted, so we just log the error
      }
    } catch (glError) {
      console.error("Error creating GL reversal entry:", glError);
      // Don't fail the delete operation if GL posting fails
    }

    // Log audit trail for commission deletion
    try {
      const { AuditLogger } = await import("@/lib/audit-logger");

      AuditLogger.log({
        userId: user.id,
        username: user.name,
        actionType: "delete",
        entityType: "commission",
        entityId: existingCommission.id,
        description: `Commission deleted - ${existingCommission.source} - ${existingCommission.reference}`,
        details: {
          source: existingCommission.source,
          reference: existingCommission.reference,
          month: existingCommission.month,
          amount: existingCommission.amount,
          status: existingCommission.status,
          branchId: existingCommission.branchId,
          branchName: existingCommission.branchName,
        },
        severity: "high",
        branchId: existingCommission.branchId,
        branchName: existingCommission.branchName,
        status: "success",
      });
    } catch (auditError) {
      console.error("Failed to log audit trail:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Commission deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/commissions/[id]:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete commission",
      },
      { status: 500 }
    );
  }
}
