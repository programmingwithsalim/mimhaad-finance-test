"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

const entityTypes = [
  { value: "user", label: "User" },
  { value: "transaction", label: "Transaction" },
  { value: "float_account", label: "Float Account" },
  { value: "branch", label: "Branch" },
  { value: "expense", label: "Expense" },
  { value: "commission", label: "Commission" },
  { value: "report", label: "Report" },
  { value: "system_config", label: "System Config" },
  { value: "role", label: "Role" },
  { value: "permission", label: "Permission" },
  { value: "gl_account", label: "GL Account" },
  { value: "gl_transaction", label: "GL Transaction" },
  { value: "cash_till", label: "Cash Till" },
  { value: "agency_banking", label: "Agency Banking" },
  { value: "momo", label: "MoMo" },
  { value: "e_zwich", label: "E-Zwich" },
  { value: "power", label: "Power" },
  { value: "jumia", label: "Jumia" },
]

interface EntityTypeFilterProps {
  selectedEntityTypes: string[]
  setSelectedEntityTypes: (entityTypes: string[]) => void
}

export function EntityTypeFilter({ selectedEntityTypes, setSelectedEntityTypes }: EntityTypeFilterProps) {
  const [open, setOpen] = useState(false)

  const toggleEntityType = (entityType: string) => {
    if (selectedEntityTypes.includes(entityType)) {
      setSelectedEntityTypes(selectedEntityTypes.filter((type) => type !== entityType))
    } else {
      setSelectedEntityTypes([...selectedEntityTypes, entityType])
    }
  }

  const clearSelection = () => {
    setSelectedEntityTypes([])
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Entity Type</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedEntityTypes.length > 0 ? `${selectedEntityTypes.length} selected` : "Select entity types..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search entity types..." />
            <CommandList>
              <CommandEmpty>No entity type found.</CommandEmpty>
              {selectedEntityTypes.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={clearSelection} className="justify-center text-center">
                    Clear all selections
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup className="max-h-64 overflow-auto">
                {entityTypes.map((entityType) => (
                  <CommandItem
                    key={entityType.value}
                    value={entityType.value}
                    onSelect={() => toggleEntityType(entityType.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedEntityTypes.includes(entityType.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {entityType.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedEntityTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedEntityTypes.map((entityType) => {
            const label = entityTypes.find((type) => type.value === entityType)?.label || entityType
            return (
              <Badge key={entityType} variant="outline" className="flex items-center gap-1">
                {label}
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => toggleEntityType(entityType)}>
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
