"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useToast } from "@/components/ui/use-toast";
import {
  Calculator,
  Building2,
  Upload,
  X,
  FileText,
  Image,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const commissionSchema = z.object({
  source: z.string().min(1, "Partner is required"),
  sourceName: z.string().min(1, "Partner name is required"),
  reference: z.string().min(1, "Reference is required"),
  month: z.string().min(1, "Month is required"),
  amount: z.number().optional(),
  transactionVolume: z.number().min(1, "Transaction volume is required"),
  commissionRate: z.number().min(0.01, "Commission rate is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().default("paid"),
});

type CommissionFormData = z.infer<typeof commissionSchema>;

interface CommissionFormProps {
  onSuccess?: () => void;
}

interface FloatAccount {
  id: string;
  account_type: string;
  provider: string;
  account_number: string | null;
  current_balance: string;
  is_active: boolean;
}

export default function CommissionForm({ onSuccess }: CommissionFormProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [floatAccounts, setFloatAccounts] = useState<FloatAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CommissionFormData>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      transactionVolume: 0,
      commissionRate: 0,
      month: format(new Date(), "yyyy-MM"),
      status: "pending", // Changed to pending for approval workflow
    },
  });

  const watchedSource = watch("source");
  const watchedVolume = watch("transactionVolume");
  const watchedRate = watch("commissionRate");

  // Auto-calculate amount when volume or rate changes
  const calculatedAmount =
    watchedVolume && watchedRate ? watchedVolume * watchedRate : 0;

  // Fetch float accounts on component mount
  useEffect(() => {
    const fetchFloatAccounts = async () => {
      try {
        // Build URL with branch filtering
        let url = "/api/float-accounts";
        const params = new URLSearchParams();

        // If user is not admin, filter by their branch
        if (
          user &&
          user.role !== "admin" &&
          user.role !== "Admin" &&
          user.branchId
        ) {
          params.append("branchId", user.branchId);
        }

        if (params.toString()) {
          url += "?" + params.toString();
        }

        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            // Add user context headers for proper authentication
            "x-user-id": user?.id || "",
            "x-user-name": user?.name || user?.username || "Unknown User",
            "x-user-role": user?.role || "user",
            "x-branch-id": user?.branchId || "",
            "x-branch-name": user?.branchName || "Unknown Branch",
          },
        });
        if (response.ok) {
          const data = await response.json();
          // Handle the nested structure from the API
          const accounts = data.accounts || data.data || data;

          // Filter for active accounts that can be commission partners (including cash-in-till)
          const activeAccounts = accounts.filter(
            (account: FloatAccount) =>
              account.is_active &&
              [
                "agency-banking",
                "power",
                "momo",
                "e-zwich",
                "cash-in-till",
              ].includes(account.account_type)
          );

          console.log(
            "📊 [COMMISSION] Loaded float accounts:",
            activeAccounts.length,
            "for branch:",
            user?.branchId || "all branches (admin)"
          );
          setFloatAccounts(activeAccounts);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error("Error fetching float accounts:", error);

        // Fallback to default accounts if API fails
        const fallbackAccounts: FloatAccount[] = [
          {
            id: "fallback-mtn",
            account_type: "momo",
            provider: "MTN Mobile Money",
            account_number: "0549514617",
            current_balance: "1000.00",
            is_active: true,
          },
          {
            id: "fallback-gcb",
            account_type: "agency-banking",
            provider: "GCB Bank",
            account_number: "2464402761018",
            current_balance: "118394.00",
            is_active: true,
          },
          {
            id: "fallback-ecg",
            account_type: "power",
            provider: "ECG",
            account_number: "POWER-ECG-001",
            current_balance: "6800.00",
            is_active: true,
          },
        ];

        console.log(
          "📊 [COMMISSION] Using fallback accounts:",
          fallbackAccounts.length
        );
        setFloatAccounts(fallbackAccounts);

        toast({
          variant: "destructive",
          title: "Warning",
          description:
            "Using fallback partner accounts. Some features may be limited.",
        });
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchFloatAccounts();
  }, [toast, user]);

  const handlePartnerChange = (value: string) => {
    console.log("#############value", value);
    const account = floatAccounts.find((acc) => acc.id === value);
    if (account) {
      setValue("source", value);
      setValue("sourceName", `${account.provider} (${account.account_type})`);

      // Generate reference number
      const monthStr = watch("month") || format(new Date(), "yyyy-MM");
      const formattedMonthStr = monthStr.replace("-", "");
      const accountType = account.account_type.toUpperCase().substring(0, 3);
      const reference = `${accountType}-${formattedMonthStr}-${Math.random()
        .toString(36)
        .substr(2, 4)
        .toUpperCase()}`;
      setValue("reference", reference);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please select a file smaller than 5MB",
        });
        return;
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Invalid file type",
          description: "Please select an image, PDF, or Word document",
        });
        return;
      }

      setUploadedFile(file);

      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setFilePreview(null);
    // Reset the file input
    const fileInput = document.getElementById(
      "receipt-upload"
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const onSubmit = async (data: CommissionFormData) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      // Ensure we have a calculated amount
      if (calculatedAmount <= 0) {
        throw new Error(
          "Please enter valid transaction volume and commission rate"
        );
      }

      // Convert month from "YYYY-MM" to "YYYY-MM-01" for PostgreSQL date format
      const formattedMonth = data.month.includes("-")
        ? `${data.month}-01`
        : data.month;

      // Use real user data if available, otherwise use meaningful defaults
      const userData = user || {
        id: `user-${Date.now()}`,
        username: "System User",
        name: "System User",
        branchId: "635844ab-029a-43f8-8523-d7882915266a", // Use real branch ID
        branchName: "Main Branch",
        role: "manager",
      };

      // Ensure we have valid branch data
      if (!userData.branchId || userData.branchId.startsWith("branch-")) {
        userData.branchId = "635844ab-029a-43f8-8523-d7882915266a"; // Fallback to real branch ID
        userData.branchName = "Main Branch";
      }

      console.log("📝 [COMMISSION] Submitting with user data:", userData);

      // Create FormData to handle file upload
      const formData = new FormData();

      // Add commission data
      formData.append("source", data.source);
      formData.append("sourceName", data.sourceName);
      formData.append("reference", data.reference);
      formData.append("month", formattedMonth);
      formData.append("amount", calculatedAmount.toString());
      formData.append("transactionVolume", data.transactionVolume.toString());
      formData.append("commissionRate", data.commissionRate.toString());
      formData.append("description", data.description || "");
      formData.append("notes", data.notes || "");
      formData.append("status", "paid");
      formData.append("createdBy", userData.id);
      formData.append("createdByName", userData.username || userData.name);
      formData.append("branchId", userData.branchId);
      formData.append("branchName", userData.branchName);
      formData.append("userRole", userData.role);

      // Add receipt file if uploaded
      if (uploadedFile) {
        formData.append("receipt", uploadedFile);
      }

      const response = await fetch("/api/commissions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create commission");
      }

      const result = await response.json();

      toast({
        title: "Commission Created",
        description: `Commission for ${data.sourceName} has been created successfully`,
      });

      // Reset form
      reset();
      setUploadedFile(null);
      setFilePreview(null);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("❌ [COMMISSION] Error:", error);
      setFormError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create commission",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingAccounts) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading partner accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Partner Selection */}
        <div className="space-y-2">
          <Label htmlFor="source">Partner Account (Provider) *</Label>
          <Select onValueChange={handlePartnerChange} value={watchedSource}>
            <SelectTrigger>
              <SelectValue placeholder="Select partner account" />
            </SelectTrigger>
            <SelectContent>
              {floatAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{account.provider}</span>
                    <span className="text-muted-foreground">
                      ({account.account_type})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.source && (
            <p className="text-sm text-destructive">{errors.source.message}</p>
          )}
        </div>

        {/* Reference */}
        <div className="space-y-2">
          <Label htmlFor="reference">Reference *</Label>
          <Input
            {...register("reference")}
            placeholder="Auto-generated reference"
            readOnly
          />
          {errors.reference && (
            <p className="text-sm text-destructive">
              {errors.reference.message}
            </p>
          )}
        </div>

        {/* Month */}
        <div className="space-y-2">
          <Label htmlFor="month">Month *</Label>
          <Input {...register("month")} type="month" required />
          {errors.month && (
            <p className="text-sm text-destructive">{errors.month.message}</p>
          )}
        </div>

        {/* Transaction Volume */}
        <div className="space-y-2">
          <Label htmlFor="transactionVolume">Transaction Volume (GHS) *</Label>
          <Input
            {...register("transactionVolume", { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
          />
          {errors.transactionVolume && (
            <p className="text-sm text-destructive">
              {errors.transactionVolume.message}
            </p>
          )}
        </div>

        {/* Commission Rate */}
        <div className="space-y-2">
          <Label htmlFor="commissionRate">Commission Rate (%) *</Label>
          <Input
            {...register("commissionRate", { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
          />
          {errors.commissionRate && (
            <p className="text-sm text-destructive">
              {errors.commissionRate.message}
            </p>
          )}
        </div>

        {/* Calculated Amount */}
        <div className="space-y-2">
          <Label>Commission Amount (GHS)</Label>
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {calculatedAmount.toLocaleString("en-GH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          {...register("description")}
          placeholder="Brief description of the commission"
          rows={2}
        />
        {errors.description && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Receipt Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Receipt Upload
          </CardTitle>
          <CardDescription>
            Upload a receipt or supporting document for this commission
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!uploadedFile ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <input
                id="receipt-upload"
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="receipt-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Click to upload receipt</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, PDF, DOC up to 5MB
                  </p>
                </div>
              </label>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {filePreview ? (
                    <Image className="h-8 w-8 text-blue-500" />
                  ) : (
                    <FileText className="h-8 w-8 text-gray-500" />
                  )}
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {filePreview && (
                <div className="mt-3">
                  <img
                    src={filePreview}
                    alt="Receipt preview"
                    className="max-w-full h-32 object-contain rounded border"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          {...register("notes")}
          placeholder="Any additional notes or comments"
          rows={3}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
          {isSubmitting ? "Creating..." : "Create Commission"}
        </Button>
      </div>
    </form>
  );
}
