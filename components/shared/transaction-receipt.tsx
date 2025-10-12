"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Receipt, Printer, Download, X } from "lucide-react";
import { format } from "date-fns";

export interface TransactionReceiptData {
  transactionId: string;
  sourceModule: "momo" | "agency_banking" | "e_zwich" | "power" | "jumia";
  transactionType: string;
  amount: number;
  fee: number;
  customerName?: string;
  customerPhone?: string;
  reference: string;
  branchName: string;
  date: string;
  additionalData?: Record<string, any>;
}

interface TransactionReceiptProps {
  data: TransactionReceiptData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionReceipt({
  data,
  open,
  onOpenChange,
}: TransactionReceiptProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!data) return null;

  // Ensure amount and fee are numbers
  const amount =
    typeof data.amount === "number" ? data.amount : Number(data.amount) || 0;
  const fee = typeof data.fee === "number" ? data.fee : Number(data.fee) || 0;
  const totalAmount = amount + fee;

  console.log("Receipt Debug:", {
    originalAmount: data.amount,
    originalFee: data.fee,
    convertedAmount: amount,
    convertedFee: fee,
    totalAmount,
  });

  const formattedDate = format(new Date(data.date), "PPP p");

  const getModuleDisplayName = (module: string) => {
    switch (module) {
      case "momo":
        return "MoMo";
      case "agency_banking":
        return "Agency Banking";
      case "e_zwich":
        return "E-Zwich";
      case "power":
        return "Power";
      case "jumia":
        return "Jumia";
      default:
        return module.toUpperCase();
    }
  };

  const getTransactionTypeDisplayName = (type: string) => {
    switch (type) {
      case "cash-in":
        return "Cash In";
      case "cash-out":
        return "Cash Out";
      case "deposit":
        return "Deposit";
      case "withdrawal":
        return "Withdrawal";
      case "card_issuance":
        return "Card Issuance";
      case "pod_collection":
        return "POD Collection";
      case "package_receipt":
        return "Package Receipt";
      case "settlement":
        return "Settlement";
      case "sale":
        return "Sale";
      default:
        return type.replace(/_/g, " ").toUpperCase();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const printReceipt = () => {
    setIsPrinting(true);

    const printWindow = window.open("", "_blank", "width=350,height=600");
    if (!printWindow) {
      console.error("Failed to open print window");
      setIsPrinting(false);
      return;
    }

    const receiptContent = generateReceiptHTML(data);
    printWindow.document.write(receiptContent);
    printWindow.document.close();

    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
    }, 500);
  };

