"use client"

import { useState } from "react"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CommunicationsSettings } from "./communications-settings"
import { FeeConfigSettings } from "./fee-config-settings"
import { Mail, DollarSign, Settings } from "lucide-react"

const floatThresholdSchema = z.object({
  minimumFloat: z.coerce.number().min(0, { message: "Minimum float must be at least 0" }),
  warningThreshold: z.coerce.number().min(0, { message: "Warning threshold must be at least 0" }),
  criticalThreshold: z.coerce.number().min(0, { message: "Critical threshold must be at least 0" }),
  notificationEmail: z.string().email({ message: "Please enter a valid email address" }).optional().or(z.literal("")),
  enableSmsNotifications: z.boolean().default(false),
  notificationPhone: z.string().optional(),
})

const transactionLimitsSchema = z.object({
  dailyTransactionLimit: z.coerce.number().min(0, { message: "Daily limit must be at least 0" }),
  singleTransactionMaximum: z.coerce.number().min(0, { message: "Max transaction must be at least 0" }),
  singleTransactionMinimum: z.coerce.number().min(0, { message: "Min transaction must be at least 0" }),
  monthlyTransactionLimit: z.coerce.number().min(0, { message: "Monthly limit must be at least 0" }),
  requireApprovalAbove: z.coerce.number().min(0, { message: "Approval threshold must be at least 0" }),
  limitByUserRole: z.boolean().default(true),
})

const feeConfigSchema = z.object({
  momoDepositFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  momoWithdrawalFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  agencyBankingDepositFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  agencyBankingWithdrawalFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  interbankTransferFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  interbankInquiryFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  eZwichCardIssuanceFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  eZwichWithdrawalFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  powerTransactionFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
  jumiaTransactionFee: z.coerce.number().min(0, { message: "Fee must be at least 0" }),
})

const communicationConfigSchema = z.object({
  emailProvider: z.enum(["resend", "smtp"]).default("resend"),
  // Resend configuration
  resendApiKey: z.string().optional(),
  resendFromEmail: z.string().email().optional().or(z.literal("")),
  resendFromName: z.string().optional(),
  // SMTP configuration
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean().default(true),
  smtpFromEmail: z.string().email().optional().or(z.literal("")),
  smtpFromName: z.string().optional(),
  // SMS configuration
  smsProvider: z.enum(["twilio", "nexmo", "africastalking"]).default("twilio"),
  smsApiKey: z.string().optional(),
  smsApiSecret: z.string().optional(),
  smsSenderId: z.string().optional(),
})

type FloatThresholdValues = z.infer<typeof floatThresholdSchema>
type TransactionLimitsValues = z.infer<typeof transactionLimitsSchema>
type FeeConfigValues = z.infer<typeof feeConfigSchema>
type CommunicationConfigValues = z.infer<typeof communicationConfigSchema>

interface SystemConfigSettingsProps {
  userRole: string
}

export function SystemConfigSettings({ userRole }: SystemConfigSettingsProps) {
  const [activeTab, setActiveTab] = useState("communications")

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="communications" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email & SMS
          </TabsTrigger>
          <TabsTrigger value="fees" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Fee Configuration
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="communications">
            <CommunicationsSettings userRole={userRole} />
          </TabsContent>

          <TabsContent value="fees">
            <FeeConfigSettings userRole={userRole} />
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General System Settings</CardTitle>
                <CardDescription>Configure general system parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Settings className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">General Settings</h3>
                  <p className="text-muted-foreground">General system configuration options will be available here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
