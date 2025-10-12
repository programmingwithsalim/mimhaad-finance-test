"use client"

import { useEffect, useRef } from "react"
import type { Branch } from "./types"

interface BranchDistributionMapProps {
  branches: Branch[]
}

export function BranchDistributionMap({ branches }: BranchDistributionMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw simplified Ghana map
    drawGhanaMap(ctx, canvas.width, canvas.height)

    // Plot branch locations
    plotBranches(ctx, branches, canvas.width, canvas.height)

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current) return

      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight

      // Redraw everything
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawGhanaMap(ctx, canvas.width, canvas.height)
      plotBranches(ctx, branches, canvas.width, canvas.height)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [branches])

  return (
    <div className="relative h-[300px] w-full rounded-md bg-muted/20">
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute bottom-2 right-2 rounded bg-background/80 p-1 text-xs">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
          <span>Active Branch</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-500"></span>
          <span>Inactive Branch</span>
        </div>
      </div>
    </div>
  )
}

// Draw simplified Ghana map
function drawGhanaMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // This is a very simplified outline of Ghana
  const scaleFactor = Math.min(width, height) / 100

  ctx.beginPath()
  ctx.moveTo(50 * scaleFactor, 20 * scaleFactor) // Start at upper left
  ctx.lineTo(65 * scaleFactor, 15 * scaleFactor)
  ctx.lineTo(70 * scaleFactor, 30 * scaleFactor)
  ctx.lineTo(60 * scaleFactor, 50 * scaleFactor)
  ctx.lineTo(65 * scaleFactor, 70 * scaleFactor)
  ctx.lineTo(55 * scaleFactor, 80 * scaleFactor)
  ctx.lineTo(35 * scaleFactor, 75 * scaleFactor)
  ctx.lineTo(30 * scaleFactor, 55 * scaleFactor)
  ctx.lineTo(40 * scaleFactor, 35 * scaleFactor)
  ctx.lineTo(50 * scaleFactor, 20 * scaleFactor)

  ctx.strokeStyle = "#ccc"
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.fillStyle = "rgba(240, 240, 250, 0.3)"
  ctx.fill()

  // Draw region boundaries (simplified)
  ctx.beginPath()
  ctx.moveTo(50 * scaleFactor, 20 * scaleFactor)
  ctx.lineTo(45 * scaleFactor, 45 * scaleFactor)
  ctx.moveTo(45 * scaleFactor, 45 * scaleFactor)
  ctx.lineTo(60 * scaleFactor, 50 * scaleFactor)
  ctx.moveTo(45 * scaleFactor, 45 * scaleFactor)
  ctx.lineTo(35 * scaleFactor, 65 * scaleFactor)

  ctx.strokeStyle = "#ddd"
  ctx.lineWidth = 1
  ctx.stroke()

  // Add region labels (simplified)
  ctx.fillStyle = "#666"
  ctx.font = `${8 * scaleFactor}px Arial`
  ctx.fillText("Greater Accra", 50 * scaleFactor, 60 * scaleFactor)
  ctx.fillText("Ashanti", 40 * scaleFactor, 40 * scaleFactor)
  ctx.fillText("Western", 35 * scaleFactor, 70 * scaleFactor)
}

// Plot branch locations on the map
function plotBranches(ctx: CanvasRenderingContext2D, branches: Branch[], width: number, height: number) {
  const scaleFactor = Math.min(width, height) / 100

  // Define region coordinates (simplified)
  const regionCoordinates: Record<string, [number, number]> = {
    "greater-accra": [60, 65],
    ashanti: [45, 40],
    western: [30, 70],
    eastern: [55, 50],
    central: [40, 60],
    northern: [50, 25],
    "upper-east": [60, 15],
    "upper-west": [35, 15],
    volta: [65, 55],
    bono: [35, 35],
  }

  // Group branches by region
  const branchesByRegion: Record<string, Branch[]> = {}

  branches.forEach((branch) => {
    if (!branchesByRegion[branch.region]) {
      branchesByRegion[branch.region] = []
    }
    branchesByRegion[branch.region].push(branch)
  })

  // Plot branches
  Object.entries(branchesByRegion).forEach(([region, regionBranches]) => {
    if (!regionCoordinates[region]) return

    const [baseX, baseY] = regionCoordinates[region]

    // Place branches in a circular pattern around the region center
    const radius = 5 * scaleFactor
    const count = regionBranches.length

    regionBranches.forEach((branch, index) => {
      const angle = (index / count) * Math.PI * 2
      const offsetX = Math.cos(angle) * radius
      const offsetY = Math.sin(angle) * radius

      const x = baseX * scaleFactor + offsetX
      const y = baseY * scaleFactor + offsetY

      // Draw branch dot
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = branch.status === "active" ? "#10b981" : "#6b7280"
      ctx.fill()

      // Add tooltip on hover (simplified)
      // In a real implementation, you would use a proper map library
    })

    // Add count label
    ctx.fillStyle = "#333"
    ctx.font = `bold ${7 * scaleFactor}px Arial`
    ctx.fillText(count.toString(), baseX * scaleFactor, baseY * scaleFactor - 8)
  })
}
