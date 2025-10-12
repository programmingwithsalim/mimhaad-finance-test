/**
 * Email service using Resend
 */

type EmailTemplate =
  | "welcome"
  | "password_reset"
  | "transactionAlert"
  | "lowBalanceAlert"
  | "loginAlert"
  | "generic";

export class EmailService {
  /**
   * Send an email notification using Resend
   * @param to Recipient email address
   * @param template Email template to use
   * @param data Data to populate the template
   * @returns Promise that resolves when the email is sent
   */
  static async sendEmail(
    to: string,
    template: EmailTemplate,
    data: Record<string, any>
  ): Promise<boolean> {
    // Fetch API key and sender from system_config
    const { sql } = await import("@/lib/db");
    const configRows = await sql`
      SELECT config_key, config_value FROM system_config WHERE config_key IN ('resend_api_key', 'resend_sender_email', 'resend_from_name')
    `;
    const config: Record<string, string> = {};
    for (const row of configRows) {
      config[row.config_key] = row.config_value;
    }
    const apiKey = config["resend_api_key"];
    const fromEmail = config["resend_sender_email"];
    const fromName = config["resend_from_name"];
    if (!apiKey || !fromEmail) {
      console.error(
        "Resend API key or sender email not configured in system_config"
      );
      return false;
    }
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    // Choose template
    let subject = "Notification from Mimhaad Financial Platform";
    let html = "";

    try {
      const { EmailTemplates } = await import("@/lib/email-templates");

      if (template === "welcome" && data.userName) {
        const templateData = EmailTemplates.welcome(data.userName);
        subject = templateData.subject;
        html = templateData.html;
      } else if (
        template === "password_reset" &&
        data.userName &&
        data.resetLink
      ) {
        const templateData = EmailTemplates.passwordReset(
          data.userName,
          data.resetLink
        );
        subject = templateData.subject;
        html = templateData.html;
      } else if (
        template === "transactionAlert" &&
        data.userName &&
        data.transactionDetails
      ) {
        const templateData = EmailTemplates.transactionAlert(
          data.userName,
          data.transactionDetails
        );
        subject = templateData.subject;
        html = templateData.html;
      } else if (
        template === "lowBalanceAlert" &&
        data.userName &&
        data.accountType
      ) {
        const templateData = EmailTemplates.lowBalanceAlert(
          data.userName,
          data.accountType,
          data.currentBalance,
          data.threshold
        );
        subject = templateData.subject;
        html = templateData.html;
      } else if (template === "loginAlert" && data.userName && data.loginData) {
        // Create a login alert template
        const templateData = this.createLoginAlertTemplate(
          data.userName,
          data.loginData
        );
        subject = templateData.subject;
        html = templateData.html;
      } else {
        // Fallback to a generic notification template
        const templateData = this.createGenericNotificationTemplate(data);
        subject = templateData.subject;
        html = templateData.html;
      }
    } catch (e) {
      console.error("Error loading email template:", e);
      // Create a fallback template instead of sending JSON
      const templateData = this.createFallbackTemplate(data);
      subject = templateData.subject;
      html = templateData.html;
    }

    // Send email via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    });
    const result = await response.json();
    console.log("Resend API response:", result);
    if (!response.ok || result.error) {
      console.error("Failed to send email:", result.error || result);
      return false;
    }
    return true;
  }

  /**
   * Create a login alert template
   */
  private static createLoginAlertTemplate(userName: string, loginData: any) {
    return {
      subject: "Login Alert - Mimhaad Financial ",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Login Alert</h2>
          <p>Hello ${userName},</p>
          <p>A new login was detected on your account:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>IP Address:</strong> ${loginData.ipAddress}</p>
            <p><strong>Device:</strong> ${loginData.userAgent}</p>
            <p><strong>Location:</strong> ${loginData.location}</p>
            <p><strong>Time:</strong> ${new Date(
              loginData.timestamp
            ).toLocaleString()}</p>
          </div>
          <p>If this wasn't you, please contact our support team immediately.</p>
          <p>Best regards,<br>The Mimhaad Financial  Team</p>
        </div>
      `,
    };
  }

  /**
   * Create a generic notification template
   */
  private static createGenericNotificationTemplate(data: any) {
    return {
      subject: "Notification - Mimhaad Financial ",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Notification</h2>
          <p>Hello ${data.userName || "User"},</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Message:</strong> ${
              data.message || "You have a new notification."
            }</p>
            <p><strong>Type:</strong> ${data.type || "System"}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>Best regards,<br>The Mimhaad Financial  Team</p>
        </div>
      `,
    };
  }

  /**
   * Create a fallback template when template loading fails
   */
  private static createFallbackTemplate(data: any) {
    return {
      subject: "System Notification - Mimhaad Financial ",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">System Notification</h2>
          <p>Hello,</p>
          <p>You have received a notification from the Mimhaad Financial :</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Title:</strong> ${data.title || "Notification"}</p>
            <p><strong>Message:</strong> ${
              data.message || "You have a new notification."
            }</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p>Best regards,<br>The Mimhaad Financial  Team</p>
        </div>
      `,
    };
  }

  /**
   * Send password reset notification
   */
  static async sendPasswordResetNotification(
    to: string,
    userName: string,
    isTemporary: boolean,
    password?: string
  ): Promise<boolean> {
    return this.sendEmail(to, "password_reset", {
      userName,
      isTemporary,
      password,
      resetTime: new Date().toISOString(),
    });
  }
}
