"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/use-current-user"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Building2 } from "lucide-react"

const formSchema = z.object({
  bank_name: z.string().min(2, "Bank name is required"),
  account_number: z.string().min(5, "Account number must be at least 5 characters"),
  account_name: z.string().min(3, "Account name is required"),
  contact_person: z.string().min(3, "Contact person is required"),
  contact_phone: z.string().min(10, "Contact phone is required"),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  settlement_time: z.string().default("17:00"),
})

type FormValues = z.infer<typeof formSchema>

interface PartnerAccountFormProps {
  onSuccess?: () => void
}

export function PartnerAccountForm({ onSuccess }: PartnerAccountFormProps) {
  const { toast } = useToast()
  const { user } = useCurrentUser()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bank_name: "",
      account_number: "",
      account_name: "",
      contact_person: "",
      contact_phone: "",
      contact_email: "",
      settlement_time: "17:00",
    },
  })

  const onSubmit = async (values: FormValues) => {
    if (!user?.branchId) {
      toast({
        title: "Error",
        description: "Branch information not found",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch("/api/e-zwich/partner-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          branch_id: user.branchId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Partner Account Created",
          description: `${values.bank_name} account added successfully`,
        })
        form.reset()
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create partner account",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating partner account:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const ghanaianBanks = [
    "Ghana Commercial Bank (GCB)",
    "Ecobank Ghana",
    "Standard Chartered Bank",
    "Barclays Bank Ghana",
    "Zenith Bank Ghana",
    "Stanbic Bank Ghana",
    "Fidelity Bank Ghana",
    "CAL Bank",
    "Universal Merchant Bank (UMB)",
    "Agricultural Development Bank (ADB)",
    "National Investment Bank (NIB)",
    "Prudential Bank",
    "Republic Bank Ghana",
    "Societe Generale Ghana",
    "Access Bank Ghana",
    "First National Bank Ghana",
    "GT Bank Ghana",
    "United Bank for Africa (UBA)",
    "First Atlantic Bank",
    "ARB Apex Bank",
  ]

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Add E-Zwich Partner Bank Account
        </CardTitle>
        <CardDescription>Add a partner bank account for E-Zwich settlements</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bank Name *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ghanaianBanks.map((bank) => (
                          <SelectItem key={bank} value={bank}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter account number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter account name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact person name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="settlement_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Settlement Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Partner Account
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
