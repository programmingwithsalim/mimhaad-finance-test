"use client";

import type React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { TopNavbar } from "@/components/top-navbar";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { RouteGuard } from "@/components/rbac/route-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // If not loading and no user, redirect to login
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="relative h-12 w-12">
            <div className="absolute h-full w-full animate-ping rounded-full bg-primary/10"></div>
            <div className="absolute h-full w-full animate-pulse rounded-full bg-primary/30"></div>
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-primary"></div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if no user
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }



  return (
    <>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <SidebarNavigation />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top Navigation */}
          <TopNavbar />

          {/* Page Content with Route Protection */}
          <main className="flex-1 overflow-auto p-6 w-full">
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
      </div>
    </>
  );
}
