"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBranch } from "@/contexts/branch-context";
import { Badge } from "@/components/ui/badge";

interface BranchSelectorProps {
  onBranchChange?: (branchId: string) => void;
  className?: string;
  showActiveOnly?: boolean;
}

export function BranchSelector({
  onBranchChange,
  className,
  showActiveOnly = true,
}: BranchSelectorProps) {
  const { branches, selectedBranchId, setSelectedBranchId, loading, error } =
    useBranch();
  const [open, setOpen] = useState(false);

  console.log("BranchSelector - Loading:", loading);
  console.log("BranchSelector - Branches:", branches);
  console.log("BranchSelector - Error:", error);
  console.log("BranchSelector - Selected Branch ID:", selectedBranchId);

  // Filter branches if showActiveOnly is true
  const filteredBranches = showActiveOnly
    ? branches.filter((branch) => branch.status === "active")
    : branches;

  console.log("BranchSelector - Filtered Branches:", filteredBranches);

  // Handle branch selection
  const handleSelect = (branchId: string) => {
    console.log("BranchSelector - Selecting branch:", branchId);
    setSelectedBranchId(branchId);
    if (onBranchChange) {
      onBranchChange(branchId);
    }
    setOpen(false);
  };

  // Get the selected branch name
  const selectedBranchName = selectedBranchId
    ? branches.find((branch) => branch.id === selectedBranchId)?.name
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={false} // Temporarily disabled loading check
        >
          {selectedBranchId ? (
            <div className="flex items-center">
              <Building className="mr-2 h-4 w-4" />
              {selectedBranchName}
            </div>
          ) : (
            <div className="flex items-center text-muted-foreground">
              <Building className="mr-2 h-4 w-4" />
              {loading ? "Loading branches..." : "Select branch"}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search branches..." />
          <CommandList>
            <CommandEmpty>No branches found.</CommandEmpty>
            <CommandGroup>
              {filteredBranches.map((branch) => (
                <CommandItem
                  key={branch.id}
                  value={branch.id}
                  onSelect={() => handleSelect(branch.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedBranchId === branch.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{branch.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {branch.location}
                    </span>
                  </div>
                  {branch.status === "inactive" && (
                    <Badge variant="outline" className="ml-auto">
                      Inactive
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
