// Core audit log types
export interface AuditLog {
  id: string;
  userId?: string;
  username: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  description: string;
  details?: any;
  severity: "low" | "medium" | "high" | "critical";
  status: "success" | "failure";
  branchId?: string;
  branchName?: string;
  ipAddress?: string;
  userAgent?: string;
  errorMessage?: string;
  relatedEntities?: any;
  metadata?: any;
  timestamp: string;
}

// API response types
export interface AuditLogsResponse {
  success: boolean;
  data?: {
    logs: AuditLog[];
    pagination: PaginationInfo;
  };
  error?: string;
  details?: any;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Statistics types
export interface AuditStatistics {
  totalLogs: number;
  criticalEvents: number;
  failedActions: number;
  activeUsers: number;
  recentActivity: AuditLog[];
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  actionTypeBreakdown: Record<string, number>;
  dailyActivity: DailyActivity[];
}

export interface DailyActivity {
  date: string;
  total: number;
  critical: number;
  failures: number;
}

// Filter types
export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string[];
  actionType?: string[];
  entityType?: string[];
  severity?: string[];
  status?: ("success" | "failure")[];
  branchId?: string[];
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}

// Action type definitions
export interface ActionTypeGroup {
  label: string;
  actions: ActionType[];
}

export interface ActionType {
  value: string;
  label: string;
}

// Entity type definitions
export interface EntityTypeGroup {
  label: string;
  entities: EntityType[];
}

export interface EntityType {
  value: string;
  label: string;
}

// Component props
export interface AuditTrailDashboardProps {
  initialFilters?: AuditLogFilters;
  showStatistics?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
}

export interface AuditLogTableProps {
  logs: AuditLog[];
  loading: boolean;
  onLogClick?: (log: AuditLog) => void;
  selectedLog?: AuditLog | null;
}

export interface FilterProps {
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  label: string;
}

// Export types
export interface ExportOptions {
  format: "csv" | "excel" | "pdf";
  filters?: AuditLogFilters;
  includeDetails?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ExportResponse {
  success: boolean;
  data?: {
    exportId: string;
    downloadUrl?: string;
    expiresAt?: string;
  };
  error?: string;
}

// Legacy type for backward compatibility
export interface AuditTrailEntry {
  userId: string;
  action: string;
  actionType: string;
  timestamp: string;
  transactionId?: string;
  details?: string;
  ipAddress: string;
}
