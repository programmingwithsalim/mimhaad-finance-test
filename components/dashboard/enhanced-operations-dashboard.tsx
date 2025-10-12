"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Receipt,
  Smartphone,
  Banknote,
  CreditCard,
  Zap,
  ShoppingCart,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import Link from "next/link";

interface ServiceStats {
  service: string;
  todayTransactions: number;
  todayVolume: number;
  todayFees: number;
  totalBalance: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
}

interface TotalStats {
  totalTransactions: number;
  totalVolume: number;
  totalCommission: number;
  todayTransactions: number;
  todayVolume: number;
  todayCommission: number;
  recentActivity: Array<{
    id: string;
    type: string;
    service: string;
    amount: number;
    timestamp: string;
    user: string;
  }>;
  floatAlerts: Array<{
    id: string;
    provider: string;
    service: string;
    current_balance: number;
    threshold: number;
    severity: "warning" | "critical";
  }>;
}

interface EnhancedOperationsDashboardProps {
  serviceStats: ServiceStats[];
  totalStats: TotalStats;
}

export function EnhancedOperationsDashboard({
  serviceStats,
  totalStats,
}: EnhancedOperationsDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setIsRefreshing(false);
      window.location.reload();
    }, 1000);
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return <Smartphone className="h-4 w-4" />;
      case "agency_banking":
      case "agency banking":
        return <Banknote className="h-4 w-4" />;
      case "e_zwich":
      case "e-zwich":
        return <CreditCard className="h-4 w-4" />;
      case "power":
        return <Zap className="h-4 w-4" />;
      case "jumia":
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getServiceColor = (service: string) => {
    switch (service.toLowerCase()) {
      case "momo":
        return "text-blue-600";
      case "agency_banking":
      case "agency banking":
        return "text-green-600";
      case "e_zwich":
      case "e-zwich":
        return "text-purple-600";
      case "power":
        return "text-yellow-600";
      case "jumia":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operations Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage daily operations across all services
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Transactions
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.todayTransactions}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {totalStats.totalTransactions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Volume
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalStats.todayVolume)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalStats.totalVolume)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalStats.todayCommission)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalStats.totalCommission)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Float Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.floatAlerts?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Low balance accounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Service Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Service Performance</CardTitle>
            <CardDescription>
              Today's transaction volume by service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serviceStats.map((service) => (
                <div
                  key={service.service}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full bg-gray-100 ${getServiceColor(
                        service.service
                      )}`}
                    >
                      {getServiceIcon(service.service)}
                    </div>
                    <div>
                      <p className="font-medium capitalize">
                        {service.service.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {service.todayTransactions} transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(service.todayVolume)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(service.todayFees)} fees
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common operations tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/momo">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <Smartphone className="h-6 w-6 mb-2" />
                  <span className="text-sm">Mobile Money</span>
                </Button>
              </Link>
              <Link href="/dashboard/agency-banking">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <Banknote className="h-6 w-6 mb-2" />
                  <span className="text-sm">Agency Banking</span>
                </Button>
              </Link>
              <Link href="/dashboard/e-zwich">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <CreditCard className="h-6 w-6 mb-2" />
                  <span className="text-sm">E-Zwich</span>
                </Button>
              </Link>
              <Link href="/dashboard/power">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <Zap className="h-6 w-6 mb-2" />
                  <span className="text-sm">Power</span>
                </Button>
              </Link>
              <Link href="/dashboard/jumia">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <ShoppingCart className="h-6 w-6 mb-2" />
                  <span className="text-sm">Jumia</span>
                </Button>
              </Link>
              <Link href="/dashboard/transactions/all">
                <Button variant="outline" className="w-full h-20 flex-col">
                  <Receipt className="h-6 w-6 mb-2" />
                  <span className="text-sm">All Transactions</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest transactions across all services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {totalStats.recentActivity?.slice(0, 10).map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full bg-gray-100 ${getServiceColor(
                      activity.service
                    )}`}
                  >
                    {getServiceIcon(activity.service)}
                  </div>
                  <div>
                    <p className="font-medium capitalize">
                      {activity.service.replace(/_/g, " ")} - {activity.type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.user} •{" "}
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatCurrency(activity.amount)}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {activity.type}
                  </Badge>
                </div>
              </div>
            ))}
            {(!totalStats.recentActivity ||
              totalStats.recentActivity.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Float Alerts */}
      {totalStats.floatAlerts && totalStats.floatAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Float Alerts
            </CardTitle>
            <CardDescription>Accounts with low balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {totalStats.floatAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 bg-yellow-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full bg-yellow-100 ${getServiceColor(
                        alert.service
                      )}`}
                    >
                      {getServiceIcon(alert.service)}
                    </div>
                    <div>
                      <p className="font-medium">
                        {alert.provider} - {alert.service}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Current: {formatCurrency(alert.current_balance)} |
                        Threshold: {formatCurrency(alert.threshold)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      alert.severity === "critical"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
