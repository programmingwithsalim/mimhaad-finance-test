"use client";

import { DateRangePicker } from "@/components/gl-accounting/date-range-picker";
import { ActionTypeFilter } from "./action-type-filter";
import { EntityTypeFilter } from "./entity-type-filter";
import { SeverityFilter } from "./severity-filter";
import { StatusFilter } from "./status-filter";
import { BranchFilter } from "./branch-filter";
import { UserFilter } from "./user-filter";
import type { AuditLogFilters } from "./types";
import type { DateRange } from "react-day-picker";

interface AuditFiltersProps {
  filters: AuditLogFilters;
  onFilterChange: (newFilters: Partial<AuditLogFilters>) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  showBranchFilter?: boolean;
}

export function AuditFilters({
  filters,
  onFilterChange,
  searchTerm,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  showBranchFilter = true,
}: AuditFiltersProps) {
  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date Range</label>
        <DateRangePicker onDateRangeChange={onDateRangeChange} />
      </div>

      {/* Filter Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <UserFilter
          selectedUsers={filters.userId || []}
          setSelectedUsers={(users) => onFilterChange({ userId: users })}
        />

        <ActionTypeFilter
          selectedActionTypes={filters.actionType || []}
          setSelectedActionTypes={(actions) =>
            onFilterChange({ actionType: actions })
          }
        />

        <EntityTypeFilter
          selectedEntityTypes={filters.entityType || []}
          setSelectedEntityTypes={(entities) =>
            onFilterChange({ entityType: entities })
          }
        />

        <SeverityFilter
          selectedSeverities={filters.severity || []}
          setSelectedSeverities={(severities) =>
            onFilterChange({ severity: severities })
          }
        />

        <StatusFilter
          selectedStatuses={filters.status || []}
          setSelectedStatuses={(statuses) =>
            onFilterChange({ status: statuses })
          }
        />

        {showBranchFilter && (
          <BranchFilter
            selectedBranches={filters.branchId || []}
            setSelectedBranches={(branches) =>
              onFilterChange({ branchId: branches })
            }
          />
        )}
      </div>
    </div>
  );
}
