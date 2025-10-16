"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Banknote,
  Receipt,
  Settings,
  FileText,
  Shield,
  Zap,
  ShoppingCart,
  Smartphone,
  Wallet,
  TrendingUp,
  Database,
  Calculator,
  ChevronRight,
  Menu,
  X,
  LogOut,
  CheckCircle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useRBAC } from "@/components/rbac/rbac-provider";
import { normalizeRole, type Role } from "@/lib/rbac/unified-rbac";

// Menu structure organized by functionality with role-based access
const menuItems = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
      },
      {
        title: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        roles: ["Admin", "Manager", "Finance"],
      },
    ],
  },
  {
    title: "Transactions",
    items: [
      {
        title: "All Transactions",
        href: "/dashboard/transactions/all",
        icon: Receipt,
        roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
      },
      {
        title: "Mobile Money",
        href: "/dashboard/momo",
        icon: Smartphone,
        roles: ["Admin", "Manager", "Operations"],
      },
      {
        title: "Agency Banking",
        href: "/dashboard/agency-banking",
        icon: Banknote,
        roles: ["Admin", "Manager", "Operations"],
      },
      {
        title: "E-Zwich",
        href: "/dashboard/e-zwich",
        icon: CreditCard,
        roles: ["Admin", "Manager", "Operations"],
      },
      {
        title: "Power/Utilities",
        href: "/dashboard/power",
        icon: Zap,
        roles: ["Admin", "Manager", "Operations"],
      },
      {
        title: "Jumia Pay",
        href: "/dashboard/jumia",
        icon: ShoppingCart,
        roles: ["Admin", "Manager", "Operations"],
      },
    ],
  },
  {
    title: "Financial Management",
    items: [
      {
        title: "Float Management",
        href: "/dashboard/float-management",
        icon: Wallet,
        roles: ["Admin", "Manager", "Finance"],
      },
      {
        title: "Expenses",
        href: "/dashboard/expenses",
        icon: Receipt,
        roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
      },
      {
        title: "Expense Approvals",
        href: "/dashboard/expenses/approvals",
        icon: CheckCircle,
        roles: ["Admin", "Manager", "Finance"],
      },
      {
        title: "Commissions",
        href: "/dashboard/commissions",
        icon: TrendingUp,
        roles: ["Admin", "Manager", "Finance"],
      },
      {
        title: "GL Accounting",
        href: "/dashboard/gl-accounting",
        icon: Calculator,
        roles: ["Admin", "Finance"],
      },
      {
        title: "Shareholders Fund",
        href: "/dashboard/equity",
        icon: DollarSign,
        roles: ["Admin"], // Shareholders fund management - Admin only
      },
    ],
  },
  {
    title: "Inventory & Assets",
    items: [
      {
        title: "Inventory",
        href: "/dashboard/inventory/e-zwich",
        icon: Database,
        roles: ["Admin", "Manager", "Finance"],
      },
      {
        title: "Fixed Assets",
        href: "/dashboard/inventory/fixed-assets",
        icon: Building2,
        roles: ["Admin", "Manager", "Finance"],
      },
      {
        title: "Jumia Packages",
        href: "/dashboard/jumia/packages",
        icon: ShoppingCart,
        roles: ["Admin", "Manager", "Operations"],
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        title: "User Management",
        href: "/dashboard/user-management",
        icon: Users,
        roles: ["Admin"], // Only admins can access user management
      },
      {
        title: "Branch Management",
        href: "/dashboard/branch-management",
        icon: Building2,
        roles: ["Admin"], // Only admins can access branch management
      },
    ],
  },
  {
    title: "Reports & Analytics",
    items: [
      {
        title: "Reports",
        href: "/dashboard/reports",
        icon: FileText,
        roles: ["Admin", "Manager", "Finance"],
      },
      {
        title: "Audit Trail",
        href: "/dashboard/audit-trail",
        icon: Shield,
        roles: ["Admin", "Manager", "Finance"],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
      },
    ],
  },
];

