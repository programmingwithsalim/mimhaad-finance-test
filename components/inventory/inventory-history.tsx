"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Package, Smartphone, Flag, CreditCard } from "lucide-react";

interface IssuedItem {
  id: string;
  batch_id: string;
  inventory_type: string;
  item_number: string;
  customer_name: string;
  customer_phone: string;
  branch_name: string;
  issued_by_name: string;
  batch_code: string;
  status: string;
  notes: string;
  issued_at: string;
}

export function InventoryHistory() {
  const [items, setItems] = useState<IssuedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/inventory/issued");
      const result = await response.json();

      if (result.success) {
        setItems(result.data || []);
      } else {
        setError(result.error || "Failed to fetch inventory history");
      }
    } catch (err) {
      console.error("Error fetching inventory history:", err);
      setError("Failed to fetch inventory history");
    } finally {
      setLoading(false);
    }
  };

  const getInventoryIcon = (type: string) => {
    switch (type) {
      case "sim":
        return <Smartphone className="h-4 w-4" />;
      case "rollers":
        return <Flag className="h-4 w-4" />;
      case "e-zwich":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getInventoryLabel = (type: string) => {
    switch (type) {
      case "sim":
        return "SIM Card";
      case "rollers":
        return "Roller Banner";
      case "e-zwich":
        return "E-Zwich Card";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Issuance History</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Inventory Issuance History
        </CardTitle>
        <CardDescription>
          Recent SIM cards and roller banners issued ({items.length} items)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No inventory items issued yet
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.issued_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getInventoryIcon(item.inventory_type)}
                        <Badge variant="secondary">
                          {getInventoryLabel(item.inventory_type)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {item.item_number}
                    </TableCell>
                    <TableCell>{item.customer_name}</TableCell>
                    <TableCell>{item.customer_phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.batch_code}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.issued_by_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "issued" ? "default" : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
