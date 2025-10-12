import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { getCurrentUser } from "@/lib/auth-utils";
import { verifyPassword } from "@/lib/auth-service";

const sql = neon(process.env.DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await sql`
      SELECT 
        fa.*,
        b.name as branch_name
      FROM float_accounts fa
      LEFT JOIN branches b ON fa.branch_id = b.id
      WHERE fa.id = ${id}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Float account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account: result[0],
    });
  } catch (error) {
    console.error("Error fetching float account:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch float account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get current user for role-based access
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      console.warn("Authentication failed, using fallback:", authError);
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        name: "System User",
        username: "system",
        role: "User",
        branchId: "635844ab-029a-43f8-8523-d7882915266a",
        branchName: "Main Branch",
      };
    }

    const {
      branch_id,
      provider,
      account_number,
      current_balance,
      min_threshold,
      max_threshold,
      is_active,
      isEzwichPartner,
    } = body;

    // Check if user is trying to change branch assignment
    if (branch_id) {
      const isAdmin = user.role === "Admin" || user.role === "admin";
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: "Only administrators can change branch assignments",
          },
          { status: 403 }
        );
      }
    }

    // Update the float account
    const result = await sql`
      UPDATE float_accounts SET
        branch_id = COALESCE(${branch_id}, branch_id),
        provider = COALESCE(${provider}, provider),
        account_number = COALESCE(${account_number}, account_number),
        current_balance = COALESCE(${current_balance}, current_balance),
        min_threshold = COALESCE(${min_threshold}, min_threshold),
        max_threshold = COALESCE(${max_threshold}, max_threshold),
        is_active = COALESCE(${is_active}, is_active),
        isezwichpartner = COALESCE(${isEzwichPartner}, isezwichpartner),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Float account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account: result[0],
      message: "Float account updated successfully",
    });
  } catch (error) {
    console.error("Error updating float account:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update float account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get current user for role-based access
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      console.warn("Authentication failed, using fallback:", authError);
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        name: "System User",
        username: "system",
        role: "User",
        branchId: "635844ab-029a-43f8-8523-d7882915266a",
        branchName: "Main Branch",
      };
    }

    const {
      branch_id,
      provider,
      account_number,
      current_balance,
      min_threshold,
      max_threshold,
      is_active,
      isEzwichPartner,
    } = body;

    // Check if user is trying to change branch assignment
    if (branch_id) {
      const isAdmin = user.role === "Admin" || user.role === "admin";
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: "Only administrators can change branch assignments",
          },
          { status: 403 }
        );
      }
    }

    // Get current account to check if balance is being changed
    const [currentAccount] = await sql`
      SELECT current_balance, branch_id FROM float_accounts WHERE id = ${id}
    `;

    if (!currentAccount) {
      return NextResponse.json(
        { success: false, error: "Float account not found" },
        { status: 404 }
      );
    }

    // Update the float account
    const result = await sql`
      UPDATE float_accounts SET
        branch_id = COALESCE(${branch_id}, branch_id),
        provider = COALESCE(${provider}, provider),
        account_number = COALESCE(${account_number}, account_number),
        current_balance = COALESCE(${current_balance}, current_balance),
        min_threshold = COALESCE(${min_threshold}, min_threshold),
        max_threshold = COALESCE(${max_threshold}, max_threshold),
        is_active = COALESCE(${is_active}, is_active),
        isezwichpartner = COALESCE(${isEzwichPartner}, isezwichpartner),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Float account not found" },
        { status: 404 }
      );
    }

    // Create GL entries if balance was adjusted
    if (
      current_balance !== undefined &&
      current_balance !== currentAccount.current_balance
    ) {
      const adjustmentAmount =
        current_balance - Number(currentAccount.current_balance);
      const reason =
        adjustmentAmount > 0
          ? "Manual balance increase"
          : "Manual balance decrease";

      try {
        const { FloatAccountGLService } = await import(
          "@/lib/services/float-account-gl-service"
        );
        await FloatAccountGLService.createBalanceAdjustmentGLEntries(
          id,
          adjustmentAmount,
          reason,
          user.id,
          currentAccount.branch_id,
          `Balance adjustment: ${reason}`
        );
        console.log(
          "✅ [FLOAT-EDIT] GL entries created for balance adjustment"
        );
      } catch (glError) {
        console.error(
          "❌ [FLOAT-EDIT] Failed to create GL entries for balance adjustment:",
          glError
        );
        // Don't fail the entire operation for GL entry issues
      }
    }

    return NextResponse.json({
      success: true,
      account: result[0],
      message: "Float account updated successfully",
    });
  } catch (error) {
    console.error("Error updating float account:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update float account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { password } = body;

    // Get current user for role-based access
    let user;
    try {
      user = await getCurrentUser(request);
    } catch (authError) {
      console.warn("Authentication failed, using fallback:", authError);
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        name: "System User",
        username: "system",
        role: "User",
        branchId: "635844ab-029a-43f8-8523-d7882915266a",
        branchName: "Main Branch",
      };
    }

    // Only admin can permanently delete
    const isAdmin = user.role === "Admin" || user.role === "admin";
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Insufficient permissions. Only administrators can permanently delete accounts.",
        },
        { status: 403 }
      );
    }

    // Validate password is provided
    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required for account deletion.",
        },
        { status: 400 }
      );
    }

    // Verify the password against the user's actual password
    try {
      const userRecord = await sql`
        SELECT password_hash FROM users WHERE id = ${user.id}
      `;

      if (userRecord.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "User not found. Please log in again.",
          },
          { status: 401 }
        );
      }

      const isValidPassword = await verifyPassword(
        password,
        userRecord[0].password_hash
      );

      if (!isValidPassword) {
        return NextResponse.json(
          {
            success: false,
            error: "Incorrect password. Please enter your correct password.",
          },
          { status: 401 }
        );
      }
    } catch (passwordError) {
      console.error("Error verifying password:", passwordError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify password. Please try again.",
        },
        { status: 500 }
      );
    }

    // Get the float account details before deletion
    const floatAccount = await sql`
      SELECT * FROM float_accounts WHERE id = ${id}
    `;

    if (floatAccount.length === 0) {
      return NextResponse.json(
        { success: false, error: "Float account not found" },
        { status: 404 }
      );
    }

    const account = floatAccount[0];

    // Check if account has transactions (prevent deletion if it does)
    const transactionCount = await sql`
      SELECT COUNT(*) as count FROM (
        SELECT id FROM momo_transactions WHERE float_account_id = ${id}
        UNION ALL
        SELECT id FROM agency_banking_transactions WHERE partner_bank_id = ${id}
        UNION ALL
        SELECT id FROM e_zwich_withdrawals WHERE ezwich_settlement_account_id = ${id}
        UNION ALL
        SELECT id FROM power_transactions WHERE float_account_id = ${id}
        UNION ALL
        SELECT id FROM jumia_transactions WHERE float_account_id = ${id}
      ) as all_transactions
    `;

    const hasTransactions = Number(transactionCount[0]?.count || 0) > 0;

    if (hasTransactions) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete float account: ${transactionCount[0]?.count} related transactions exist. Please deactivate the account instead.`,
        },
        { status: 400 }
      );
    }

    // Begin transaction for cleanup
    await sql`BEGIN`;

    try {
      // 1. Delete GL mappings for this float account
      const glMappings = await sql`
        SELECT gl_account_id FROM gl_mappings 
        WHERE float_account_id = ${id} AND is_active = true
      `;

      // 2. Delete the GL mappings
      await sql`
        DELETE FROM gl_mappings 
        WHERE float_account_id = ${id}
      `;

      // 3. Delete the GL accounts (only if they were created specifically for this float account)
      const glAccountIds = glMappings.map(
        (mapping: any) => mapping.gl_account_id
      );

      if (glAccountIds.length > 0) {
        // Check if these GL accounts are used by other float accounts
        const otherMappings = await sql`
          SELECT gl_account_id FROM gl_mappings 
          WHERE gl_account_id = ANY(${glAccountIds}) AND float_account_id != ${id}
        `;

        // Only delete GL accounts that are not used by other float accounts
        const accountsToDelete = glAccountIds.filter(
          (id: string) =>
            !otherMappings.some((mapping: any) => mapping.gl_account_id === id)
        );

        if (accountsToDelete.length > 0) {
          await sql`
            DELETE FROM gl_accounts 
            WHERE id = ANY(${accountsToDelete})
          `;
        }
      }

      // 4. Finally delete the float account
      const result = await sql`
        DELETE FROM float_accounts 
        WHERE id = ${id}
        RETURNING *
      `;

      await sql`COMMIT`;

      if (result.length === 0) {
        return NextResponse.json(
          { success: false, error: "Float account not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "Float account and all related GL mappings and accounts deleted successfully",
        deletedAccount: result[0],
        cleanupDetails: {
          glMappingsDeleted: glMappings.length,
          glAccountsDeleted: glAccountIds.length,
        },
      });
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error("Error deleting float account:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete float account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
