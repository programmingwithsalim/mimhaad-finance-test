import { NextResponse } from "next/server"
import { NotificationService } from "@/lib/services/notification-service"
import { EmailTemplates } from "@/lib/email-templates"

export async function POST(request: Request) {
  try {
    const { type, recipient, data } = await request.json()

    if (!type || !recipient) {
      return NextResponse.json({ success: false, error: "Type and recipient are required" }, { status: 400 })
    }

    let emailContent
    let smsContent

    switch (type) {
      case "welcome":
        emailContent = EmailTemplates.welcome(data.userName)
        smsContent = `Welcome to Mimhaad Financial Services, ${data.userName}! Your account has been created successfully.`
        break

      case "password-reset":
        emailContent = EmailTemplates.passwordReset(data.userName, data.resetLink)
        smsContent = `Password reset requested for your Mimhaad Financial Services account. Check your email for the reset link.`
        break

      case "transaction-alert":
        emailContent = EmailTemplates.transactionAlert(data.userName, data.transactionDetails)
        smsContent = `Transaction Alert: GHS ${data.transactionDetails.amount} ${data.transactionDetails.type} processed on your account.`
        break

      case "low-balance":
        emailContent = EmailTemplates.lowBalanceAlert(
          data.userName,
          data.accountType,
          data.currentBalance,
          data.threshold,
        )
        smsContent = `Low Balance Alert: Your ${data.accountType} balance is GHS ${data.currentBalance.toFixed(2)}. Please add funds.`
        break

      default:
        return NextResponse.json({ success: false, error: "Invalid notification type" }, { status: 400 })
    }

    const results = []

    // Send email if recipient has email
    if (recipient.email) {
      const emailResult = await NotificationService.sendEmail({
        to: recipient.email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      })
      results.push({ type: "email", ...emailResult })
    }

    // Send SMS if recipient has phone and SMS content is available
    if (recipient.phone && smsContent) {
      const smsResult = await NotificationService.sendSMS({
        to: recipient.phone,
        message: smsContent,
      })
      results.push({ type: "sms", ...smsResult })
    }

    const successCount = results.filter((r) => r.success).length
    const totalCount = results.length

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}/${totalCount} notifications sent successfully`,
      results,
    })
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
