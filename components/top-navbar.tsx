"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  Bell,
  User,
  LogOut,
  Settings,
  Maximize,
  Minimize,
  Sun,
  Moon,
  Building,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotifications } from "@/hooks/use-notifications";

// Mock notification data
const mockNotifications = [
  {
    id: 1,
    title: "System Update",
    message: "The system will be updated at 2:00 AM tonight.",
    timestamp: "2023-06-15T14:30:00",
    read: true,
    type: "system",
  },
  {
    id: 2,
    title: "New User Registered",
    message: "A new user has registered in the system.",
    timestamp: "2023-06-15T12:45:00",
    read: true,
    type: "user",
  },
  {
    id: 3,
    title: "Failed Login Attempt",
    message: "There was a failed login attempt to your account.",
    timestamp: "2023-06-15T10:15:00",
    read: false,
    type: "security",
  },
  {
    id: 4,
    title: "Transaction Approved",
    message: "A transaction of GHS 5,000 has been approved.",
    timestamp: "2023-06-14T16:20:00",
    read: false,
    type: "transaction",
  },
];

export function TopNavbar() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [tempRole, setTempRole] = useState(user?.role || "");
  const [tempBranch, setTempBranch] = useState(user?.branchId || "");

  const {
    notifications,
    isLoading: notificationsLoading,
    markAsRead,
    deleteNotification,
    updating,
  } = useNotifications();

  // Count unread notifications
  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Invalid date";
      }

      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  // Handle theme toggle
  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen: ${e.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
  };

  // Handle profile click
  const handleProfileClick = () => {
    router.push("/profile");
    setUserMenuOpen(false);
  };

  // Handle notification view all click
  const handleViewAllNotifications = () => {
    router.push("/dashboard/notifications");
    setNotificationOpen(false);
  };

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setNotificationOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Check for fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Set mounted state to true after component mounts and set default theme to system
  useEffect(() => {
    setMounted(true);
    // Set default theme to system if not already set
    if (!theme) {
      setTheme("system");
    }
  }, [theme, setTheme]);

  // Don't render theme toggle until after mounting to prevent hydration mismatch
  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Current User Branch Display */}
          <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-1.5 text-sm">
            <Building className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">Loading...</span>
              <span className="text-xs text-muted-foreground">
                Please wait...
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Loading placeholders */}
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-4 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Current User Branch Display */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-1.5 text-sm">
          <Building className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-medium">
              {user?.branchName || "No Branch Assigned"}
            </span>
            <span className="text-xs text-muted-foreground capitalize">
              {user?.role || "User"}{" "}
              {user?.branchType && `• ${user.branchType}`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1"></div>

      <div className="flex items-center gap-2">
        {/* Notification Dropdown */}
        <div ref={notificationRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>

          {notificationOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 rounded-md border bg-background p-2 shadow-lg z-50">
              <div className="flex items-center justify-between p-2">
                <h3 className="font-medium">Notifications</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs"
                  onClick={handleViewAllNotifications}
                >
                  View all
                </Button>
              </div>
              <div className="max-h-[300px] overflow-auto">
                {notificationsLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`group rounded-md p-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 ${
                          notification.is_read ? "" : "bg-muted"
                        }`}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {notification.title}
                          </span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {notification.type}
                            </Badge>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(notification.created_at)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                disabled={updating === notification.id}
                                className="h-6 w-6 p-0 hover:bg-green-100"
                                title="Mark as read"
                              >
                                {updating === notification.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 text-green-600" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              disabled={updating === notification.id}
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                              title="Delete notification"
                            >
                              {updating === notification.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle - Functional on click */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            aria-label="Toggle theme"
            className="relative"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        )}

        {/* Fullscreen Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle fullscreen</span>
        </Button>

        {/* User Profile Menu */}
        <div ref={userMenuRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.avatar || "/abstract-geometric-shapes.png"}
                alt={user?.name || "User"}
              />
              <AvatarFallback>
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                  : "U"}
              </AvatarFallback>
            </Avatar>
          </Button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-md border bg-background p-1 shadow-lg z-50">
              <div className="border-b p-2">
                <p className="font-medium">{user?.firstName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {user?.role}
                </p>
              </div>
              <div className="p-1">
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={handleProfileClick}
                >
                  <User className="h-4 w-4" />
                  <span>User Profile</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={() => router.push("/dashboard/settings")}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
