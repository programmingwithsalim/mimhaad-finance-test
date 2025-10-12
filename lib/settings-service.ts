import { neon } from "@neondatabase/serverless"
import { AuditService } from "./audit-service"

const sql = neon(process.env.DATABASE_URL!)

export interface SystemSetting {
  id: number
  key: string
  value: string
  category: string
  description: string
  data_type: "string" | "number" | "boolean" | "json"
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface FeeConfiguration {
  id: number
  service_type: string
  fee_type: "fixed" | "percentage" | "tiered"
  fee_value: number
  minimum_fee?: number
  maximum_fee?: number
  currency: string
  is_active: boolean
  effective_date: string
  created_at: string
  updated_at: string
}

export class SettingsService {
  /**
   * Initialize settings tables
   */
  static async initializeTables(): Promise<void> {
    // Create system_settings table
    await sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        data_type VARCHAR(20) DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create fee_configurations table
    await sql`
      CREATE TABLE IF NOT EXISTS fee_configurations (
        id SERIAL PRIMARY KEY,
        service_type VARCHAR(100) NOT NULL,
        fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('fixed', 'percentage', 'tiered')),
        fee_value DECIMAL(10,4) NOT NULL,
        minimum_fee DECIMAL(10,2),
        maximum_fee DECIMAL(10,2),
        currency VARCHAR(3) DEFAULT 'GHS',
        is_active BOOLEAN DEFAULT true,
        effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category)`
    await sql`CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key)`
    await sql`CREATE INDEX IF NOT EXISTS idx_fee_configurations_service_type ON fee_configurations(service_type)`
    await sql`CREATE INDEX IF NOT EXISTS idx_fee_configurations_is_active ON fee_configurations(is_active)`
  }

  /**
   * Get a system setting by key
   */
  static async getSetting(key: string): Promise<SystemSetting | null> {
    try {
      const result = await sql`
        SELECT * FROM system_settings WHERE key = ${key}
      `
      return result[0] || null
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error)
      return null
    }
  }

