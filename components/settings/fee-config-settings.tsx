"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2, Edit, Trash2 } from "lucide-react";

const feeConfigSchema = z.object({
  service_type: z.string().min(1, "Service type is required"),
  transaction_type: z.string().min(1, "Transaction type is required"),
  fee_type: z.enum(["fixed", "percentage"], {
    message: "Fee type is required",
  }),
  fee_value: z.string().min(0, "Fee value must be positive"),
  minimum_fee: z.string().min(0, "Minimum fee must be positive"),
  maximum_fee: z.string().min(0, "Maximum fee must be positive"),
});

type FeeConfigFormValues = z.infer<typeof feeConfigSchema>;

interface FeeConfig {
  id: number;
  service_type: string;
  transaction_type: string;
  fee_type: string;
  fee_value: string;
  minimum_fee: string;
  maximum_fee: string;
  currency: string;
  is_active: boolean;
  effective_date: string;
}

export function FeeConfigSettings({
  userRole = "admin",
}: {
  userRole?: string;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [feeConfigs, setFeeConfigs] = useState<FeeConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<FeeConfig | null>(null);
  const [showForm, setShowForm] = useState(false);

  const form = useForm<FeeConfigFormValues>({
    resolver: zodResolver(feeConfigSchema),
    defaultValues: {
      service_type: "",
      transaction_type: "",
      fee_type: "fixed",
      fee_value: "0",
      minimum_fee: "0",
      maximum_fee: "0",
    },
  });

  useEffect(() => {
    fetchFeeConfigs();
  }, []);

  const fetchFeeConfigs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/settings/fee-config");
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setFeeConfigs(result.data);
        }
      }
    } catch (error) {
      console.error("Error fetching fee configs:", error);
      toast({
        title: "Error",
        description: "Failed to load fee configurations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FeeConfigFormValues) => {
    try {
      setIsLoading(true);
      console.log("📝 [FRONTEND] Submitting fee config data:", data);

      const payload = {
        ...data,
        fee_value: Number.parseFloat(data.fee_value),
        minimum_fee: Number.parseFloat(data.minimum_fee),
        maximum_fee: Number.parseFloat(data.maximum_fee),
        currency: "GHS",
        is_active: true,
        effective_date: new Date().toISOString().split("T")[0],
      };

      console.log("📤 [FRONTEND] Sending payload:", payload);

      const url = editingConfig
        ? `/api/settings/fee-config/${editingConfig.id}`
        : "/api/settings/fee-config";
      const method = editingConfig ? "PUT" : "POST";

      console.log(
        "🌐 [FRONTEND] Making request to:",
        url,
        "with method:",
        method
      );

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("📥 [FRONTEND] Response status:", response.status);
      console.log(
        "📥 [FRONTEND] Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      const result = await response.json();
      console.log("📥 [FRONTEND] Response body:", result);

      if (response.ok && result.success) {
        console.log("✅ [FRONTEND] Success - showing toast and refreshing");
        toast({
          title: "Success",
          description: `Fee configuration ${
            editingConfig ? "updated" : "created"
          } successfully`,
        });
        form.reset();
        setEditingConfig(null);
        setShowForm(false);
        await fetchFeeConfigs();
        console.log("✅ [FRONTEND] Form reset and data refreshed");
      } else {
        console.log("❌ [FRONTEND] Error in response:", result.error);
        throw new Error(result.error || "Failed to save fee configuration");
      }
    } catch (error) {
      console.error("❌ [FRONTEND] Error saving fee config:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save fee configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (config: FeeConfig) => {
    setEditingConfig(config);
    form.reset({
      service_type: config.service_type,
      transaction_type: config.transaction_type,
      fee_type: config.fee_type as "fixed" | "percentage",
      fee_value: config.fee_value,
      minimum_fee: config.minimum_fee,
      maximum_fee: config.maximum_fee,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this fee configuration?"))
      return;

    try {
      const response = await fetch(`/api/settings/fee-config/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Fee configuration deleted successfully",
        });
        fetchFeeConfigs();
      } else {
        throw new Error("Failed to delete fee configuration");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete fee configuration",
        variant: "destructive",
      });
    }
  };

  // Check if user has permission to edit fees (case insensitive)
  const canManageFees =
    userRole?.toLowerCase() === "admin" ||
    userRole?.toLowerCase() === "finance";

  if (isLoading && feeConfigs.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Fee Configuration</CardTitle>
            <CardDescription>Loading fee configuration...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fee Configuration</CardTitle>
              <CardDescription>
                Manage transaction fees for different services
              </CardDescription>
            </div>
            {canManageFees && (
              <Button
                onClick={() => {
                  setEditingConfig(null);
                  form.reset();
                  setShowForm(true);
                }}
              >
                Add New Fee
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!canManageFees ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Access Restricted</AlertTitle>
              <AlertDescription>
                You don't have permission to manage fee configurations. Contact
                your administrator for assistance. Current role: {userRole}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {showForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {editingConfig ? "Edit" : "Add"} Fee Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="service_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Service Type</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select service type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="momo">
                                      Mobile Money
                                    </SelectItem>
                                    <SelectItem value="agency_banking">
                                      Agency Banking
                                    </SelectItem>
                                    <SelectItem value="e_zwich">
                                      E-Zwich
                                    </SelectItem>
                                    <SelectItem value="power">Power</SelectItem>
                                    <SelectItem value="jumia">Jumia</SelectItem>
                                    <SelectItem value="interbank">
                                      Interbank
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="transaction_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Transaction Type</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select transaction type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="deposit">
                                      Deposit
                                    </SelectItem>
                                    <SelectItem value="withdrawal">
                                      Withdrawal
                                    </SelectItem>
                                    <SelectItem value="transfer">
                                      Transfer
                                    </SelectItem>
                                    <SelectItem value="interbank_transfer">
                                      Interbank Transfer
                                    </SelectItem>
                                    <SelectItem value="card_issuance">
                                      Card Issuance
                                    </SelectItem>
                                    <SelectItem value="transaction">
                                      Transaction
                                    </SelectItem>
                                    <SelectItem value="inquiry">
                                      Inquiry
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="fee_type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fee Type</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select fee type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="fixed">
                                      Fixed Amount
                                    </SelectItem>
                                    <SelectItem value="percentage">
                                      Percentage
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="fee_value"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fee Value</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                  />
                                </FormControl>
                                <FormDescription>
                                  {form.watch("fee_type") === "percentage"
                                    ? "Percentage (0-100)"
                                    : "Amount in GHS"}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="minimum_fee"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Minimum Fee (GHS)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="maximum_fee"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Maximum Fee (GHS)</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex gap-4">
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              `${
                                editingConfig ? "Update" : "Create"
                              } Fee Configuration`
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowForm(false);
                              setEditingConfig(null);
                              form.reset();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Current Fee Configurations</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Transaction Type</TableHead>
                        <TableHead>Fee Type</TableHead>
                        <TableHead>Fee Value</TableHead>
                        <TableHead>Min Fee</TableHead>
                        <TableHead>Max Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feeConfigs.map((config) => (
                        <TableRow key={config.id}>
                          <TableCell className="font-medium">
                            {config.service_type
                              .replace("_", " ")
                              .toUpperCase()}
                          </TableCell>
                          <TableCell>
                            {config.transaction_type.replace("_", " ")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{config.fee_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {config.fee_type === "percentage"
                              ? `${config.fee_value}%`
                              : `GHS ${config.fee_value}`}
                          </TableCell>
                          <TableCell>GHS {config.minimum_fee}</TableCell>
                          <TableCell>GHS {config.maximum_fee}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                config.is_active ? "default" : "secondary"
                              }
                            >
                              {config.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(config)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(config.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {feeConfigs.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        No fee configurations found
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
