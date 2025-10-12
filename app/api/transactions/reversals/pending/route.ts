import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const reversals = await sql`
      SELECT 
        tr.*,
        -- Try to get transaction details from different tables with proper type casting
        COALESCE(mt.customer_name, abt.customer_name, et.customer_name, pt.customer_name, jt.customer_name) as customer_name,
        COALESCE(mt.amount::text, abt.amount::text, et.amount::text, pt.amount::text, jt.amount::text, '0')::decimal as amount,
        COALESCE(mt.fee::text, abt.fee::text, et.fee::text, pt.fee::text, jt.fee::text, '0')::decimal as fee,
        COALESCE(mt.phone_number, abt.phone_number, et.phone_number, pt.phone_number, jt.phone_number) as phone_number,
        COALESCE(mt.branch_id::text, abt.branch_id::text, et.branch_id::text, pt.branch_id::text, jt.branch_id::text) as transaction_branch_id,
        COALESCE(b.name, 'Unknown Branch') as branch_name,
        -- Get user info
        COALESCE(u.name, u.username, tr.requested_by) as requester_name
      FROM transaction_reversals tr
      LEFT JOIN momo_transactions mt ON tr.transaction_id = mt.id::text
      LEFT JOIN agency_banking_transactions abt ON tr.transaction_id = abt.id::text  
      LEFT JOIN ezwich_transactions et ON tr.transaction_id = et.id::text
      LEFT JOIN power_transactions pt ON tr.transaction_id = pt.id::text
      LEFT JOIN jumia_transactions jt ON tr.transaction_id = jt.id::text
      LEFT JOIN branches b ON COALESCE(mt.branch_id::text, abt.branch_id::text, et.branch_id::text, pt.branch_id::text, jt.branch_id::text) = b.id::text
      LEFT JOIN users u ON tr.requested_by = u.id::text OR tr.requested_by = u.username
      WHERE tr.status = 'pending'
      ORDER BY tr.requested_at DESC
    `

    // Transform the data to match expected format
    const transformedReversals = reversals.map((reversal) => ({
      id: reversal.id,
      transactionId: reversal.transaction_id,
      originalTransactionId: reversal.original_transaction_id,
      transactionType: reversal.reversal_type,
      serviceType: reversal.service_type || "unknown",
      amount: Number.parseFloat(reversal.amount) || 0,
      fee: Number.parseFloat(reversal.fee) || 0,
      customerName: reversal.customer_name || "Unknown Customer",
      phoneNumber: reversal.phone_number,
      reason: reversal.reason,
      requestedBy: reversal.requester_name || reversal.requested_by || "Unknown",
      requestedAt: reversal.requested_at,
      status: reversal.status,
      reviewedBy: reversal.approved_by || reversal.rejected_by,
      reviewedAt: reversal.approved_at || reversal.rejected_at,
      reviewComments: reversal.approval_notes || reversal.rejection_reason,
      branchId: reversal.transaction_branch_id,
      branchName: reversal.branch_name || "Unknown Branch",
    }))

    return NextResponse.json({
      success: true,
      reversals: transformedReversals,
    })
  } catch (error) {
    console.error("Error fetching pending reversals with JOINs:", error)

    // Fallback: Try a much simpler approach - get reversals first, then fetch transaction details separately
    try {
      const simpleReversals = await sql`
        SELECT * FROM transaction_reversals 
        WHERE status = 'pending'
        ORDER BY requested_at DESC
      `

      // For each reversal, try to get transaction details
      const enrichedReversals = await Promise.all(
        simpleReversals.map(async (reversal) => {
          let transactionDetails = {
            amount: 0,
            fee: 0,
            customer_name: "Unknown Customer",
            phone_number: null,
            branch_id: null,
            branch_name: "Unknown Branch",
          }

          try {
            // Try each transaction table
            const tables = [
              { name: "momo_transactions", service: "momo" },
              { name: "agency_banking_transactions", service: "agency-banking" },
              { name: "ezwich_transactions", service: "ezwich" },
              { name: "power_transactions", service: "power" },
              { name: "jumia_transactions", service: "jumia" },
            ]

            for (const table of tables) {
              try {
                const result = await sql.unsafe(`
                  SELECT 
                    amount, fee, customer_name, phone_number, branch_id,
                    b.name as branch_name
                  FROM ${table.name} t
                  LEFT JOIN branches b ON t.branch_id = b.id
                  WHERE t.id::text = '${reversal.transaction_id}'
                  LIMIT 1
                `)

                if (result.length > 0) {
                  transactionDetails = {
                    amount: Number.parseFloat(result[0].amount) || 0,
                    fee: Number.parseFloat(result[0].fee) || 0,
                    customer_name: result[0].customer_name || "Unknown Customer",
                    phone_number: result[0].phone_number,
                    branch_id: result[0].branch_id,
                    branch_name: result[0].branch_name || "Unknown Branch",
                  }
                  break
                }
              } catch (tableError) {
                // Continue to next table
                continue
              }
            }
          } catch (detailError) {
            console.error(`Error fetching details for reversal ${reversal.id}:`, detailError)
          }

          // Try to get user info
          let requesterName = reversal.requested_by
          try {
            const userResult = await sql`
              SELECT name, username FROM users 
              WHERE id::text = ${reversal.requested_by} OR username = ${reversal.requested_by}
              LIMIT 1
            `
            if (userResult.length > 0) {
              requesterName = userResult[0].name || userResult[0].username || reversal.requested_by
            }
          } catch (userError) {
            // Use original requested_by value
          }

          return {
            id: reversal.id,
            transactionId: reversal.transaction_id,
            originalTransactionId: reversal.original_transaction_id,
            transactionType: reversal.reversal_type,
            serviceType: reversal.service_type || "unknown",
            amount: transactionDetails.amount,
            fee: transactionDetails.fee,
            customerName: transactionDetails.customer_name,
            phoneNumber: transactionDetails.phone_number,
            reason: reversal.reason,
            requestedBy: requesterName,
            requestedAt: reversal.requested_at,
            status: reversal.status,
            reviewedBy: reversal.approved_by || reversal.rejected_by,
            reviewedAt: reversal.approved_at || reversal.rejected_at,
            reviewComments: reversal.approval_notes || reversal.rejection_reason,
            branchId: transactionDetails.branch_id,
            branchName: transactionDetails.branch_name,
          }
        }),
      )

      return NextResponse.json({
        success: true,
        reversals: enrichedReversals,
      })
    } catch (fallbackError) {
      console.error("Fallback query also failed:", fallbackError)

      // Last resort: return basic reversal data without transaction details
      try {
        const basicReversals = await sql`
          SELECT * FROM transaction_reversals 
          WHERE status = 'pending'
          ORDER BY requested_at DESC
        `

        const basicTransformed = basicReversals.map((reversal) => ({
          id: reversal.id,
          transactionId: reversal.transaction_id,
          originalTransactionId: reversal.original_transaction_id,
          transactionType: reversal.reversal_type,
          serviceType: reversal.service_type || "unknown",
          amount: 0,
          fee: 0,
          customerName: "Unknown Customer",
          phoneNumber: null,
          reason: reversal.reason,
          requestedBy: reversal.requested_by || "Unknown",
          requestedAt: reversal.requested_at,
          status: reversal.status,
          reviewedBy: reversal.approved_by || reversal.rejected_by,
          reviewedAt: reversal.approved_at || reversal.rejected_at,
          reviewComments: reversal.approval_notes || reversal.rejection_reason,
          branchId: null,
          branchName: "Unknown Branch",
        }))

        return NextResponse.json({
          success: true,
          reversals: basicTransformed,
        })
      } catch (lastError) {
        console.error("All queries failed:", lastError)
        return NextResponse.json({ error: "Failed to fetch pending reversals" }, { status: 500 })
      }
    }
  }
}
