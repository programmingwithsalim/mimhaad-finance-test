"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Loader2,
  Database,
  Shield,
  Settings,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const systemConfigSchema = z.object({
  systemName: z.string().min(1, { message: "System name is required" }),
  systemVersion: z.string().optional(),
  maintenanceMode: z.boolean(),
  debugMode: z.boolean(),
  sessionTimeout: z.coerce.number().min(5).max(1440), // 5 minutes to 24 hours
  maxLoginAttempts: z.coerce.number().min(3).max(10),
  passwordPolicy: z.object({
    minLength: z.coerce.number().min(6).max(20),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumbers: z.boolean(),
    requireSpecialChars: z.boolean(),
  }),
  backupSettings: z.object({
    autoBackup: z.boolean(),
    backupFrequency: z.enum(["daily", "weekly", "monthly"]),
    retentionDays: z.coerce.number().min(1).max(365),
    backupLocation: z.string().optional(),
  }),
  securitySettings: z.object({
    enableTwoFactor: z.boolean(),
    requireTwoFactorForAdmins: z.boolean(),
    enableAuditLogs: z.boolean(),
    enableIpWhitelist: z.boolean(),
    allowedIps: z.string().optional(),
  }),
});

type SystemConfigValues = z.infer<typeof systemConfigSchema>;

const initialSystemConfig: SystemConfigValues = {
  systemName: "Mimhaad Financial Services",
  systemVersion: "1.0.0",
  maintenanceMode: false,
  debugMode: false,
  sessionTimeout: 30,
  maxLoginAttempts: 5,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  backupSettings: {
    autoBackup: true,
    backupFrequency: "daily",
    retentionDays: 30,
    backupLocation: "",
  },
  securitySettings: {
    enableTwoFactor: false,
    requireTwoFactorForAdmins: true,
    enableAuditLogs: true,
    enableIpWhitelist: false,
    allowedIps: "",
  },
};

interface GeneralConfigurationProps {
  userRole: string;
}

