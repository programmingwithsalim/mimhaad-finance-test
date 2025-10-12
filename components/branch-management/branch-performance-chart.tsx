"use client"

import { useState, useEffect } from "react"
import { Bar } from "react-chartjs-2"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BranchPerformanceChartProps {
  className?: string
}

type MetricType = "transactions" | "revenue" | "float" | "expenses"
type TimeRange = "month" | "quarter" | "year"

interface BranchPerformance {
  id: string
  name: string
  transactions: number
  revenue: number
  float: number
  expenses: number
}

export function BranchPerformanceChart({ className }: BranchPerformanceChartProps) {
  const [branchData, setBranchData] = useState<BranchPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<MetricType>("transactions")
  const [timeRange, setTimeRange] = useState<TimeRange>("month")
  const [limit, setLimit] = useState<number>(5)

  useEffect(() => {
    fetchBranchPerformance()
  }, [metric, timeRange])

  const fetchBranchPerformance = async () => {
    setLoading(true)
    setError(null)

    try {
      // In a real implementation, we would fetch from an API with the parameters
      // For now, we'll generate mock data
      const mockData = generateMockBranchData()
      setBranchData(mockData)
    } catch (err) {
      console.error("Error fetching branch performance data:", err)
      setError(err instanceof Error ? err.message : "Failed to load branch performance data")
    } finally {
      setLoading(false)
    }
  }

  // Generate mock data for demonstration
  const generateMockBranchData = (): BranchPerformance[] => {
    const branchNames = [
      "Accra Main",
      "Kumasi Central",
      "Takoradi",
      "Tamale",
      "Cape Coast",
      "Tema",
      "Koforidua",
      "Sunyani",
      "Ho",
      "Wa",
    ]

    return branchNames.map((name, index) => {
      // Generate realistic but random performance metrics
      // Add some correlation between metrics (e.g., higher transactions often mean higher revenue)
      const transactionBase = 1000 + Math.random() * 2000
      const transactionMultiplier = timeRange === "month" ? 1 : timeRange === "quarter" ? 3 : 12

      const transactions = Math.round(transactionBase * transactionMultiplier * (1 + Math.random() * 0.5))
      const revenuePerTransaction = 50 + Math.random() * 30
      const revenue = Math.round(transactions * revenuePerTransaction)
      const float = Math.round((50000 + Math.random() * 100000) * (1 + (index % 3) * 0.2))
      const expenses = Math.round(revenue * (0.3 + Math.random() * 0.2))

      return {
        id: `branch-${index + 1}`,
        name,
        transactions,
        revenue,
        float,
        expenses,
      }
    })
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Get metric label
  const getMetricLabel = (metricType: MetricType): string => {
    switch (metricType) {
      case "transactions":
        return "Transaction Count"
      case "revenue":
        return "Revenue"
      case "float":
        return "Float Balance"
      case "expenses":
        return "Expenses"
    }
  }

  // Get time range label
  const getTimeRangeLabel = (range: TimeRange): string => {
    switch (range) {
      case "month":
        return "This Month"
      case "quarter":
        return "This Quarter"
      case "year":
        return "This Year"
    }
  }

  // Sort branches by the selected metric
  const sortedBranches = [...branchData].sort((a, b) => b[metric] - a[metric]).slice(0, limit)

  // Prepare chart data
  const chartData = {
    labels: sortedBranches.map((branch) => branch.name),
    datasets: [
      {
        label: getMetricLabel(metric),
        data: sortedBranches.map((branch) => branch[metric]),
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)", // indigo-500
          "rgba(34, 197, 94, 0.8)", // green-500
          "rgba(249, 115, 22, 0.8)", // orange-500
          "rgba(236, 72, 153, 0.8)", // pink-500
          "rgba(59, 130, 246, 0.8)", // blue-500
          "rgba(139, 92, 246, 0.8)", // violet-500
          "rgba(234, 179, 8, 0.8)", // yellow-500
          "rgba(14, 165, 233, 0.8)", // sky-500
          "rgba(168, 85, 247, 0.8)", // purple-500
          "rgba(239, 68, 68, 0.8)", // red-500
        ],
        borderColor: "white",
        borderWidth: 1,
      },
    ],
  }

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw
            if (metric === "transactions") {
              return `${value.toLocaleString()} transactions`
            } else {
              return formatCurrency(value)
            }
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            if (metric === "transactions") {
              return value.toLocaleString()
            } else {
              return formatCurrency(value)
            }
          },
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Branch Performance</CardTitle>
          <CardDescription>Comparing branch performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading chart data</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchBranchPerformance} className="mt-2">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle>Branch Performance</CardTitle>
            <CardDescription>
              {loading
                ? "Loading branch performance data..."
                : `Top ${limit} branches by ${getMetricLabel(metric).toLowerCase()} for ${getTimeRangeLabel(timeRange).toLowerCase()}`}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Tabs value={metric} onValueChange={(value) => setMetric(value as MetricType)}>
              <TabsList className="h-8">
                <TabsTrigger value="transactions" className="text-xs px-2">
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="revenue" className="text-xs px-2">
                  Revenue
                </TabsTrigger>
                <TabsTrigger value="float" className="text-xs px-2">
                  Float
                </TabsTrigger>
                <TabsTrigger value="expenses" className="text-xs px-2">
                  Expenses
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <TabsList className="h-8">
                <TabsTrigger value="month" className="text-xs px-2">
                  Month
                </TabsTrigger>
                <TabsTrigger value="quarter" className="text-xs px-2">
                  Quarter
                </TabsTrigger>
                <TabsTrigger value="year" className="text-xs px-2">
                  Year
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={limit.toString()} onValueChange={(value) => setLimit(Number.parseInt(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Show top branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5 Branches</SelectItem>
              <SelectItem value="10">Top 10 Branches</SelectItem>
              <SelectItem value="15">Top 15 Branches</SelectItem>
              <SelectItem value="20">Top 20 Branches</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="h-[350px] flex items-center justify-center">
            <Skeleton className="h-full w-full rounded-md" />
          </div>
        ) : (
          <div className="h-[350px] relative">
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}

        {!loading && branchData.length > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex flex-col p-2 border rounded-md">
              <span className="text-xs text-muted-foreground">Total {getMetricLabel(metric)}</span>
              <span className="text-lg font-bold">
                {metric === "transactions"
                  ? branchData.reduce((sum, branch) => sum + branch.transactions, 0).toLocaleString()
                  : formatCurrency(branchData.reduce((sum, branch) => sum + branch[metric], 0))}
              </span>
            </div>
            <div className="flex flex-col p-2 border rounded-md">
              <span className="text-xs text-muted-foreground">Average per Branch</span>
              <span className="text-lg font-bold">
                {metric === "transactions"
                  ? Math.round(
                      branchData.reduce((sum, branch) => sum + branch.transactions, 0) / branchData.length,
                    ).toLocaleString()
                  : formatCurrency(
                      Math.round(branchData.reduce((sum, branch) => sum + branch[metric], 0) / branchData.length),
                    )}
              </span>
            </div>
            <div className="flex flex-col p-2 border rounded-md">
              <span className="text-xs text-muted-foreground">Top Performer</span>
              <span className="text-lg font-bold">{sortedBranches[0]?.name || "N/A"}</span>
            </div>
            <div className="flex flex-col p-2 border rounded-md">
              <span className="text-xs text-muted-foreground">Bottom Performer</span>
              <span className="text-lg font-bold">{sortedBranches[sortedBranches.length - 1]?.name || "N/A"}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
