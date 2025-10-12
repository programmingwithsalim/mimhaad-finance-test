"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BankDetailsCard } from "./bank-details-card"
import { BankSelector } from "./bank-selector"
import { Building2, ChevronRight } from "lucide-react"
import type { PartnerBank } from "@/hooks/use-partner-banks"

interface PartnerBanksDialogProps {
  banks: PartnerBank[]
  onBankSelect?: (bankId: string) => void
}

export function PartnerBanksDialog({ banks, onBankSelect }: PartnerBanksDialogProps) {
  const [selectedBankId, setSelectedBankId] = useState<string>(banks[0]?.id || "")
  const [open, setOpen] = useState(false)

  const handleBankSelect = (bankId: string) => {
    setSelectedBankId(bankId)
    if (onBankSelect) {
      onBankSelect(bankId)
      setOpen(false)
    }
  }

  const selectedBank = banks.find((bank) => bank.id === selectedBankId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center">
            <Building2 className="mr-2 h-4 w-4" />
            <span>View Partner Banks</span>
          </div>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Partner Banks</DialogTitle>
          <DialogDescription>
            View details of our partner banks or select a bank for your transaction.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="list" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Bank List</TabsTrigger>
            <TabsTrigger value="details">Bank Details</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <BankSelector banks={banks} selectedBankId={selectedBankId} onBankSelect={handleBankSelect} />
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            {selectedBank ? (
              <BankDetailsCard bank={selectedBank} />
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No bank selected. Please select a bank from the list.
              </div>
            )}
          </TabsContent>
        </Tabs>

        {onBankSelect && (
          <div className="flex justify-end mt-4">
            <Button onClick={() => handleBankSelect(selectedBankId)}>Select Bank</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