export function GeneralConfiguration({ userRole }: GeneralConfigurationProps) {
  const [configTab, setConfigTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const { toast } = useToast();

  const canEditGeneral =
    userRole?.toLowerCase() === "admin" || userRole === "Admin";

  const form = useForm<SystemConfigValues>({
    resolver: zodResolver(systemConfigSchema),
    defaultValues: initialSystemConfig,
  });

  useEffect(() => {
    fetchSystemConfig();
    fetchSystemStats();
  }, []);

  const fetchSystemConfig = async () => {
    try {
      const response = await fetch("/api/settings/system-config");
      const result = await response.json();
      if (result.success && result.data) {
        form.reset(result.data);
      }
    } catch (error) {
      console.error("Error fetching system config:", error);
    }
  };

  const fetchSystemStats = async () => {
    try {
      setLoadingStats(true);
      const response = await fetch("/api/settings/system-stats");
      const result = await response.json();
      if (result.success) {
        setSystemStats(result.data);
      }
    } catch (error) {
      console.error("Error fetching system stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const onSubmitSystemConfig = async (values: SystemConfigValues) => {
    try {
      setIsSaving(true);

      console.log("Submitting system config:", {
        hasSystemName: !!values.systemName,
        hasPasswordPolicy: !!values.passwordPolicy,
        hasBackupSettings: !!values.backupSettings,
        hasSecuritySettings: !!values.securitySettings,
        valuesKeys: Object.keys(values),
      });

      const response = await fetch("/api/settings/system-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "System configuration updated successfully",
        });
      } else {
        throw new Error(result.error || "Failed to update configuration");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update configuration",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDatabaseReset = async () => {
    if (!resetPassword) {
      toast({
        title: "Error",
        description: "Please enter your admin password to confirm",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/settings/reset-database", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ adminPassword: resetPassword }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Database reset completed successfully",
        });
        setShowResetDialog(false);
        setResetPassword("");
        // Refresh the page to reflect changes
        window.location.reload();
      } else {
        throw new Error(result.error || "Failed to reset database");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to reset database",
        variant: "destructive",
      });
    }
  };

  const handleSystemBackup = async () => {
    try {
      const response = await fetch("/api/settings/create-backup", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "System backup created successfully",
        });
        setShowBackupDialog(false);
        fetchSystemStats(); // Refresh stats
      } else {
        throw new Error(result.error || "Failed to create backup");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create backup",
        variant: "destructive",
      });
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await fetch("/api/settings/clear-cache", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "System cache cleared successfully",
        });
        fetchSystemStats(); // Refresh stats
      } else {
        throw new Error(result.error || "Failed to clear cache");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to clear cache",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>General Configuration</CardTitle>
          <CardDescription>
            System-wide settings and administrative functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canEditGeneral ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Restricted</AlertTitle>
              <AlertDescription>
                You don't have permission to modify general settings. Contact
                your administrator for assistance.
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmitSystemConfig)}
                className="space-y-6"
              >
                <Tabs value={configTab} onValueChange={setConfigTab}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger
                      value="general"
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      General
                    </TabsTrigger>
                    <TabsTrigger
                      value="security"
                      className="flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      Security
                    </TabsTrigger>
                    <TabsTrigger
                      value="backup"
                      className="flex items-center gap-2"
                    >
                      <Database className="h-4 w-4" />
                      Backup
                    </TabsTrigger>
                    <TabsTrigger
                      value="maintenance"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Maintenance
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    <TabsContent value="general">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="systemName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>System Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Mimhaad Financial Services"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                The name displayed throughout the system
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="systemVersion"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>System Version</FormLabel>
                              <FormControl>
                                <Input placeholder="1.0.0" {...field} />
                              </FormControl>
                              <FormDescription>
                                Current system version
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="sessionTimeout"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Session Timeout (minutes)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="5"
                                  max="1440"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                How long before users are automatically logged
                                out
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxLoginAttempts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Login Attempts</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="3"
                                  max="10"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Maximum failed login attempts before account
                                lockout
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4 mt-6">
                        <FormField
                          control={form.control}
                          name="maintenanceMode"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Maintenance Mode</FormLabel>
                                <FormDescription>
                                  Enable maintenance mode to restrict access
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
                          name="debugMode"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                              <div className="space-y-0.5">
                                <FormLabel>Debug Mode</FormLabel>
                                <FormDescription>
                                  Enable debug logging for troubleshooting
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
                    </TabsContent>

                    <TabsContent value="security">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                              Password Policy
                            </h3>
                            <FormField
                              control={form.control}
                              name="passwordPolicy.minLength"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Minimum Length</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="6"
                                      max="20"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="passwordPolicy.requireUppercase"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Require Uppercase</FormLabel>
                                    <FormDescription>
                                      Passwords must contain at least one
                                      uppercase letter
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
                              name="passwordPolicy.requireLowercase"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Require Lowercase</FormLabel>
                                    <FormDescription>
                                      Passwords must contain at least one
                                      lowercase letter
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
                              name="passwordPolicy.requireNumbers"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Require Numbers</FormLabel>
                                    <FormDescription>
                                      Passwords must contain at least one number
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
                              name="passwordPolicy.requireSpecialChars"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>
                                      Require Special Characters
                                    </FormLabel>
                                    <FormDescription>
                                      Passwords must contain at least one
                                      special character
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

                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                              Security Settings
                            </h3>
                            <FormField
                              control={form.control}
                              name="securitySettings.enableTwoFactor"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>
                                      Enable Two-Factor Authentication
                                    </FormLabel>
                                    <FormDescription>
                                      Require 2FA for all users
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
                              name="securitySettings.requireTwoFactorForAdmins"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>
                                      Require 2FA for Admins
                                    </FormLabel>
                                    <FormDescription>
                                      Require 2FA specifically for admin users
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
                              name="securitySettings.enableAuditLogs"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Enable Audit Logs</FormLabel>
                                    <FormDescription>
                                      Log all system activities for security
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
                              name="securitySettings.enableIpWhitelist"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Enable IP Whitelist</FormLabel>
                                    <FormDescription>
                                      Restrict access to specific IP addresses
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

                            {form.watch(
                              "securitySettings.enableIpWhitelist"
                            ) && (
                              <FormField
                                control={form.control}
                                name="securitySettings.allowedIps"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Allowed IP Addresses</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="192.168.1.1, 10.0.0.1"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Comma-separated list of allowed IP
                                      addresses
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="backup">
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                              Backup Settings
                            </h3>
                            <FormField
                              control={form.control}
                              name="backupSettings.autoBackup"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                  <div className="space-y-0.5">
                                    <FormLabel>Auto Backup</FormLabel>
                                    <FormDescription>
                                      Automatically create system backups
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
                              name="backupSettings.backupFrequency"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Backup Frequency</FormLabel>
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
                                      <SelectItem value="daily">
                                        Daily
                                      </SelectItem>
                                      <SelectItem value="weekly">
                                        Weekly
                                      </SelectItem>
                                      <SelectItem value="monthly">
                                        Monthly
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="backupSettings.retentionDays"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Retention Period (days)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="365"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    How long to keep backup files
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="backupSettings.backupLocation"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Backup Location</FormLabel>
                                  <FormControl>
                                    <Input placeholder="/backups" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    Directory to store backup files
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                              Manual Actions
                            </h3>
                            <Dialog
                              open={showBackupDialog}
                              onOpenChange={setShowBackupDialog}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                  <Download className="mr-2 h-4 w-4" />
                                  Create Manual Backup
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Create System Backup
                                  </DialogTitle>
                                  <DialogDescription>
                                    This will create a complete backup of the
                                    system database and configuration files.
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setShowBackupDialog(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button onClick={handleSystemBackup}>
                                    Create Backup
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={handleClearCache}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Clear System Cache
                            </Button>

                            {systemStats && (
                              <div className="space-y-2">
                                <h4 className="font-medium">
                                  System Statistics
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Database Size:
                                    </span>
                                    <Badge variant="secondary" className="ml-2">
                                      {systemStats.databaseSize || "N/A"}
                                    </Badge>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Cache Size:
                                    </span>
                                    <Badge variant="secondary" className="ml-2">
                                      {systemStats.cacheSize || "N/A"}
                                    </Badge>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Last Backup:
                                    </span>
                                    <Badge variant="secondary" className="ml-2">
                                      {systemStats.lastBackup || "Never"}
                                    </Badge>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Uptime:
                                    </span>
                                    <Badge variant="secondary" className="ml-2">
                                      {systemStats.uptime || "N/A"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="maintenance">
                      <div className="space-y-6">
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Danger Zone</AlertTitle>
                          <AlertDescription>
                            These actions are irreversible and can affect system
                            stability. Use with extreme caution.
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-destructive">
                              Database Reset
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              This will completely reset the database, deleting
                              all data except your admin account. This action
                              cannot be undone.
                            </p>

                            <Dialog
                              open={showResetDialog}
                              onOpenChange={setShowResetDialog}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  className="w-full"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Reset Database
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    Confirm Database Reset
                                  </DialogTitle>
                                  <DialogDescription>
                                    This action will delete all data except your
                                    admin account. Please enter your admin
                                    password to confirm.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="reset-password">
                                      Admin Password
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        id="reset-password"
                                        type={
                                          showResetPassword
                                            ? "text"
                                            : "password"
                                        }
                                        value={resetPassword}
                                        onChange={(e) =>
                                          setResetPassword(e.target.value)
                                        }
                                        placeholder="Enter your admin password"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() =>
                                          setShowResetPassword(
                                            !showResetPassword
                                          )
                                        }
                                      >
                                        {showResetPassword ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setShowResetDialog(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={handleDatabaseReset}
                                  >
                                    Reset Database
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <div className="text-sm text-muted-foreground">
                              <p>⚠️ This will:</p>
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Delete all user accounts (except yours)</li>
                                <li>Delete all transaction data</li>
                                <li>Delete all configuration settings</li>
                                <li>Reset the system to initial state</li>
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-lg font-semibold">
                              System Information
                            </h3>
                            {loadingStats ? (
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading system information...</span>
                              </div>
                            ) : systemStats ? (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    System Version:
                                  </span>
                                  <span>
                                    {systemStats.version || "Unknown"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Node.js Version:
                                  </span>
                                  <span>
                                    {systemStats.nodeVersion || "Unknown"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Database Type:
                                  </span>
                                  <span>
                                    {systemStats.databaseType || "Unknown"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Environment:
                                  </span>
                                  <Badge variant="outline">
                                    {systemStats.environment || "Unknown"}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Memory Usage:
                                  </span>
                                  <span>
                                    {systemStats.memoryUsage || "Unknown"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    CPU Usage:
                                  </span>
                                  <span>
                                    {systemStats.cpuUsage || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-muted-foreground">
                                Unable to load system information
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>

                <div className="mt-6 pt-6 border-t">
                  <Button type="submit" disabled={isSaving} className="w-full">
                    {isSaving && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
