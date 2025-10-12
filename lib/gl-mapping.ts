/**
 * GL Mapping System
 *
 * This module provides the core mapping system between transactions and GL accounts.
 * It defines the structure for mapping different transaction types to their corresponding
 * GL accounts and provides utility functions for working with these mappings.
 */

// Types of transaction sources in the system
export type TransactionSource =
  | "momo" // Mobile Money
  | "agency-banking" // Agency Banking
  | "e-zwich" // E-Zwich
  | "jumia" // Jumia Collections
  | "power" // Power Transactions
  | "expenses" // Expense Management
  | "commissions" // Commission Management
  | "float" // Float Management
  | "cash-till" // Cash Till Operations
  | "manual"; // Manual Journal Entries

// GL Account Mapping interface
export interface GLAccountMapping {
  id: string;
  serviceModule: string;
  transactionType: string;
  debitAccountId: string;
  creditAccountId: string;
  description: string;
  isActive: boolean;
  conditions?: MappingCondition[];
}

// Conditions for more complex mapping rules
export interface MappingCondition {
  field: string;
  operator:
    | "equals"
    | "not-equals"
    | "greater-than"
    | "less-than"
    | "contains"
    | "starts-with"
    | "ends-with";
  value: string | number | boolean;
}

// Transaction data interface - generic structure that all transaction types should conform to
export interface TransactionData {
  id: string;
  type: string;
  amount: number;
  date: string;
  source: TransactionSource;
  branchId?: string;
  userId?: string;
  reference?: string;
  metadata?: Record<string, any>;
  [key: string]: any; // Allow for additional properties specific to each transaction type
}

// Journal Entry Line interface
export interface JournalEntryLine {
  accountId: string;
  debit?: number;
  credit?: number;
  description: string;
  metadata?: Record<string, any>;
}

// Journal Entry interface
export interface JournalEntry {
  id: string;
  transactionId: string;
  transactionSource: TransactionSource;
  transactionType: string;
  date: string;
  entries: JournalEntryLine[];
  description: string;
  status: "pending" | "posted" | "reversed";
  createdBy: string;
  createdAt: string;
  postedBy?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  metadata?: Record<string, any>;
}

