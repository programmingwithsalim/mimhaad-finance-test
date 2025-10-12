"use client";

import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  Loader2,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  TestTube,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const emailConfigSchema = z.object({
  emailProvider: z.enum(["resend", "smtp", "sendgrid", "mailgun"], {
    required_error: "Please select an email provider",
  }),
  // Resend fields
  resendApiKey: z.string().optional(),
  resendFromEmail: z.string().email().optional().or(z.literal("")),
  resendFromName: z.string().optional(),
  // SMTP fields
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean(),
  smtpFromEmail: z.string().email().optional().or(z.literal("")),
  smtpFromName: z.string().optional(),
});

const smsConfigSchema = z.object({
  smsProvider: z.enum(["hubtel", "twilio", "custom", "smsonlinegh"], {
    required_error: "Please select an SMS provider",
  }),
  smsApiKey: z.string().min(1, { message: "API key is required" }),
  smsApiSecret: z.string().min(1, { message: "API secret is required" }),
  smsSenderId: z.string().min(1, { message: "Sender ID is required" }),
  smsWebhookUrl: z
    .string()
    .url({ message: "Please enter a valid URL" })
    .optional()
    .or(z.literal("")),
  smsTestMode: z.boolean(),
});

type EmailConfigValues = z.infer<typeof emailConfigSchema>;
type SmsConfigValues = z.infer<typeof smsConfigSchema>;

const initialEmailConfig = {
  emailProvider: "resend" as const,
  resendApiKey: "",
  resendFromEmail: "",
  resendFromName: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUsername: "",
  smtpPassword: "",
  smtpSecure: true,
  smtpFromEmail: "",
  smtpFromName: "",
};

const initialSmsConfig = {
  smsProvider: "hubtel" as const,
  smsApiKey: "",
  smsApiSecret: "",
  smsSenderId: "",
  smsWebhookUrl: "",
  smsTestMode: true,
};

const smsProviders = [
  { value: "hubtel", label: "Hubtel" },
  { value: "smsonlinegh", label: "SMSOnlineGH" },
  { value: "twilio", label: "Twilio" },
  { value: "custom", label: "Custom Provider" },
];

// Helper function to get provider-specific field names
const getProviderFieldName = (provider: string, field: string) => {
  if (provider === "hubtel") {
    // Use ClientID/ClientSecret naming for Hubtel
    if (field === "sms_api_key") return "hubtel_sms_client_id";
    if (field === "sms_api_secret") return "hubtel_sms_client_secret";
    return `hubtel_sms_${field}`;
  }
  return `${provider}_sms_${field}`;
};

