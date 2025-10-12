"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  AlertCircle,
  Building2,
  User,
  Mail,
  Phone,
  Shield,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Available roles
const AVAILABLE_ROLES = [
  { id: "Admin", name: "Admin", description: "Full system access" },
  {
    id: "Manager",
    name: "Manager",
    description: "Branch management and oversight",
  },
  {
    id: "Finance",
    name: "Finance",
    description: "Financial operations and reporting",
  },
  {
    id: "Operations",
    name: "Operations",
    description: "Daily operations management",
  },
  { id: "Cashier", name: "Cashier", description: "Transaction processing" },
];

// Form schema
const userFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.string({
    required_error: "Please select a role",
  }),
  primaryBranchId: z.string({
    required_error: "Please select a primary branch",
  }),
  branchIds: z.array(z.string()).min(1, "Please select at least one branch"),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: any | null;
  branches?: any[];
  isLoadingBranches?: boolean;
  onSubmit: (data: UserFormValues & { id?: string; status?: string }) => void;
  onCancel: () => void;
}

export function UserForm({
  user = null,
  branches = [],
  isLoadingBranches = false,
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [branchError, setBranchError] = useState<any>(null);

  // Ensure branches is always an array
  const safeBranches = Array.isArray(branches) ? branches : [];

  console.log("UserForm - branches:", branches);
  console.log("UserForm - safeBranches:", safeBranches);
  console.log("UserForm - isLoadingBranches:", isLoadingBranches);

  // Initialize form with user data or defaults
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: user
      ? {
          firstName: user.firstName || user.name?.split(" ")[0] || "",
          lastName:
            user.lastName || user.name?.split(" ").slice(1).join(" ") || "",
          email: user.email || "",
          role: user.role || "",
          primaryBranchId: user.primaryBranchId || user.branch_id || "",
          branchIds: user.branchIds ||
            user.branches || [user.primaryBranchId || user.branch_id || ""],
          phone: user.phone || "",
          isActive: user.status === "active" || user.is_active !== false,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          role: "",
          primaryBranchId: "",
          branchIds: [],
          phone: "",
          isActive: true,
        },
  });

  // Update selected branches when form values change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "branchIds") {
        setSelectedBranchIds((value.branchIds as string[]) || []);
      }

      // If primary branch changes and it's not in selected branches, add it
      if (
        name === "primaryBranchId" &&
        value.primaryBranchId &&
        !value.branchIds?.includes(value.primaryBranchId as string)
      ) {
        const newBranchIds = [
          ...((value.branchIds as string[]) || []),
          value.primaryBranchId as string,
        ];
        form.setValue("branchIds", newBranchIds);
        setSelectedBranchIds(newBranchIds);
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Initialize selected branches from user data
  useEffect(() => {
    if (user) {
      const userBranches = user.branchIds ||
        user.branches || [user.primaryBranchId || user.branch_id];
      setSelectedBranchIds(userBranches.filter(Boolean));
    }
  }, [user]);

  // Handle branch selection
  const handleBranchSelection = (branchId: string, isChecked: boolean) => {
    let newSelectedBranchIds: string[];

    if (isChecked) {
      newSelectedBranchIds = [...selectedBranchIds, branchId];
    } else {
      newSelectedBranchIds = selectedBranchIds.filter((id) => id !== branchId);

      // If primary branch is deselected, update primary branch
      if (form.getValues("primaryBranchId") === branchId) {
        // Set primary branch to first remaining branch or empty
        const newPrimaryBranch =
          newSelectedBranchIds.length > 0 ? newSelectedBranchIds[0] : "";
        form.setValue("primaryBranchId", newPrimaryBranch);
      }
    }

    form.setValue("branchIds", newSelectedBranchIds);
    setSelectedBranchIds(newSelectedBranchIds);
  };

  // Set a branch as primary
  const handleSetPrimaryBranch = (branchId: string) => {
    form.setValue("primaryBranchId", branchId);

    // Ensure the branch is also selected
    if (!selectedBranchIds.includes(branchId)) {
      const newSelectedBranchIds = [...selectedBranchIds, branchId];
      form.setValue("branchIds", newSelectedBranchIds);
      setSelectedBranchIds(newSelectedBranchIds);
    }
  };

  // Form submission handler
  const handleSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Transform form values to user data
      const userData = {
        ...values,
        name: `${values.firstName} ${values.lastName}`,
        primaryBranchId: values.primaryBranchId, // Use consistent naming
        branchIds: values.branchIds, // Use consistent naming
        status: values.isActive ? "active" : "inactive",
        id: user?.id,
      };

      onSubmit(userData);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          {user ? "Edit User" : "Add New User"}
        </h2>
        <p className="text-muted-foreground">
          {user
            ? "Update user information and permissions"
            : "Create a new user account with appropriate access"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Personal Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Basic user details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="user@example.com"
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This will be used for login and system notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+233 XX XXX XXXX"
                        type="tel"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Optional contact number</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Role and Permissions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role and Permissions
              </CardTitle>
              <CardDescription>
                Define user access level and system permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AVAILABLE_ROLES.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{role.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {role.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Role determines what features and data the user can access
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Account Status
                      </FormLabel>
                      <FormDescription>
                        Active accounts can log in and access the system
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Branch Assignment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Branch Assignment
              </CardTitle>
              <CardDescription>
                Assign user to branches and set primary location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingBranches ? (
                <div className="flex items-center justify-center h-32 border rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Loading branches...
                    </p>
                  </div>
                </div>
              ) : branchError ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load branches. Please refresh the page or contact
                    support.
                    <Button
                      variant="link"
                      className="p-0 h-auto ml-2"
                      onClick={() => window.location.reload()}
                    >
                      Refresh
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : safeBranches.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No branches found. Please create branches first before
                    assigning users.
                    <Button
                      variant="link"
                      className="p-0 h-auto ml-2"
                      onClick={() =>
                        window.open("/dashboard/branch-management", "_blank")
                      }
                    >
                      Manage Branches
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Branch Selection */}
                  <div>
                    <FormLabel className="text-base font-medium mb-3 block">
                      Available Branches
                    </FormLabel>
                    <FormDescription className="mb-4">
                      Select all branches this user should have access to
                    </FormDescription>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
                      {safeBranches.map((branch) => {
                        const isSelected = selectedBranchIds.includes(
                          branch.id
                        );
                        const isPrimary =
                          form.getValues("primaryBranchId") === branch.id;

                        return (
                          <div
                            key={branch.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-primary/5 border-primary/20"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`branch-${branch.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleBranchSelection(
                                    branch.id,
                                    checked === true
                                  )
                                }
                              />
                              <div>
                                <label
                                  htmlFor={`branch-${branch.id}`}
                                  className="text-sm font-medium leading-none cursor-pointer"
                                >
                                  {branch.name}
                                </label>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {branch.location} • {branch.region}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isPrimary && (
                                <Badge variant="default" className="text-xs">
                                  Primary
                                </Badge>
                              )}
                              {isSelected && !isPrimary && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleSetPrimaryBranch(branch.id)
                                  }
                                  className="text-xs h-7"
                                >
                                  Set Primary
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Branch Selection */}
                  <FormField
                    control={form.control}
                    name="primaryBranchId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Branch</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={selectedBranchIds.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  selectedBranchIds.length === 0
                                    ? "Select branches above first"
                                    : "Choose primary branch"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedBranchIds.map((branchId) => {
                              const branch = safeBranches.find(
                                (b) => b.id === branchId
                              );
                              return (
                                <SelectItem key={branchId} value={branchId}>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    <span>{branch?.name || branchId}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The main branch where this user is primarily located
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Selected Branches Summary */}
                  {selectedBranchIds.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2">
                        Selected Branches ({selectedBranchIds.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedBranchIds.map((branchId) => {
                          const branch = safeBranches.find(
                            (b) => b.id === branchId
                          );
                          const isPrimary =
                            form.getValues("primaryBranchId") === branchId;
                          return (
                            <Badge
                              key={branchId}
                              variant={isPrimary ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {branch?.name || branchId}
                              {isPrimary && " (Primary)"}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button variant="outline" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || isLoadingBranches || safeBranches.length === 0
              }
              className="min-w-[120px]"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {user ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
