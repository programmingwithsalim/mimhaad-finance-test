"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { CreditCard, User, Building, Smartphone, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCardBatches, useIssuedCards } from "@/hooks/use-e-zwich";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";

interface PartnerBank {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

export function EZwichCardIssuance() {
  const { batches } = useCardBatches();
  const { issueCard } = useIssuedCards();
  const { toast } = useToast();
  const { user } = useCurrentUser();

  const [inventoryType, setInventoryType] = useState<string>("sim");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedPartnerBank, setSelectedPartnerBank] = useState<string>("");
  const [partnerBanks, setPartnerBanks] = useState<PartnerBank[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerIdNumber, setCustomerIdNumber] = useState<string>("");
  const [customerIdType, setCustomerIdType] = useState<string>("");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loadingBanks, setLoadingBanks] = useState<boolean>(true);

  // Fetch partner banks on component mount
  useEffect(() => {
    const fetchPartnerBanks = async () => {
      try {
        setLoadingBanks(true);

        // Use the dedicated E-Zwich partner banks endpoint
        const response = await fetch(
          `/api/float-accounts/ezwich-partners?branchId=${user?.branchId || ""}`
        );
        const data = await response.json();

        if (data.success) {
          setPartnerBanks(data.accounts || []);
        } else {
          console.error("Failed to fetch E-Zwich partner banks:", data.error);
          toast({
            title: "Error",
            description: "Failed to load E-Zwich partner banks",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching E-Zwich partner banks:", error);
        toast({
          title: "Error",
          description: "Failed to load E-Zwich partner banks",
          variant: "destructive",
        });
      } finally {
        setLoadingBanks(false);
      }
    };

    // Only fetch if user is available
    if (user?.branchId) {
      fetchPartnerBanks();
    }
  }, [user?.branchId, toast]);

  // Filter available batches by inventory type and quantity
  const availableBatches =
    batches?.filter(
      (batch) =>
        batch.quantity_available > 0 &&
        (batch.inventory_type === inventoryType ||
          (!batch.inventory_type && inventoryType === "e-zwich"))
    ) || [];

  // Debug logging
  useEffect(() => {
    console.log("Selected inventory type:", inventoryType);
    console.log("All batches:", batches);
    console.log("Filtered batches:", availableBatches);
  }, [inventoryType, batches, availableBatches]);

  // Get inventory type labels
  const getInventoryLabel = (type: string) => {
    switch (type) {
      case "sim":
        return { singular: "SIM Card", plural: "SIM Cards", icon: Smartphone };
      case "rollers":
        return {
          singular: "Roller Banner",
          plural: "Roller Banners",
          icon: Flag,
        };
      default:
        return { singular: "Item", plural: "Items", icon: Smartphone };
    }
  };

  const inventoryLabel = getInventoryLabel(inventoryType);
  const InventoryIcon = inventoryLabel.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simple validation - only need batch, name, phone, and item number
    if (!selectedBatch || !customerName || !customerPhone || !cardNumber) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Use simplified inventory API instead of E-Zwich card API
      const response = await fetch("/api/inventory/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: selectedBatch,
          item_number: cardNumber,
          customer_name: customerName,
          customer_phone: customerPhone,
          notes: `${inventoryLabel.singular} issuance`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to issue item");
      }

      toast({
        title: `${inventoryLabel.singular} issued successfully`,
        description: `${
          inventoryLabel.singular
        } ${cardNumber} has been issued to ${customerName} from batch ${
          selectedBatchData?.batch_code || "Unknown"
        }.`,
      });

      // Reset form
      setSelectedBatch("");
      setCustomerName("");
      setCustomerPhone("");
      setCardNumber("");
    } catch (error) {
      toast({
        title: `Failed to issue ${inventoryLabel.singular.toLowerCase()}`,
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBatchData = batches?.find(
    (batch) => batch.id === selectedBatch
  );
  const selectedBankData = partnerBanks.find(
    (bank) => bank.id === selectedPartnerBank
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <InventoryIcon className="h-5 w-5 mr-2" />
          Issue {inventoryLabel.singular}
        </CardTitle>
        <CardDescription>
          Issue a new {inventoryLabel.singular.toLowerCase()} to a customer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Inventory Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="inventoryType">Inventory Type *</Label>
            <Select
              value={inventoryType}
              onValueChange={(value) => {
                setInventoryType(value);
                setSelectedBatch(""); // Reset batch when type changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select inventory type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">
                  <div className="flex items-center">
                    <Smartphone className="h-4 w-4 mr-2" />
                    SIM Cards
                  </div>
                </SelectItem>
                <SelectItem value="rollers">
                  <div className="flex items-center">
                    <Flag className="h-4 w-4 mr-2" />
                    Roller Banners
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Batch Selection */}
          <div className="space-y-2">
            <Label htmlFor="batch">
              Select {inventoryLabel.singular} Batch *
            </Label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an available batch" />
              </SelectTrigger>
              <SelectContent>
                {availableBatches.length === 0 ? (
                  <SelectItem value="no-batch" disabled>
                    No {inventoryLabel.plural.toLowerCase()} batches available
                  </SelectItem>
                ) : (
                  availableBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {batch.batch_code}
                          </span>
                          <Badge variant="secondary">
                            {batch.quantity_available} available
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {batch.inventory_type || "e-zwich"} • Received:{" "}
                          {batch.quantity_received} • Issued:{" "}
                          {batch.quantity_issued}
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {availableBatches.length === 0 && (
              <div className="text-sm text-orange-600 mt-2">
                No {inventoryLabel.plural.toLowerCase()} batches found. Please
                add a batch with inventory_type = "{inventoryType}" first.
              </div>
            )}

            {selectedBatchData && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Selected Batch Details:
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium">Batch Code:</span>{" "}
                    {selectedBatchData.batch_code}
                  </div>
                  <div>
                    <span className="font-medium">Available:</span>{" "}
                    {selectedBatchData.quantity_available} cards
                  </div>
                  <div>
                    <span className="font-medium">Card Type:</span>{" "}
                    {selectedBatchData.card_type}
                  </div>
                  <div>
                    <span className="font-medium">Partner Bank:</span>{" "}
                    {selectedBatchData.partner_bank_name || "N/A"}
                  </div>
                  <div>
                    <span className="font-medium">Total Received:</span>{" "}
                    {selectedBatchData.quantity_received}
                  </div>
                  <div>
                    <span className="font-medium">Already Issued:</span>{" "}
                    {selectedBatchData.quantity_issued}
                  </div>
                </div>
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <span className="font-medium text-blue-800">
                    ⚠️ This batch will be deducted by 1{" "}
                    {inventoryLabel.singular.toLowerCase()} when you issue.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card/Item Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Item ID / Serial Number *</Label>
            <Input
              id="cardNumber"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder={
                inventoryType === "sim"
                  ? "Enter SIM card number or ICCID"
                  : "Enter serial number or identifier"
              }
              required
            />
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <Label className="text-base font-medium">
                {inventoryType === "rollers"
                  ? "Client Information"
                  : "Customer Information"}
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">
                  {inventoryType === "rollers"
                    ? "Client/Company Name"
                    : "Full Name"}{" "}
                  *
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={
                    inventoryType === "rollers"
                      ? "Client or company name"
                      : "Customer full name"
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+233 XX XXX XXXX"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || availableBatches.length === 0}
            >
              {isSubmitting ? "Issuing..." : `Issue ${inventoryLabel.singular}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
