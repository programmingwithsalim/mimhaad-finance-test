"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

const severityLevels = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
]

interface SeverityFilterProps {
  selectedSeverities: string[]
  setSelectedSeverities: (severities: string[]) => void
}

export function SeverityFilter({ selectedSeverities, setSelectedSeverities }: SeverityFilterProps) {
  const [open, setOpen] = useState(false)

  const toggleSeverity = (severity: string) => {
    if (selectedSeverities.includes(severity)) {
      setSelectedSeverities(selectedSeverities.filter((level) => level !== severity))
    } else {
      setSelectedSeverities([...selectedSeverities, severity])
    }
  }

  const clearSelection = () => {
    setSelectedSeverities([])
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Severity</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedSeverities.length > 0 ? `${selectedSeverities.length} selected` : "Select severity levels..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search severity levels..." />
            <CommandList>
              <CommandEmpty>No severity level found.</CommandEmpty>
              {selectedSeverities.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={clearSelection} className="justify-center text-center">
                    Clear all selections
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {severityLevels.map((severity) => (
                  <CommandItem
                    key={severity.value}
                    value={severity.value}
                    onSelect={() => toggleSeverity(severity.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedSeverities.includes(severity.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {severity.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedSeverities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedSeverities.map((severity) => {
            const label = severityLevels.find((level) => level.value === severity)?.label || severity
            return (
              <Badge key={severity} variant="outline" className="flex items-center gap-1">
                {label}
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => toggleSeverity(severity)}>
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
