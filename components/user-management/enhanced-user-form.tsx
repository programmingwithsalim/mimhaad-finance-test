"use client"

import { Badge } from "@/components/ui/badge"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, AlertCircle, Building2, Info, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { UserType } from "@/components/user-management/mock-data"
import type { Branch } from "@/lib/branch-data"

// Available roles interface
interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  user_count?: number
}

// Form schema
const userFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.string({
    required_error: "Please select a role",
  }),
  primaryBranch: z.string({
    required_error: "Please select a primary branch",
  }),
  branches: z.array(z.string()).min(1, "Please select at least one branch"),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
})

type UserFormValues = z.infer<typeof userFormSchema>

interface UserFormProps {
  user: UserType | null
  branches: Branch[]
  isLoadingBranches?: boolean
  onSubmit: (data: UserFormValues & { id?: string; status?: string }) => void
  onCancel: () => void
}

export function UserForm({ user, branches, isLoadingBranches = false, onSubmit, onCancel }: UserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)

  // Initialize form with user data or defaults
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          primaryBranch: user.branch,
          branches: user.branches || [user.branch],
          phone: user.phone || "",
          isActive: user.status === "active",
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          role: "",
          primaryBranch: "",
          branches: [],
          phone: "",
          isActive: true,
        },
  })

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setIsLoadingRoles(true)
        const response = await fetch("/api/settings/roles")
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setRoles(result.data)
          }
        }
      } catch (error) {
        console.error("Error fetching roles:", error)
      } finally {
        setIsLoadingRoles(false)
      }
    }

    fetchRoles()
  }, [])

  // Update selected role when form role changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "role" && value.role) {
        const role = roles.find((r) => r.name === value.role)
        setSelectedRole(role || null)
      }

      if (name === "branches") {
        setSelectedBranches((value.branches as string[]) || [])
      }

      // If primary branch changes and it's not in selected branches, add it
      if (name === "primaryBranch" && value.primaryBranch && !value.branches?.includes(value.primaryBranch as string)) {
        const newBranches = [...((value.branches as string[]) || []), value.primaryBranch as string]
        form.setValue("branches", newBranches)
        setSelectedBranches(newBranches)
      }
    })

    return () => subscription.unsubscribe()
  }, [form, roles])

  // Initialize selected branches from user data
  useEffect(() => {
    if (user) {
      setSelectedBranches(user.branches || [user.branch])
      // Set selected role
      const role = roles.find((r) => r.name === user.role)
      setSelectedRole(role || null)
    }
  }, [user, roles])

  // Handle branch selection
  const handleBranchSelection = (branchId: string, isChecked: boolean) => {
    let newSelectedBranches: string[]

    if (isChecked) {
      newSelectedBranches = [...selectedBranches, branchId]
    } else {
      newSelectedBranches = selectedBranches.filter((id) => id !== branchId)

      // If primary branch is deselected, update primary branch
      if (form.getValues("primaryBranch") === branchId) {
        // Set primary branch to first remaining branch or empty
        const newPrimaryBranch = newSelectedBranches.length > 0 ? newSelectedBranches[0] : ""
        form.setValue("primaryBranch", newPrimaryBranch)
      }
    }

    form.setValue("branches", newSelectedBranches)
    setSelectedBranches(newSelectedBranches)
  }

  // Set a branch as primary
  const handleSetPrimaryBranch = (branchId: string) => {
    form.setValue("primaryBranch", branchId)

    // Ensure the branch is also selected
    if (!selectedBranches.includes(branchId)) {
      const newSelectedBranches = [...selectedBranches, branchId]
      form.setValue("branches", newSelectedBranches)
      setSelectedBranches(newSelectedBranches)
    }
  }

  // Form submission handler
  const handleSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true)

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Transform form values to user data
      const userData = {
        ...values,
        branch: values.primaryBranch, // Set primary branch
        branches: values.branches, // Set all assigned branches
        status: values.isActive ? "active" : "inactive",
        id: user?.id, // Only include ID for existing users
      }

      onSubmit(userData)
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" type="email" {...field} />
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
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+233 XX XXX XXXX" type="tel" {...field} />
                  </FormControl>
                  <FormDescription>Optional phone number for contact purposes.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingRoles}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingRoles ? "Loading roles..." : "Select a role"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          <div className="flex items-center gap-2">
                            <span>{role.name}</span>
                            {role.is_system && <Shield className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Determines the user's permissions in the system.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role Permissions Preview */}
            {selectedRole && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Role Permissions</span>
                  {selectedRole.is_system && (
                    <Badge variant="outline" className="text-xs">
                      System Role
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{selectedRole.description}</p>
                <div className="flex flex-wrap gap-1">
                  {selectedRole.permissions.slice(0, 5).map((permission) => (
                    <Badge key={permission} variant="secondary" className="text-xs">
                      {permission}
                    </Badge>
                  ))}
                  {selectedRole.permissions.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedRole.permissions.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">User Status</FormLabel>
                    <FormDescription>Set whether this account is active in the system.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <h3 className="text-lg font-medium">Branch Assignments</h3>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Info className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p>
                        Assign the user to one or more branches. The primary branch is where the user is primarily
                        located.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <FormField
                control={form.control}
                name="primaryBranch"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel>Primary Branch</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isLoadingBranches || selectedBranches.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              isLoadingBranches
                                ? "Loading branches..."
                                : selectedBranches.length === 0
                                  ? "Select branches below first"
                                  : "Select primary branch"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {selectedBranches.map((branchId) => {
                          const branch = branches.find((b) => b.id === branchId)
                          return (
                            <SelectItem key={branchId} value={branchId}>
                              {branch?.name || branchId}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>The main branch where this user is located.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="branches"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Assigned Branches</FormLabel>
                      <FormDescription>Select all branches this user should have access to.</FormDescription>
                      <FormMessage />
                    </div>

                    {isLoadingBranches ? (
                      <div className="flex items-center justify-center h-32 border rounded-md">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span>Loading branches...</span>
                      </div>
                    ) : branches.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>No branches found. Please create branches first.</AlertDescription>
                      </Alert>
                    ) : (
                      <ScrollArea className="h-64 border rounded-md p-4">
                        <div className="space-y-4">
                          {branches.map((branch) => {
                            const isPrimary = form.getValues("primaryBranch") === branch.id
                            return (
                              <div key={branch.id} className="flex items-center justify-between space-x-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`branch-${branch.id}`}
                                    checked={selectedBranches.includes(branch.id)}
                                    onCheckedChange={(checked) => handleBranchSelection(branch.id, checked === true)}
                                  />
                                  <label
                                    htmlFor={`branch-${branch.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                  >
                                    {branch.name}
                                    {isPrimary && (
                                      <Badge variant="outline" className="ml-2 bg-primary/10">
                                        Primary
                                      </Badge>
                                    )}
                                  </label>
                                </div>
                                {selectedBranches.includes(branch.id) && !isPrimary && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSetPrimaryBranch(branch.id)}
                                  >
                                    Set as Primary
                                  </Button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end space-x-4">
          <Button variant="outline" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingBranches || branches.length === 0 || isLoadingRoles}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {user ? "Update User" : "Create User"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
