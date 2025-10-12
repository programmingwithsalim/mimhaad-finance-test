"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  Camera,
  Check,
  Loader2,
  MapPin,
  Phone,
  Shield,
  Mail,
  UserCheck,
  UserIcon,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TopNavbar } from "@/components/top-navbar";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/hooks/use-notifications";
import { TwoFactorAuthSettings } from "@/components/profile/two-factor-auth-settings";

// Personal information form schema
const personalInfoSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  phone: z
    .string()
    .min(10, { message: "Phone number must be at least 10 digits." }),
});

// Password change form schema
const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: "Current password is required." }),
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .regex(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter.",
      })
      .regex(/[a-z]/, {
        message: "Password must contain at least one lowercase letter.",
      })
      .regex(/[0-9]/, {
        message: "Password must contain at least one number.",
      }),
    confirmPassword: z
      .string()
      .min(1, { message: "Please confirm your password." }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// Notification settings schema
const notificationSchema = z.object({
  emailNotifications: z.boolean().default(true),
  emailAddress: z.string().email().optional().or(z.literal("")),
  smsNotifications: z.boolean().default(false),
  phoneNumber: z.string().optional(),
  pushNotifications: z.boolean().default(true),
  transactionAlerts: z.boolean().default(true),
  floatThresholdAlerts: z.boolean().default(true),
  systemUpdates: z.boolean().default(true),
  securityAlerts: z.boolean().default(true),
  dailyReports: z.boolean().default(false),
  weeklyReports: z.boolean().default(false),
  loginAlerts: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().default("22:00"),
  quietHoursEnd: z.string().default("08:00"),
  alertFrequency: z.enum(["immediate", "hourly", "daily"]).default("immediate"),
  reportFrequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
});

type PersonalInfoValues = z.infer<typeof personalInfoSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type NotificationValues = z.infer<typeof notificationSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState("personal-info");
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Set active tab based on URL parameter
  useEffect(() => {
    if (tabParam) {
      const validTabs = ["personal-info", "security", "notifications"];
      if (validTabs.includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam]);

  // Get user from auth context
  const { user, isLoading: authLoading, updateUser } = useAuth();

  console.log("Userrrrrr", user);

  // Use notification hook
  const {
    preferences,
    isLoading: notificationLoading,
    loadPreferences,
    savePreferences,
  } = useNotifications();

  // Set profile image from user data
  useEffect(() => {
    if (user?.avatar) {
      setProfileImage(user.avatar);
    } else {
      setProfileImage("/abstract-geometric-shapes.png");
    }
  }, [user]);

  // Load notification preferences when user is available
  useEffect(() => {
    if (user?.id) {
      loadPreferences(user.id);
    }
  }, [user?.id, loadPreferences]);

  // Personal info form
  const personalInfoForm = useForm<PersonalInfoValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      personalInfoForm.reset({
        fullName:
          user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user, personalInfoForm]);

  // Password change form
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Notification settings form
  const notificationForm = useForm<NotificationValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      emailAddress: "",
      smsNotifications: false,
      phoneNumber: "",
      pushNotifications: true,
      transactionAlerts: true,
      floatThresholdAlerts: true,
      systemUpdates: true,
      securityAlerts: true,
      dailyReports: false,
      weeklyReports: false,
      loginAlerts: true,
      marketingEmails: false,
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      alertFrequency: "immediate",
      reportFrequency: "weekly",
    },
  });

  // Update notification form when preferences load
  useEffect(() => {
    if (preferences) {
      notificationForm.reset({
        emailNotifications: preferences.emailNotifications,
        emailAddress: preferences.emailAddress || user?.email || "",
        smsNotifications: preferences.smsNotifications,
        phoneNumber: preferences.phoneNumber || user?.phone || "",
        pushNotifications: preferences.pushNotifications,
        transactionAlerts: preferences.transactionAlerts,
        floatThresholdAlerts: preferences.floatThresholdAlerts,
        systemUpdates: preferences.systemUpdates,
        securityAlerts: preferences.securityAlerts,
        dailyReports: preferences.dailyReports,
        weeklyReports: preferences.weeklyReports,
        loginAlerts: preferences.loginAlerts,
        marketingEmails: preferences.marketingEmails,
        quietHoursEnabled: preferences.quietHoursEnabled,
        quietHoursStart: preferences.quietHoursStart,
        quietHoursEnd: preferences.quietHoursEnd,
        alertFrequency: preferences.alertFrequency,
        reportFrequency: preferences.reportFrequency,
      });
    }
  }, [preferences, user, notificationForm]);

  // Handle personal info update
  const onPersonalInfoSubmit = async (data: PersonalInfoValues) => {
    setIsUpdatingInfo(true);
    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: data.fullName,
          email: data.email,
          phone: data.phone,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Update user in context with the returned data
        updateUser({
          ...result.user,
          name: data.fullName,
          email: data.email,
          phone: data.phone,
        });

        toast({
          title: "Profile updated",
          description:
            "Your personal information has been updated successfully.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error updating your profile.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingInfo(false);
    }
  };

  // Handle password change
  const onPasswordSubmit = async (data: PasswordValues) => {
    setIsChangingPassword(true);
    try {
      const response = await fetch(`/api/users/${user?.id}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      if (response.ok) {
        toast({
          title: "Password changed",
          description: "Your password has been changed successfully.",
        });

        // Reset form
        passwordForm.reset({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to change password");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error changing your password.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle notification settings update
  const onNotificationSubmit = async (data: NotificationValues) => {
    try {
      const success = await savePreferences(data, user?.id);

      if (success) {
        toast({
          title: "Notification settings updated",
          description:
            "Your notification preferences have been updated successfully.",
        });
      } else {
        throw new Error("Failed to save preferences");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error updating your notification settings.",
        variant: "destructive",
      });
    }
  };

  // Handle profile image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 2MB.",
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save profile image
  const saveProfileImage = async () => {
    if (!previewImage) return;

    setIsUploadingImage(true);
    try {
      // Use the base64 upload endpoint for better handling
      const uploadResponse = await fetch(
        `/api/users/${user?.id}/upload-avatar-base64`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            imageData: previewImage,
          }),
        }
      );

      if (uploadResponse.ok) {
        const result = await uploadResponse.json();

        // Update profile image with the uploaded image data for immediate display
        setProfileImage(result.avatar);
        setPreviewImage(null);

        // Update user in context
        updateUser({ avatar: result.avatar });

        toast({
          title: "Profile picture updated",
          description: "Your profile picture has been updated successfully.",
        });
      } else {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Failed to upload avatar");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "There was an error updating your profile picture.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Cancel profile image upload
  const cancelImageUpload = () => {
    setPreviewImage(null);
  };

  // Get role badge color
  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      case "supervisor":
        return "secondary";
      case "cashier":
        return "outline";
      default:
        return "outline";
    }
  };

  // Get user initials
  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Redirect if no user
  if (!user) {
    router.push("/");
    return null;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <TopNavbar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNavigation />
        <div className="flex-1 overflow-auto">
          <main className="w-full p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                      User Profile
                    </h1>
                    <p className="text-muted-foreground mt-2">
                      View and manage your profile information and preferences
                    </p>
                  </div>
                  <Badge
                    variant={getRoleBadgeVariant(user?.role || "")}
                    className="flex items-center gap-1"
                  >
                    <Shield className="h-3 w-3" />
                    {user?.role || "User"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-4">
                {/* Profile Sidebar */}
                <div className="lg:col-span-1">
                  <Card>
                    <CardContent className="p-6">
                      {/* Profile Picture */}
                      <div className="text-center mb-6">
                        <div className="relative mx-auto mb-4 h-24 w-24">
                          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                            <AvatarImage
                              src={previewImage || profileImage || ""}
                              alt="Profile"
                            />
                            <AvatarFallback className="text-xl font-semibold">
                              {getUserInitials()}
                            </AvatarFallback>
                          </Avatar>
                          <label
                            htmlFor="profile-image"
                            className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transition-colors"
                          >
                            <Camera className="h-4 w-4" />
                            <span className="sr-only">
                              Upload profile picture
                            </span>
                            <input
                              id="profile-image"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                            />
                          </label>
                        </div>

                        <h3 className="font-semibold text-xl">
                          {user?.name ||
                            `${user?.firstName || ""} ${
                              user?.lastName || ""
                            }`.trim() ||
                            "User Name"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {user?.email || "user@example.com"}
                        </p>

                        {previewImage && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium">
                              Preview new picture
                            </p>
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                onClick={saveProfileImage}
                                disabled={isUploadingImage}
                              >
                                {isUploadingImage ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="mr-2 h-3 w-3" />
                                )}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelImageUpload}
                                disabled={isUploadingImage}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator className="mb-6" />

                      {/* User Info */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">Role</h4>
                            <Badge
                              variant={getRoleBadgeVariant(user?.role || "")}
                              className="mt-1 text-xs"
                            >
                              {user?.role || "User"}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">Branch</h4>
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {user?.branchName || "No Branch Assigned"}
                            </p>
                            {user?.branchType && (
                              <p className="text-xs text-muted-foreground capitalize">
                                {user.branchType}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">Email</h4>
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {user?.email || "Not provided"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">Phone</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {user?.phone || "Not provided"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium">User ID</h4>
                            <p className="text-sm text-muted-foreground mt-1 font-mono">
                              {user?.id || "Unknown"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Profile Content */}
                <div className="lg:col-span-3">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger
                        value="personal-info"
                        className="flex items-center gap-2"
                      >
                        <UserIcon className="h-4 w-4" />
                        Personal Info
                      </TabsTrigger>
                      <TabsTrigger
                        value="security"
                        className="flex items-center gap-2"
                      >
                        <Lock className="h-4 w-4" />
                        Security
                      </TabsTrigger>
                      <TabsTrigger
                        value="notifications"
                        className="flex items-center gap-2"
                      >
                        <Bell className="h-4 w-4" />
                        Notifications
                      </TabsTrigger>
                    </TabsList>

                    {/* Personal Information Tab */}
                    <TabsContent value="personal-info" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Personal Information</CardTitle>
                          <CardDescription>
                            Update your personal information and contact details
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Form {...personalInfoForm}>
                            <form
                              id="personal-info-form"
                              onSubmit={personalInfoForm.handleSubmit(
                                onPersonalInfoSubmit
                              )}
                              className="space-y-6"
                            >
                              <FormField
                                control={personalInfoForm.control}
                                name="fullName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        placeholder="Enter your full name"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={personalInfoForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="email"
                                        placeholder="Enter your email address"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={personalInfoForm.control}
                                name="phone"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        type="tel"
                                        placeholder="Enter your phone number"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </form>
                          </Form>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button
                            type="submit"
                            form="personal-info-form"
                            disabled={isUpdatingInfo}
                          >
                            {isUpdatingInfo && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Changes
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>

                    {/* Security Tab */}
                    <TabsContent value="security" className="mt-6">
                      <div className="space-y-6">
                        {/* Two-Factor Authentication Section */}
                        <TwoFactorAuthSettings />

                        {/* Change Password Section */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>
                              Update your password to keep your account secure
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <Form {...passwordForm}>
                              <form
                                id="password-form"
                                onSubmit={passwordForm.handleSubmit(
                                  onPasswordSubmit
                                )}
                                className="space-y-6"
                              >
                                <FormField
                                  control={passwordForm.control}
                                  name="currentPassword"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Current Password</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="password"
                                          placeholder="Enter your current password"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={passwordForm.control}
                                  name="newPassword"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>New Password</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="password"
                                          placeholder="Enter your new password"
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Password must be at least 8 characters
                                        and include uppercase, lowercase, and
                                        numbers.
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={passwordForm.control}
                                  name="confirmPassword"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>
                                        Confirm New Password
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="password"
                                          placeholder="Confirm your new password"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </form>
                            </Form>
                          </CardContent>
                          <CardFooter className="flex justify-end">
                            <Button
                              type="submit"
                              form="password-form"
                              disabled={isChangingPassword}
                            >
                              {isChangingPassword && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Change Password
                            </Button>
                          </CardFooter>
                        </Card>
                      </div>
                    </TabsContent>

                    {/* Notifications Tab */}
                    <TabsContent value="notifications" className="mt-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Notification Settings</CardTitle>
                          <CardDescription>
                            Manage how you receive notifications
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Form {...notificationForm}>
                            <form
                              id="notification-form"
                              onSubmit={notificationForm.handleSubmit(
                                onNotificationSubmit
                              )}
                              className="space-y-6"
                            >
                              <div className="space-y-4">
                                <h3 className="text-lg font-medium">
                                  Notification Channels
                                </h3>
                                <div className="space-y-2">
                                  <FormField
                                    control={notificationForm.control}
                                    name="emailNotifications"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Email Notifications
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

                                  {notificationForm.watch(
                                    "emailNotifications"
                                  ) && (
                                    <FormField
                                      control={notificationForm.control}
                                      name="emailAddress"
                                      render={({ field }) => (
                                        <FormItem className="ml-4">
                                          <FormLabel>Email Address</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              type="email"
                                              placeholder="Enter email address"
                                            />
                                          </FormControl>
                                          <FormDescription>
                                            Leave blank to use your profile
                                            email
                                          </FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  )}

                                  <FormField
                                    control={notificationForm.control}
                                    name="smsNotifications"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            SMS Notifications
                                          </FormLabel>
                                          <FormDescription>
                                            Receive notifications via SMS
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

                                  {notificationForm.watch(
                                    "smsNotifications"
                                  ) && (
                                    <FormField
                                      control={notificationForm.control}
                                      name="phoneNumber"
                                      render={({ field }) => (
                                        <FormItem className="ml-4">
                                          <FormLabel>Phone Number</FormLabel>
                                          <FormControl>
                                            <Input
                                              {...field}
                                              type="tel"
                                              placeholder="Enter phone number"
                                            />
                                          </FormControl>
                                          <FormDescription>
                                            Leave blank to use your profile
                                            phone number
                                          </FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  )}

                                  <FormField
                                    control={notificationForm.control}
                                    name="pushNotifications"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Push Notifications
                                          </FormLabel>
                                          <FormDescription>
                                            Receive push notifications in the
                                            app
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

                              <Separator />

                              <div className="space-y-4">
                                <h3 className="text-lg font-medium">
                                  Notification Types
                                </h3>
                                <div className="space-y-2">
                                  <FormField
                                    control={notificationForm.control}
                                    name="transactionAlerts"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Transaction Alerts
                                          </FormLabel>
                                          <FormDescription>
                                            Get notified about transaction
                                            activities
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
                                    control={notificationForm.control}
                                    name="floatThresholdAlerts"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Float Threshold Alerts
                                          </FormLabel>
                                          <FormDescription>
                                            Get notified when float levels are
                                            low
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
                                    control={notificationForm.control}
                                    name="securityAlerts"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Security Alerts
                                          </FormLabel>
                                          <FormDescription>
                                            Get notified about security events
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
                                    control={notificationForm.control}
                                    name="loginAlerts"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Login Alerts
                                          </FormLabel>
                                          <FormDescription>
                                            Get notified about login activities
                                            on your account
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
                                    control={notificationForm.control}
                                    name="systemUpdates"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            System Updates
                                          </FormLabel>
                                          <FormDescription>
                                            Get notified about system updates
                                            and maintenance
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
                                    control={notificationForm.control}
                                    name="dailyReports"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Daily Reports
                                          </FormLabel>
                                          <FormDescription>
                                            Receive daily activity reports
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
                                    control={notificationForm.control}
                                    name="weeklyReports"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Weekly Reports
                                          </FormLabel>
                                          <FormDescription>
                                            Receive weekly summary reports
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
                                    control={notificationForm.control}
                                    name="marketingEmails"
                                    render={({ field }) => (
                                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">
                                            Marketing Emails
                                          </FormLabel>
                                          <FormDescription>
                                            Receive marketing and promotional
                                            emails
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

                              <Separator />

                              <div className="space-y-4">
                                <h3 className="text-lg font-medium">
                                  Timing & Frequency
                                </h3>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <FormField
                                    control={notificationForm.control}
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
                                            <SelectItem value="immediate">
                                              Immediate
                                            </SelectItem>
                                            <SelectItem value="hourly">
                                              Hourly
                                            </SelectItem>
                                            <SelectItem value="daily">
                                              Daily
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormDescription>
                                          How often to receive alert
                                          notifications
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={notificationForm.control}
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
                                        <FormDescription>
                                          How often to receive report
                                          notifications
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <FormField
                                  control={notificationForm.control}
                                  name="quietHoursEnabled"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">
                                          Quiet Hours
                                        </FormLabel>
                                        <FormDescription>
                                          Suppress non-critical notifications
                                          during specified hours
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

                                {notificationForm.watch(
                                  "quietHoursEnabled"
                                ) && (
                                  <div className="grid gap-4 md:grid-cols-2 ml-4">
                                    <FormField
                                      control={notificationForm.control}
                                      name="quietHoursStart"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>
                                            Quiet Hours Start
                                          </FormLabel>
                                          <FormControl>
                                            <Input {...field} type="time" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={notificationForm.control}
                                      name="quietHoursEnd"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Quiet Hours End</FormLabel>
                                          <FormControl>
                                            <Input {...field} type="time" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                )}
                              </div>
                            </form>
                          </Form>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          <Button
                            type="submit"
                            form="notification-form"
                            disabled={notificationLoading}
                          >
                            {notificationLoading && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Preferences
                          </Button>
                        </CardFooter>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
