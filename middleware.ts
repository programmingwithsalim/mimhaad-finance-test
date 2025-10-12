import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getDatabaseSession } from "./lib/database-session-service";
import {
  normalizeRole,
  hasPermission,
  type Role,
  type Permission,
} from "./lib/rbac/unified-rbac";

// Define role-based route restrictions
const ROLE_ROUTE_RESTRICTIONS: Record<
  string,
  { roles: Role[]; permissions?: Permission[] }
> = {
  "/dashboard/admin": { roles: ["Admin"] },
  "/dashboard/user-management": { roles: ["Admin"] },
  "/dashboard/branch-management": { roles: ["Admin"] },
  "/dashboard/gl-accounting": { roles: ["Admin", "Finance"] },
  "/dashboard/audit-trail": { roles: ["Admin", "Manager", "Finance"] },
  "/dashboard/settings": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/dashboard/float-management": { roles: ["Admin", "Manager", "Finance"] },
  "/dashboard/expenses": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/dashboard/commissions": { roles: ["Admin", "Manager", "Finance"] },
  "/dashboard/reports": { roles: ["Admin", "Manager", "Finance"] },
  "/dashboard/analytics": { roles: ["Admin", "Manager", "Finance"] },
  "/dashboard/momo": {
    roles: ["Admin", "Manager", "Operations"],
  },
  "/dashboard/agency-banking": {
    roles: ["Admin", "Manager", "Operations"],
  },
  "/dashboard/e-zwich": {
    roles: ["Admin", "Manager", "Operations"],
  },
  "/dashboard/power": {
    roles: ["Admin", "Manager", "Operations"],
  },
  "/dashboard/jumia": {
    roles: ["Admin", "Manager", "Operations"],
  },
  "/dashboard/inventory": { roles: ["Admin", "Manager", "Finance"] },
  "/dashboard/transactions": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
};

// API route restrictions
const API_ROUTE_RESTRICTIONS: Record<
  string,
  { roles: Role[]; permissions?: Permission[] }
> = {
  "/api/users/notification-settings": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/users": { roles: ["Admin"] },
  "/api/branches": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/branches/statistics": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/branches/search": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/settings": { roles: ["Admin", "Manager", "Finance"] },
  "/api/gl": { roles: ["Admin", "Finance"] },
  "/api/audit-logs": { roles: ["Admin", "Manager", "Finance"] },
  "/api/float-accounts": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/expenses": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/expenses-statistics": {
    roles: ["Admin", "Manager", "Finance", "Operations", "Cashier"],
  },
  "/api/commissions": { roles: ["Admin", "Manager", "Finance"] },
  "/api/reports": { roles: ["Admin", "Manager", "Finance"] },
  "/api/analytics": { roles: ["Admin", "Manager", "Finance"] },
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Log only in development
  const isDev = process.env.NODE_ENV === "development";

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/setup"];
  const publicApiRoutes = [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/check-setup",
    "/api/auth/2fa/verify",
    "/api/auth/2fa/send-otp",
    "/api/auth/2fa/status",
    "/api/auth/login-complete",
    "/api/seed",
    "/api/transactions/all",
    "/api/debug/test-sql",
    "/api/debug/check-ezwich-gl-mappings",
    "/api/debug/fix-ezwich-mappings",
    "/api/db/add-payment-source-to-fixed-assets",
    "/api/db/add-payment-method-to-power-transactions",
    "/api/db/fix-float-account-id-column",
    "/api/db/add-system-config-table",
  ];

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/_next")
  ) {
    return NextResponse.next();
  }

  if (isDev) console.log("Middleware processing:", pathname);

  // Handle API routes
  if (pathname.startsWith("/api/")) {
    // Add CORS headers
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    // Skip auth check for public API routes
    if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
      return response;
    }

    // Check authentication for protected API routes
    try {
      const session = await getDatabaseSession(request);
      if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check role-based access for API routes
      const userRole = normalizeRole(session.user.role);

      if (userRole) {
        // Check if this API route has restrictions
        for (const [route, restriction] of Object.entries(
          API_ROUTE_RESTRICTIONS
        )) {
          if (pathname.startsWith(route)) {
            // Check role restriction
            if (!restriction.roles.includes(userRole)) {
              if (isDev) {
                console.log(
                  `Access denied: ${userRole} cannot access ${pathname}`
                );
              }
              return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            // Check permission restriction if specified
            if (restriction.permissions) {
              const hasRequiredPermission = restriction.permissions.some(
                (permission) => hasPermission(userRole, permission)
              );
              if (!hasRequiredPermission) {
                if (isDev) {
                  console.log(
                    `Permission denied: ${userRole} lacks required permissions for ${pathname}`
                  );
                }
                return NextResponse.json(
                  { error: "Forbidden" },
                  { status: 403 }
                );
              }
            }
            break;
          }
        }
      }

      console.log("Authenticated API request");
      return response;
    } catch (error) {
      console.error("Session check error in middleware:", error);
      return NextResponse.json(
        { error: "Authentication error" },
        { status: 500 }
      );
    }
  }

  // Handle page routes
  try {
    const session = await getDatabaseSession(request);
    console.log("Session check result:", !!session);

    // Debug: Check what cookies are present
    const sessionCookie = request.cookies.get("session_token");
    console.log("Session cookie present:", !!sessionCookie);
    if (sessionCookie) {
      console.log("Session token length:", sessionCookie.value.length);
    }

    // If accessing public routes, allow access
    if (publicRoutes.includes(pathname)) {
      // If user is authenticated and trying to access login page, redirect to dashboard
      if (session && pathname === "/") {
        console.log(
          "Authenticated user accessing login, redirecting to dashboard"
        );
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      console.log("Public route access allowed");
      return NextResponse.next();
    }

    // For protected routes, if no session, redirect to login
    if (!session || !session.user) {
      console.log("No session for protected route, redirecting to login");
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Check role-based access for page routes
    const userRole = normalizeRole(session.user.role);
    if (userRole) {
      // Check if this page route has restrictions
      for (const [route, restriction] of Object.entries(
        ROLE_ROUTE_RESTRICTIONS
      )) {
        if (pathname.startsWith(route)) {
          // Check role restriction
          if (!restriction.roles.includes(userRole)) {
            console.log(`Access denied: ${userRole} cannot access ${pathname}`);
            return NextResponse.redirect(new URL("/unauthorized", request.url));
          }

          // Check permission restriction if specified
          if (restriction.permissions) {
            const hasRequiredPermission = restriction.permissions.some(
              (permission) => hasPermission(userRole, permission)
            );
            if (!hasRequiredPermission) {
              console.log(
                `Permission denied: ${userRole} lacks required permissions for ${pathname}`
              );
              return NextResponse.redirect(
                new URL("/unauthorized", request.url)
              );
            }
          }
          break;
        }
      }
    }

    console.log("Authenticated access to protected route");
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    // On error, redirect to login for safety
    if (!publicRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
