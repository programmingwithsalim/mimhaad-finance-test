"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFloatAccounts } from "@/hooks/use-float-accounts"

interface FloatAccountSelectorProps {
  serviceType: string
  branchId: string
  onAccountSelect: (accountId: string, account: any) => void
  label?: string
  className?: string
  defaultValue?: string
}

export function FloatAccountSelector({
  serviceType,
  branchId,
  onAccountSelect,
  label = "Float Account",
  className = "",
  defaultValue,
}: FloatAccountSelectorProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(defaultValue || "")

  // Fetch float accounts for the branch and service type
  const { accounts, isLoading, error } = useFloatAccounts({
    branchId,
    serviceType,
    onlyActive: true,
  })

  // When accounts are loaded, set the first account as selected if no default is provided
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      const firstAccountId = accounts[0].id
      setSelectedAccountId(firstAccountId)
      onAccountSelect(firstAccountId, accounts[0])
    }
  }, [accounts, selectedAccountId, onAccountSelect])

  // Handle account selection
  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId)
    const selectedAccount = accounts?.find((account) => account.id === accountId)
    if (selectedAccount) {
      onAccountSelect(accountId, selectedAccount)
    }
  }

  return (
    <div className={className}>
      <Label htmlFor="floatAccount">{label}</Label>
      <Select value={selectedAccountId} onValueChange={handleAccountSelect} disabled={isLoading}>
        <SelectTrigger id="floatAccount">
          <SelectValue placeholder={isLoading ? "Loading accounts..." : "Select a float account"} />
        </SelectTrigger>
        <SelectContent>
          {error ? (
            <SelectItem value="error" disabled>
              Error loading accounts
            </SelectItem>
          ) : isLoading ? (
            <SelectItem value="loading" disabled>
              Loading accounts...
            </SelectItem>
          ) : accounts && accounts.length > 0 ? (
            accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.provider} - {account.accountNumber}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              No accounts available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
