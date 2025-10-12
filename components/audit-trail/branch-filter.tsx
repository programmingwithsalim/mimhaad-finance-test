"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface Branch {
  id: string
  name: string
}

interface BranchFilterProps {
  selectedBranches: string[]
  setSelectedBranches: (branches: string[]) => void
}

export function BranchFilter({ selectedBranches, setSelectedBranches }: BranchFilterProps) {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/branches")
        if (!response.ok) {
          throw new Error("Failed to fetch branches")
        }
        const data = await response.json()
        setBranches(data || [])
      } catch (error) {
        console.error("Error fetching branches:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBranches()
  }, [])

  const toggleBranch = (branchId: string) => {
    if (selectedBranches.includes(branchId)) {
      setSelectedBranches(selectedBranches.filter((id) => id !== branchId))
    } else {
      setSelectedBranches([...selectedBranches, branchId])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Branch</label>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
              {selectedBranches.length > 0 ? `${selectedBranches.length} selected` : "Select branches..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search branches..." />
              <CommandList>
                <CommandEmpty>No branch found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {branches.map((branch) => (
                    <CommandItem key={branch.id} value={branch.id} onSelect={() => toggleBranch(branch.id)}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedBranches.includes(branch.id) ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {branch.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {selectedBranches.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedBranches.map((branchId) => {
            const branch = branches.find((b) => b.id === branchId)
            return (
              <Badge key={branchId} variant="outline" className="flex items-center gap-1">
                {branch?.name || branchId}
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => toggleBranch(branchId)}>
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
