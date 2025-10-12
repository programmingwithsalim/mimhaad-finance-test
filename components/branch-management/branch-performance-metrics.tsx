"use client"

import { useEffect, useRef } from "react"
import type { Branch } from "./types"

interface BranchPerformanceMetricsProps {
  branches: Branch[]
}

export function BranchPerformanceMetrics({ branches }: BranchPerformanceMetricsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Sample data generation for performance metrics
    const branchNames = branches.slice(0, 5).map((b) => b.name)
    const transactionData = branches.slice(0, 5).map(() => Math.floor(Math.random() * 90) + 10)
    const revenueData = branches.slice(0, 5).map(() => Math.floor(Math.random() * 90) + 10)
    const customerData = branches.slice(0, 5).map(() => Math.floor(Math.random() * 90) + 10)

    // Draw the bar chart
    drawBarChart(ctx, canvas.width, canvas.height, branchNames, [
      { label: "Transactions", data: transactionData, color: "#3b82f6" },
      { label: "Revenue", data: revenueData, color: "#10b981" },
      { label: "Customers", data: customerData, color: "#f59e0b" },
    ])

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current) return

      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight

      // Redraw bar chart
      drawBarChart(ctx, canvas.width, canvas.height, branchNames, [
        { label: "Transactions", data: transactionData, color: "#3b82f6" },
        { label: "Revenue", data: revenueData, color: "#10b981" },
        { label: "Customers", data: customerData, color: "#f59e0b" },
      ])
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [branches])

  return (
    <div className="h-[300px] w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

interface DataSeries {
  label: string
  data: number[]
  color: string
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  labels: string[],
  dataSeries: DataSeries[],
) {
  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Chart dimensions
  const chartWidth = width - 60
  const chartHeight = height - 60
  const chartX = 50
  const chartY = 20

  // Draw axes
  ctx.beginPath()
  ctx.moveTo(chartX, chartY)
  ctx.lineTo(chartX, chartY + chartHeight)
  ctx.lineTo(chartX + chartWidth, chartY + chartHeight)
  ctx.strokeStyle = "#ccc"
  ctx.lineWidth = 1
  ctx.stroke()

  // Draw horizontal grid lines
  const numGridLines = 5
  ctx.beginPath()
  for (let i = 0; i <= numGridLines; i++) {
    const y = chartY + chartHeight - (i * chartHeight) / numGridLines
    ctx.moveTo(chartX, y)
    ctx.lineTo(chartX + chartWidth, y)

    // Add y-axis labels
    ctx.fillStyle = "#666"
    ctx.font = "10px Arial"
    ctx.textAlign = "right"
    ctx.fillText((i * 20).toString(), chartX - 5, y + 3)
  }
  ctx.strokeStyle = "#eee"
  ctx.stroke()

  // Calculate bar widths and positions
  const numGroups = labels.length
  const groupWidth = chartWidth / numGroups
  const barWidth = (groupWidth * 0.7) / dataSeries.length
  const groupPadding = groupWidth * 0.15

  // Draw bars for each data series
  dataSeries.forEach((series, seriesIndex) => {
    ctx.fillStyle = series.color

    series.data.forEach((value, index) => {
      const barHeight = (value / 100) * chartHeight
      const barX = chartX + groupPadding + index * groupWidth + seriesIndex * barWidth
      const barY = chartY + chartHeight - barHeight

      ctx.fillRect(barX, barY, barWidth, barHeight)
    })
  })

  // Draw x-axis labels
  labels.forEach((label, index) => {
    ctx.fillStyle = "#666"
    ctx.font = "10px Arial"
    ctx.textAlign = "center"
    ctx.fillText(
      label.length > 10 ? label.substring(0, 10) + "..." : label,
      chartX + groupPadding + index * groupWidth + groupWidth / 2,
      chartY + chartHeight + 15,
    )
  })

  // Draw legend
  const legendX = chartX
  const legendY = chartY + chartHeight + 30
  const legendItemWidth = 80

  dataSeries.forEach((series, index) => {
    const itemX = legendX + index * legendItemWidth

    // Draw legend color box
    ctx.fillStyle = series.color
    ctx.fillRect(itemX, legendY, 10, 10)

    // Draw legend text
    ctx.fillStyle = "#666"
    ctx.font = "10px Arial"
    ctx.textAlign = "left"
    ctx.fillText(series.label, itemX + 15, legendY + 8)
  })
}
