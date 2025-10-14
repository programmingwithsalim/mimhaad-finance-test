// Commission source types
export type CommissionSource =
  | "mtn"
  | "vodafone"
  | "airtel-tigo"
  | "jumia"
  | "vra"
  | "ecg"
  | "agency-banking"
  | "bank"
  | "other";

// Simplified commission status types - removed approval/rejection
export type CommissionStatus = "pending" | "approved" | "rejected" | "paid";

// Payment status types
export type PaymentStatus = "pending" | "completed" | "failed";

// Payment method types
export type PaymentMethod = "bank_transfer" | "check" | "cash" | "other";

// User reference type
export interface UserReference {
  id: string;
  name: string;
}

// Payment information type
export interface PaymentInfo {
  status: PaymentStatus;
  method: PaymentMethod;
  receivedAt?: string;
  bankAccount?: string;
  referenceNumber?: string;
  notes?: string;
}

// Attachment type
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: UserReference;
  url?: string;
}

// Comment type
export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  createdBy: UserReference;
}

// Main commission type
export interface Commission {
  id: string;
  source: CommissionSource;
  sourceName: string; // Partner company name
  amount: number;
  month: string; // Period covered (ISO date string for first day of month)
  reference: string; // Partner's reference ID or our internal reference
  description?: string; // Details about the commission
  status: CommissionStatus;
  glAccount: string; // GL account for revenue recognition
  glAccountName: string;
  createdAt: string;
  createdBy: UserReference;
  updatedAt?: string;
  updatedBy?: UserReference;
  // Approval fields
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_comments?: string;
  // Payment fields
  payment?: PaymentInfo;
  attachments?: Attachment[];
  comments?: Comment[];
  // Receipt fields
  receipt_filename?: string;
  receipt_size?: number;
  receipt_type?: string;
  // Branch fields
  branchId?: string;
  branchName?: string;
  // Additional fields from database
  transactionVolume?: number;
  commissionRate?: number;
  notes?: string;
  metadata?: {
    transactionVolume?: number; // Number of transactions processed
    commissionRate?: string; // Rate charged by partner
    settlementPeriod?: string; // How often partner pays (Monthly, Quarterly, etc.)
    [key: string]: any;
  };
}

// Commission creation input type (for forms)
export type CommissionInput = Omit<
  Commission,
  | "id"
  | "createdAt"
  | "createdBy"
  | "updatedAt"
  | "updatedBy"
  | "status"
  | "payment"
  | "attachments"
  | "comments"
> & {
  attachmentFiles?: File[];
};

// Commission summary type (for listings)
export interface CommissionSummary {
  id: string;
  source: CommissionSource;
  sourceName: string;
  amount: number;
  month: string;
  reference: string;
  status: CommissionStatus;
  createdAt: string;
}

// Commission filter options
export interface CommissionFilters {
  source?: CommissionSource[];
  status?: CommissionStatus[];
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

// Commission statistics - simplified for our two-status system
export interface CommissionStatistics {
  totalAmount: number;
  totalCount: number;
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
  bySource: Record<
    CommissionSource,
    {
      count: number;
      amount: number;
    }
  >;
  byMonth: Record<
    string,
    {
      count: number;
      amount: number;
    }
  >;
  monthlyTrends?: {
    month: string;
    amount: number;
  }[];
}
