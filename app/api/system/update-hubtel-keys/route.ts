import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST() {
  try {
    console.log(
      "🔄 Updating Hubtel configuration keys to use ClientID/ClientSecret..."
    );

    // Get current Hubtel configuration
    const currentConfig = await sql`
      SELECT config_key, config_value 
      FROM system_config 
      WHERE config_key IN ('hubtel_sms_api_key', 'hubtel_sms_api_secret')
    `;

    console.log("📋 Current Hubtel config:", currentConfig);

    if (currentConfig.length > 0) {
      // Update existing keys to new naming convention
      for (const config of currentConfig) {
        if (config.config_key === "hubtel_sms_api_key") {
          await sql`
            UPDATE system_config 
            SET config_key = 'hubtel_sms_client_id', 
                description = 'Hubtel Client ID for SMS authentication'
            WHERE config_key = 'hubtel_sms_api_key'
          `;
          console.log("✅ Updated hubtel_sms_api_key → hubtel_sms_client_id");
        } else if (config.config_key === "hubtel_sms_api_secret") {
          await sql`
            UPDATE system_config 
            SET config_key = 'hubtel_sms_client_secret', 
                description = 'Hubtel Client Secret for SMS authentication'
            WHERE config_key = 'hubtel_sms_api_secret'
          `;
          console.log(
            "✅ Updated hubtel_sms_api_secret → hubtel_sms_client_secret"
          );
        }
      }
    } else {
      // If no existing keys, create new ones with default values
      await sql`
        INSERT INTO system_config (config_key, config_value, config_type, description, category)
        VALUES 
          ('hubtel_sms_client_id', 'your_client_id_here', 'string', 'Hubtel Client ID for SMS authentication', 'system'),
          ('hubtel_sms_client_secret', 'your_client_secret_here', 'string', 'Hubtel Client Secret for SMS authentication', 'system')
        ON CONFLICT (config_key) DO NOTHING
      `;
      console.log("✅ Created new Hubtel ClientID/ClientSecret configuration");
    }

    // Verify the update
    const updatedConfig = await sql`
      SELECT config_key, config_value 
      FROM system_config 
      WHERE config_key IN ('hubtel_sms_client_id', 'hubtel_sms_client_secret')
    `;

    console.log("📋 Updated Hubtel config:", updatedConfig);

    return NextResponse.json({
      success: true,
      message: "Hubtel configuration keys updated successfully",
      updatedConfig,
    });
  } catch (error) {
    console.error("❌ Error updating Hubtel configuration:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Hubtel configuration" },
      { status: 500 }
    );
  }
}
