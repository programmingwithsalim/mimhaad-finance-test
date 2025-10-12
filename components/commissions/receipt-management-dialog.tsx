"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Upload, Download, X, Image as ImageIcon } from "lucide-react";
import type { Commission } from "@/lib/commission-types";

interface ReceiptManagementDialogProps {
  commission: Commission;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReceiptManagementDialog({ commission, onClose, onSuccess }: ReceiptManagementDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

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
    const fileInput = document.getElementById("receipt-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleUpload = async () => {
    if (!uploadedFile) {
      toast({
        variant: "destructive",
        title: "No file selected",
        description: "Please select a file to upload",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("receipt", uploadedFile);

      const response = await fetch(`/api/commissions/${commission.id}/receipt`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload receipt");
      }

      toast({
        title: "Receipt Uploaded",
        description: "Receipt has been uploaded successfully",
      });

      onSuccess();
    } catch (error) {
      console.error("Error uploading receipt:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload receipt",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/commissions/${commission.id}/receipt`);
      if (!response.ok) {
        throw new Error("Failed to download receipt");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = commission.receipt_filename || "receipt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Receipt download has started",
      });
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download receipt",
      });
    }
  };

  const hasReceipt = commission.receipt_filename;

  return (
    <div className="space-y-6">
      {/* Commission Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Commission Details</CardTitle>
          <CardDescription>Receipt management for this commission</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Reference:</span> {commission.reference}
            </div>
            <div>
              <span className="font-medium">Amount:</span> {commission.amount}
            </div>
            <div>
              <span className="font-medium">Provider:</span> {commission.sourceName}
            </div>
            <div>
              <span className="font-medium">Status:</span> {commission.status}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Receipt */}
      {hasReceipt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Current Receipt
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">{commission.receipt_filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {commission.receipt_size ? `${(commission.receipt_size / 1024).toFixed(1)} KB` : "Unknown size"}
                  </p>
                </div>
              </div>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload New Receipt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {hasReceipt ? "Replace Receipt" : "Upload Receipt"}
          </CardTitle>
          <CardDescription>
            {hasReceipt 
              ? "Upload a new file to replace the current receipt"
              : "Upload a receipt or supporting document for this commission"
            }
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
                    <ImageIcon className="h-8 w-8 text-blue-500" />
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

          {uploadedFile && (
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading ? "Uploading..." : "Upload Receipt"}
              </Button>
              <Button variant="outline" onClick={removeFile}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
