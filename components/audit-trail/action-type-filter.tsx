"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

const actionTypeGroups = [
  {
    label: "Authentication",
    actions: [
      { value: "login", label: "Login" },
      { value: "logout", label: "Logout" },
      { value: "password_reset", label: "Password Reset" },
      { value: "failed_login_attempt", label: "Failed Login Attempt" },
    ],
  },
  {
    label: "CRUD Operations",
    actions: [
      { value: "create", label: "Create" },
      { value: "update", label: "Update" },
      { value: "delete", label: "Delete" },
      { value: "view", label: "View" },
    ],
  },
  {
    label: "Transactions",
    actions: [
      { value: "transaction_deposit", label: "Deposit" },
      { value: "transaction_withdrawal", label: "Withdrawal" },
      { value: "transaction_transfer", label: "Transfer" },
      { value: "transaction_reversal", label: "Reversal" },
      { value: "transaction_approval", label: "Approval" },
      { value: "transaction_rejection", label: "Rejection" },
    ],
  },
  {
    label: "Float",
    actions: [
      { value: "float_addition", label: "Addition" },
      { value: "float_withdrawal", label: "Withdrawal" },
      { value: "float_adjustment", label: "Adjustment" },
      { value: "float_allocation", label: "Allocation" },
      { value: "float_reconciliation", label: "Reconciliation" },
    ],
  },
  {
    label: "Export",
    actions: [
      { value: "export_data", label: "Data Export" },
      { value: "export_report", label: "Report Export" },
      { value: "export_logs", label: "Logs Export" },
    ],
  },
  {
    label: "System",
    actions: [
      { value: "system_config_change", label: "Config Change" },
      { value: "permission_change", label: "Permission Change" },
      { value: "role_change", label: "Role Change" },
      { value: "branch_change", label: "Branch Change" },
      { value: "system_error", label: "System Error" },
    ],
  },
]

// Flatten all action types for easier lookup
const allActionTypes = actionTypeGroups.flatMap((group) => group.actions)

interface ActionTypeFilterProps {
  selectedActionTypes: string[]
  setSelectedActionTypes: (actionTypes: string[]) => void
}

export function ActionTypeFilter({ selectedActionTypes, setSelectedActionTypes }: ActionTypeFilterProps) {
  const [open, setOpen] = useState(false)

  const toggleActionType = (actionType: string) => {
    if (selectedActionTypes.includes(actionType)) {
      setSelectedActionTypes(selectedActionTypes.filter((type) => type !== actionType))
    } else {
      setSelectedActionTypes([...selectedActionTypes, actionType])
    }
  }

  const clearSelection = () => {
    setSelectedActionTypes([])
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Action Type</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedActionTypes.length > 0 ? `${selectedActionTypes.length} selected` : "Select action types..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search action types..." />
            <CommandList>
              <CommandEmpty>No action type found.</CommandEmpty>
              {selectedActionTypes.length > 0 && (
                <>
                  <CommandGroup>
                    <CommandItem onSelect={clearSelection} className="justify-center text-center">
                      Clear all selections
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              {actionTypeGroups.map((group, groupIndex) => (
                <div key={group.label}>
                  {groupIndex > 0 && <CommandSeparator />}
                  <CommandGroup heading={group.label}>
                    {group.actions.map((action) => (
                      <CommandItem
                        key={action.value}
                        value={action.value}
                        onSelect={() => toggleActionType(action.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedActionTypes.includes(action.value) ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {action.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedActionTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedActionTypes.map((actionType) => {
            const action = allActionTypes.find((a) => a.value === actionType)
            return (
              <Badge key={actionType} variant="outline" className="flex items-center gap-1">
                {action?.label || actionType}
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => toggleActionType(actionType)}>
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
