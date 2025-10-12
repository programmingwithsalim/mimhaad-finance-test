"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Loader2,
  Mail,
  MessageSquare,
  Bell,
  Shield,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

const notificationSchema = z.object({
  // Email Settings
  emailNotifications: z.boolean().default(true),
  emailAddress: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),

  // SMS Settings
  smsNotifications: z.boolean().default(false),
  phoneNumber: z.string().optional(),

  // Notification Types
  transactionAlerts: z.boolean().default(true),
  floatThresholdAlerts: z.boolean().default(true),
  systemUpdates: z.boolean().default(true),
  securityAlerts: z.boolean().default(true),
  dailyReports: z.boolean().default(false),
  weeklyReports: z.boolean().default(false),

  // Timing Preferences
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().default("22:00"),
  quietHoursEnd: z.string().default("08:00"),

  // Frequency Settings
  alertFrequency: z.enum(["immediate", "hourly", "daily"]).default("immediate"),
  reportFrequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

export function NotificationSettings() {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      emailAddress: "",
      smsNotifications: false,
      phoneNumber: "",
      transactionAlerts: true,
      floatThresholdAlerts: true,
      systemUpdates: true,
      securityAlerts: true,
      dailyReports: false,
      weeklyReports: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      alertFrequency: "immediate",
      reportFrequency: "weekly",
    },
  });

  // Load user's current notification settings
  useEffect(() => {
    if (user) {
      form.setValue("emailAddress", user.email || "");
      form.setValue("phoneNumber", user.phone || "");
      loadNotificationSettings();
    }
  }, [user, form]);

  const loadNotificationSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users/notification-settings");

      if (response.ok) {
        const settings = await response.json();
        if (settings.data) {
          // Update form with saved settings
          Object.keys(settings.data).forEach((key) => {
            if (key in form.getValues()) {
              form.setValue(
                key as keyof NotificationFormData,
                settings.data[key]
              );
            }
          });
        }
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: NotificationFormData) => {
    try {
      setIsSaving(true);

      const response = await fetch("/api/users/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save notification settings");
      }

      toast({
        title: "Settings Saved",
        description:
          "Your notification preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testNotification = async (type: "email" | "sms") => {
    try {
      const response = await fetch("/api/notifications/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
        credentials: "include", // Ensure session token is sent
      });

      if (response.ok) {
        toast({
          title: "Test Notification Sent",
          description: `A test ${type} notification has been sent.`,
        });
      } else {
        throw new Error(`Failed to send test ${type}`);
      }
    } catch (error) {
      toast({
        title: "Test Failed",
        description:
          error instanceof Error
            ? error.message
            : `Failed to send test ${type}`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading notification settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Configure email notification preferences and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="emailNotifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable Email Notifications
                    </FormLabel>
                    <FormDescription>
                      Receive notifications via email
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

            <FormField
              control={form.control}
              name="emailAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="your.email@example.com"
                        disabled={!form.watch("emailNotifications")}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testNotification("email")}
                      disabled={
                        !form.watch("emailNotifications") || !field.value
                      }
                    >
                      Test
                    </Button>
                  </div>
                  <FormDescription>
                    Email address where notifications will be sent
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* SMS Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              SMS Notifications
              <Badge variant="secondary" className="text-xs">
                Coming Soon
              </Badge>
            </CardTitle>
            <CardDescription>
              Configure SMS notification preferences and settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="smsNotifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Enable SMS Notifications
                    </FormLabel>
                    <FormDescription>
                      Receive notifications via SMS (requires setup)
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

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+233 XX XXX XXXX"
                        disabled={!form.watch("smsNotifications")}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => testNotification("sms")}
                      disabled={!form.watch("smsNotifications") || !field.value}
                    >
                      Test
                    </Button>
                  </div>
                  <FormDescription>
                    Phone number where SMS notifications will be sent
                  </FormDescription>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Types
            </CardTitle>
            <CardDescription>
              Choose which types of notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="transactionAlerts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Transaction Alerts
                      </FormLabel>
                      <FormDescription>
                        High-value transactions and approvals
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

              <FormField
                control={form.control}
                name="floatThresholdAlerts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Float Threshold Alerts
                      </FormLabel>
                      <FormDescription>
                        Low balance and threshold warnings
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

              <FormField
                control={form.control}
                name="securityAlerts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Security Alerts
                      </FormLabel>
                      <FormDescription>
                        Login attempts and security events
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

              <FormField
                control={form.control}
                name="systemUpdates"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        System Updates
                      </FormLabel>
                      <FormDescription>
                        Maintenance and system announcements
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

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Report Notifications</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dailyReports"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Daily Reports
                        </FormLabel>
                        <FormDescription>
                          Daily transaction summaries
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

                <FormField
                  control={form.control}
                  name="weeklyReports"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Weekly Reports
                        </FormLabel>
                        <FormDescription>
                          Weekly performance summaries
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
            </div>
          </CardContent>
        </Card>

        {/* Timing and Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>Timing & Frequency</CardTitle>
            <CardDescription>
              Configure when and how often you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="quietHoursEnabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Quiet Hours</FormLabel>
                    <FormDescription>
                      Disable non-urgent notifications during specified hours
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

            {form.watch("quietHoursEnabled") && (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quietHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiet Hours Start</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quietHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quiet Hours End</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="alertFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alert Frequency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="hourly">Hourly Digest</SelectItem>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to receive alert notifications
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Frequency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often to receive report notifications
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Notification Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
