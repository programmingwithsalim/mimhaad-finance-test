import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { AuditLoggerService } from "@/lib/services/audit-logger-service"
import { GLPostingService } from "@/lib/services/gl-posting-service-corrected"

const sql = neon(process.env.DATABASE_URL!)

// PUT - Update batch
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  let body
  try {
    const { id } = params
    body = await request.json()

    console.log("📝 Updating batch:", id, body)

    // Validate required fields
    const { batch_code, quantity_received, card_type, expiry_date, notes, userId, branchId } = body

    if (!batch_code || !quantity_received || !card_type) {
      await AuditLoggerService.log({
        userId: userId || "unknown",
        actionType: "batch_update_failed",
        entityType: "ezwich_batch",
        entityId: id,
        description: "Failed to update E-Zwich batch - missing required fields",
        details: { batch_code, quantity_received, card_type },
        severity: "medium",
        branchId,
        status: "failure",
        errorMessage: "Missing required fields",
      })

      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Check if batch exists and get current data
    const existingBatch = await sql`
      SELECT * FROM ezwich_card_batches WHERE id = ${id}
    `

    if (existingBatch.length === 0) {
      await AuditLoggerService.log({
        userId: userId || "unknown",
        actionType: "batch_update_failed",
        entityType: "ezwich_batch",
        entityId: id,
        description: "Failed to update E-Zwich batch - batch not found",
        details: { batch_id: id },
        severity: "medium",
        branchId,
        status: "failure",
        errorMessage: "Batch not found",
      })

      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 })
    }

    const currentBatch = existingBatch[0]

    // Validate that new quantity_received is not less than quantity_issued
    const quantityIssued = Number(currentBatch.quantity_issued || 0)
    if (Number(quantity_received) < quantityIssued) {
      await AuditLoggerService.log({
        userId: userId || "unknown",
        actionType: "batch_update_failed",
        entityType: "ezwich_batch",
        entityId: id,
        description: "Failed to update E-Zwich batch - invalid quantity",
        details: {
          batch_code: currentBatch.batch_code,
          current_quantity: currentBatch.quantity_received,
          new_quantity: quantity_received,
          quantity_issued: quantityIssued,
        },
        severity: "medium",
        branchId,
        status: "failure",
        errorMessage: `Cannot reduce quantity below issued cards (${quantityIssued})`,
      })

      return NextResponse.json(
        {
          success: false,
          error: `Cannot reduce quantity below issued cards (${quantityIssued})`,
        },
        { status: 400 },
      )
    }

    // Store old values for comparison
    const oldQuantity = Number(currentBatch.quantity_received)
    const oldData = {
      batch_code: currentBatch.batch_code,
      quantity_received: oldQuantity,
      card_type: currentBatch.card_type,
      expiry_date: currentBatch.expiry_date,
      notes: currentBatch.notes,
    }

    // Update the batch
    const updatedBatch = await sql`
      UPDATE ezwich_card_batches 
      SET 
        batch_code = ${batch_code},
        quantity_received = ${Number(quantity_received)},
        card_type = ${card_type},
        expiry_date = ${expiry_date || null},
        notes = ${notes || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING 
        id,
        batch_code,
        quantity_received,
        quantity_issued,
        quantity_available,
        card_type,
        expiry_date,
        status,
        branch_id,
        created_by,
        notes,
        created_at,
        updated_at
    `

    const newBatch = updatedBatch[0]

    console.log("✅ E-Zwich batch updated successfully:", newBatch.id)

    // Create GL entries for the update if quantity changed
    try {
      if (oldQuantity !== Number(quantity_received)) {
        const glTransactionId = await GLPostingService.createBatchGLTransaction(
          "update",
          {
            id: newBatch.id,
            batch_code: newBatch.batch_code,
            quantity_received: Number(quantity_received),
          },
          userId || "unknown",
          branchId || newBatch.branch_id,
          oldQuantity,
        )

        console.log("✅ GL transaction created for batch update:", glTransactionId)
      }
    } catch (glError) {
      console.error("❌ GL posting failed for batch update:", glError)
      // Continue with batch update even if GL posting fails
    }

    // Log successful audit
    await AuditLoggerService.log({
      userId: userId || "unknown",
      actionType: "batch_update",
      entityType: "ezwich_batch",
      entityId: newBatch.id,
      description: "E-Zwich card batch updated successfully",
      details: {
        old_data: oldData,
        new_data: {
          batch_code: newBatch.batch_code,
          quantity_received: Number(newBatch.quantity_received),
          card_type: newBatch.card_type,
          expiry_date: newBatch.expiry_date,
          notes: newBatch.notes,
        },
        changes: {
          quantity_changed: oldQuantity !== Number(quantity_received),
          quantity_difference: Number(quantity_received) - oldQuantity,
        },
      },
      severity: "medium",
      branchId: branchId || newBatch.branch_id,
    })

    // Format the response
    const formattedBatch = {
      id: newBatch.id,
      batch_code: newBatch.batch_code,
      quantity_received: Number(newBatch.quantity_received),
      quantity_issued: Number(newBatch.quantity_issued),
      quantity_available: Number(newBatch.quantity_available),
      card_type: newBatch.card_type,
      expiry_date: newBatch.expiry_date ? new Date(newBatch.expiry_date).toISOString().split("T")[0] : null,
      status: newBatch.status,
      display_status: newBatch.status,
      branch_id: newBatch.branch_id,
      created_by: newBatch.created_by,
      notes: newBatch.notes,
      created_at: new Date(newBatch.created_at).toISOString(),
      updated_at: new Date(newBatch.updated_at).toISOString(),
      utilization_percentage:
        newBatch.quantity_received > 0 ? Math.round((newBatch.quantity_issued / newBatch.quantity_received) * 100) : 0,
    }

    return NextResponse.json({
      success: true,
      data: formattedBatch,
      message: "Batch updated successfully",
    })
  } catch (error) {
    console.error("❌ Error updating batch:", error)

    // Log failed audit
    await AuditLoggerService.log({
      userId: body?.userId || "unknown",
      actionType: "batch_update_failed",
      entityType: "ezwich_batch",
      entityId: id,
      description: "Failed to update E-Zwich card batch",
      details: {
        batch_code: body?.batch_code,
        error: error instanceof Error ? error.message : String(error),
      },
      severity: "high",
      branchId: body?.branchId,
      status: "failure",
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return NextResponse.json({ success: false, error: "Batch code already exists" }, { status: 409 })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update batch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// DELETE - Delete batch
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "unknown"
    const branchId = searchParams.get("branchId")

    console.log("🗑️ Deleting batch:", id)

    // Check if batch exists and get its details
    const batch = await sql`
      SELECT 
        id, 
        batch_code, 
        quantity_issued,
        quantity_received,
        quantity_available,
        card_type,
        expiry_date,
        notes,
        branch_id,
        created_by
      FROM ezwich_card_batches 
      WHERE id = ${id}
    `

    if (batch.length === 0) {
      await AuditLoggerService.log({
        userId,
        actionType: "batch_delete_failed",
        entityType: "ezwich_batch",
        entityId: id,
        description: "Failed to delete E-Zwich batch - batch not found",
        details: { batch_id: id },
        severity: "medium",
        branchId,
        status: "failure",
        errorMessage: "Batch not found",
      })

      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 })
    }

    const batchData = batch[0]

    // Check if any cards have been issued from this batch
    const quantityIssued = Number(batchData.quantity_issued || 0)
    if (quantityIssued > 0) {
      await AuditLoggerService.log({
        userId,
        actionType: "batch_delete_failed",
        entityType: "ezwich_batch",
        entityId: id,
        description: "Failed to delete E-Zwich batch - cards already issued",
        details: {
          batch_code: batchData.batch_code,
          quantity_issued: quantityIssued,
          quantity_received: batchData.quantity_received,
        },
        severity: "medium",
        branchId: branchId || batchData.branch_id,
        status: "failure",
        errorMessage: `Cannot delete batch with issued cards (${quantityIssued} cards issued)`,
      })

      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete batch with issued cards. ${quantityIssued} cards have been issued from this batch.`,
        },
        { status: 400 },
      )
    }

    // Create GL entries for the deletion (reverse entries)
    try {
      const glTransactionId = await GLPostingService.createBatchGLTransaction(
        "delete",
        {
          id: batchData.id,
          batch_code: batchData.batch_code,
          quantity_received: Number(batchData.quantity_received),
        },
        userId,
        branchId || batchData.branch_id,
      )

      console.log("✅ GL reversal transaction created for batch deletion:", glTransactionId)
    } catch (glError) {
      console.error("❌ GL posting failed for batch deletion:", glError)
      // Continue with batch deletion even if GL posting fails
    }

    // Delete the batch
    await sql`
      DELETE FROM ezwich_card_batches WHERE id = ${id}
    `

    console.log("✅ E-Zwich batch deleted successfully:", id)

    // Log successful audit
    await AuditLoggerService.log({
      userId,
      actionType: "batch_delete",
      entityType: "ezwich_batch",
      entityId: id,
      description: "E-Zwich card batch deleted successfully",
      details: {
        batch_code: batchData.batch_code,
        quantity_received: Number(batchData.quantity_received),
        quantity_issued: Number(batchData.quantity_issued),
        card_type: batchData.card_type,
        expiry_date: batchData.expiry_date,
        notes: batchData.notes,
      },
      severity: "high",
      branchId: branchId || batchData.branch_id,
    })

    return NextResponse.json({
      success: true,
      message: "Batch deleted successfully",
    })
  } catch (error) {
    console.error("❌ Error deleting batch:", error)

    // Log failed audit
    const { searchParams } = new URL(request.url)
    const { id } = params // Add this line to declare 'id'
    await AuditLoggerService.log({
      userId: searchParams?.get("userId") || "unknown",
      actionType: "batch_delete_failed",
      entityType: "ezwich_batch",
      entityId: id,
      description: "Failed to delete E-Zwich card batch",
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      severity: "high",
      branchId: searchParams?.get("branchId"),
      status: "failure",
      errorMessage: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete batch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// GET - Get single batch
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string  }> }) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId") || "unknown"

    // Log audit for read operation
    await AuditLoggerService.log({
      userId,
      actionType: "batch_read_single",
      entityType: "ezwich_batch",
      entityId: id,
      description: "Fetched single E-Zwich card batch",
      details: { batch_id: id },
      severity: "low",
    })

    const batch = await sql`
      SELECT * FROM ezwich_card_batches WHERE id = ${id}
    `

    if (batch.length === 0) {
      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: batch[0],
    })
  } catch (error) {
    console.error("❌ Error fetching batch:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch batch",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
