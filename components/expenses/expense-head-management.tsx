"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExpenseHead {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
}

interface ExpenseHeadFormProps {
  expenseHead: ExpenseHead | null;
  onSubmit: (data: Partial<ExpenseHead>) => Promise<void>;
  onCancel: () => void;
}

function ExpenseHeadForm({
  expenseHead,
  onSubmit,
  onCancel,
}: ExpenseHeadFormProps) {
  const [formData, setFormData] = useState<Partial<ExpenseHead>>({
    name: expenseHead?.name || "",
    category: expenseHead?.category || "",
    description: expenseHead?.description || "",
    is_active: expenseHead?.is_active ?? true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name *
          </label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter expense head name"
            required
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="category" className="text-sm font-medium">
            Category *
          </label>
          <Select
            value={formData.category}
            onValueChange={(value) => handleSelectChange("category", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="administrative">Administrative</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="capital">Capital</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="description"
            name="description"
            value={formData.description || ""}
            onChange={handleChange}
            placeholder="Enter description"
            rows={3}
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={(e) =>
              setFormData({ ...formData, is_active: e.target.checked })
            }
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="is_active" className="text-sm font-medium">
            Active
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : expenseHead ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

interface ExpenseHeadManagementProps {
  onExpenseHeadCreated?: (expenseHead: ExpenseHead) => void;
  className?: string;
}

export function ExpenseHeadManagement({
  onExpenseHeadCreated,
  className,
}: ExpenseHeadManagementProps) {
  const [expenseHeads, setExpenseHeads] = useState<ExpenseHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHead, setSelectedHead] = useState<ExpenseHead | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch expense heads
  useEffect(() => {
    const fetchExpenseHeads = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/expense-heads");
        if (!response.ok) {
          throw new Error(`Failed to fetch expense heads: ${response.status}`);
        }

        const data = await response.json();
        setExpenseHeads(data.expense_heads || []);
      } catch (error) {
        console.error("Error fetching expense heads:", error);
        setError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
        toast({
          title: "Error",
          description: "Failed to load expense heads. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchExpenseHeads();
  }, [toast]);

  // Handle search
  const filteredHeads = expenseHeads.filter(
    (head) =>
      head.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      head.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle add button click
  const handleAddClick = () => {
    setSelectedHead(null);
    setIsDialogOpen(true);
  };

  // Handle edit
  const handleEdit = (head: ExpenseHead) => {
    setSelectedHead(head);
    setIsDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense head?")) {
      return;
    }

    try {
      const response = await fetch(`/api/expense-heads/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete expense head");
      }

      setExpenseHeads((prev) => prev.filter((head) => head.id !== id));
      toast({
        title: "Success",
        description: "Expense head deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting expense head:", error);
      toast({
        title: "Error",
        description: "Failed to delete expense head.",
        variant: "destructive",
      });
    }
  };

  // Handle form submit
  const handleFormSubmit = async (formData: Partial<ExpenseHead>) => {
    try {
      const url = selectedHead
        ? `/api/expense-heads/${selectedHead.id}`
        : "/api/expense-heads";
      const method = selectedHead ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save expense head");
      }

      const data = await response.json();
      const savedHead = data.expense_head;

      if (selectedHead) {
        // Update existing
        setExpenseHeads((prev) =>
          prev.map((head) => (head.id === selectedHead.id ? savedHead : head))
        );
        toast({
          title: "Success",
          description: "Expense head updated successfully.",
        });
      } else {
        // Add new
        setExpenseHeads((prev) => [...prev, savedHead]);
        onExpenseHeadCreated?.(savedHead);
        toast({
          title: "Success",
          description: "Expense head created successfully.",
        });
      }

      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving expense head:", error);
      toast({
        title: "Error",
        description: "Failed to save expense head.",
        variant: "destructive",
      });
    }
  };

  const formatCategory = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Expense Heads</h3>
        <Button onClick={handleAddClick} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Head
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search expense heads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-4">
            <div className="text-red-500 text-sm">{error}</div>
          </CardContent>
        </Card>
      ) : filteredHeads.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            {searchQuery
              ? "No expense heads found matching your search."
              : "No expense heads found."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredHeads.map((head) => (
            <Card key={head.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{head.name}</h4>
                      <Badge variant={head.is_active ? "default" : "secondary"}>
                        {head.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatCategory(head.category)}</span>
                      {head.description && (
                        <>
                          <span>•</span>
                          <span className="truncate">{head.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(head)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(head.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedHead ? "Edit Expense Head" : "Create Expense Head"}
            </DialogTitle>
          </DialogHeader>
          <ExpenseHeadForm
            expenseHead={selectedHead}
            onSubmit={handleFormSubmit}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
