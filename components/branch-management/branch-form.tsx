"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useManagers } from "@/hooks/use-managers"
import type { Branch } from "@/hooks/use-branches"

const regionOptions = [
  { label: "Greater Accra", value: "greater-accra" },
  { label: "Ashanti", value: "ashanti" },
  { label: "Western", value: "western" },
  { label: "Eastern", value: "eastern" },
  { label: "Central", value: "central" },
  { label: "Northern", value: "northern" },
  { label: "Upper East", value: "upper-east" },
  { label: "Upper West", value: "upper-west" },
  { label: "Volta", value: "volta" },
  { label: "Bono", value: "bono" },
]

const formSchema = z.object({
  name: z.string().min(3, {
    message: "Branch name must be at least 3 characters.",
  }),
  code: z.string().min(2, {
    message: "Branch code must be at least 2 characters.",
  }),
  location: z.string().min(3, {
    message: "Location must be at least 3 characters.",
  }),
  region: z.string({
    required_error: "Please select a region.",
  }),
  manager: z.string().optional(),
  contact_phone: z
    .string()
    .min(10, {
      message: "Contact phone must be at least 10 characters.",
    })
    .optional(),
  email: z
    .string()
    .email({
      message: "Please enter a valid email address.",
    })
    .optional(),
  staff_count: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["active", "inactive"]),
  address: z.string().optional(),
  phone: z.string().optional(),
})

interface BranchFormProps {
  branch?: Branch
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
}

export function BranchForm({ branch, onSubmit, onCancel }: BranchFormProps) {
  const { managers, loading: managersLoading, error: managersError } = useManagers()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: branch
      ? {
          name: branch.name,
          code: branch.code,
          location: branch.location,
          region: branch.region,
          manager: branch.manager,
          contact_phone: branch.contact_phone || "",
          email: branch.email || "",
          staff_count: branch.staff_count || 0,
          status: branch.status as "active" | "inactive",
          address: branch.address || "",
          phone: branch.phone || "",
        }
      : {
          name: "",
          code: "",
          location: "",
          region: "",
          manager: "",
          contact_phone: "",
          email: "",
          staff_count: 0,
          status: "active",
          address: "",
          phone: "",
        },
  })

  function handleSubmit(values: z.infer<typeof formSchema>) {
    onSubmit(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Name</FormLabel>
                <FormControl>
                  <Input placeholder="Main Branch" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch Code</FormLabel>
                <FormControl>
                  <Input placeholder="MB001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="123 Main Street, Accra" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Region</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {regionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="manager"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Branch Manager</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={managersLoading}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={managersLoading ? "Loading managers..." : "Select manager"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.name}>
                        {manager.name} ({manager.role})
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
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+233 20 123 4567" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="branch@example.com" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="staff_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Staff Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    value={field.value === undefined ? "" : field.value}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number.parseInt(e.target.value, 10))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input placeholder="Full address" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+233 30 123 4567" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{branch ? "Update Branch" : "Add Branch"}</Button>
        </div>
      </form>
    </Form>
  )
}
