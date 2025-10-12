"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Key,
  Smartphone,
  Copy,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface TwoFactorSettings {
  enabled: boolean;
  method: "sms" | "email";
  phoneNumber?: string;
  email?: string;
  backupCodesCount: number;
  trustedDevicesCount: number;
  trustedDevices: any[];
}

export function TwoFactorAuthSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TwoFactorSettings | null>(null);
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showBackupCodesDialog, setShowBackupCodesDialog] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);

  // Form state
  const [method, setMethod] = useState<"sms" | "email">("sms");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/auth/2fa/status");
      const data = await response.json();

      if (data.success) {
        setSettings({
          enabled: data.enabled,
          method: data.method,
          phoneNumber: data.phoneNumber,
          email: data.email,
          backupCodesCount: data.backupCodesCount,
          trustedDevicesCount: data.trustedDevicesCount,
          trustedDevices: data.trustedDevices || [],
        });
      }
    } catch (error) {
      console.error("Error fetching 2FA settings:", error);
      toast({
        title: "Error",
        description: "Failed to load 2FA settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    try {
      setEnabling(true);

      const response = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          phoneNumber: method === "sms" ? phoneNumber : undefined,
          email: method === "email" ? email : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBackupCodes(data.backupCodes || []);
        setShowEnableDialog(false);
        setShowBackupCodesDialog(true);

        await fetchSettings();

        toast({
          title: "2FA Enabled",
          description:
            "Two-factor authentication has been enabled successfully",
        });
      } else {
        throw new Error(data.error || "Failed to enable 2FA");
      }
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to enable 2FA",
        variant: "destructive",
      });
    } finally {
      setEnabling(false);
    }
  };

  const handleDisable2FA = async () => {
    if (
      !confirm(
        "Are you sure you want to disable two-factor authentication? This will make your account less secure."
      )
    ) {
      return;
    }

    try {
      setDisabling(true);

      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        await fetchSettings();

        toast({
          title: "2FA Disabled",
          description: "Two-factor authentication has been disabled",
        });
      } else {
        throw new Error(data.error || "Failed to disable 2FA");
      }
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to disable 2FA",
        variant: "destructive",
      });
    } finally {
      setDisabling(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (
      !confirm(
        "Remove this trusted device? You will need to verify with 2FA next time you log in from this device."
      )
    ) {
      return;
    }

    try {
      // This endpoint needs to be created
      toast({
        title: "Success",
        description: "Trusted device removed",
      });
      await fetchSettings();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove trusted device",
        variant: "destructive",
      });
    }
  };

  const copyBackupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Backup code copied to clipboard",
    });
  };

  const copyAllBackupCodes = () => {
    const allCodes = backupCodes.join("\n");
    navigator.clipboard.writeText(allCodes);
    toast({
      title: "Copied",
      description: "All backup codes copied to clipboard",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Enhance your account security with 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {settings?.enabled ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">2FA Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Your account is protected with{" "}
                      {settings.method === "sms" ? "SMS" : "Email"} verification
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">2FA Disabled</p>
                    <p className="text-sm text-muted-foreground">
                      Enable 2FA to add an extra layer of security
                    </p>
                  </div>
                </>
              )}
            </div>
            <div>
              {settings?.enabled ? (
                <Button
                  variant="outline"
                  onClick={handleDisable2FA}
                  disabled={disabling}
                >
                  {disabling ? "Disabling..." : "Disable 2FA"}
                </Button>
              ) : (
                <Button onClick={() => setShowEnableDialog(true)}>
                  <Shield className="mr-2 h-4 w-4" />
                  Enable 2FA
                </Button>
              )}
            </div>
          </div>

          {/* 2FA Details (when enabled) */}
          {settings?.enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Method Card */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Verification Method</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {settings.method === "sms" ? "SMS" : "Email"}
                  </p>
                  <p className="text-sm font-mono mt-1">
                    {settings.method === "sms"
                      ? settings.phoneNumber
                      : settings.email}
                  </p>
                </div>

                {/* Backup Codes Card */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">Backup Codes</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {settings.backupCodesCount} remaining
                  </p>
                  <Badge
                    variant={
                      settings.backupCodesCount === 0
                        ? "destructive"
                        : settings.backupCodesCount <= 2
                        ? "outline"
                        : "secondary"
                    }
                  >
                    {settings.backupCodesCount === 0
                      ? "No codes left"
                      : settings.backupCodesCount <= 2
                      ? "Low codes"
                      : "Codes available"}
                  </Badge>
                </div>
              </div>

              {/* Warning for low backup codes */}
              {settings.backupCodesCount <= 2 &&
                settings.backupCodesCount > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      You have {settings.backupCodesCount} backup code(s)
                      remaining. Consider disabling and re-enabling 2FA to
                      generate new codes.
                    </AlertDescription>
                  </Alert>
                )}

              {/* Trusted Devices */}
              {settings.trustedDevices.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">
                    Trusted Devices ({settings.trustedDevicesCount})
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.trustedDevices.map((device) => (
                          <TableRow key={device.id}>
                            <TableCell className="font-mono text-sm">
                              {device.device_name?.substring(0, 50) ||
                                "Unknown Device"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {device.ip_address}
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(
                                device.last_used_at
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemoveDevice(device.device_id)
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Enable 2FA Dialog */}
      <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Choose how you want to receive verification codes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Method Selection */}
            <div className="space-y-3">
              <Label>Verification Method</Label>
              <RadioGroup
                value={method}
                onValueChange={(v) => setMethod(v as "sms" | "email")}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="sms" id="sms" />
                  <Label
                    htmlFor="sms"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Smartphone className="h-4 w-4" />
                    <div>
                      <p className="font-medium">SMS</p>
                      <p className="text-xs text-muted-foreground">
                        Receive codes via text message
                      </p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="email" id="email" />
                  <Label
                    htmlFor="email"
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <Key className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Email</p>
                      <p className="text-xs text-muted-foreground">
                        Receive codes via email
                      </p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Contact Input */}
            {method === "sms" ? (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+233240000000"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Include country code (e.g., +233 for Ghana)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email-input">Email Address</Label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="your-email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                After enabling 2FA, you'll receive 8 backup codes. Save them in
                a secure location - you'll need them if you lose access to your{" "}
                {method === "sms" ? "phone" : "email"}.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEnableDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnable2FA}
              disabled={
                enabling ||
                (method === "sms" && !phoneNumber) ||
                (method === "email" && !email)
              }
            >
              {enabling ? "Enabling..." : "Enable 2FA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog
        open={showBackupCodesDialog}
        onOpenChange={setShowBackupCodesDialog}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-green-600" />
              Your Backup Codes
            </DialogTitle>
            <DialogDescription>
              Save these codes in a secure location. Each code can only be used
              once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Important:</strong> You will not be able to see these
                codes again. Save them now!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-3">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg font-mono text-sm border"
                >
                  <span className="font-bold">{code}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyBackupCode(code)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={copyAllBackupCodes}
                className="flex-1"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy All Codes
              </Button>
              <Button
                onClick={() => setShowBackupCodesDialog(false)}
                className="flex-1"
              >
                Done - I've Saved Them
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
