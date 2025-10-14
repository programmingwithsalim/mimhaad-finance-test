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
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw,
  Filter,
  X,
  Calendar as CalendarIcon,
  Building2,
  ChevronRight,
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
    <Card className="shadow-md">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Report Filters</h3>
          </div>

          {/* Main Filter Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Date Range Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Date Range
              </label>

              {/* Date Range Picker Button */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-11"
                    aria-label="Select date range"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {dateRange?.from && dateRange?.to ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {format(dateRange.from, "MMM dd, yyyy")}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(dateRange.to, "MMM dd, yyyy")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        Select date range
                      </span>
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
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDateRange(7)}
                  className="text-sm h-9"
                >
                  Last 7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDateRange(30)}
                  className="text-sm h-9"
                >
                  Last 30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthRange(0)}
                  className="text-sm h-9"
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthRange(1)}
                  className="text-sm h-9"
                >
                  Last Month
                </Button>
              </div>
            </div>

            {/* Branch Selector Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Branch
              </label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  {canViewAllBranches && (
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-medium">All Branches</span>
                      </div>
                    </SelectItem>
                  )}
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {branch.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">
                Actions
              </label>
              <div className="flex flex-col gap-2">
                <Button
                  variant="default"
                  onClick={onApply}
                  disabled={loading}
                  className="h-11 w-full"
                >
                  <RefreshCw
                    className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
                  />
                  {loading ? "Loading..." : "Apply Filters"}
                </Button>
                <Button
                  variant="outline"
                  onClick={onReset}
                  disabled={loading}
                  className="h-11 w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