  const downloadReceipt = () => {
    const receiptContent = generateReceiptHTML(data);
    const blob = new Blob([receiptContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${data.transactionId}-${format(
      new Date(),
      "yyyy-MM-dd-HH-mm"
    )}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction Receipt
          </DialogTitle>
        </DialogHeader>

        <div id="receipt-content" className="space-y-4">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <div className="flex justify-center mb-2">
              <img
                src="/logo.png"
                alt="MIMHAAD Logo"
                className="w-16 h-16 rounded-full"
              />
            </div>
            <h3 className="text-lg font-bold">MIMHAAD FINANCIAL SERVICES</h3>
            <p className="text-sm">{data.branchName}</p>
            <p className="text-sm">Tel: 0241378880</p>
            <p className="text-sm">{formattedDate}</p>
          </div>

          {/* Receipt Title */}
          <div className="text-center">
            <h4 className="font-semibold text-base">
              {getModuleDisplayName(data.sourceModule)} TRANSACTION RECEIPT
            </h4>
          </div>

          {/* Transaction Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1">
              <span className="font-medium">Transaction ID:</span>
              <span className="font-mono">{data.transactionId}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="font-medium">Type:</span>
              <span>{getTransactionTypeDisplayName(data.transactionType)}</span>
            </div>

            {data.customerName && (
              <div className="flex justify-between py-1">
                <span className="font-medium">Customer:</span>
                <span>{data.customerName}</span>
              </div>
            )}

            {data.customerPhone && (
              <div className="flex justify-between py-1">
                <span className="font-medium">Phone:</span>
                <span>{data.customerPhone}</span>
              </div>
            )}

            {/* Additional data specific to each module */}
            {data.additionalData &&
              Object.entries(data.additionalData).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1">
                  <span className="font-medium">
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())}
                    :
                  </span>
                  <span>{String(value)}</span>
                </div>
              ))}

            <div className="flex justify-between py-1">
              <span className="font-medium">Amount:</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>

            {fee > 0 && (
              <div className="flex justify-between py-1">
                <span className="font-medium">Fee:</span>
                <span>{formatCurrency(fee)}</span>
              </div>
            )}

            <div className="flex justify-between py-1">
              <span className="font-medium">Reference:</span>
              <span className="font-mono text-xs">{data.reference}</span>
            </div>

            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="font-bold text-base">TOTAL:</span>
                <span className="font-bold text-lg">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>Thank you for using our service!</p>
            <p>For inquiries, please call our customer service at 0241378880</p>
            <p>Powered by MIMHAAD Financial Services</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={printReceipt}
            disabled={isPrinting}
            className="flex-1"
          >
            <Printer className="h-4 w-4 mr-2" />
            {isPrinting ? "Printing..." : "Print Receipt"}
          </Button>
          <Button onClick={downloadReceipt} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function generateReceiptHTML(data: TransactionReceiptData): string {
  // Ensure amount and fee are numbers
  const amount =
    typeof data.amount === "number" ? data.amount : Number(data.amount) || 0;
  const fee = typeof data.fee === "number" ? data.fee : Number(data.fee) || 0;
  const totalAmount = amount + fee;
  const formattedDate = format(new Date(data.date), "PPP p");

  const getModuleDisplayName = (module: string) => {
    switch (module) {
      case "momo":
        return "MoMo";
      case "agency_banking":
        return "Agency Banking";
      case "e_zwich":
        return "E-Zwich";
      case "power":
        return "Power";
      case "jumia":
        return "Jumia";
      default:
        return module.toUpperCase();
    }
  };

  const getTransactionTypeDisplayName = (type: string) => {
    switch (type) {
      case "cash-in":
        return "Cash In";
      case "cash-out":
        return "Cash Out";
      case "deposit":
        return "Deposit";
      case "withdrawal":
        return "Withdrawal";
      case "card_issuance":
        return "Card Issuance";
      case "pod_collection":
        return "POD Collection";
      case "package_receipt":
        return "Package Receipt";
      case "settlement":
        return "Settlement";
      case "sale":
        return "Sale";
      default:
        return type.replace(/_/g, " ").toUpperCase();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Transaction Receipt</title>
  <style>
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 12px; 
      margin: 0; 
      padding: 20px; 
      max-width: 300px;
      background: white;
    }
    .header { 
      text-align: center; 
      margin-bottom: 20px; 
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
    }
    .logo { 
      width: 60px; 
      height: 60px; 
      margin: 0 auto 10px; 
    }
    .line { 
      border-bottom: 1px dashed #000; 
      margin: 10px 0; 
    }
    .row { 
      display: flex; 
      justify-content: space-between; 
      margin: 5px 0; 
    }
    .footer { 
      text-align: center; 
      margin-top: 20px; 
      font-size: 10px; 
      border-top: 1px solid #000;
      padding-top: 10px;
    }
    .title {
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      margin: 10px 0;
    }
    .total {
      font-weight: bold;
      font-size: 14px;
      border-top: 1px solid #000;
      padding-top: 5px;
    }
    @media print {
      body { margin: 0; padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="/logo.png" alt="MIMHAAD Logo" class="logo" />
    <h3>MIMHAAD FINANCIAL SERVICES</h3>
    <p>${data.branchName}</p>
    <p>Tel: 0241378880</p>
    <p>${formattedDate}</p>
  </div>
  
  <div class="title">${getModuleDisplayName(
    data.sourceModule
  )} TRANSACTION RECEIPT</div>
  
  <div class="line"></div>
  
  <div class="row">
    <span>Transaction ID:</span>
    <span>${data.transactionId}</span>
  </div>
  
  <div class="row">
    <span>Type:</span>
    <span>${getTransactionTypeDisplayName(data.transactionType)}</span>
  </div>
  
  ${
    data.customerName
      ? `
  <div class="row">
    <span>Customer:</span>
    <span>${data.customerName}</span>
  </div>
  `
      : ""
  }
  
  ${
    data.customerPhone
      ? `
  <div class="row">
    <span>Phone:</span>
    <span>${data.customerPhone}</span>
  </div>
  `
      : ""
  }
  
  ${
    data.additionalData
      ? Object.entries(data.additionalData)
          .map(
            ([key, value]) => `
  <div class="row">
    <span>${key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())}:</span>
    <span>${String(value)}</span>
  </div>
  `
          )
          .join("")
      : ""
  }
  
  <div class="row">
    <span>Amount:</span>
    <span>${formatCurrency(amount)}</span>
  </div>
  
  ${
    fee > 0
      ? `
  <div class="row">
    <span>Fee:</span>
    <span>${formatCurrency(fee)}</span>
  </div>
  `
      : ""
  }
  
  <div class="row">
    <span>Reference:</span>
    <span>${data.reference}</span>
  </div>
  
  <div class="line"></div>
  
  <div class="row total">
    <span>TOTAL:</span>
    <span>${formatCurrency(totalAmount)}</span>
  </div>
  
  <div class="footer">
    <p>Thank you for using our service!</p>
    <p>For inquiries, please call 0241378880</p>
    <p>Powered by MIMHAAD Financial Services</p>
  </div>
</body>
</html>
  `;
}
