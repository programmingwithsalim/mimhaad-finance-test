import { sql } from "@/lib/db";
import {
  formatGhanaPhoneNumber,
  formatPhoneForSMS,
} from "@/lib/utils/phone-utils";
import { logger, LogCategory } from "@/lib/logger";

export interface CustomerNotificationData {
  type:
    | "transaction_success"
    | "transaction_failed"
    | "balance_update"
    | "service_alert"
    | "delivery";
  title: string;
  message: string;
  customerPhone: string;
  customerName?: string;
  transactionId?: string;
  amount?: number;
  service?: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export class CustomerNotificationService {
  /**
   * Send mandatory notification to customer (not dependent on user preferences)
   */
  static async sendCustomerNotification(data: CustomerNotificationData) {
    try {
      await logger.info(
        LogCategory.TRANSACTION,
        "Sending customer notification",
        {
          type: data.type,
          customerPhone: data.customerPhone,
          transactionId: data.transactionId,
          amount: data.amount,
        }
      );

      // Format phone number for Ghana
      const formattedPhone = formatGhanaPhoneNumber(data.customerPhone);
      const smsPhone = formatPhoneForSMS(data.customerPhone);

      console.log("📱 Customer notification details:", {
        originalPhone: data.customerPhone,
        formattedPhone,
        smsPhone,
        customerName: data.customerName,
        message: data.message,
      });

      // Get system SMS configuration
      const smsConfig = await this.getSystemSMSConfig();

      console.log("📧 SMS Configuration:", smsConfig);

      if (!smsConfig) {
        await logger.warn(
          LogCategory.TRANSACTION,
          "No SMS configuration found, skipping customer notification"
        );
        console.log("❌ No SMS configuration found in system_settings");
        return { success: false, error: "No SMS configuration found" };
      }

      // Send SMS notification
      const smsResult = await this.sendSMSNotification(
        data,
        smsPhone,
        smsConfig
      );

      console.log("📤 SMS Result:", smsResult);

      // Log the notification attempt
      await this.logCustomerNotification(data, smsResult.success);

      return smsResult;
    } catch (error) {
      await logger.error(
        LogCategory.TRANSACTION,
        "Customer notification failed",
        error as Error,
        {
          customerPhone: data.customerPhone,
          type: data.type,
        }
      );
      console.error("❌ Customer notification error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Customer notification failed",
      };
    }
  }

  /**
   * Send transaction success notification to customer
   */
  static async sendTransactionSuccessNotification(
    customerPhone: string,
    customerName: string,
    transactionData: {
      amount: number;
      service: string;
      reference: string;
      transactionId: string;
    }
  ) {
    const message = `Dear ${customerName}, your ${
      transactionData.service
    } transaction of GHS ${transactionData.amount.toFixed(
      2
    )} has been processed successfully. Reference: ${
      transactionData.reference
    }. Thank you for using our service.`;

    return this.sendCustomerNotification({
      type: "transaction_success",
      title: "Transaction Successful",
      message,
      customerPhone,
      customerName,
      transactionId: transactionData.transactionId,
      amount: transactionData.amount,
      service: transactionData.service,
      reference: transactionData.reference,
      metadata: transactionData,
    });
  }

  /**
   * Send transaction failed notification to customer
   */
  static async sendTransactionFailedNotification(
    customerPhone: string,
    customerName: string,
    transactionData: {
      amount: number;
      service: string;
      reference: string;
      transactionId: string;
      reason?: string;
    }
  ) {
    const reason = transactionData.reason || "technical issue";
    const message = `Dear ${customerName}, your ${
      transactionData.service
    } transaction of GHS ${transactionData.amount.toFixed(
      2
    )} could not be processed due to ${reason}. Reference: ${
      transactionData.reference
    }. Please try again or contact support.`;

    return this.sendCustomerNotification({
      type: "transaction_failed",
      title: "Transaction Failed",
      message,
      customerPhone,
      customerName,
      transactionId: transactionData.transactionId,
      amount: transactionData.amount,
      service: transactionData.service,
      reference: transactionData.reference,
      metadata: { ...transactionData, reason },
    });
  }

  /**
   * Get system SMS configuration
   */
  private static async getSystemSMSConfig() {
    try {
      console.log("🔍 Fetching SMS configuration from system_config...");

      // First, get the active SMS provider
      const providerConfig = await sql`
        SELECT config_value 
        FROM system_config 
        WHERE config_key = 'sms_provider'
      `;

      console.log("📋 Provider config from database:", providerConfig);

      if (providerConfig.length === 0) {
        console.log("❌ No SMS provider found in system_config table");
        return null;
      }

      const provider = providerConfig[0].config_value;
      console.log("📱 Active SMS provider:", provider);

      // Get provider-specific configuration + generic fallbacks
      let configKeys: string[] = [];

      if (provider === "hubtel") {
        configKeys = [
          "hubtel_sms_client_id", // Provider-specific
          "hubtel_sms_client_secret",
          "hubtel_sms_sender_id",
          "hubtel_sms_test_mode",
          "sms_api_key", // Generic fallbacks
          "sms_api_secret",
          "sms_sender_id",
          "sms_test_mode",
        ];
      } else if (provider === "smsonlinegh") {
        configKeys = [
          "smsonlinegh_sms_api_key",
          "smsonlinegh_sms_api_secret",
          "smsonlinegh_sms_sender_id",
          "smsonlinegh_sms_test_mode",
        ];
      } else {
        console.log("❌ Unsupported SMS provider:", provider);
        return null;
      }

      const config = await sql`
        SELECT config_key, config_value
        FROM system_config 
        WHERE config_key = ANY(${configKeys})
      `;

      console.log("📋 Raw SMS config from database:", config);

      if (config.length === 0) {
        console.log("❌ No SMS settings found in system_config table");
        return null;
      }

      // Convert to object
      const configObj = config.reduce((acc: any, setting: any) => {
        acc[setting.config_key] = setting.config_value;
        return acc;
      }, {});

      console.log("🔧 Processed SMS config object:", configObj);

      const result = {
        provider: provider,
        apiKey:
          provider === "hubtel"
            ? configObj.hubtel_sms_client_id || configObj.sms_api_key // Fallback to generic
            : configObj.smsonlinegh_sms_api_key,
        apiSecret:
          provider === "hubtel"
            ? configObj.hubtel_sms_client_secret || configObj.sms_api_secret // Fallback to generic
            : configObj.smsonlinegh_sms_api_secret,
        senderId:
          provider === "hubtel"
            ? configObj.hubtel_sms_sender_id || configObj.sms_sender_id // Fallback to generic
            : configObj.smsonlinegh_sms_sender_id,
        testMode:
          provider === "hubtel"
            ? configObj.hubtel_sms_test_mode === "true"
            : configObj.smsonlinegh_sms_test_mode === "true",
      };

      console.log("✅ Final SMS config:", result);
      return result;
    } catch (error) {
      console.error("❌ Error getting system SMS config:", error);
      return null;
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSMSNotification(
    data: CustomerNotificationData,
    phone: string,
    config: any
  ) {
    try {
      const { provider, apiKey, apiSecret, senderId, testMode } = config;

      console.log("📤 Sending SMS notification:", {
        provider,
        senderId,
        phone,
        testMode,
        messageLength: data.message.length,
      });

      if (!apiKey || !senderId || !phone) {
        console.log("❌ Missing SMS configuration:", {
          apiKey: !!apiKey,
          senderId: !!senderId,
          phone: !!phone,
        });
        return { success: false, error: "Missing SMS configuration" };
      }

      // If in test mode, log but don't actually send
      // if (testMode) {
      //   console.log("🧪 TEST MODE: SMS would be sent to:", phone);
      //   console.log("🧪 TEST MODE: Message:", data.message);
      //   return {
      //     success: true,
      //     message: "SMS logged in test mode",
      //     testMode: true,
      //   };
      // }

      if (provider === "smsonlinegh") {
        // SMSOnlineGH API
        console.log("📤 Sending via SMSOnlineGH...");
        const response = await fetch(
          "https://api.smsonlinegh.com/v4/message/sms/send",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              sender: senderId,
              message: data.message,
              recipients: [phone],
            }),
          }
        );
        const result = await response.json();
        console.log("📤 SMSOnlineGH response:", result);

        if (result.status === "success" || result.status === true) {
          return { success: true, message: "SMS sent via SMSOnlineGH" };
        } else {
          return {
            success: false,
            error: result.message || "SMSOnlineGH send failed",
          };
        }
      } else if (provider === "hubtel") {
        // Hubtel API - use URL Authentication with query parameters
        console.log("📤 Sending via Hubtel...");

        // Use ClientID and ClientSecret for authentication via URL parameters
        const clientId = apiKey; // apiKey is actually the ClientID
        const clientSecret = apiSecret; // apiSecret is actually the ClientSecret

        // Build URL with query parameters
        const url = new URL("https://smsc.hubtel.com/v1/messages/send");
        url.searchParams.set("clientid", clientId);
        url.searchParams.set("clientsecret", clientSecret);
        url.searchParams.set("from", senderId);
        url.searchParams.set("to", phone);
        url.searchParams.set("content", data.message);

        console.log("🔐 Hubtel URL Authentication:", {
          clientId: clientId ? "***" : "MISSING",
          clientSecret: clientSecret ? "***" : "MISSING",
          senderId,
          phone,
          messageLength: data.message.length,
          url: url
            .toString()
            .replace(
              /clientid=([^&]+)&clientsecret=([^&]+)/,
              "clientid=***&clientsecret=***"
            ),
        });

        const response = await fetch(url.toString(), {
          method: "GET", // Hubtel URL auth uses GET requests
          headers: {
            "Content-Type": "application/json",
          },
        });
        const result = await response.json();
        console.log("📤 Hubtel response:", result);

        // Hubtel returns status: 0 for success, or other values for failure
        if (result.status === 0 || (result.data && result.data.status === 0)) {
          return {
            success: true,
            message: "SMS sent via Hubtel",
            messageId: result.messageId || result.data?.messageId,
          };
        } else {
          return {
            success: false,
            error:
              result.statusDescription ||
              result.message ||
              result.error ||
              "Hubtel send failed",
          };
        }
      } else {
        return {
          success: false,
          error: `Unsupported SMS provider: ${provider}`,
        };
      }
    } catch (error) {
      console.error("❌ Error sending SMS notification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Log customer notification attempt
   */
  private static async logCustomerNotification(
    data: CustomerNotificationData,
    success: boolean
  ) {
    try {
      await sql`
        INSERT INTO system_logs (
          level,
          category,
          message,
          details,
          entity_id,
          entity_type,
          metadata
        ) VALUES (
          ${success ? "INFO" : "ERROR"},
          'CUSTOMER_NOTIFICATION',
          ${`Customer notification ${success ? "sent" : "failed"}: ${
            data.type
          }`},
          ${JSON.stringify(data)},
          ${data.transactionId || null},
          'customer_notification',
          ${JSON.stringify({
            customerPhone: data.customerPhone,
            customerName: data.customerName,
            type: data.type,
            success,
          })}
        )
      `;
    } catch (error) {
      console.error("Error logging customer notification:", error);
    }
  }
}
