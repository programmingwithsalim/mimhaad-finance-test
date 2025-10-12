import { sql } from "@/lib/db";
import { EmailTemplates } from "@/lib/email-templates";
import {
  formatGhanaPhoneNumber,
  formatPhoneForSMS,
} from "@/lib/utils/phone-utils";

export interface NotificationConfig {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  login_alerts: boolean;
  transaction_alerts: boolean;
  low_balance_alerts: boolean;
  high_value_transaction_threshold: number;
  low_balance_threshold: number;
  email_address?: string;
  phone_number?: string;
  sms_provider?: string; // Added for SMSOnlineGH
  sms_api_key?: string; // Added for SMSOnlineGH
  sms_api_secret?: string; // Added for Hubtel
  sms_sender_id?: string; // Added for Hubtel
}

export interface NotificationData {
  type:
    | "login"
    | "transaction"
    | "low_balance"
    | "high_value_transaction"
    | "system_alert";
  title: string;
  message: string;
  userId: string;
  branchId?: string;
  metadata?: Record<string, any>;
  priority: "low" | "medium" | "high" | "critical";
}

export class NotificationService {
  static async sendNotification(data: NotificationData) {
    try {
      console.log("🔔 Sending notification:", {
        type: data.type,
        title: data.title,
        userId: data.userId,
        priority: data.priority,
      });

      // Get user notification preferences
      const userPrefs = await this.getUserNotificationSettings(data.userId);
      if (!userPrefs) {
        console.log(
          "❌ No notification preferences found for user:",
          data.userId
        );
        return { success: false, error: "No notification preferences found" };
      }

      // Check if we should send this type of notification
      if (!this.shouldSendNotification(data.type, userPrefs)) {
        console.log("❌ Notification type disabled:", data.type);
        return { success: false, error: "Notification type disabled" };
      }

      // Format phone number with Ghana country code
      if (userPrefs.phone_number) {
        userPrefs.phone_number = formatGhanaPhoneNumber(userPrefs.phone_number);
      }

      console.log("✅ Notification preferences loaded:", {
        email: userPrefs.email_enabled,
        sms: userPrefs.sms_enabled,
        push: userPrefs.push_enabled,
        phone: userPrefs.phone_number ? "configured" : "not configured",
      });

      // Send via enabled channels
      const results = [];

      if (userPrefs.email_enabled && userPrefs.email_address) {
        const emailResult = await this.sendEmailNotification(data, userPrefs);
        results.push({ channel: "email", ...emailResult });
      }

      if (userPrefs.sms_enabled && userPrefs.phone_number) {
        const smsResult = await this.sendSMSNotification(data, userPrefs);
        results.push({ channel: "sms", ...smsResult });
      }

      if (userPrefs.push_enabled) {
        const pushResult = await this.sendPushNotification(data, userPrefs);
        results.push({ channel: "push", ...pushResult });
      }

      // ✅ CRITICAL: Save notification to database for in-app display
      try {
        await sql`
          INSERT INTO notifications (
            user_id,
            branch_id,
            type,
            title,
            message,
            metadata,
            priority,
            status
          ) VALUES (
            ${data.userId},
            ${data.branchId || null},
            ${data.type},
            ${data.title},
            ${data.message},
            ${JSON.stringify(data.metadata || {})},
            ${data.priority},
            'unread'
          )
        `;
        console.log("✅ Notification saved to database");
      } catch (dbError) {
        console.error("❌ Failed to save notification to database:", dbError);
        // Don't fail the entire notification if DB save fails
      }

      console.log("✅ Notification sent successfully");
      return { success: true, results };
    } catch (error) {
      console.error("❌ Error sending notification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async sendLoginAlert(
    userId: string,
    loginData: {
      ipAddress: string;
      userAgent: string;
      location?: string;
      branchId?: string;
    }
  ) {
    const user = await sql`
      SELECT first_name || ' ' || last_name as full_name, email, phone FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) return { success: false, error: "User not found" };

    const userData = user[0];
    const timestamp = new Date().toLocaleString();

    return this.sendNotification({
      type: "login",
      title: "New Login Alert",
      message: `Hello ${userData.full_name}, a new login was detected on your account at ${timestamp}. IP: ${loginData.ipAddress}. If this wasn't you, please contact support immediately.`,
      userId,
      branchId: loginData.branchId,
      metadata: {
        ip_address: loginData.ipAddress,
        user_agent: loginData.userAgent,
        location: loginData.location,
        timestamp,
      },
      priority: "medium",
    });
  }

