import { neon } from "@neondatabase/serverless";
import { hashPassword } from "./auth-service";

const sql = neon(process.env.DATABASE_URL!);

export interface SeedUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  password: string;
  phone?: string;
  status: string;
  primaryBranchId?: string;
}

const defaultUsers: SeedUser[] = [
  {
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    role: "Admin",
    password: "password123",
    phone: "+233123456789",
    status: "active",
  },
  {
    firstName: "Mohammed Salim",
    lastName: "Abdul-Majeed",
    email: "msalim@example.com",
    role: "Manager",
    password: "password123",
    phone: "+233987654321",
    status: "active",
  },
  {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    role: "Cashier",
    password: "password123",
    phone: "+233555666777",
    status: "active",
  },
  {
    firstName: "Michael",
    lastName: "Johnson",
    email: "michael.johnson@example.com",
    role: "Supervisor",
    password: "password123",
    phone: "+233444555666",
    status: "active",
  },
  {
    firstName: "Emily",
    lastName: "Brown",
    email: "emily.brown@example.com",
    role: "Cashier",
    password: "password123",
    phone: "+233333444555",
    status: "active",
  },
];

export async function seedUsers(customPassword?: string): Promise<{
  success: boolean;
  usersCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let usersCreated = 0;

  try {
    console.log("Starting user seeding process...");

    // First, ensure we have at least one branch to assign users to
    const branches = await sql`SELECT id FROM branches LIMIT 1`;
    let defaultBranchId = null;

    if (branches.length === 0) {
      console.log("No branches found, creating default branch...");
      const [newBranch] = await sql`
        INSERT INTO branches (name, code, location, manager, staff_count, status)
        VALUES ('Main Branch', 'MAIN', 'Head Office', 'Admin User', 0, 'active')
        RETURNING id
      `;
      defaultBranchId = newBranch.id;
    } else {
      defaultBranchId = branches[0].id;
    }

    // Use custom password if provided, otherwise use default
    const passwordToUse = customPassword || "password123";

    for (const userData of defaultUsers) {
      try {
        // Check if user already exists
        const existingUser = await sql`
          SELECT id FROM users WHERE email = ${userData.email}
        `;

        if (existingUser.length > 0) {
          console.log(`User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Hash the password
        const hashedPassword = await hashPassword(passwordToUse);

        // Insert the user
        const [newUser] = await sql`
          INSERT INTO users (
            first_name,
            last_name,
            email,
            role,
            primary_branch_id,
            phone,
            status,
            password_hash,
            password_reset_required,
            created_at,
            updated_at
          ) VALUES (
            ${userData.firstName},
            ${userData.lastName},
            ${userData.email},
            ${userData.role},
            ${userData.primaryBranchId || defaultBranchId},
            ${userData.phone || null},
            ${userData.status},
            ${hashedPassword},
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING id, email
        `;

        // Create user-branch assignment
        await sql`
          INSERT INTO user_branch_assignments (
            user_id,
            branch_id,
            is_primary,
            created_at,
            updated_at
          ) VALUES (
            ${newUser.id},
            ${userData.primaryBranchId || defaultBranchId},
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;

        console.log(`Created user: ${userData.email}`);
        usersCreated++;
      } catch (userError) {
        const errorMsg = `Failed to create user ${userData.email}: ${
          (userError as Error).message
        }`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Update branch staff counts
    await sql`
      UPDATE branches 
      SET staff_count = (
        SELECT COUNT(*) 
        FROM users 
        WHERE primary_branch_id = branches.id AND status = 'active'
      ),
      updated_at = CURRENT_TIMESTAMP
    `;

    console.log(`User seeding completed. Created ${usersCreated} users.`);

    return {
      success: true,
      usersCreated,
      errors,
    };
  } catch (error) {
    const errorMsg = `User seeding failed: ${(error as Error).message}`;
    console.error(errorMsg);
    errors.push(errorMsg);

    return {
      success: false,
      usersCreated,
      errors,
    };
  }
}

export async function createDemoUser(
  email: string,
  password: string,
  role = "Admin"
) {
  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUser.length > 0) {
      return { success: false, message: "User already exists" };
    }

    // Get default branch
    const branches = await sql`SELECT id FROM branches LIMIT 1`;
    let defaultBranchId = null;

    if (branches.length === 0) {
      const [newBranch] = await sql`
        INSERT INTO branches (name, code, location, manager, staff_count, status)
        VALUES ('Demo Branch', 'DEMO', 'Demo Location', 'Demo Manager', 1, 'active')
        RETURNING id
      `;
      defaultBranchId = newBranch.id;
    } else {
      defaultBranchId = branches[0].id;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const [newUser] = await sql`
      INSERT INTO users (
        first_name,
        last_name,
        email,
        role,
        primary_branch_id,
        phone,
        status,
        password_hash,
        password_reset_required,
        created_at,
        updated_at
      ) VALUES (
        'Demo',
        'User',
        ${email},
        ${role},
        ${defaultBranchId},
        '+233000000000',
        'active',
        ${hashedPassword},
        false,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING id, email
    `;

    // Create user-branch assignment
    await sql`
      INSERT INTO user_branch_assignments (
        user_id,
        branch_id,
        is_primary,
        created_at,
        updated_at
      ) VALUES (
        ${newUser.id},
        ${defaultBranchId},
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    return {
      success: true,
      message: "Demo user created successfully",
      user: newUser,
    };
  } catch (error) {
    console.error("Error creating demo user:", error);
    return { success: false, message: (error as Error).message };
  }
}
