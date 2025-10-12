"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface Bank {
  id: string
  name: string
  code: string
  logo?: string
  interestRate: number
  transferFee: number
  minFee: number
  maxFee: number
  status: "active" | "inactive" | "maintenance"
}

interface BankSelectorProps {
  banks: Bank[]
  selectedBankId: string
  onBankSelect: (bankId: string) => void
}

export function BankSelector({ banks, selectedBankId, onBankSelect }: BankSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredBanks = banks.filter(
    (bank) =>
      bank.status === "active" &&
      (bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bank.code.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search banks..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <RadioGroup value={selectedBankId} onValueChange={onBankSelect} className="space-y-2">
          {filteredBanks.map((bank) => (
            <div
              key={bank.id}
              className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
              onClick={() => onBankSelect(bank.id)}
            >
              <RadioGroupItem value={bank.id} id={`bank-${bank.id}`} />
              <Label htmlFor={`bank-${bank.id}`} className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{bank.name}</div>
                    <div className="text-sm text-muted-foreground">Fee: {(bank.transferFee * 100).toFixed(1)}%</div>
                  </div>
                  <Badge variant="outline">{bank.code}</Badge>
                </div>
              </Label>
            </div>
          ))}

          {filteredBanks.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">No banks found matching "{searchQuery}"</div>
          )}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
