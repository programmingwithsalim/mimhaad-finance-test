"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

const statuses = [
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
]

interface StatusFilterProps {
  selectedStatuses: ("success" | "failure")[]
  setSelectedStatuses: (statuses: ("success" | "failure")[]) => void
}

export function StatusFilter({ selectedStatuses, setSelectedStatuses }: StatusFilterProps) {
  const [open, setOpen] = useState(false)

  const toggleStatus = (status: "success" | "failure") => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s !== status))
    } else {
      setSelectedStatuses([...selectedStatuses, status])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Status</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedStatuses.length > 0 ? `${selectedStatuses.length} selected` : "Select statuses..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search statuses..." />
            <CommandList>
              <CommandEmpty>No status found.</CommandEmpty>
              <CommandGroup>
                {statuses.map((status) => (
                  <CommandItem
                    key={status.value}
                    value={status.value}
                    onSelect={() => toggleStatus(status.value as "success" | "failure")}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedStatuses.includes(status.value as "success" | "failure") ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {status.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedStatuses.map((status) => {
            const label = statuses.find((s) => s.value === status)?.label || status
            return (
              <Badge key={status} variant="outline" className="flex items-center gap-1">
                {label}
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => toggleStatus(status)}>
                  ×
                </Button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