// Default GL mappings for common transaction types
export const defaultGLMappings: GLAccountMapping[] = [
  // Mobile Money Transactions
  {
    id: "mapping-momo-cash-in",
    serviceModule: "momo",
    transactionType: "cash-in",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "2001", // Accounts Payable (Customer Liability)
    description: "MoMo Cash In Transaction",
    isActive: true,
  },
  {
    id: "mapping-momo-cash-out",
    serviceModule: "momo",
    transactionType: "cash-out",
    debitAccountId: "2001", // Accounts Payable (Customer Liability)
    creditAccountId: "1001", // Cash in Bank
    description: "MoMo Cash Out Transaction",
    isActive: true,
  },
  {
    id: "mapping-momo-commission",
    serviceModule: "momo",
    transactionType: "commission",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "4001", // Commission Revenue
    description: "MoMo Commission Revenue",
    isActive: true,
  },

  // Agency Banking Transactions
  {
    id: "mapping-agency-deposit",
    serviceModule: "agency-banking",
    transactionType: "deposit",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "2001", // Accounts Payable (Customer Liability)
    description: "Agency Banking Deposit",
    isActive: true,
  },
  {
    id: "mapping-agency-withdrawal",
    serviceModule: "agency-banking",
    transactionType: "withdrawal",
    debitAccountId: "2001", // Accounts Payable (Customer Liability)
    creditAccountId: "1001", // Cash in Bank
    description: "Agency Banking Withdrawal",
    isActive: true,
  },
  {
    id: "mapping-agency-commission",
    serviceModule: "agency-banking",
    transactionType: "commission",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "4001", // Commission Revenue
    description: "Agency Banking Commission Revenue",
    isActive: true,
  },

  // E-Zwich Transactions - Updated to use dynamic settlement account
  {
    id: "mapping-ezwich-issue",
    serviceModule: "e-zwich",
    transactionType: "issue",
    debitAccountId: "1001", // Cash in Till
    creditAccountId: "4002", // E-Zwich Revenue
    description: "E-Zwich Card Issuance Fee",
    isActive: true,
  },
  {
    id: "mapping-ezwich-withdrawal",
    serviceModule: "e-zwich",
    transactionType: "withdrawal",
    debitAccountId: "1002", // E-Zwich Settlement Account
    creditAccountId: "1001", // Cash in Till
    description: "E-Zwich Withdrawal",
    isActive: true,
  },
  {
    id: "mapping-ezwich-fee",
    serviceModule: "e-zwich",
    transactionType: "fee",
    debitAccountId: "1002", // E-Zwich Settlement Account
    creditAccountId: "4003", // Transaction Fee Income
    description: "E-Zwich Transaction Fee",
    isActive: true,
  },

  // Power Transactions - NEW MAPPINGS
  {
    id: "mapping-power-sale",
    serviceModule: "power",
    transactionType: "sale",
    debitAccountId: "1001", // Cash in Bank (received from customer)
    creditAccountId: "1004", // Power Float Account (power inventory reduced)
    description: "Power Sale Transaction",
    isActive: true,
  },
  {
    id: "mapping-power-purchase",
    serviceModule: "power",
    transactionType: "purchase",
    debitAccountId: "1004", // Power Float Account (power inventory increased)
    creditAccountId: "1001", // Cash in Bank (paid to supplier)
    description: "Power Purchase Transaction",
    isActive: true,
  },
  {
    id: "mapping-power-commission",
    serviceModule: "power",
    transactionType: "commission",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "4004", // Power Commission Revenue
    description: "Power Commission Revenue",
    isActive: true,
  },

  // Jumia Transactions
  {
    id: "mapping-jumia-collection",
    serviceModule: "jumia",
    transactionType: "collection",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "2002", // Jumia Payable
    description: "Jumia Collection",
    isActive: true,
  },
  {
    id: "mapping-jumia-settlement",
    serviceModule: "jumia",
    transactionType: "settlement",
    debitAccountId: "2002", // Jumia Payable
    creditAccountId: "1001", // Cash in Bank
    description: "Jumia Settlement",
    isActive: true,
  },
  {
    id: "mapping-jumia-commission",
    serviceModule: "jumia",
    transactionType: "commission",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "4005", // Jumia Commission Revenue
    description: "Jumia Commission Revenue",
    isActive: true,
  },

  // Expense Transactions
  {
    id: "mapping-expenses-payment",
    serviceModule: "expenses",
    transactionType: "payment",
    debitAccountId: "5001", // Expense Account (will be overridden based on expense type)
    creditAccountId: "1001", // Cash in Bank
    description: "Expense Payment",
    isActive: true,
  },

  // Float Management
  {
    id: "mapping-float-allocation",
    serviceModule: "float",
    transactionType: "allocation",
    debitAccountId: "1003", // Petty Cash / Float Account
    creditAccountId: "1001", // Cash in Bank
    description: "Float Allocation to Agent/Branch",
    isActive: true,
  },
  {
    id: "mapping-float-return",
    serviceModule: "float",
    transactionType: "return",
    debitAccountId: "1001", // Cash in Bank
    creditAccountId: "1003", // Petty Cash / Float Account
    description: "Float Return from Agent/Branch",
    isActive: true,
  },
];

/**
 * Find the appropriate GL mapping for a transaction
 * @param source Transaction source (module)
 * @param type Transaction type
 * @param data Additional transaction data for condition matching
 * @returns The matching GL account mapping or null if no match found
 */
export function findGLMapping(
  source: TransactionSource,
  type: string,
  data?: Record<string, any>
): GLAccountMapping | null {
  // Filter active mappings that match the source and type
  const matchingMappings = defaultGLMappings.filter(
    (mapping) =>
      mapping.isActive &&
      mapping.serviceModule === source &&
      mapping.transactionType === type
  );

  if (matchingMappings.length === 0) {
    return null;
  }

  // If there are no additional conditions or no data provided, return the first match
  if (
    !data ||
    matchingMappings.every(
      (mapping) => !mapping.conditions || mapping.conditions.length === 0
    )
  ) {
    return matchingMappings[0];
  }

  // Find mappings that match all conditions
  for (const mapping of matchingMappings) {
    if (!mapping.conditions || mapping.conditions.length === 0) {
      continue;
    }

    const allConditionsMatch = mapping.conditions.every((condition) => {
      const fieldValue = data[condition.field];

      if (fieldValue === undefined) {
        return false;
      }

      switch (condition.operator) {
        case "equals":
          return fieldValue === condition.value;
        case "not-equals":
          return fieldValue !== condition.value;
        case "greater-than":
          return fieldValue > condition.value;
        case "less-than":
          return fieldValue < condition.value;
        case "contains":
          return String(fieldValue).includes(String(condition.value));
        case "starts-with":
          return String(fieldValue).startsWith(String(condition.value));
        case "ends-with":
          return String(fieldValue).endsWith(String(condition.value));
        default:
          return false;
      }
    });

    if (allConditionsMatch) {
      return mapping;
    }
  }

  // If no mapping with matching conditions is found, return the first mapping without conditions
  const defaultMapping = matchingMappings.find(
    (mapping) => !mapping.conditions || mapping.conditions.length === 0
  );
  return defaultMapping || matchingMappings[0];
}

