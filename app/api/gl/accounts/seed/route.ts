import { NextResponse } from "next/server";
// Note: This endpoint is deprecated. Use /api/gl/accounts POST instead

// Default GL accounts to seed
const defaultGLAccounts = [
  // Asset accounts
  {
    code: "1001",
    name: "Cash in Bank - Operations",
    type: "Asset",
    description: "Main bank account for operations",
  },
  {
    code: "1002",
    name: "Cash in Bank - Payroll",
    type: "Asset",
    description: "Bank account for payroll",
  },
  {
    code: "1003",
    name: "Petty Cash",
    type: "Asset",
    description: "Petty cash for small expenses",
  },
  {
    code: "1100",
    name: 'Float Accounts", type:  description: "Petty cash for small expenses',
  },
  {
    code: "1100",
    name: "Float Accounts",
    type: "Asset",
    description: "Float accounts for agents and branches",
  },
  {
    code: "1200",
    name: "Accounts Receivable",
    type: "Asset",
    description: "Amounts owed to the company",
  },
  {
    code: "1300",
    name: "Prepaid Insurance",
    type: "Asset",
    description: "Insurance paid in advance",
  },
  {
    code: "1400",
    name: "Equipment",
    type: "Asset",
    description: "Office equipment and furniture",
  },
  {
    code: "1500",
    name: "Accumulated Depreciation",
    type: "Asset",
    description: "Accumulated depreciation on equipment",
  },

  // Liability accounts
  {
    code: "2001",
    name: "Accounts Payable",
    type: "Liability",
    description: "Amounts owed by the company",
  },
  {
    code: "2100",
    name: "Customer Deposits",
    type: "Liability",
    description: "Deposits held for customers",
  },
  {
    code: "2200",
    name: "Accrued Expenses",
    type: "Liability",
    description: "Expenses incurred but not yet paid",
  },
  {
    code: "2300",
    name: "Payroll Liabilities",
    type: "Liability",
    description: "Payroll taxes and benefits payable",
  },
  {
    code: "2400",
    name: "Short-term Loans",
    type: "Liability",
    description: "Short-term loans and borrowings",
  },

  // Equity accounts
  {
    code: "3001",
    name: "Share Capital",
    type: "Equity",
    description: "Owners' investment in the company",
  },
  {
    code: "3100",
    name: "Retained Earnings",
    type: "Equity",
    description: "Accumulated profits reinvested",
  },
  {
    code: "3200",
    name: "Current Year Earnings",
    type: "Equity",
    description: "Current year profit or loss",
  },

  // Revenue accounts
  {
    code: "4001",
    name: "MoMo Commission Revenue",
    type: "Revenue",
    description: "Revenue from Mobile Money commissions",
  },
  {
    code: "4002",
    name: "E-Zwich Commission Revenue",
    type: "Revenue",
    description: "Revenue from E-Zwich commissions",
  },
  {
    code: "4003",
    name: "Agency Banking Revenue",
    type: "Revenue",
    description: "Revenue from Agency Banking services",
  },
  {
    code: "4004",
    name: "Jumia Collection Revenue",
    type: "Revenue",
    description: "Revenue from Jumia collections",
  },
  {
    code: "4005",
    name: "Power Sales Revenue",
    type: "Revenue",
    description: "Revenue from Power sales",
  },
  {
    code: "4100",
    name: "Card Issuance Fees",
    type: "Revenue",
    description: "Revenue from card issuance",
  },
  {
    code: "4200",
    name: "Interest Income",
    type: "Revenue",
    description: "Interest earned on deposits",
  },

  // Expense accounts
  {
    code: "5001",
    name: "Salaries Expense",
    type: "Expense",
    description: "Salaries and wages",
  },
  {
    code: "5002",
    name: "Rent Expense",
    type: "Expense",
    description: "Office and branch rent",
  },
  {
    code: "5003",
    name: "Office Supplies Expense",
    type: "Expense",
    description: "Office supplies and stationery",
  },
  {
    code: "5004",
    name: "Insurance Expense",
    type: "Expense",
    description: "Insurance expenses",
  },
  {
    code: "5005",
    name: "Utilities Expense",
    type: "Expense",
    description: "Electricity, water, internet",
  },
  {
    code: "5006",
    name: "Depreciation Expense",
    type: "Expense",
    description: "Depreciation of assets",
  },
  {
    code: "5007",
    name: "Bank Charges",
    type: "Expense",
    description: "Bank fees and charges",
  },
  {
    code: "5011",
    name: "Amortization Expense",
    type: "Expense",
    description: "Amortization of intangible assets",
  },
  {
    code: "5008",
    name: "Travel Expense",
    type: "Expense",
    description: "Business travel expenses",
  },
  {
    code: "5009",
    name: "Maintenance Expense",
    type: "Expense",
    description: "Equipment and office maintenance",
  },
  {
    code: "5010",
    name: "Marketing Expense",
    type: "Expense",
    description: "Advertising and promotion",
  },
];

export async function POST() {
  try {
    const createdAccounts = [];

    // Create each account
    for (const account of defaultGLAccounts) {
      const createdAccount = await createGLAccount({
        code: account.code,
        name: account.name,
        type: account.type as
          | "Asset"
          | "Liability"
          | "Equity"
          | "Revenue"
          | "Expense",
        description: account.description,
        isActive: true,
      });

      createdAccounts.push(createdAccount);
    }

    return NextResponse.json({
      message: `Successfully seeded ${createdAccounts.length} GL accounts`,
      accounts: createdAccounts,
    });
  } catch (error) {
    console.error("Error seeding GL accounts:", error);
    return NextResponse.json(
      { error: "Failed to seed GL accounts" },
      { status: 500 }
    );
  }
}
