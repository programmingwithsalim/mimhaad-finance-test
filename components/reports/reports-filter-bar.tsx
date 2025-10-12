import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Filter,
  X,
  Calendar as CalendarIcon,
  Building2,
} from "lucide-react";
import { format, subDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
}

interface ReportsFilterBarProps {
  dateRange: { from: Date; to: Date };
  setDateRange: (range: { from: Date; to: Date }) => void;
  branches: Branch[];
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  canViewAllBranches: boolean;
  onApply: () => void;
  onReset: () => void;
  loading?: boolean;
}

export function ReportsFilterBar({
  dateRange,
  setDateRange,
  branches,
  selectedBranch,
  setSelectedBranch,
  canViewAllBranches,
  onApply,
  onReset,
  loading,
}: ReportsFilterBarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Quick presets
  const setQuickDateRange = (days: number) => {
    const to = new Date();
    const from = subDays(to, days);
    setDateRange({ from, to });
  };
  const setMonthRange = (monthsBack: number) => {
    const date = subMonths(new Date(), monthsBack);
    setDateRange({ from: startOfMonth(date), to: endOfMonth(date) });
  };

  return (
    <div className="bg-background border-b border-muted shadow-sm sm:px-3 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full">
      {/* Filter Icon (mobile) */}
      <span className="sm:hidden flex items-center text-muted-foreground">
        <Filter className="h-5 w-5 mr-1" /> Filters
      </span>
      {/* Date Range Picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 min-w-[180px]"
            aria-label="Select date range"
          >
            <CalendarIcon className="h-4 w-4" />
            {dateRange?.from && dateRange?.to ? (
              <span>
                {format(dateRange.from, "MMM dd")} -{" "}
                {format(dateRange.to, "MMM dd, yyyy")}
              </span>
            ) : (
              <span>Pick date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={setDateRange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      {/* Quick Presets */}
      <div className="flex gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQuickDateRange(7)}
          className="text-xs px-2"
        >
          7D
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQuickDateRange(30)}
          className="text-xs px-2"
        >
          30D
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonthRange(0)}
          className="text-xs px-2"
        >
          This Month
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMonthRange(1)}
          className="text-xs px-2"
        >
          Last Month
        </Button>
      </div>
      {/* Branch Selector */}
      <div className="min-w-[160px]">
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="h-10">
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Select Branch" />
          </SelectTrigger>
          <SelectContent>
            {canViewAllBranches && (
              <SelectItem value="all">All Branches</SelectItem>
            )}
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Apply & Reset Buttons */}
      <div className="flex gap-2 ml-auto">
        <Button
          variant="default"
          onClick={onApply}
          disabled={loading}
          className="px-4"
        >
          <RefreshCw
            className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
          />
          Apply
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          disabled={loading}
          className="px-4"
        >
          <X className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}
