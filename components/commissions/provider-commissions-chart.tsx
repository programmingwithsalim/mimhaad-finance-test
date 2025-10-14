"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type TimeRange = "3months" | "6months" | "12months";

interface MonthlyCommissionData {
  month: string;
  [provider: string]: string | number;
}

interface ProviderTotal {
  provider: string;
  total: number;
  color: string;
}

interface ProviderCommissionsChartProps {
  className?: string;
}

// Define colors for different providers
const PROVIDER_COLORS = [
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#f97316", // orange
];

export function ProviderCommissionsChart({
  className,
}: ProviderCommissionsChartProps) {
  const [chartData, setChartData] = useState<MonthlyCommissionData[]>([]);
  const [providerTotals, setProviderTotals] = useState<ProviderTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("6months");

  useEffect(() => {
    fetchCommissionData();
  }, [timeRange]);

  const fetchCommissionData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(
        "[COMMISSION CHART] Fetching commission data for time range:",
        timeRange
      );

      const months =
        timeRange === "3months" ? 3 : timeRange === "6months" ? 6 : 12;

      const response = await fetch(
        `/api/commissions/analytics?months=${months}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch commission data: ${response.status}`);
      }

      const data = await response.json();
      console.log("[COMMISSION CHART] Received data:", data);

      if (data.success && data.data) {
        setChartData(data.data.monthlyData || []);
        setProviderTotals(data.data.providerTotals || []);
      } else {
        throw new Error(data.error || "Failed to load commission analytics");
      }
    } catch (err) {
      console.error("[COMMISSION CHART] Error fetching data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load commission data"
      );
    } finally {
      setLoading(false);
    }
  };

  // Get time range label
  const getTimeRangeLabel = (range: TimeRange): string => {
    switch (range) {
      case "3months":
        return "Last 3 Months";
      case "6months":
        return "Last 6 Months";
      case "12months":
        return "Last 12 Months";
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Create chart config for recharts
  const chartConfig = React.useMemo(() => {
    const config: any = {};
    providerTotals.forEach((provider, index) => {
      config[provider.provider] = {
        label: provider.provider,
        color: PROVIDER_COLORS[index % PROVIDER_COLORS.length],
      };
    });
    return config;
  }, [providerTotals]);

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Provider Commission Trends
          </CardTitle>
          <CardDescription>
            Commission comparison across providers over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading chart data</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCommissionData}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Provider Commission Trends
            </CardTitle>
            <CardDescription>
              {loading
                ? "Loading commission analytics..."
                : `Commission comparison across providers over ${getTimeRangeLabel(
                    timeRange
                  ).toLowerCase()}`}
            </CardDescription>
          </div>

          <Tabs
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <TabsList className="h-8">
              <TabsTrigger value="3months" className="text-xs px-2">
                3M
              </TabsTrigger>
              <TabsTrigger value="6months" className="text-xs px-2">
                6M
              </TabsTrigger>
              <TabsTrigger value="12months" className="text-xs px-2">
                12M
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Skeleton className="h-full w-full rounded-md" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">
                No Commission Data
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                No commission records found for the selected time period.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis
                    dataKey="month"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name,
                    ]}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  {providerTotals.map((provider, index) => (
                    <Line
                      key={provider.provider}
                      type="monotone"
                      dataKey={provider.provider}
                      stroke={PROVIDER_COLORS[index % PROVIDER_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Provider totals summary */}
            {providerTotals.length > 0 && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {providerTotals.map((provider, index) => (
                  <div
                    key={provider.provider}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          PROVIDER_COLORS[index % PROVIDER_COLORS.length],
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {provider.provider}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(provider.total)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