  /**
   * Get settings by category
   */
  static async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    try {
      const result = await sql`
        SELECT * FROM system_settings WHERE category = ${category} ORDER BY key
      `
      return result
    } catch (error) {
      console.error(`Error getting settings for category ${category}:`, error)
      return []
    }
  }

  /**
   * Update a system setting
   */
  static async updateSetting(
    key: string,
    value: string,
    userId: string,
    username: string,
    branchId?: string,
    branchName?: string,
  ): Promise<boolean> {
    try {
      // Get old value for audit
      const oldSetting = await this.getSetting(key)
      const oldValue = oldSetting?.value

      // Update setting
      await sql`
        UPDATE system_settings 
        SET value = ${value}, updated_at = CURRENT_TIMESTAMP 
        WHERE key = ${key}
      `

      // Log the change
      await AuditService.logSystemConfig({
        userId,
        username,
        configType: key,
        description: `System setting '${key}' updated`,
        oldValue,
        newValue: value,
        branchId,
        branchName,
      })

      return true
    } catch (error) {
      console.error(`Error updating setting ${key}:`, error)
      return false
    }
  }

  /**
   * Create a new system setting
   */
  static async createSetting(
    setting: Omit<SystemSetting, "id" | "created_at" | "updated_at">,
    userId: string,
    username: string,
  ): Promise<boolean> {
    try {
      await sql`
        INSERT INTO system_settings (key, value, category, description, data_type, is_public)
        VALUES (${setting.key}, ${setting.value}, ${setting.category}, 
                ${setting.description}, ${setting.data_type}, ${setting.is_public})
      `

      // Log the creation
      await AuditService.logSystemConfig({
        userId,
        username,
        configType: setting.key,
        description: `System setting '${setting.key}' created`,
        newValue: setting.value,
      })

      return true
    } catch (error) {
      console.error(`Error creating setting ${setting.key}:`, error)
      return false
    }
  }

  /**
   * Get fee configuration for a service
   */
  static async getFeeConfiguration(serviceType: string): Promise<FeeConfiguration | null> {
    try {
      // First check if the table exists
      try {
        const tableCheck = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'fee_configurations'
          ) as exists
        `

        if (!tableCheck[0]?.exists) {
          console.log("Fee configurations table does not exist yet")
          return null
        }

        const result = await sql`
          SELECT * FROM fee_configurations 
          WHERE service_type = ${serviceType} AND is_active = true
          ORDER BY effective_date DESC
          LIMIT 1
        `
        return result[0] || null
      } catch (error) {
        console.error(`Error checking fee_configurations table: ${error}`)
        return null
      }
    } catch (error) {
      console.error(`Error getting fee configuration for ${serviceType}:`, error)
      return null
    }
  }

  /**
   * Get all fee configurations
   */
  static async getAllFeeConfigurations(): Promise<FeeConfiguration[]> {
    try {
      const result = await sql`
        SELECT * FROM fee_configurations 
        ORDER BY service_type, effective_date DESC
      `
      return result
    } catch (error) {
      console.error("Error getting fee configurations:", error)
      return []
    }
  }

  /**
   * Create fee configuration
   */
  static async createFeeConfiguration(
    config: Omit<FeeConfiguration, "id" | "created_at" | "updated_at">,
    userId: string,
    username: string,
  ): Promise<boolean> {
    try {
      await sql`
        INSERT INTO fee_configurations (
          service_type, fee_type, fee_value, minimum_fee, maximum_fee, 
          currency, is_active, effective_date
        ) VALUES (
          ${config.service_type}, ${config.fee_type}, ${config.fee_value},
          ${config.minimum_fee || null}, ${config.maximum_fee || null},
          ${config.currency}, ${config.is_active}, ${config.effective_date}
        )
      `

      // Log the creation
      await AuditService.logSystemConfig({
        userId,
        username,
        configType: "fee_configuration",
        description: `Fee configuration created for ${config.service_type}`,
        newValue: config,
      })

      return true
    } catch (error) {
      console.error(`Error creating fee configuration for ${config.service_type}:`, error)
      return false
    }
  }

  /**
   * Update fee configuration
   */
  static async updateFeeConfiguration(
    id: number,
    updates: Partial<FeeConfiguration>,
    userId: string,
    username: string,
  ): Promise<boolean> {
    try {
      // Get old configuration for audit
      const oldConfig = await sql`SELECT * FROM fee_configurations WHERE id = ${id}`

      // Build update query dynamically
      const updateFields = Object.keys(updates)
        .filter((key) => key !== "id" && key !== "created_at" && key !== "updated_at")
        .map((key) => `${key} = $${key}`)
        .join(", ")

      if (updateFields) {
        await sql`
          UPDATE fee_configurations 
          SET ${sql.unsafe(updateFields)}, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ${id}
        `

        // Log the change
        await AuditService.logSystemConfig({
          userId,
          username,
          configType: "fee_configuration",
          description: `Fee configuration updated for ${oldConfig[0]?.service_type}`,
          oldValue: oldConfig[0],
          newValue: { ...oldConfig[0], ...updates },
        })
      }

      return true
    } catch (error) {
      console.error(`Error updating fee configuration ${id}:`, error)
      return false
    }
  }

  /**
   * Seed default settings
   */
  static async seedDefaultSettings(): Promise<void> {
    const defaultSettings = [
      // Transaction limits
      {
        key: "daily_transaction_limit",
        value: "50000",
        category: "transaction_limits",
        description: "Daily transaction limit in GHS",
        data_type: "number" as const,
        is_public: false,
      },
      {
        key: "single_transaction_limit",
        value: "10000",
        category: "transaction_limits",
        description: "Single transaction limit in GHS",
        data_type: "number" as const,
        is_public: false,
      },
      // SMS Configuration
      {
        key: "sms_provider",
        value: "hubtel",
        category: "sms",
        description: "Default SMS provider (hubtel, smsonlinegh)",
        data_type: "string" as const,
        is_public: false,
      },
      {
        key: "sms_api_key",
        value: "",
        category: "sms",
        description: "SMS API key for notifications",
        data_type: "string" as const,
        is_public: false,
      },
      {
        key: "sms_api_secret",
        value: "",
        category: "sms",
        description: "SMS API secret for notifications",
        data_type: "string" as const,
        is_public: false,
      },
      {
        key: "sms_sender_id",
        value: "MIMHAAD",
        category: "sms",
        description: "SMS sender ID for notifications",
        data_type: "string" as const,
        is_public: false,
      },
      // System configuration
      {
        key: "system_maintenance_mode",
        value: "false",
        category: "system",
        description: "Enable/disable system maintenance mode",
        data_type: "boolean" as const,
        is_public: true,
      },
      {
        key: "session_timeout_minutes",
        value: "30",
        category: "security",
        description: "User session timeout in minutes",
        data_type: "number" as const,
        is_public: false,
      },
      // Business settings
      {
        key: "business_hours_start",
        value: "08:00",
        category: "business",
        description: "Business hours start time",
        data_type: "string" as const,
        is_public: true,
      },
      {
        key: "business_hours_end",
        value: "17:00",
        category: "business",
        description: "Business hours end time",
        data_type: "string" as const,
        is_public: true,
      },
    ]

    const defaultFees = [
      {
        service_type: "momo_deposit",
        fee_type: "percentage" as const,
        fee_value: 1.5,
        minimum_fee: 1.0,
        maximum_fee: 50.0,
        currency: "GHS",
        is_active: true,
      },
      {
        service_type: "momo_withdrawal",
        fee_type: "percentage" as const,
        fee_value: 2.0,
        minimum_fee: 2.0,
        maximum_fee: 100.0,
        currency: "GHS",
        is_active: true,
      },
      {
        service_type: "agency_banking_deposit",
        fee_type: "fixed" as const,
        fee_value: 5.0,
        currency: "GHS",
        is_active: true,
      },
      {
        service_type: "agency_banking_withdrawal",
        fee_type: "fixed" as const,
        fee_value: 10.0,
        currency: "GHS",
        is_active: true,
      },
      {
        service_type: "e_zwich_card_issuance",
        fee_type: "fixed" as const,
        fee_value: 15.0,
        currency: "GHS",
        is_active: true,
      },
      {
        service_type: "e_zwich_withdrawal",
        fee_type: "percentage" as const,
        fee_value: 1.5,
        minimum_fee: 1.5,
        maximum_fee: 50.0,
        currency: "GHS",
        is_active: true,
      },
    ]

    try {
      // Insert default settings
      for (const setting of defaultSettings) {
        await sql`
          INSERT INTO system_settings (key, value, category, description, data_type, is_public)
          VALUES (${setting.key}, ${setting.value}, ${setting.category}, 
                  ${setting.description}, ${setting.data_type}, ${setting.is_public})
          ON CONFLICT (key) DO NOTHING
        `
      }

      // Insert default fee configurations
      for (const fee of defaultFees) {
        await sql`
          INSERT INTO fee_configurations (service_type, fee_type, fee_value, minimum_fee, maximum_fee, currency, is_active)
          VALUES (${fee.service_type}, ${fee.fee_type}, ${fee.fee_value}, 
                  ${fee.minimum_fee || null}, ${fee.maximum_fee || null}, ${fee.currency}, ${fee.is_active})
          ON CONFLICT DO NOTHING
        `
      }

      console.log("Default settings and fees seeded successfully")
    } catch (error) {
      console.error("Error seeding default settings:", error)
    }
  }
}
