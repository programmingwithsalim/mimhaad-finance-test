"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "transaction" | "system" | "security";
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

interface UserPreferences {
  emailNotifications: boolean;
  emailAddress: string;
  smsNotifications: boolean;
  phoneNumber: string;
  pushNotifications: boolean;
  transactionAlerts: boolean;
  floatThresholdAlerts: boolean;
  systemUpdates: boolean;
  securityAlerts: boolean;
  dailyReports: boolean;
  weeklyReports: boolean;
  loginAlerts: boolean;
  marketingEmails: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  alertFrequency: "immediate" | "hourly" | "daily";
  reportFrequency: "daily" | "weekly" | "monthly";
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/notifications");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      } else {
        console.error("Failed to fetch notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        setUpdating(notificationId);
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "mark-read" }),
        });

        if (response.ok) {
          setNotifications((prev) =>
            prev.map((notification) =>
              notification.id === notificationId
                ? {
                    ...notification,
                    is_read: true,
                    read_at: new Date().toISOString(),
                  }
                : notification
            )
          );
          toast({
            title: "Success",
            description: "Notification marked as read",
          });
          return true;
        } else {
          throw new Error("Failed to mark notification as read");
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to mark notification as read",
          variant: "destructive",
        });
        return false;
      } finally {
        setUpdating(null);
      }
    },
    [toast]
  );

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        setUpdating(notificationId);
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setNotifications((prev) =>
            prev.filter((notification) => notification.id !== notificationId)
          );
          toast({
            title: "Success",
            description: "Notification deleted",
          });
          return true;
        } else {
          throw new Error("Failed to delete notification");
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete notification",
          variant: "destructive",
        });
        return false;
      } finally {
        setUpdating(null);
      }
    },
    [toast]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      setUpdating("all");
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            is_read: true,
            read_at: new Date().toISOString(),
          }))
        );
        toast({
          title: "Success",
          description: data.message,
        });
        return true;
      } else {
        throw new Error("Failed to mark all notifications as read");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
      return false;
    } finally {
      setUpdating(null);
    }
  }, [toast]);

  const deleteAllNotifications = useCallback(async () => {
    try {
      setUpdating("delete-all");
      const response = await fetch("/api/notifications/delete-all", {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications([]);
        toast({
          title: "Success",
          description: data.message,
        });
        return true;
      } else {
        throw new Error("Failed to delete all notifications");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete all notifications",
        variant: "destructive",
      });
      return false;
    } finally {
      setUpdating(null);
    }
  }, [toast]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Load user preferences
  const loadPreferences = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users/notification-settings");
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPreferences(data.data);
        } else {
          console.error("Failed to load preferences:", data.error);
        }
      } else {
        console.error("Failed to fetch preferences");
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save user preferences
  const savePreferences = useCallback(
    async (preferences: UserPreferences, userId: string) => {
      try {
        setIsLoading(true);
        console.log(
          "🔍 [USE-NOTIFICATIONS] Saving preferences for user:",
          userId
        );
        console.log("📋 [USE-NOTIFICATIONS] Preferences data:", preferences);

        const response = await fetch("/api/users/notification-settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preferences),
        });

        console.log("🔍 [USE-NOTIFICATIONS] Response status:", response.status);
        console.log("🔍 [USE-NOTIFICATIONS] Response ok:", response.ok);

        if (response.ok) {
          const data = await response.json();
          console.log("🔍 [USE-NOTIFICATIONS] Response data:", data);

          if (data.success) {
            setPreferences(preferences);
            console.log(
              "✅ [USE-NOTIFICATIONS] Preferences saved successfully"
            );
            return true;
          } else {
            console.error(
              "❌ [USE-NOTIFICATIONS] API returned error:",
              data.error
            );
            throw new Error(data.error || "Failed to save preferences");
          }
        } else {
          const errorText = await response.text();
          console.error(
            "❌ [USE-NOTIFICATIONS] HTTP error:",
            response.status,
            errorText
          );
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      } catch (error) {
        console.error(
          "❌ [USE-NOTIFICATIONS] Error saving preferences:",
          error
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    preferences,
    loading,
    isLoading,
    updating,
    unreadCount,
    fetchNotifications,
    loadPreferences,
    savePreferences,
    markAsRead,
    deleteNotification,
    markAllAsRead,
    deleteAllNotifications,
  };
}
