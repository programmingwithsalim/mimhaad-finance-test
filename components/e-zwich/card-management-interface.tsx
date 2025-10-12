"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Edit,
  Trash2,
  Download,
  Search,
  Filter,
  RefreshCw,
  User,
  CreditCard,
  Camera,
  FileText,
} from "lucide-react";

interface CardIssuance {
  id: string;
  card_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  date_of_birth?: string;
  gender?: string;
  id_type?: string;
  id_number?: string;
  id_expiry_date?: string;
  address_line1?: string;
  city?: string;
  region?: string;
  fee_charged: number;
  payment_method?: string;
  partner_bank?: string;
  card_status: string;
  issue_date: string;
  customer_photo?: string;
  id_front_image?: string;
  id_back_image?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface CardManagementInterfaceProps {
  branchId: string;
}

export function CardManagementInterface({
  branchId,
}: CardManagementInterfaceProps) {
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const [cards, setCards] = useState<CardIssuance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CardIssuance | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingCard, setEditingCard] = useState<Partial<CardIssuance>>({});

  const loadCards = async () => {
    if (!branchId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/e-zwich/card-issuance?branchId=${branchId}&limit=100`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setCards(data.data);
        } else {
          setCards([]);
        }
      } else {
        setCards([]);
      }
    } catch (error) {
      console.error("Error loading cards:", error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [branchId]);

  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.card_number.includes(searchTerm) ||
      card.customer_phone.includes(searchTerm) ||
      card.id_number?.includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" || card.card_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleEditCard = async () => {
    if (!selectedCard || !editingCard) return;

    try {
      const response = await fetch(
        `/api/e-zwich/card-issuance/${selectedCard.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...editingCard,
            userId: user?.id,
            branchId: branchId,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast({
            title: "Success",
            description: "Card information updated successfully",
          });
          setEditDialogOpen(false);
          loadCards();
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to update card",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to update card",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating card:", error);
      toast({
        title: "Error",
        description: "Failed to update card",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this card?")) return;

    try {
      const response = await fetch(`/api/e-zwich/card-issuance/${cardId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
          branchId: branchId,
          reason: "User requested deletion",
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Card deleted successfully",
        });
        loadCards();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete card",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting card:", error);
      toast({
        title: "Error",
        description: "Failed to delete card",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (card: CardIssuance) => {
    setSelectedCard(card);
    setEditingCard(card);
    setEditDialogOpen(true);
  };

  const openViewDialog = (card: CardIssuance) => {
    setSelectedCard(card);
    setViewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            E-Zwich Card Management
          </CardTitle>
          <CardDescription>
            View, edit, and manage all issued E-Zwich cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, card number, phone, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadCards} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {/* Cards Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-mono">
                      {card.card_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{card.customer_name}</div>
                        {card.customer_email && (
                          <div className="text-sm text-muted-foreground">
                            {card.customer_email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{card.customer_phone}</TableCell>
                    <TableCell>
                      {card.id_type && card.id_number ? (
                        <div>
                          <div className="text-sm font-medium">
                            {card.id_type}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {card.id_number}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          Not provided
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(card.card_status)}</TableCell>
                    <TableCell>
                      {new Date(card.issue_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>₵{card.fee_charged.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewDialog(card)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(card)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user?.role === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCard(card.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredCards.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? "Loading cards..." : "No cards found"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Card Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Card Details</DialogTitle>
            <DialogDescription>
              Complete information for card {selectedCard?.card_number}
            </DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Full Name</Label>
                    <p className="text-sm">{selectedCard.customer_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone Number</Label>
                    <p className="text-sm">{selectedCard.customer_phone}</p>
                  </div>
                  {selectedCard.customer_email && (
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <p className="text-sm">{selectedCard.customer_email}</p>
                    </div>
                  )}
                  {selectedCard.date_of_birth && (
                    <div>
                      <Label className="text-sm font-medium">
                        Date of Birth
                      </Label>
                      <p className="text-sm">
                        {new Date(
                          selectedCard.date_of_birth
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedCard.gender && (
                    <div>
                      <Label className="text-sm font-medium">Gender</Label>
                      <p className="text-sm">{selectedCard.gender}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Identification
                </h3>
                <div className="space-y-3">
                  {selectedCard.id_type && (
                    <div>
                      <Label className="text-sm font-medium">ID Type</Label>
                      <p className="text-sm">{selectedCard.id_type}</p>
                    </div>
                  )}
                  {selectedCard.id_number && (
                    <div>
                      <Label className="text-sm font-medium">ID Number</Label>
                      <p className="text-sm font-mono">
                        {selectedCard.id_number}
                      </p>
                    </div>
                  )}
                  {selectedCard.id_expiry_date && (
                    <div>
                      <Label className="text-sm font-medium">
                        ID Expiry Date
                      </Label>
                      <p className="text-sm">
                        {new Date(
                          selectedCard.id_expiry_date
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Card Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Card Number</Label>
                    <p className="text-sm font-mono">
                      {selectedCard.card_number}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">
                      {getStatusBadge(selectedCard.card_status)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Issue Date</Label>
                    <p className="text-sm">
                      {new Date(selectedCard.issue_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Fee Charged</Label>
                    <p className="text-sm">
                      ₵{selectedCard.fee_charged.toFixed(2)}
                    </p>
                  </div>
                  {selectedCard.payment_method && (
                    <div>
                      <Label className="text-sm font-medium">
                        Payment Method
                      </Label>
                      <p className="text-sm">{selectedCard.payment_method}</p>
                    </div>
                  )}
                  {selectedCard.partner_bank && (
                    <div>
                      <Label className="text-sm font-medium">
                        Partner Bank
                      </Label>
                      <p className="text-sm">{selectedCard.partner_bank}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Images and Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Images
                </h3>
                <div className="space-y-4">
                  {selectedCard.customer_photo && (
                    <div>
                      <Label className="text-sm font-medium">
                        Customer Photo
                      </Label>
                      <div className="mt-2">
                        <img
                          src={selectedCard.customer_photo}
                          alt="Customer"
                          className="w-32 h-32 object-cover rounded-lg border"
                        />
                      </div>
                    </div>
                  )}
                  {selectedCard.id_front_image && (
                    <div>
                      <Label className="text-sm font-medium">ID Front</Label>
                      <div className="mt-2">
                        <img
                          src={selectedCard.id_front_image}
                          alt="ID Front"
                          className="w-32 h-32 object-cover rounded-lg border"
                        />
                      </div>
                    </div>
                  )}
                  {selectedCard.id_back_image && (
                    <div>
                      <Label className="text-sm font-medium">ID Back</Label>
                      <div className="mt-2">
                        <img
                          src={selectedCard.id_back_image}
                          alt="ID Back"
                          className="w-32 h-32 object-cover rounded-lg border"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <h3 className="text-lg font-semibold">Address Information</h3>
                <div className="space-y-3">
                  {selectedCard.address_line1 && (
                    <div>
                      <Label className="text-sm font-medium">Address</Label>
                      <p className="text-sm">{selectedCard.address_line1}</p>
                    </div>
                  )}
                  {selectedCard.city && (
                    <div>
                      <Label className="text-sm font-medium">City</Label>
                      <p className="text-sm">{selectedCard.city}</p>
                    </div>
                  )}
                  {selectedCard.region && (
                    <div>
                      <Label className="text-sm font-medium">Region</Label>
                      <p className="text-sm">{selectedCard.region}</p>
                    </div>
                  )}
                </div>

                {selectedCard.notes && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-sm font-medium">Notes</Label>
                      <p className="text-sm mt-1">{selectedCard.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Card Information</DialogTitle>
            <DialogDescription>
              Update information for card {selectedCard?.card_number}
            </DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    value={editingCard.customer_name || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        customer_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editingCard.customer_phone || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        customer_phone: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingCard.customer_email || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        customer_email: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-dob">Date of Birth</Label>
                  <Input
                    id="edit-dob"
                    type="date"
                    value={editingCard.date_of_birth || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        date_of_birth: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select
                    value={editingCard.gender || ""}
                    onValueChange={(value) =>
                      setEditingCard({ ...editingCard, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-id-type">ID Type</Label>
                  <Select
                    value={editingCard.id_type || ""}
                    onValueChange={(value) =>
                      setEditingCard({ ...editingCard, id_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select ID type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ghana_card">Ghana Card</SelectItem>
                      <SelectItem value="voters_id">Voter's ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="drivers_license">
                        Driver's License
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-id-number">ID Number</Label>
                  <Input
                    id="edit-id-number"
                    value={editingCard.id_number || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        id_number: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-id-expiry">ID Expiry Date</Label>
                  <Input
                    id="edit-id-expiry"
                    type="date"
                    value={editingCard.id_expiry_date || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        id_expiry_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editingCard.address_line1 || ""}
                    onChange={(e) =>
                      setEditingCard({
                        ...editingCard,
                        address_line1: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editingCard.city || ""}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, city: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-region">Region</Label>
                  <Input
                    id="edit-region"
                    value={editingCard.region || ""}
                    onChange={(e) =>
                      setEditingCard({ ...editingCard, region: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingCard.card_status || ""}
                    onValueChange={(value) =>
                      setEditingCard({ ...editingCard, card_status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editingCard.notes || ""}
                  onChange={(e) =>
                    setEditingCard({ ...editingCard, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditCard}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