/**
 * Generate journal entry lines based on a transaction and its mapping
 * @param transaction Transaction data
 * @param mapping GL account mapping
 * @returns Array of journal entry lines
 */
export function generateJournalEntryLines(
  transaction: TransactionData,
  mapping: GLAccountMapping
): JournalEntryLine[] {
  const { amount } = transaction;

  // Create the journal entry lines
  const lines: JournalEntryLine[] = [
    {
      accountId: mapping.debitAccountId,
      debit: amount,
      description: `${mapping.description} - ${
        transaction.reference || transaction.id
      }`,
    },
    {
      accountId: mapping.creditAccountId,
      credit: amount,
      description: `${mapping.description} - ${
        transaction.reference || transaction.id
      }`,
    },
  ];

  return lines;
}

/**
 * Generate a complete journal entry from a transaction
 * @param transaction Transaction data
 * @param userId ID of the user creating the journal entry
 * @returns Journal entry object or null if no mapping found
 */
export function generateJournalEntry(
  transaction: TransactionData,
  userId: string
): JournalEntry | null {
  // Find the appropriate mapping
  const mapping = findGLMapping(
    transaction.source,
    transaction.type,
    transaction
  );

  if (!mapping) {
    return null;
  }

  // Generate journal entry lines
  const entryLines = generateJournalEntryLines(transaction, mapping);

  // Create the journal entry
  const journalEntry: JournalEntry = {
    id: `je-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    transactionId: transaction.id,
    transactionSource: transaction.source,
    transactionType: transaction.type,
    date: transaction.date,
    entries: entryLines,
    description: `${mapping.description} - ${
      transaction.reference || transaction.id
    }`,
    status: "pending",
    createdBy: userId,
    createdAt: new Date().toISOString(),
    metadata: {
      originalTransaction: transaction,
    },
  };

  return journalEntry;
}

/**
 * Validate that a journal entry is balanced (debits = credits)
 * @param journalEntry Journal entry to validate
 * @returns True if the journal entry is balanced, false otherwise
 */
export function validateJournalEntry(journalEntry: JournalEntry): boolean {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of journalEntry.entries) {
    if (line.debit) {
      totalDebits += line.debit;
    }
    if (line.credit) {
      totalCredits += line.credit;
    }
  }

  // Check if debits equal credits (allowing for small floating point differences)
  return Math.abs(totalDebits - totalCredits) < 0.001;
}

/**
 * Create a custom GL mapping
 * @param mapping GL account mapping to create
 * @returns The created mapping with a generated ID
 */
export function createGLMapping(
  mapping: Omit<GLAccountMapping, "id">
): GLAccountMapping {
  const newMapping: GLAccountMapping = {
    id: `mapping-${mapping.serviceModule}-${
      mapping.transactionType
    }-${Date.now()}`,
    ...mapping,
  };

  // In a real application, this would save to a database
  // For now, we'll just return the new mapping
  return newMapping;
}

/**
 * Update an existing GL mapping
 * @param id ID of the mapping to update
 * @param updates Updates to apply to the mapping
 * @returns True if the mapping was updated, false if not found
 */
export function updateGLMapping(
  id: string,
  updates: Partial<Omit<GLAccountMapping, "id">>
): boolean {
  // In a real application, this would update a database record
  // For now, we'll just return true to simulate success
  return true;
}

/**
 * Delete a GL mapping
 * @param id ID of the mapping to delete
 * @returns True if the mapping was deleted, false if not found
 */
export function deleteGLMapping(id: string): boolean {
  // In a real application, this would delete from a database
  // For now, we'll just return true to simulate success
  return true;
}

/**
 * Get all GL mappings for a specific service module
 * @param serviceModule Service module to filter by
 * @returns Array of GL mappings for the specified service module
 */
export function getGLMappingsByModule(
  serviceModule: string
): GLAccountMapping[] {
  return defaultGLMappings.filter(
    (mapping) => mapping.serviceModule === serviceModule
  );
}

/**
 * Get all active GL mappings
 * @returns Array of all active GL mappings
 */
export function getActiveGLMappings(): GLAccountMapping[] {
  return defaultGLMappings.filter((mapping) => mapping.isActive);
}