export function SidebarNavigation() {
  const pathname = usePathname();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { userRole } = useRBAC();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // Check if mobile on initial load
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Auto-expand sections that contain the current active page
  useEffect(() => {
    const newExpandedSections = new Set<string>();

    menuItems.forEach((section) => {
      const hasActiveItem = section.items.some((item) => {
        const hasPermission = userRole ? item.roles.includes(userRole) : false;
        return hasPermission && pathname === item.href;
      });

      if (hasActiveItem) {
        newExpandedSections.add(section.title);
      }
    });

    setExpandedSections(newExpandedSections);
  }, [pathname, userRole]);

  const hasPermission = (roles: Role[]) => {
    // Use RBAC role if available, otherwise fall back to user role from auth
    const effectiveRole =
      userRole || (user?.role ? normalizeRole(user.role) : null);

    const hasAccess = effectiveRole ? roles.includes(effectiveRole) : false;

    return hasAccess;
  };

  // Fallback menu items for when role is not recognized
  const getFallbackMenuItems = () => [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Transactions",
      href: "/dashboard/transactions/all",
      icon: Receipt,
    },
    {
      title: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setMobileOpen(!mobileOpen);
  };

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionTitle)) {
        newSet.delete(sectionTitle);
      } else {
        newSet.add(sectionTitle);
      }
      return newSet;
    });
  };

  const SidebarContent = (
    <div
      className={cn(
        "flex h-full flex-col bg-background border-r transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="MIMHAAD Logo"
              className="w-8 h-8 rounded-full"
            />
            <div>
              <h2 className="text-lg font-bold">MIMHAAD</h2>
              <p className="text-xs text-muted-foreground">
                Financial Services
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <img
              src="/logo.png"
              alt="MIMHAAD Logo"
              className="w-8 h-8 rounded-full"
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isCollapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 p-2">
        {authLoading ? (
          // Show loading state while auth is loading
          <div className="space-y-2 p-4">
            <div className="h-4 bg-muted animate-pulse rounded"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
          </div>
        ) : (
          (() => {
            // Get visible items from menu structure
            const visibleItems = menuItems
              .map((section) => {
                const sectionVisibleItems = section.items.filter((item) =>
                  hasPermission(item.roles as Role[])
                );
                return { ...section, items: sectionVisibleItems };
              })
              .filter((section) => section.items.length > 0);

            // If no role-based items are visible, show fallback items
            if (visibleItems.length === 0) {
              return (
                <div className="space-y-1">
                  {getFallbackMenuItems().map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.title}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-[1.02] min-w-0",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate whitespace-nowrap overflow-hidden">
                          {item.title}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            // Render normal role-based menu
            return visibleItems.map((section) => {
              const isExpanded = expandedSections.has(section.title);
              const hasActiveItem = section.items.some(
                (item) => pathname === item.href
              );

              // In collapsed mode, show all items as icons only
              if (isCollapsed) {
                return (
                  <div key={section.title} className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={item.title}
                          className={cn(
                            "flex items-center justify-center px-2 py-2 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-[1.02] min-w-0",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
                          )}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              // Expanded mode - show sections with expand/collapse
              return (
                <div key={section.title} className="space-y-1">
                  {/* Section Header - Clickable to expand/collapse */}
                  <button
                    onClick={() => toggleSection(section.title)}
                    title={isCollapsed ? section.title : undefined}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-all duration-200 ease-in-out hover:bg-accent/50 min-w-0",
                      hasActiveItem
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                      isCollapsed && "justify-center px-2"
                    )}
                  >
                    <span className="truncate whitespace-nowrap overflow-hidden">
                      {section.title}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-300 ease-in-out flex-shrink-0",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Section Items - Smooth expand/collapse animation */}
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="space-y-1 ml-4 pl-4 border-l-2 border-muted/30">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={isCollapsed ? item.title : undefined}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-[1.02] min-w-0",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
                            )}
                          >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            <span className="truncate whitespace-nowrap overflow-hidden">
                              {item.title}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
      </nav>

      {/* User Info & Logout - fixed at bottom */}
      <div className="border-t p-4 space-y-3">
        {!isCollapsed && user && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {user.firstName?.[0] || user.email?.[0] || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userRole || "User"}
                </p>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className={cn(
            "w-full transition-all duration-200 ease-in-out",
            isCollapsed && "px-2"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="ml-2">Logout</span>}
        </Button>
      </div>
    </div>
  );

  // Mobile sidebar overlay
  if (isMobile) {
    return (
      <>
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMobileSidebar}
          className="fixed top-4 left-4 z-50 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity duration-300"
              onClick={toggleMobileSidebar}
            />
            <div className="fixed left-0 top-0 h-full w-64 transform transition-transform duration-300 ease-in-out">
              {SidebarContent}
            </div>
          </div>
        )}

        {/* Desktop sidebar */}
        <div className="hidden md:block">{SidebarContent}</div>
      </>
    );
  }

  // Desktop sidebar
  return SidebarContent;
}
