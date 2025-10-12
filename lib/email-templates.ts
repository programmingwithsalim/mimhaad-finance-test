export const EmailTemplates = {
  welcome: (userName: string) => ({
    subject: "Welcome to Mimhaad Financial Services",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Mimhaad Financial Services!</h2>
        <p>Hello ${userName},</p>
        <p>Welcome to our financial technology platform. Your account has been successfully created.</p>
        <p>You can now access all the features available to your role.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>Mimhaad Financial Services Team</p>
      </div>
    `,
    text: `Welcome to Mimhaad Financial Services!\n\nHello ${userName},\n\nWelcome to our financial technology platform. Your account has been successfully created.\n\nYou can now access all the features available to your role.\n\nIf you have any questions, please don't hesitate to contact our support team.\n\nBest regards,\nThe Mimhaad Financial Services Team`,
  }),

  passwordReset: (userName: string, resetLink: string) => ({
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>We received a request to reset your password. Click the link below to reset your password:</p>
        <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>Best regards,<br>Mimhaad Financial Services Team</p>
      </div>
    `,
    text: `Password Reset Request\n\nHello ${userName},\n\nWe received a request to reset your password. Click the link below to reset your password:\n\n${resetLink}\n\nIf you didn't request this password reset, please ignore this email.\n\nThis link will expire in 1 hour for security reasons.\n\nBest regards,\nMimhaad Financial Services`,
  }),

  transactionAlert: (userName: string, transactionDetails: any) => ({
    subject: "Transaction Alert",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Transaction Alert</h2>
        <p>Hello ${userName},</p>
        <p>A transaction has been processed on your account:</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Transaction ID:</strong> ${transactionDetails.id}</p>
          <p><strong>Amount:</strong> GHS ${transactionDetails.amount}</p>
          <p><strong>Type:</strong> ${transactionDetails.type}</p>
          <p><strong>Date:</strong> ${new Date(
            transactionDetails.date
          ).toLocaleString()}</p>
        </div>
        <p>If you have any questions about this transaction, please contact our support team.</p>
        <p>Best regards,<br>Mimhaad Financial Services Team</p>
      </div>
    `,
    text: `Transaction Alert\n\nHello ${userName},\n\nA transaction has been processed on your account:\n\nTransaction ID: ${
      transactionDetails.id
    }\nAmount: GHS ${transactionDetails.amount}\nType: ${
      transactionDetails.type
    }\nDate: ${new Date(
      transactionDetails.date
    ).toLocaleString()}\n\nIf you have any questions about this transaction, please contact our support team.\n\nBest regards,\nMimhaad Financial Services`,
  }),

  lowBalanceAlert: (
    userName: string,
    accountType: string,
    currentBalance: number,
    threshold: number
  ) => ({
    subject: "Low Balance Alert",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Low Balance Alert</h2>
        <p>Hello ${userName},</p>
        <p>Your ${accountType} account balance has fallen below the warning threshold:</p>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffc107;">
          <p><strong>Current Balance:</strong> GHS ${currentBalance.toFixed(
            2
          )}</p>
          <p><strong>Warning Threshold:</strong> GHS ${threshold.toFixed(2)}</p>
        </div>
        <p>Please consider adding funds to maintain service operations.</p>
        <p>Best regards,<br>Mimhaad Financial Services Team</p>
      </div>
    `,
    text: `Low Balance Alert\n\nHello ${userName},\n\nYour ${accountType} account balance has fallen below the warning threshold:\n\nCurrent Balance: GHS ${currentBalance.toFixed(
      2
    )}\nWarning Threshold: GHS ${threshold.toFixed(
      2
    )}\n\nPlease consider adding funds to maintain service operations.\n\nBest regards,\nMimhaad Financial Services`,
  }),

  loginAlert: (userName: string, loginData: any) => ({
    subject: "New Login Alert",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">New Login Alert</h2>
        <p>Hello ${userName},</p>
        <p>A new login was detected on your account:</p>
        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #28a745;">
          <p><strong>Time:</strong> ${loginData.timestamp}</p>
          <p><strong>IP Address:</strong> ${loginData.ipAddress}</p>
          <p><strong>Location:</strong> ${loginData.location}</p>
          <p><strong>Device:</strong> ${loginData.userAgent}</p>
        </div>
        <p>If this wasn't you, please contact our support team immediately and change your password.</p>
        <p>Best regards,<br>Mimhaad Financial Services Team</p>
      </div>
    `,
    text: `New Login Alert\n\nHello ${userName},\n\nA new login was detected on your account:\n\nTime: ${loginData.timestamp}\nIP Address: ${loginData.ipAddress}\nLocation: ${loginData.location}\nDevice: ${loginData.userAgent}\n\nIf this wasn't you, please contact our support team immediately and change your password.\n\nBest regards,\nMimhaad Financial Services`,
  }),
};
