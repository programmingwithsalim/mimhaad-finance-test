"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { RefreshCw, Save, Plus, Edit, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/currency"

const feeConfigSchema = z.object({
  serviceType: z.string().min(1, "Service type is required"),
  feeType: z.enum(["fixed", "percentage", "tiered"]),
  feeValue: z.string().min(1, "Fee value is required"),
  minimumFee: z.string().optional(),
  maximumFee: z.string().optional(),
  isActive: z.boolean().default(true),
})

type FeeConfigFormValues = z.infer<typeof feeConfigSchema>

interface FeeConfiguration {
  id: number
  service_type: string
  fee_type: "fixed" | "percentage" | "tiered"
  fee_value: number
  minimum_fee?: number
  maximum_fee?: number
  currency: string
  is_active: boolean
  effective_date: string
  created_at: string
  updated_at: string
}

export function EZwichFeeSettings() {
  const { toast } = useToast()
  const [feeConfigs, setFeeConfigs] = useState<FeeConfiguration[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const form = useForm<FeeConfigFormValues>({
    resolver: zodResolver(feeConfigSchema),
    defaultValues: {
      serviceType: "",
      feeType: "fixed",
      feeValue: "",
      minimumFee: "",
      maximumFee: "",
      isActive: true,
    },
  })

  const fetchFeeConfigurations = async () => {
    try {
      setLoading(true)
      console.log("Fetching fee configurations...")

      const response = await fetch("/api/settings/fee-config/e-zwich")
      console.log("Fetch response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("Fetched fee configurations:", data)
        setFeeConfigs(data.feeConfigurations || [])
      } else {
        const errorText = await response.text()
        console.error("Fetch error:", errorText)
        throw new Error("Failed to fetch fee configurations")
      }
    } catch (error) {
      console.error("Error fetching fee configurations:", error)
      toast({
        title: "Error",
        description: "Failed to load fee configurations",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeeConfigurations()
  }, [])

  const onSubmit = async (data: FeeConfigFormValues) => {
    try {
      console.log("Submitting fee configuration:", data)

      const response = await fetch("/api/settings/fee-config/e-zwich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceType: data.serviceType,
          feeType: data.feeType,
          feeValue: Number(data.feeValue),
          minimumFee: data.minimumFee ? Number(data.minimumFee) : null,
          maximumFee: data.maximumFee ? Number(data.maximumFee) : null,
          isActive: data.isActive,
          userId: "current-user", // Replace with actual user ID
          username: "Current User", // Replace with actual username
        }),
      })

      console.log("Response status:", response.status)
      const responseData = await response.json()
      console.log("Response data:", responseData)

      if (response.ok && responseData.success) {
        toast({
          title: "Success",
          description: "Fee configuration created successfully",
        })
        form.reset()
        setShowAddDialog(false)
        fetchFeeConfigurations()
      } else {
        throw new Error(responseData.error || "Failed to create fee configuration")
      }
    } catch (error) {
      console.error("Error creating fee configuration:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create fee configuration",
        variant: "destructive",
      })
    }
  }

  const getFeeTypeDisplay = (config: FeeConfiguration) => {
    if (config.fee_type === "fixed") {
      return `${formatCurrency(config.fee_value)} fixed`
    } else if (config.fee_type === "percentage") {
      let display = `${config.fee_value}%`
      if (config.minimum_fee) display += ` (min: ${formatCurrency(config.minimum_fee)})`
      if (config.maximum_fee) display += ` (max: ${formatCurrency(config.maximum_fee)})`
      return display
    }
    return config.fee_type
  }

  const getServiceTypeDisplay = (serviceType: string) => {
    switch (serviceType) {
      case "e_zwich_withdrawal":
        return "E-Zwich Withdrawal"
      case "e_zwich_card_issuance":
        return "E-Zwich Card Issuance"
      default:
        return serviceType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">E-Zwich Fee Configuration</h3>
          <p className="text-sm text-muted-foreground">Configure fees for E-Zwich transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchFeeConfigurations} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Fee Config
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Fee Configuration</DialogTitle>
                <DialogDescription>Create a new fee configuration for E-Zwich services</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select
                    onValueChange={(value) => {
                      console.log("Service type selected:", value)
                      form.setValue("serviceType", value)
                    }}
                    value={form.watch("serviceType")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="e_zwich_withdrawal">E-Zwich Withdrawal</SelectItem>
                      <SelectItem value="e_zwich_card_issuance">E-Zwich Card Issuance</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.serviceType && (
                    <p className="mt-1 text-sm text-destructive">{form.formState.errors.serviceType.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="feeType">Fee Type</Label>
                  <Select
                    onValueChange={(value) => {
                      console.log("Fee type selected:", value)
                      form.setValue("feeType", value as any)
                    }}
                    value={form.watch("feeType")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fee type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="tiered">Tiered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="feeValue">Fee Value {form.watch("feeType") === "percentage" ? "(%)" : "(GHS)"}</Label>
                  <Input
                    id="feeValue"
                    type="number"
                    step="0.01"
                    placeholder="Enter fee value"
                    {...form.register("feeValue")}
                    onChange={(e) => {
                      console.log("Fee value changed:", e.target.value)
                      form.setValue("feeValue", e.target.value)
                    }}
                  />
                  {form.formState.errors.feeValue && (
                    <p className="mt-1 text-sm text-destructive">{form.formState.errors.feeValue.message}</p>
                  )}
                </div>

                {form.watch("feeType") === "percentage" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minimumFee">Minimum Fee (GHS)</Label>
                      <Input
                        id="minimumFee"
                        type="number"
                        step="0.01"
                        placeholder="Optional"
                        {...form.register("minimumFee")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maximumFee">Maximum Fee (GHS)</Label>
                      <Input
                        id="maximumFee"
                        type="number"
                        step="0.01"
                        placeholder="Optional"
                        {...form.register("maximumFee")}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={form.watch("isActive")}
                    onCheckedChange={(checked) => {
                      console.log("Active status changed:", checked)
                      form.setValue("isActive", checked)
                    }}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Fee Configurations</CardTitle>
          <CardDescription>Active fee configurations for E-Zwich services</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Fee Structure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeConfigs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        <span className="text-sm text-muted-foreground">
                          No fee configurations found. Add one to get started.
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    feeConfigs.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{getServiceTypeDisplay(config.service_type)}</TableCell>
                        <TableCell>{getFeeTypeDisplay(config)}</TableCell>
                        <TableCell>
                          <Badge variant={config.is_active ? "default" : "secondary"}>
                            {config.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(config.effective_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