  static async sendTransactionAlert(
    userId: string,
    transactionData: {
      type: string;
      amount: number;
      service: string;
      reference: string;
      branchId?: string;
    }
  ) {
    const user = await sql`
      SELECT first_name || ' ' || last_name as full_name, email, phone FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) return { success: false, error: "User not found" };

    const userData = user[0];
    const timestamp = new Date().toLocaleString();

    return this.sendNotification({
      type: "transaction",
      title: "Transaction Alert",
      message: `Transaction processed: ${transactionData.service} ${
        transactionData.type
      } of GHS ${transactionData.amount.toFixed(2)}. Reference: ${
        transactionData.reference
      }`,
      userId,
      branchId: transactionData.branchId,
      metadata: {
        ...transactionData,
        timestamp,
      },
      priority: transactionData.amount > 1000 ? "high" : "medium",
    });
  }

  static async sendLowBalanceAlert(
    userId: string,
    floatData: {
      accountName: string;
      currentBalance: number;
      threshold: number;
      branchId?: string;
    }
  ) {
    const user = await sql`
      SELECT first_name || ' ' || last_name as full_name, email, phone FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) return { success: false, error: "User not found" };

    const userData = user[0];
    const timestamp = new Date().toLocaleString();

    return this.sendNotification({
      type: "low_balance",
      title: "Low Balance Alert",
      message: `Low balance alert for ${
        floatData.accountName
      }. Current balance: GHS ${floatData.currentBalance.toFixed(
        2
      )}. Threshold: GHS ${floatData.threshold.toFixed(
        2
      )}. Please recharge soon.`,
      userId,
      branchId: floatData.branchId,
      metadata: {
        ...floatData,
        timestamp,
      },
      priority: "high",
    });
  }

  private static async getUserNotificationSettings(
    userId: string
  ): Promise<NotificationConfig | null> {
    try {
      // First, get the user's basic info including phone number
      const userInfo = await sql`
        SELECT first_name, last_name, email, phone
        FROM users 
        WHERE id = ${userId}
      `;

      if (userInfo.length === 0) {
        console.error("User not found:", userId);
        return null;
      }

      const user = userInfo[0];
      console.log("🔍 [NOTIFICATION] User info:", {
        userId,
        userPhone: user.phone,
        userEmail: user.email,
      });

      // Get user's notification settings
      const settings = await sql`
        SELECT 
          email_notifications,
          sms_notifications,
          push_notifications,
          login_alerts,
          transaction_alerts,
          float_threshold_alerts,
          phone_number,
          email_address,
          sms_provider,
          sms_api_key,
          sms_api_secret,
          sms_sender_id
        FROM user_notification_settings
        WHERE user_id = ${userId}
      `;

      if (settings.length === 0) {
        // Create default settings for the user
        await sql`
          INSERT INTO user_notification_settings (
            user_id,
            email_notifications,
            sms_notifications,
            push_notifications,
            login_alerts,
            transaction_alerts,
            float_threshold_alerts,
            phone_number,
            email_address
          ) VALUES (
            ${userId},
            true,
            true,
            false,
            true,
            true,
            true,
            ${user.phone || null},
            ${user.email || null}
          )
        `;

        console.log(
          "✅ Created default notification settings for user:",
          userId
        );

        // Return default settings with user's phone and email
        return {
          email_enabled: true,
          sms_enabled: true,
          push_enabled: false,
          login_alerts: true,
          transaction_alerts: true,
          low_balance_alerts: true,
          high_value_transaction_threshold: 1000,
          low_balance_threshold: 100,
          email_address: user.email,
          phone_number: user.phone, // Use user's phone from users table
        };
      }

      const setting = settings[0];

      // Use notification settings phone if available, otherwise fall back to user's phone
      const phoneNumber = setting.phone_number || user.phone;
      const emailAddress = setting.email_address || user.email;

      // ✅ CRITICAL: Fetch system SMS config if user doesn't have it
      let systemSMSConfig: any = {};
      if (!setting.sms_provider || !setting.sms_api_key) {
        try {
          const smsConfig = await sql`
            SELECT config_key, config_value
            FROM system_config
            WHERE config_key IN (
              'sms_provider', 'sms_api_key', 'sms_api_secret', 'sms_sender_id',
              'hubtel_sms_client_id', 'hubtel_sms_client_secret', 'hubtel_sms_sender_id'
            )
          `;
          systemSMSConfig = smsConfig.reduce((acc: any, row: any) => {
            acc[row.config_key] = row.config_value;
            return acc;
          }, {});
          console.log("✅ Loaded system SMS config as fallback");
        } catch (error) {
          console.error("Failed to load system SMS config:", error);
        }
      }

      console.log("🔍 [NOTIFICATION] Final settings:", {
        userId,
        notificationPhone: setting.phone_number,
        userPhone: user.phone,
        finalPhone: phoneNumber,
        notificationEmail: setting.email_address,
        userEmail: user.email,
        finalEmail: emailAddress,
      });

      const smsProvider =
        setting.sms_provider || systemSMSConfig.sms_provider || "hubtel";

      return {
        email_enabled: setting.email_notifications,
        sms_enabled: setting.sms_notifications,
        push_enabled: setting.push_notifications,
        login_alerts: setting.login_alerts,
        transaction_alerts: setting.transaction_alerts,
        low_balance_alerts: setting.float_threshold_alerts,
        high_value_transaction_threshold: 1000,
        low_balance_threshold: 100,
        email_address: emailAddress,
        phone_number: phoneNumber, // Use notification settings or fall back to user's phone
        sms_provider: smsProvider,
        sms_api_key:
          setting.sms_api_key ||
          systemSMSConfig.hubtel_sms_client_id ||
          systemSMSConfig.sms_api_key,
        sms_api_secret:
          setting.sms_api_secret ||
          systemSMSConfig.hubtel_sms_client_secret ||
          systemSMSConfig.sms_api_secret,
        sms_sender_id:
          setting.sms_sender_id ||
          systemSMSConfig.hubtel_sms_sender_id ||
          systemSMSConfig.sms_sender_id,
      };
    } catch (error) {
      console.error("Error getting user notification settings:", error);

      // Return default settings if there's an error
      return {
        email_enabled: true,
        sms_enabled: true,
        push_enabled: false,
        login_alerts: true,
        transaction_alerts: true,
        low_balance_alerts: true,
        high_value_transaction_threshold: 1000,
        low_balance_threshold: 100,
      };
    }
  }

  private static shouldSendNotification(
    type: string,
    prefs: NotificationConfig
  ): boolean {
    switch (type) {
      case "login":
        return prefs.login_alerts;
      case "transaction":
        return prefs.transaction_alerts;
      case "low_balance":
        return prefs.low_balance_alerts;
      default:
        return true;
    }
  }

  private static async sendEmailNotification(
    data: NotificationData,
    prefs: NotificationConfig
  ) {
    try {
      if (!prefs.email_address) {
        return { success: false, error: "No email address configured" };
      }

      // Get email template based on notification type
      let htmlContent;

      switch (data.type) {
        case "transaction":
          htmlContent = EmailTemplates.transactionAlert(
            prefs.email_address?.split("@")[0] || "User",
            {
              id: data.metadata?.transactionId || "N/A",
              amount: data.metadata?.amount || 0,
              type: data.metadata?.service || "transaction",
              date: new Date().toISOString(),
            }
          );
          break;
        case "login":
          htmlContent = EmailTemplates.loginAlert(
            prefs.email_address?.split("@")[0] || "User",
            {
              timestamp: new Date().toISOString(),
              ipAddress: data.metadata?.ipAddress || "Unknown",
              location: data.metadata?.location || "Unknown",
              userAgent: data.metadata?.userAgent || "Unknown",
            }
          );
          break;
        case "low_balance":
          htmlContent = EmailTemplates.lowBalanceAlert(
            prefs.email_address?.split("@")[0] || "User",
            data.metadata?.accountType || "Float",
            data.metadata?.currentBalance || 0,
            data.metadata?.threshold || 0
          );
          break;
        default:
          // Fallback to a simple template
          htmlContent = EmailTemplates.welcome(
            prefs.email_address?.split("@")[0] || "User"
          );
      }

      // Send email using your email service
      console.log("📧 Sending email to:", prefs.email_address);

      // Simulate email sending
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log(
        `\n===== EMAIL NOTIFICATION =====\nTo: ${
          prefs.email_address
        }\nSubject: ${data.title}\nMessage: ${data.message}\nPriority: ${
          data.priority
        }\nType: ${
          data.type
        }\nTimestamp: ${new Date().toISOString()}\n============================\n`
      );

      return {
        success: true,
        message: "Email notification sent successfully (simulated)",
      };
    } catch (error) {
      console.error("Email notification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Email send failed",
      };
    }
  }

  private static async sendSMSNotification(
    data: NotificationData,
    prefs: NotificationConfig
  ) {
    try {
      if (!prefs.phone_number) {
        return { success: false, error: "No phone number configured" };
      }

      // Format phone number for SMS providers
      const formattedPhone = formatPhoneForSMS(prefs.phone_number);

      // Determine provider
      const provider = prefs.sms_provider || "hubtel";
      const apiKey = prefs.sms_api_key;
      const apiSecret = prefs.sms_api_secret;
      const senderId = prefs.sms_sender_id;
      const message = data.message;

      console.log("🔍 [SMS] Configuration:", {
        provider,
        apiKey: apiKey ? "***" : "missing",
        apiSecret: apiSecret ? "***" : "missing",
        senderId,
        originalPhone: prefs.phone_number,
        formattedPhone,
        messageLength: message.length,
      });

      if (provider === "smsonlinegh") {
        // SMSOnlineGH API
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
              message,
              recipients: [formattedPhone],
            }),
          }
        );
        const result = await response.json();
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
        const url = new URL("https://smsc.hubtel.com/v1/messages/send");

        // Use ClientID and ClientSecret for authentication via URL parameters
        const clientId = apiKey; // apiKey is actually the ClientID
        const clientSecret = apiSecret; // apiSecret is actually the ClientSecret

        // Build URL with query parameters
        if (clientId && clientSecret && senderId && formattedPhone && message) {
          url.searchParams.set("clientid", clientId);
          url.searchParams.set("clientsecret", clientSecret);
          url.searchParams.set("from", senderId);
          url.searchParams.set("to", formattedPhone);
          url.searchParams.set("content", message);
        } else {
          return {
            success: false,
            error: "Missing required Hubtel configuration parameters",
          };
        }

        console.log("🔐 Hubtel URL Authentication:", {
          clientId: clientId ? "***" : "MISSING",
          clientSecret: clientSecret ? "***" : "MISSING",
          senderId,
          formattedPhone,
          messageLength: message.length,
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
        console.log("🔍 [HUBTEL] API Response:", result);

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
              `Hubtel send failed with status: ${result.status}`,
          };
        }
      }

      // Simulate SMS sending with a delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log(
        `\n===== SMS NOTIFICATION =====\nTo: ${formattedPhone}\nMessage: ${message}\nPriority: ${
          data.priority
        }\nType: ${
          data.type
        }\nTimestamp: ${new Date().toISOString()}\n============================\n`
      );
      return {
        success: true,
        message: "SMS notification sent successfully (simulated)",
      };
    } catch (error) {
      console.error("SMS notification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "SMS send failed",
      };
    }
  }

  private static async sendPushNotification(
    data: NotificationData,
    prefs: NotificationConfig
  ) {
    try {
      console.log("📱 Sending push notification");

      // Simulate push notification
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log(
        `\n===== PUSH NOTIFICATION =====\nTitle: ${data.title}\nMessage: ${
          data.message
        }\nPriority: ${data.priority}\nType: ${
          data.type
        }\nTimestamp: ${new Date().toISOString()}\n============================\n`
      );

      return {
        success: true,
        message: "Push notification sent successfully (simulated)",
      };
    } catch (error) {
      console.error("Push notification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Push send failed",
      };
    }
  }

  // Send only an SMS for testing purposes
  static async sendSMSNotificationOnly(
    userId: string,
    config: any,
    testPhone: string
  ) {
    try {
      // Compose a test message
      const message =
        "This is a test SMS notification to verify your SMS settings are working correctly.";
      const provider = config.smsProvider || config.sms_provider || "hubtel";
      const apiKey = config.smsApiKey || config.sms_api_key;
      const apiSecret = config.smsApiSecret || config.sms_api_secret;
      const senderId = config.smsSenderId || config.sms_sender_id;
      const phone = formatPhoneForSMS(testPhone);

      if (!apiKey || !senderId || !phone) {
        return { success: false, error: "Missing SMS config or phone number" };
      }

      if (provider === "smsonlinegh") {
        // SMSOnlineGH API
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
              message,
              recipients: [phone],
            }),
          }
        );
        const result = await response.json();
        if (result.status === "success" || result.status === true) {
          return { success: true, message: "SMS sent via SMSOnlineGH" };
        } else {
          return {
            success: false,
            error: result.message || "SMSOnlineGH send failed",
          };
        }
      } else if (provider === "hubtel") {
        // Hubtel API - use HTTP Basic Auth
        const url = "https://devp-sms03726-api.hubtel.com/v1/messages/send";
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            from: senderId,
            to: phone,
            content: message,
          }),
        });
        const result = await response.json();
        console.log("🔍 [HUBTEL TEST] API Response:", result);

        // Hubtel returns status: 0 for success, or other values for failure
        if (result.status === 0 || (result.data && result.data.status === 0)) {
          return { success: true, message: "SMS sent via Hubtel" };
        } else {
          return {
            success: false,
            error:
              result.statusDescription ||
              result.message ||
              `Hubtel send failed with status: ${result.status}`,
          };
        }
      }

      // Simulate SMS sending
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log(
        `\n===== TEST SMS NOTIFICATION =====\nTo: ${phone}\nMessage: ${message}\nTimestamp: ${new Date().toISOString()}\n============================\n`
      );
      return {
        success: true,
        message: "Test SMS notification sent successfully (simulated)",
      };
    } catch (error) {
      console.error("Test SMS notification error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Test SMS send failed",
      };
    }
  }

  static async getNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: string;
      status?: string;
    } = {}
  ) {
    try {
      const { limit = 50, offset = 0, type, status } = options;

      let query = `
        SELECT 
          id,
          user_id,
          type,
          title,
          message,
          status,
          metadata,
          created_at,
          read_at
        FROM notifications 
        WHERE user_id = $1
      `;

      const params: any[] = [userId];
      let paramIndex = 1;

      if (type) {
        paramIndex++;
        query += ` AND type = $${paramIndex}`;
        params.push(type);
      }

      if (status) {
        paramIndex++;
        query += ` AND status = $${paramIndex}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex + 1} OFFSET $${
        paramIndex + 2
      }`;
      params.push(limit, offset);

      const notifications = await sql.query(query, params);

      return {
        success: true,
        notifications,
        total: notifications.length,
      };
    } catch (error) {
      console.error("Error getting notifications:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get notifications",
      };
    }
  }

  static async markAsRead(notificationId: string, userId: string) {
    try {
      await sql`
        UPDATE notifications 
        SET read_at = NOW() 
        WHERE id = ${notificationId} AND user_id = ${userId}
      `;

      return { success: true };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to mark as read",
      };
    }
  }

  static async sendTestNotification(userId: string) {
    return this.sendNotification({
      type: "system_alert",
      title: "Test Notification",
      message:
        "This is a test notification to verify your notification settings are working correctly.",
      userId,
      priority: "medium",
    });
  }
}
