/**
 * Two-Factor Authentication Service
 * Mimhaad Financial Services ERP
 *
 * Features:
 * - SMS-based OTP (via Hubtel/SMSOnlineGH)
 * - Backup codes generation
 * - Trusted device management
 * - Force 2FA for Admin users
 */

import { sql } from "@/lib/db";
import { NotificationService } from "./notification-service";
import crypto from "crypto";

export interface TwoFactorSettings {
  userId: string;
  enabled: boolean;
  method: "sms" | "email";
  phoneNumber?: string;
  email?: string;
  backupCodes?: string[];
  trustedDevices?: string[];
}

export class TwoFactorAuthService {
  /**
   * Generate a 6-digit OTP code
   */
  private static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate backup codes (8 codes, 8 characters each)
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Hash backup code for storage
   */
  private static hashBackupCode(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  /**
   * Generate device ID from request headers
   */
  static generateDeviceId(userAgent: string, ipAddress: string): string {
    const deviceString = `${userAgent}|${ipAddress}`;
    return crypto.createHash("md5").update(deviceString).digest("hex");
  }

  /**
   * Initialize 2FA tables
   */
  static async initializeTables() {
    await sql`
      CREATE TABLE IF NOT EXISTS user_2fa_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) UNIQUE NOT NULL,
        enabled BOOLEAN DEFAULT false,
        method VARCHAR(20) DEFAULT 'sms',
        phone_number VARCHAR(20),
        email VARCHAR(255),
        secret VARCHAR(255),
        backup_codes_hash TEXT[],
        force_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_2fa_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        method VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT false,
        verified_at TIMESTAMP,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_trusted_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(255),
        ip_address VARCHAR(50),
        user_agent TEXT,
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, device_id)
      )
    `;

    // Create index for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_2fa_tokens_user 
      ON user_2fa_tokens(user_id, expires_at)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user 
      ON user_trusted_devices(user_id, device_id)
    `;
  }

  /**
   * Enable 2FA for a user
   */
  static async enable2FA(
    userId: string,
    method: "sms" | "email",
    phoneNumber?: string,
    email?: string
  ): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
    try {
      await this.initializeTables();

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = backupCodes.map((code) =>
        this.hashBackupCode(code)
      );

      // Check if settings exist
      const existing = await sql`
        SELECT id FROM user_2fa_settings WHERE user_id = ${userId}
      `;

      if (existing.length > 0) {
        // Update existing
        await sql`
          UPDATE user_2fa_settings
          SET 
            enabled = true,
            method = ${method},
            phone_number = ${phoneNumber || null},
            email = ${email || null},
            backup_codes_hash = ${hashedBackupCodes},
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId}
        `;
      } else {
        // Create new
        await sql`
          INSERT INTO user_2fa_settings (
            user_id, enabled, method, phone_number, email, backup_codes_hash
          ) VALUES (
            ${userId}, true, ${method}, ${phoneNumber || null}, ${
          email || null
        }, ${hashedBackupCodes}
          )
        `;
      }

      console.log(`[2FA] Enabled for user ${userId} via ${method}`);

      return { success: true, backupCodes };
    } catch (error) {
      console.error("[2FA] Error enabling 2FA:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to enable 2FA",
      };
    }
  }

  /**
   * Disable 2FA for a user
   */
  static async disable2FA(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await sql`
        UPDATE user_2fa_settings
        SET enabled = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId}
      `;

      // Clear all tokens
      await sql`
        DELETE FROM user_2fa_tokens WHERE user_id = ${userId}
      `;

      console.log(`[2FA] Disabled for user ${userId}`);

      return { success: true };
    } catch (error) {
      console.error("[2FA] Error disabling 2FA:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disable 2FA",
      };
    }
  }

  /**
   * Get 2FA settings for a user
   */
  static async get2FASettings(
    userId: string
  ): Promise<TwoFactorSettings | null> {
    try {
      await this.initializeTables();

      const result = await sql`
        SELECT * FROM user_2fa_settings WHERE user_id = ${userId}
      `;

      if (result.length === 0) {
        return null;
      }

      const settings = result[0];
      return {
        userId: settings.user_id,
        enabled: settings.enabled,
        method: settings.method,
        phoneNumber: settings.phone_number,
        email: settings.email,
        backupCodes: settings.backup_codes_hash || [],
        trustedDevices: [],
      };
    } catch (error) {
      console.error("[2FA] Error getting settings:", error);
      return null;
    }
  }

  /**
   * Send OTP code to user
   */
  static async sendOTP(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; expiresAt?: Date; error?: string }> {
    try {
      const settings = await this.get2FASettings(userId);
      if (!settings || !settings.enabled) {
        return { success: false, error: "2FA not enabled for this user" };
      }

      // Generate OTP
      const otp = this.generateOTP();
      const tokenHash = crypto.createHash("sha256").update(otp).digest("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store token
      await sql`
        INSERT INTO user_2fa_tokens (
          user_id, token_hash, method, expires_at, ip_address, user_agent
        ) VALUES (
          ${userId}, ${tokenHash}, ${settings.method}, ${expiresAt}, ${ipAddress}, ${userAgent}
        )
      `;

      // Send OTP based on method
      if (settings.method === "sms" && settings.phoneNumber) {
        let phoneNumber = settings.phoneNumber;

        // Normalize phone number to international format
        if (phoneNumber.startsWith("0")) {
          // Ghanaian number starting with 0 - convert to +233
          phoneNumber = "+233" + phoneNumber.substring(1);
          console.log(
            `📱 [2FA] Normalized phone: ${settings.phoneNumber} → ${phoneNumber}`
          );
        } else if (!phoneNumber.startsWith("+")) {
          // Add + if missing
          phoneNumber = "+" + phoneNumber;
          console.log(
            `📱 [2FA] Added + to phone: ${settings.phoneNumber} → ${phoneNumber}`
          );
        }

        const message = `Your Mimhaad Finance login code is: ${otp}. Valid for 10 minutes. Do not share this code.`;

        // Send via notification service
        try {
          const notifSettings =
            await NotificationService.getUserNotificationSettings(userId);
          if (notifSettings.sms_provider === "hubtel") {
            // Use Hubtel SMSC API (GET with query parameters)
            // Remove + from phone number for Hubtel
            const hubtelPhone = phoneNumber.replace(/^\+/, "");

            // Encode message for URL
            const encodedMessage = encodeURIComponent(message);

            // Build Hubtel URL with query parameters
            const hubtelUrl = `https://smsc.hubtel.com/v1/messages/send?clientsecret=${
              notifSettings.sms_api_secret
            }&clientid=${notifSettings.sms_api_key}&from=${
              notifSettings.sms_sender_id || "MIMHAADFS"
            }&to=${hubtelPhone}&content=${encodedMessage}`;

            console.log("📤 [2FA] Sending to Hubtel:", {
              endpoint: "https://smsc.hubtel.com/v1/messages/send",
              from: notifSettings.sms_sender_id || "MIMHAADFS",
              to: hubtelPhone,
              messageLength: message.length,
              hasClientId: !!notifSettings.sms_api_key,
              hasClientSecret: !!notifSettings.sms_api_secret,
            });

            const response = await fetch(hubtelUrl, {
              method: "GET", // Hubtel SMSC uses GET, not POST
            });

            const responseText = await response.text();
            const responseData = JSON.parse(responseText);

            console.log("📥 [2FA] Hubtel response:", {
              status: response.status,
              statusText: response.statusText,
              body: responseText,
              parsed: responseData,
            });

            // Hubtel returns status 0 for success
            if (responseData.status !== 0) {
              console.error(
                "[2FA] Hubtel error:",
                responseData.statusDescription
              );
              throw new Error(
                `Hubtel SMS failed: ${
                  responseData.statusDescription || "Unknown error"
                }`
              );
            }
          } else {
            // Use SMSOnlineGH or other provider
            console.warn("⚠️ [2FA] SMS provider not fully configured");
          }

          console.log(`[2FA] OTP sent via SMS to ${phoneNumber}`);
        } catch (smsError) {
          console.error("[2FA] Failed to send SMS:", smsError);
          return { success: false, error: "Failed to send OTP via SMS" };
        }
      } else if (settings.method === "email" && settings.email) {
        // Send via email
        const { EmailService } = await import("@/lib/email-service");
        await EmailService.sendEmail({
          to: settings.email,
          subject: "Login Verification Code - Mimhaad Finance",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Login Verification</h2>
              <p>Your verification code is:</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p style="color: #ef4444; font-weight: bold;">Do not share this code with anyone.</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                If you did not attempt to log in, please contact your administrator immediately.
              </p>
            </div>
          `,
        });

        console.log(`[2FA] OTP sent via email to ${settings.email}`);
      }

      return { success: true, expiresAt };
    } catch (error) {
      console.error("[2FA] Error sending OTP:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send OTP",
      };
    }
  }

  /**
   * Verify OTP code
   */
  static async verifyOTP(
    userId: string,
    otp: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenHash = crypto.createHash("sha256").update(otp).digest("hex");

      // Find valid token
      const result = await sql`
        SELECT * FROM user_2fa_tokens
        WHERE user_id = ${userId}
          AND token_hash = ${tokenHash}
          AND expires_at > CURRENT_TIMESTAMP
          AND verified = false
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return { success: false, error: "Invalid or expired OTP code" };
      }

      // Mark as verified
      await sql`
        UPDATE user_2fa_tokens
        SET verified = true, verified_at = CURRENT_TIMESTAMP
        WHERE id = ${result[0].id}
      `;

      // Clean up old tokens
      await sql`
        DELETE FROM user_2fa_tokens
        WHERE user_id = ${userId}
          AND (expires_at < CURRENT_TIMESTAMP OR verified = true)
          AND id != ${result[0].id}
      `;

      console.log(`[2FA] OTP verified for user ${userId}`);

      return { success: true };
    } catch (error) {
      console.error("[2FA] Error verifying OTP:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify OTP",
      };
    }
  }

  /**
   * Verify backup code
   */
  static async verifyBackupCode(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = await this.get2FASettings(userId);
      if (!settings || !settings.backupCodes) {
        return { success: false, error: "No backup codes found" };
      }

      const codeHash = this.hashBackupCode(code);

      // Check if code exists in backup codes
      const hashedCodes = settings.backupCodes as string[];
      if (!hashedCodes.includes(codeHash)) {
        return { success: false, error: "Invalid backup code" };
      }

      // Remove used backup code
      const updatedCodes = hashedCodes.filter((c) => c !== codeHash);
      await sql`
        UPDATE user_2fa_settings
        SET backup_codes_hash = ${updatedCodes}
        WHERE user_id = ${userId}
      `;

      console.log(
        `[2FA] Backup code verified for user ${userId}. ${updatedCodes.length} codes remaining.`
      );

      return { success: true };
    } catch (error) {
      console.error("[2FA] Error verifying backup code:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify backup code",
      };
    }
  }

  /**
   * Add trusted device
   */
  static async addTrustedDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await sql`
        INSERT INTO user_trusted_devices (
          user_id, device_id, device_name, ip_address, user_agent
        ) VALUES (
          ${userId}, ${deviceId}, ${deviceName}, ${ipAddress}, ${userAgent}
        )
        ON CONFLICT (user_id, device_id) 
        DO UPDATE SET 
          last_used_at = CURRENT_TIMESTAMP,
          ip_address = ${ipAddress}
      `;

      console.log(`[2FA] Trusted device added for user ${userId}`);

      return { success: true };
    } catch (error) {
      console.error("[2FA] Error adding trusted device:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to add trusted device",
      };
    }
  }

  /**
   * Check if device is trusted
   */
  static async isDeviceTrusted(
    userId: string,
    deviceId: string
  ): Promise<boolean> {
    try {
      const result = await sql`
        SELECT id FROM user_trusted_devices
        WHERE user_id = ${userId} AND device_id = ${deviceId}
        LIMIT 1
      `;

      return result.length > 0;
    } catch (error) {
      console.error("[2FA] Error checking trusted device:", error);
      return false;
    }
  }

  /**
   * Get trusted devices for a user
   */
  static async getTrustedDevices(userId: string): Promise<any[]> {
    try {
      const devices = await sql`
        SELECT 
          id, 
          device_id, 
          device_name, 
          ip_address, 
          last_used_at, 
          created_at
        FROM user_trusted_devices
        WHERE user_id = ${userId}
        ORDER BY last_used_at DESC
      `;

      return devices;
    } catch (error) {
      console.error("[2FA] Error getting trusted devices:", error);
      return [];
    }
  }

  /**
   * Remove trusted device
   */
  static async removeTrustedDevice(
    userId: string,
    deviceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await sql`
        DELETE FROM user_trusted_devices
        WHERE user_id = ${userId} AND device_id = ${deviceId}
      `;

      console.log(`[2FA] Trusted device removed for user ${userId}`);

      return { success: true };
    } catch (error) {
      console.error("[2FA] Error removing trusted device:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove trusted device",
      };
    }
  }

  /**
   * Check if 2FA is required for login
   */
  static async is2FARequired(
    userId: string,
    deviceId: string
  ): Promise<boolean> {
    try {
      const settings = await this.get2FASettings(userId);

      // Not required if not enabled
      if (!settings || !settings.enabled) {
        console.log(`[2FA] Not required - 2FA not enabled for user ${userId}`);
        return false;
      }

      console.log(`[2FA] 2FA is enabled for user ${userId}, checking device trust...`);
      console.log(`[2FA] Device ID: ${deviceId}`);

      // Check if device is trusted
      const isTrusted = await this.isDeviceTrusted(userId, deviceId);
      if (isTrusted) {
        console.log(`[2FA] Device is TRUSTED - bypassing 2FA`);
        // Update last used
        await sql`
          UPDATE user_trusted_devices
          SET last_used_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId} AND device_id = ${deviceId}
        `;
        return false;
      }

      console.log(`[2FA] Device is NOT TRUSTED - 2FA required`);
      return true;
    } catch (error) {
      console.error("[2FA] Error checking if 2FA required:", error);
      return false;
    }
  }

  /**
   * Clean up expired tokens (run periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await sql`
        DELETE FROM user_2fa_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
        RETURNING id
      `;

      console.log(`[2FA] Cleaned up ${result.length} expired tokens`);

      return result.length;
    } catch (error) {
      console.error("[2FA] Error cleaning up tokens:", error);
      return 0;
    }
  }
}