export function CommunicationsSettings({ userRole }: { userRole: string }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [configTab, setConfigTab] = useState("email");
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [smsTestResult, setSmsTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [allSmsConfigs, setAllSmsConfigs] = useState<any>({});
  const [selectedSmsProvider, setSelectedSmsProvider] = useState<
    "hubtel" | "twilio" | "custom" | "smsonlinegh"
  >(initialSmsConfig.smsProvider);
  const [testPhoneNumber, setTestPhoneNumber] =
    useState<string>("+233241378880");

  const emailForm = useForm<EmailConfigValues>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: initialEmailConfig,
  });

  const smsForm = useForm<SmsConfigValues>({
    resolver: zodResolver(smsConfigSchema),
    defaultValues: initialSmsConfig,
  });

  const selectedEmailProvider = emailForm.watch("emailProvider");

  useEffect(() => {
    fetchCommunicationsConfig();
  }, []);

  const fetchCommunicationsConfig = async () => {
    try {
      const response = await fetch("/api/settings/communications-config");
      if (response.ok) {
        const result = await response.json();
        console.log(result);
        if (result.success && result.data && Array.isArray(result.data)) {
          const configData = result.data.reduce((acc: any, config: any) => {
            if (
              config &&
              config.config_key &&
              config.config_value !== undefined
            ) {
              acc[config.config_key] = config.config_value;
            }
            return acc;
          }, {});
          setAllSmsConfigs(configData);
          // Update Email form
          emailForm.reset({
            emailProvider: configData.email_provider || "resend",
            resendApiKey: configData.resend_api_key || "",
            resendFromEmail: configData.resend_from_email || "",
            resendFromName: configData.resend_from_name || "",
            smtpHost: configData.smtp_host || "",
            smtpPort: Number(configData.smtp_port) || 587,
            smtpUsername: configData.smtp_username || "",
            smtpPassword: configData.smtp_password || "",
            smtpSecure: configData.smtp_secure === "true" ? true : false,
            smtpFromEmail: configData.smtp_from_email || "",
            smtpFromName: configData.smtp_from_name || "",
          });

          // Update SMS form
          const provider = configData.sms_provider || "hubtel";

          // Helper function to get provider-specific field values
          const getSmsFieldValue = (field: string) => {
            if (provider === "hubtel") {
              if (field === "api_key")
                return configData["hubtel_sms_client_id"] || "";
              if (field === "api_secret")
                return configData["hubtel_sms_client_secret"] || "";
              return configData[`hubtel_sms_${field}`] || "";
            }
            return configData[`${provider}_sms_${field}`] || "";
          };

          smsForm.reset({
            smsProvider: provider,
            smsApiKey: getSmsFieldValue("api_key"),
            smsApiSecret: getSmsFieldValue("api_secret"),
            smsSenderId: getSmsFieldValue("sender_id"),
            smsWebhookUrl: getSmsFieldValue("webhook_url"),
            smsTestMode:
              getSmsFieldValue("test_mode") === "true" ? true : false,
          });
          setSelectedSmsProvider(provider);
        }
      }
    } catch (error) {
      console.error("Error fetching communications config:", error);
      toast({
        title: "Warning",
        description: "Could not load saved settings. Using default values.",
        variant: "destructive",
      });
    }
  };

  // Robust auto-population for SMS provider fields
  useEffect(() => {
    const provider = selectedSmsProvider;

    // Get provider-specific field names
    const getFieldValue = (field: string) => {
      if (provider === "hubtel") {
        if (field === "smsApiKey")
          return allSmsConfigs["hubtel_sms_client_id"] || "";
        if (field === "smsApiSecret")
          return allSmsConfigs["hubtel_sms_client_secret"] || "";
        return (
          allSmsConfigs[
            `hubtel_sms_${field.replace("sms", "").toLowerCase()}`
          ] || ""
        );
      }
      return (
        allSmsConfigs[
          `${provider}_sms_${field.replace("sms", "").toLowerCase()}`
        ] || ""
      );
    };

    smsForm.reset({
      smsProvider: provider,
      smsApiKey: getFieldValue("smsApiKey"),
      smsApiSecret: getFieldValue("smsApiSecret"),
      smsSenderId: getFieldValue("smsSenderId"),
      smsWebhookUrl: getFieldValue("smsWebhookUrl"),
      smsTestMode: getFieldValue("smsTestMode") === "true" ? true : false,
    });
  }, [selectedSmsProvider, allSmsConfigs]);

  const onSubmitEmailConfig = async (values: EmailConfigValues) => {
    setIsSaving(true);
    try {
      const configs = [
        { config_key: "email_provider", config_value: values.emailProvider },
        {
          config_key: "resend_api_key",
          config_value: values.resendApiKey || "",
        },
        {
          config_key: "resend_from_email",
          config_value: values.resendFromEmail || "",
        },
        {
          config_key: "resend_from_name",
          config_value: values.resendFromName || "",
        },
        { config_key: "smtp_host", config_value: values.smtpHost || "" },
        {
          config_key: "smtp_port",
          config_value: values.smtpPort?.toString() || "",
        },
        {
          config_key: "smtp_username",
          config_value: values.smtpUsername || "",
        },
        {
          config_key: "smtp_password",
          config_value: values.smtpPassword || "",
        },
        {
          config_key: "smtp_secure",
          config_value: values.smtpSecure.toString(),
        },
        {
          config_key: "smtp_from_email",
          config_value: values.smtpFromEmail || "",
        },
        {
          config_key: "smtp_from_name",
          config_value: values.smtpFromName || "",
        },
      ];

      const response = await fetch("/api/settings/communications-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs, userId: 1 }),
      });

      if (response.ok) {
        toast({
          title: "Settings updated",
          description: "Email configuration has been updated successfully.",
        });
        setEmailTestResult(null); // Clear previous test results
      } else {
        throw new Error("Failed to update settings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmitSmsConfig = async (values: SmsConfigValues) => {
    setIsSaving(true);
    try {
      const provider = values.smsProvider;

      // Helper function to get provider-specific field names
      const getProviderFieldName = (field: string) => {
        if (provider === "hubtel") {
          if (field === "api_key") return "hubtel_sms_client_id";
          if (field === "api_secret") return "hubtel_sms_client_secret";
          return `hubtel_sms_${field}`;
        }
        return `${provider}_sms_${field}`;
      };

      const configs = [
        { config_key: "sms_provider", config_value: provider },
        {
          config_key: getProviderFieldName("api_key"),
          config_value: values.smsApiKey,
        },
        {
          config_key: getProviderFieldName("api_secret"),
          config_value: values.smsApiSecret,
        },
        {
          config_key: getProviderFieldName("sender_id"),
          config_value: values.smsSenderId,
        },
        {
          config_key: getProviderFieldName("webhook_url"),
          config_value: values.smsWebhookUrl || "",
        },
        {
          config_key: getProviderFieldName("test_mode"),
          config_value: values.smsTestMode.toString(),
        },
      ];

      const response = await fetch("/api/settings/communications-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs, userId: 1 }),
      });

      if (response.ok) {
        toast({
          title: "Settings updated",
          description: "SMS configuration has been updated successfully.",
        });
        setSmsTestResult(null); // Clear previous test results

        // Update allSmsConfigs with new values
        const updatedConfigs = { ...allSmsConfigs };
        configs.forEach((config) => {
          updatedConfigs[config.config_key] = config.config_value;
        });
        setAllSmsConfigs(updatedConfigs);
      } else {
        throw new Error("Failed to update settings");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update SMS settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testEmailConnection = async () => {
    setIsTestingEmail(true);
    setEmailTestResult(null);

    try {
      const values = emailForm.getValues();

      // Test different email templates
      const templates = [
        "welcome",
        "transactionAlert",
        "lowBalanceAlert",
        "loginAlert",
      ];
      const results = [];

      for (const template of templates) {
        try {
          const response = await fetch("/api/test-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              template,
              testEmail: "programmingwithsalim@gmail.com",
            }),
          });

          const result = await response.json();
          results.push({
            template,
            success: response.ok,
            message: result.message || result.error,
          });
        } catch (error) {
          results.push({
            template,
            success: false,
            message: error instanceof Error ? error.message : "Request failed",
          });
        }
      }

      const successfulTests = results.filter((r) => r.success);

      if (successfulTests.length > 0) {
        setEmailTestResult({
          success: true,
          message: `Successfully sent ${successfulTests.length}/${templates.length} test emails. Check your inbox.`,
        });
        toast({
          title: "Email Test Successful",
          description: `Sent ${successfulTests.length} test emails successfully.`,
        });
      } else {
        throw new Error("All email tests failed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Email test failed";
      setEmailTestResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: "Email Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const testSmsConnection = async () => {
    setIsTestingSms(true);
    setSmsTestResult(null);

    try {
      const values = smsForm.getValues();
      const response = await fetch("/api/notifications/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: values,
          testPhone: testPhoneNumber,
        }),
        credentials: "include", // Ensure session token is sent
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSmsTestResult({
          success: true,
          message: result.message || "SMS test sent successfully!",
        });
        toast({
          title: "SMS Test Successful",
          description: "Test SMS sent successfully.",
        });
      } else {
        throw new Error(result.error || "SMS test failed");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "SMS test failed";
      setSmsTestResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: "SMS Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingSms(false);
    }
  };

  const canEditCommunications = userRole?.toLowerCase() === "admin";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Communications Configuration</CardTitle>
          <CardDescription>
            Configure email and SMS service providers for notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canEditCommunications ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Restricted</AlertTitle>
              <AlertDescription>
                You don't have permission to modify communications settings.
                Contact your administrator for assistance.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs value={configTab} onValueChange={setConfigTab}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="sms" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </TabsTrigger>
              </TabsList>

              <div className="mt-4">
                <TabsContent value="email">
                  <Form {...emailForm}>
                    <form
                      onSubmit={emailForm.handleSubmit(onSubmitEmailConfig)}
                      className="space-y-4"
                    >
                      <FormField
                        control={emailForm.control}
                        name="emailProvider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Provider</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select email provider" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="resend">
                                  Resend (Recommended)
                                </SelectItem>
                                <SelectItem value="smtp">SMTP</SelectItem>
                                <SelectItem value="sendgrid">
                                  SendGrid
                                </SelectItem>
                                <SelectItem value="mailgun">Mailgun</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Choose your email service provider
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedEmailProvider === "resend" && (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          <FormField
                            control={emailForm.control}
                            name="resendApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Resend API Key</FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="re_..."
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Your Resend API key
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="resendFromName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>From Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Mimhaad Finance Platform"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Display name for outgoing emails
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="resendFromEmail"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>From Email</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder="noreply@yourdomain.com"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Email address to send from (must be verified
                                  in Resend)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {selectedEmailProvider === "smtp" && (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          <FormField
                            control={emailForm.control}
                            name="smtpHost"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Host</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="smtp.gmail.com"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  SMTP server hostname
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="smtpPort"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SMTP Port</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="587"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  SMTP server port (587 for TLS, 465 for SSL)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="smtpUsername"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="your-email@gmail.com"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  SMTP authentication username
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="smtpPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder="••••••••••••••••"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  SMTP authentication password or app password
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="smtpFromEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>From Email</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder="noreply@company.com"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Email address to send from
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="smtpFromName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>From Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Mimhaad Finance Platform"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Display name for outgoing emails
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={emailForm.control}
                            name="smtpSecure"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                  <FormLabel>Use TLS/SSL</FormLabel>
                                  <FormDescription>
                                    Enable secure connection
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      {/* Email Test Result */}
                      {emailTestResult && (
                        <Alert
                          className={
                            emailTestResult.success
                              ? "border-green-200"
                              : "border-red-200"
                          }
                        >
                          {emailTestResult.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <AlertTitle>
                            {emailTestResult.success
                              ? "Test Successful"
                              : "Test Failed"}
                          </AlertTitle>
                          <AlertDescription>
                            {emailTestResult.message}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-2">
                        <Button type="submit" disabled={isSaving}>
                          {isSaving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save Email Settings
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={testEmailConnection}
                          disabled={isTestingEmail}
                        >
                          {isTestingEmail ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube className="mr-2 h-4 w-4" />
                          )}
                          Test Email
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>

                <TabsContent value="sms">
                  <Form {...smsForm}>
                    <form
                      onSubmit={smsForm.handleSubmit(onSubmitSmsConfig)}
                      className="space-y-4"
                    >
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <FormField
                          control={smsForm.control}
                          name="smsProvider"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>SMS Provider</FormLabel>
                              <Select
                                onValueChange={(val) => {
                                  field.onChange(val);
                                  setSelectedSmsProvider(
                                    val as
                                      | "hubtel"
                                      | "twilio"
                                      | "custom"
                                      | "smsonlinegh"
                                  );
                                }}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select SMS provider" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {smsProviders.map((p) => (
                                    <SelectItem key={p.value} value={p.value}>
                                      {p.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                Choose your SMS service provider
                                {selectedSmsProvider === "hubtel" && (
                                  <span className="block text-xs text-amber-600 mt-1">
                                    Note: Hubtel uses URL authentication with
                                    Client ID and Client Secret
                                  </span>
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={smsForm.control}
                          name="smsSenderId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sender ID</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Mimhaad Finance"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                SMS sender ID (alphanumeric, max 11 chars)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={smsForm.control}
                          name="smsApiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {selectedSmsProvider === "hubtel"
                                  ? "Client ID"
                                  : "API Key"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder={
                                    selectedSmsProvider === "hubtel"
                                      ? "cbkmgino"
                                      : "••••••••••••••••"
                                  }
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {selectedSmsProvider === "hubtel"
                                  ? "Hubtel Client ID for authentication"
                                  : "SMS provider API key"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={smsForm.control}
                          name="smsApiSecret"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {selectedSmsProvider === "hubtel"
                                  ? "Client Secret"
                                  : "API Secret"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder={
                                    selectedSmsProvider === "hubtel"
                                      ? "alywcjxo"
                                      : "••••••••••••••••"
                                  }
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                {selectedSmsProvider === "hubtel"
                                  ? "Hubtel Client Secret for authentication"
                                  : "SMS provider API secret"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={smsForm.control}
                          name="smsWebhookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Webhook URL</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://webhook.example.com/sms"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                URL for SMS delivery status callbacks
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={smsForm.control}
                          name="smsTestMode"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Test Mode</FormLabel>
                                <FormDescription>
                                  Use sandbox environment for testing
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Test Phone Number Input */}
                      <div className="space-y-2">
                        <Label htmlFor="testPhone">Test Phone Number</Label>
                        <Input
                          id="testPhone"
                          type="tel"
                          placeholder="+233241378880"
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Enter the phone number where you want to receive the
                          test SMS
                        </p>
                      </div>

                      {/* SMS Test Result */}
                      {smsTestResult && (
                        <Alert
                          className={
                            smsTestResult.success
                              ? "border-green-200"
                              : "border-red-200"
                          }
                        >
                          {smsTestResult.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <AlertTitle>
                            {smsTestResult.success
                              ? "Test Successful"
                              : "Test Failed"}
                          </AlertTitle>
                          <AlertDescription>
                            {smsTestResult.message}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="flex gap-2">
                        <Button type="submit" disabled={isSaving}>
                          {isSaving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Save SMS Settings
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={testSmsConnection}
                          disabled={isTestingSms}
                        >
                          {isTestingSms ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube className="mr-2 h-4 w-4" />
                          )}
                          Test SMS
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
