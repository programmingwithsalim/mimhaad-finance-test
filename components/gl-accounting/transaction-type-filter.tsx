"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Transaction types
const transactionTypes = [
  { value: "Auto-posted", label: "Auto-posted" },
  { value: "Manual", label: "Manual" },
]

interface TransactionTypeFilterProps {
  selectedType: string | null
  onTypeChange: (value: string | null) => void
}

export function TransactionTypeFilter({ selectedType, onTypeChange }: TransactionTypeFilterProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selectedType ? transactionTypes.find((type) => type.value === selectedType)?.label : "Transaction Type"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search types..." />
          <CommandList>
            <CommandEmpty>No type found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="all"
                value="all"
                onSelect={() => {
                  onTypeChange(null)
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !selectedType ? "opacity-100" : "opacity-0")} />
                All Types
              </CommandItem>
              {transactionTypes.map((type) => (
                <CommandItem
                  key={type.value}
                  value={type.value}
                  onSelect={() => {
                    onTypeChange(type.value)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedType === type.value ? "opacity-100" : "opacity-0")} />
                  {type.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
