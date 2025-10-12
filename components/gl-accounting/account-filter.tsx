"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

interface GLAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  balance?: number;
  is_active: boolean;
}

interface AccountFilterProps {
  selectedAccount: string | null;
  onAccountChange: (accountId: string | null) => void;
}

export function AccountFilter({
  selectedAccount,
  onAccountChange,
}: AccountFilterProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/gl/accounts", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.statusText}`);
      }

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error fetching GL accounts:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load accounts"
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedAccountData = accounts.find(
    (account) => account.id === selectedAccount
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case "asset":
        return "bg-green-100 text-green-800";
      case "liability":
        return "bg-red-100 text-red-800";
      case "equity":
        return "bg-blue-100 text-blue-800";
      case "revenue":
        return "bg-purple-100 text-purple-800";
      case "expense":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-10 px-3 border rounded-md">
        <div className="text-sm text-muted-foreground">Loading accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-10 px-3 border rounded-md">
        <div className="text-sm text-red-600">Error loading accounts</div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10"
        >
          {selectedAccount ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs">
                {selectedAccountData?.account_code}
              </span>
              <span className="truncate">
                {selectedAccountData?.account_name}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  getAccountTypeColor(selectedAccountData?.account_type || "")
                )}
              >
                {selectedAccountData?.account_type}
              </Badge>
            </div>
          ) : (
            "Select account..."
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts..." />
          <CommandList>
            <CommandEmpty>No account found.</CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={`${account.account_code} ${account.account_name} ${account.account_type}`}
                  onSelect={() => {
                    onAccountChange(
                      account.id === selectedAccount ? null : account.id
                    );
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedAccount === account.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {account.account_code}
                      </span>
                      <span className="truncate">{account.account_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          getAccountTypeColor(account.account_type)
                        )}
                      >
                        {account.account_type}
                      </Badge>
                      {account.balance !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(account.balance)}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
