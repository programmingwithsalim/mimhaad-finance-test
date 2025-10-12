"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { CreditCard, User, Building } from "lucide-react";

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

  // Filter available batches (those with cards remaining)
  const availableBatches =
    batches?.filter((batch) => batch.quantity_available > 0) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !selectedBatch ||
      !selectedPartnerBank ||
      !customerName ||
      !customerPhone ||
      !customerIdNumber ||
      !customerIdType ||
      !cardNumber
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await issueCard({
        card_number: cardNumber,
        batch_id: selectedBatch,
        partner_bank: selectedPartnerBank,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_id_number: customerIdNumber,
        customer_id_type: customerIdType,
      });

      toast({
        title: "Card issued successfully",
        description: `Card ${cardNumber} has been issued to ${customerName} from batch ${
          selectedBatchData?.batch_code || "Unknown"
        }.`,
      });

      // Reset form
      setSelectedBatch("");
      setSelectedPartnerBank("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerIdNumber("");
      setCustomerIdType("");
      setCardNumber("");
    } catch (error) {
      toast({
        title: "Failed to issue card",
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
          <CreditCard className="h-5 w-5 mr-2" />
          Issue New E-Zwich Card
        </CardTitle>
        <CardDescription>
          Issue a new E-Zwich card to a customer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Partner Bank Selection */}
          <div className="space-y-2">
            <Label htmlFor="partnerBank">Partner Bank *</Label>
            <Select
              value={selectedPartnerBank}
              onValueChange={setSelectedPartnerBank}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingBanks
                      ? "Loading partner banks..."
                      : "Select partner bank"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {partnerBanks.map((bank) => (
                  <SelectItem key={bank.id} value={bank.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{bank.bank_name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {bank.account_name}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBankData && (
              <div className="text-sm text-muted-foreground">
                Bank: {selectedBankData.bank_name} • Account:{" "}
                {selectedBankData.account_name} • Balance: GHS{" "}
                {selectedBankData.current_balance.toLocaleString()}
              </div>
            )}
          </div>

          {/* Batch Selection */}
          <div className="space-y-2">
            <Label htmlFor="batch">Select Card Batch *</Label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an available batch" />
              </SelectTrigger>
              <SelectContent>
                {availableBatches.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{batch.batch_code}</span>
                        <Badge variant="secondary">
                          {batch.quantity_available} available
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {batch.partner_bank_name &&
                          `Bank: ${batch.partner_bank_name} • `}
                        Type: {batch.card_type} • Received:{" "}
                        {batch.quantity_received} • Issued:{" "}
                        {batch.quantity_issued}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                    ⚠️ This batch will be deducted by 1 card when you issue.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number *</Label>
            <Input
              id="cardNumber"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Enter 16-20 digit card number"
              pattern="[0-9]{16,20}"
              required
            />
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <Label className="text-base font-medium">
                Customer Information
              </Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Full Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer full name"
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

              <div className="space-y-2">
                <Label htmlFor="customerIdType">ID Type *</Label>
                <Select
                  value={customerIdType}
                  onValueChange={setCustomerIdType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">
                      Driver's License
                    </SelectItem>
                    <SelectItem value="voters_id">Voter's ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerIdNumber">ID Number *</Label>
                <Input
                  id="customerIdNumber"
                  value={customerIdNumber}
                  onChange={(e) => setCustomerIdNumber(e.target.value)}
                  placeholder="Enter ID number"
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
              disabled={
                isSubmitting ||
                availableBatches.length === 0 ||
                partnerBanks.length === 0
              }
            >
              {isSubmitting ? "Issuing..." : "Issue Card"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
