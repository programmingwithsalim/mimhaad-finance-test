"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Database, CheckCircle, AlertCircle } from "lucide-react"

export default function BatchStatusUpdater() {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateComplete, setUpdateComplete] = useState(false)

  const updateBatchStatusEnum = async () => {
    try {
      setIsUpdating(true)

      const response = await fetch("/api/db/update-batch-status-enum", {
        method: "POST",
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Success",
          description: "Batch status enum updated successfully",
        })
        setUpdateComplete(true)
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update enum",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating enum:", error)
      toast({
        title: "Error",
        description: "Failed to update batch status enum",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Schema Update
        </CardTitle>
        <CardDescription>Update the batch status enum to include new status values</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          This will add the following status values to the batch_status enum:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>low_stock</li>
            <li>depleted</li>
            <li>expired</li>
          </ul>
        </div>

        {updateComplete ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Schema update completed successfully</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Schema update required</span>
          </div>
        )}

        <Button onClick={updateBatchStatusEnum} disabled={isUpdating || updateComplete} className="w-full">
          {isUpdating ? "Updating..." : updateComplete ? "Update Complete" : "Update Schema"}
        </Button>
      </CardContent>
    </Card>
  )
}
