"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon, Upload, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

interface ReconciliationFormProps {
  banks: { id: string; name: string; code: string }[]
  onSubmit: (data: any) => void
  onCancel: () => void
  isLoading: boolean
}

export function ReconciliationForm({ banks, onSubmit, onCancel, isLoading }: ReconciliationFormProps) {
  const [bankId, setBankId] = useState("")
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [manualEntry, setManualEntry] = useState(false)
  const [bankBalance, setBankBalance] = useState("")
  const [statementFile, setStatementFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!bankId) {
      alert("Please select a bank")
      return
    }

    if (!startDate || !endDate) {
      alert("Please select start and end dates")
      return
    }

    if (manualEntry && (!bankBalance || isNaN(Number.parseFloat(bankBalance)))) {
      alert("Please enter a valid bank balance")
      return
    }

    if (!manualEntry && !statementFile) {
      alert("Please upload a bank statement")
      return
    }

    onSubmit({
      bankId,
      startDate,
      endDate,
      manualEntry,
      bankBalance: manualEntry ? Number.parseFloat(bankBalance) : undefined,
      statementFile: !manualEntry ? statementFile : undefined,
      notes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bank">Partner Bank</Label>
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger id="bank">
              <SelectValue placeholder="Select a bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {bank.name} ({bank.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Reconciliation Period</Label>
          <div className="flex space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${!startDate && "text-muted-foreground"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal ${!endDate && "text-muted-foreground"}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="manual-entry">Manual Balance Entry</Label>
          <Switch id="manual-entry" checked={manualEntry} onCheckedChange={setManualEntry} />
        </div>
        <p className="text-sm text-muted-foreground">
          Toggle to manually enter the bank balance instead of uploading a statement
        </p>
      </div>

      {manualEntry ? (
        <div className="space-y-2">
          <Label htmlFor="bank-balance">Bank Balance (GHS)</Label>
          <Input
            id="bank-balance"
            type="number"
            placeholder="Enter bank balance"
            value={bankBalance}
            onChange={(e) => setBankBalance(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="statement-file">Upload Bank Statement</Label>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="statement-file"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">CSV, Excel, or PDF (max. 10MB)</p>
              </div>
              <input
                id="statement-file"
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={(e) => setStatementFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          {statementFile && (
            <p className="text-sm text-muted-foreground">
              Selected file: <span className="font-medium">{statementFile.name}</span>
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Add any additional notes or comments"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Start Reconciliation"
          )}
        </Button>
      </div>
    </form>
  )
}
