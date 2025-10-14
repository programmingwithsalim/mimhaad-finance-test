"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export interface CardBatch {
  id: string;
  batch_code: string;
  inventory_type?: string;
  quantity_received: number;
  quantity_issued: number;
  quantity_available: number;
  card_type: string;
  unit_cost: number;
  total_cost: number;
  partner_bank_id: string;
  partner_bank_name: string;
  expiry_date: string;
  status: string;
  display_status: string;
  branch_id: string;
  branch_name: string;
  created_by: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CardIssuance {
  id: string;
  card_number: string;
  batch_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  date_of_birth?: string;
  gender?: string;
  id_type?: string;
  id_number?: string;
  card_status: string;
  issue_date: string;
  expiry_date: string;
  branch_id: string;
  issued_by: string;
  fee_charged: number;
  batch_number?: string;
  card_type?: string;
  created_at: string;
}

export interface WithdrawalTransaction {
  id: string;
  card_number: string;
  amount: number;
  transaction_type: string;
  status: string;
  processed_by: string;
  branch_id: string;
  transaction_date: string;
  created_at: string;
}

// Safe JSON parsing function
function safeJsonParse(response: Response): Promise<any> {
  return response.text().then((text) => {
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error("Failed to parse JSON:", text);
      throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
    }
  });
}

export function useCardBatches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<CardBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchId = user?.branchId;
  const userId = user?.id;
  const userName = user ? `${user.firstName} ${user.lastName}` : "Unknown User";
  const userRole = user?.role;

  const fetchBatches = async (selectedBranchId?: string) => {
    try {
      setLoading(true);
      setError(null);

      // For admins, always fetch all batches and filter on frontend
      // For non-admins, fetch only their branch's batches
      const targetBranchId = userRole === "Admin" ? "all" : branchId;

      console.log(
        `📖 Fetching batches for branch: ${targetBranchId}, user: ${userName}, role: ${userRole}`
      );

      const response = await fetch(
        `/api/e-zwich/batches?branchId=${targetBranchId}&userId=${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `HTTP error! status: ${response.status}, body: ${errorText}`
        );
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("API Response:", result);

      if (result.success) {
        let filteredBatches = result.data || [];

        // For admins, filter by selected branch if specified
        if (
          userRole === "Admin" &&
          selectedBranchId &&
          selectedBranchId !== "all"
        ) {
          filteredBatches = filteredBatches.filter(
            (batch: any) => batch.branch_id === selectedBranchId
          );
          console.log(
            `[ADMIN] Filtered to ${filteredBatches.length} batches for branch ${selectedBranchId}`
          );
        }

        setBatches(filteredBatches);
        console.log(
          `Successfully loaded ${filteredBatches.length} batches (${
            result.data?.length || 0
          } total)`
        );
      } else {
        const errorMsg =
          result.details || result.error || "Failed to fetch batches";
        console.error("API returned error:", errorMsg);
        setError(errorMsg);
        setBatches([]);
      }
    } catch (err) {
      console.error("Error fetching batches:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMsg);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const createBatch = async (batchData: {
    inventory_type?: string;
    quantity_received: number;
    card_type: string;
    unit_cost?: number;
    partner_bank_id?: string;
    partner_bank_name?: string;
    payment_method_id: string;
    expiry_date?: string;
    branch_id?: string; // Admin can specify branch
    notes?: string;
  }) => {
    try {
      // Generate a unique batch code if not provided
      const batchCode = `BATCH-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 4)
        .toUpperCase()}`;

      // Admin can create batches for any branch, others only for their branch
      const targetBranchId =
        userRole === "Admin" && batchData.branch_id
          ? batchData.branch_id
          : branchId;

      const completeData = {
        batch_code: batchCode,
        inventory_type: batchData.inventory_type || "e-zwich",
        quantity_received: batchData.quantity_received,
        card_type: batchData.card_type,
        unit_cost: batchData.unit_cost || 0,
        partner_bank_id: batchData.partner_bank_id,
        partner_bank_name: batchData.partner_bank_name,
        payment_method_id: batchData.payment_method_id,
        expiry_date: batchData.expiry_date,
        notes: batchData.notes || "",
        branch_id: targetBranchId,
        created_by: userId,
        userId: userId, // For audit logging
      };

      console.log("🆕 Creating batch with data:", completeData);

      const response = await fetch("/api/e-zwich/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeData),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Create batch HTTP error! status: ${response.status}, body: ${errorText}`
        );
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Create batch result:", result);

      if (result.success) {
        console.log("Batch created successfully");
        await fetchBatches(); // Refresh the list
        return result.data;
      } else {
        throw new Error(result.error || "Failed to create batch");
      }
    } catch (err) {
      console.error("Error creating batch:", err);
      throw err;
    }
  };

  const updateBatch = async (
    batchId: string,
    batchData: {
      batch_code: string;
      inventory_type?: string;
      quantity_received: number;
      card_type: string;
      unit_cost: number;
      partner_bank_id?: string;
      partner_bank_name?: string;
      expiry_date?: string;
      branch_id?: string;
      notes?: string;
    }
  ) => {
    try {
      console.log("Updating batch with data:", batchData);

      const response = await fetch(`/api/e-zwich/batches`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: batchId,
          ...batchData,
          created_by: userId,
        }),
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Update batch HTTP error! status: ${response.status}, body: ${errorText}`
        );
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Update batch result:", result);

      if (result.success) {
        console.log("Batch updated successfully");
        await fetchBatches(); // Refresh the list
        return result.data;
      } else {
        throw new Error(result.error || "Failed to update batch");
      }
    } catch (err) {
      console.error("Error updating batch:", err);
      throw err;
    }
  };

  const deleteBatch = async (batchId: string) => {
    try {
      console.log("🗑️ Deleting batch:", batchId);

      const response = await fetch(`/api/e-zwich/batches?id=${batchId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      console.log("Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Delete batch HTTP error! status: ${response.status}, body: ${errorText}`
        );
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const result = await response.json();
      console.log("Delete batch result:", result);

      if (result.success) {
        console.log("Batch deleted successfully");
        await fetchBatches(); // Refresh the list
        return result;
      } else {
        throw new Error(result.error || "Failed to delete batch");
      }
    } catch (err) {
      console.error("Error deleting batch:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [branchId]);

  return {
    batches,
    loading,
    error,
    fetchBatches,
    createBatch,
    updateBatch,
    deleteBatch,
  };
}

export function useIssuedCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardIssuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchId = user?.branchId;
  const userId = user?.id;

  const fetchCards = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/e-zwich/cards?branchId=${branchId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        setCards(result.data || []);
      } else {
        setError(result.details || result.error || "Failed to fetch cards");
      }
    } catch (err) {
      console.error("Error fetching cards:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const issueCard = async (cardData: any) => {
    try {
      const completeData = {
        ...cardData,
        branch_id: branchId,
        issued_by: userId || "635844ab-029a-43f8-8523-d7882915266a", // Use default if no user
        partner_bank: cardData.partner_bank, // Include partner bank
      };

      const response = await fetch("/api/e-zwich/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        await fetchCards(); // Refresh the list
        return result.data;
      } else {
        throw new Error(
          result.details || result.error || "Failed to issue card"
        );
      }
    } catch (err) {
      console.error("Error issuing card:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (user) {
      fetchCards();
    }
  }, [branchId, user]);

  return { cards, loading, error, fetchCards, issueCard };
}

export function useWithdrawals() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchId = user?.branchId || "branch-1";
  const userId = user?.id;

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/e-zwich/withdrawals?branchId=${branchId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        setWithdrawals(result.data || []);
      } else {
        setError(
          result.details || result.error || "Failed to fetch withdrawals"
        );
      }
    } catch (err) {
      console.error("Error fetching withdrawals:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  const processWithdrawal = async (withdrawalData: any) => {
    try {
      const completeData = {
        ...withdrawalData,
        branch_id: branchId,
        processed_by: userId || "635844ab-029a-43f8-8523-d7882915266a", // Use default if no user
      };

      const response = await fetch("/api/e-zwich/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        await fetchWithdrawals(); // Refresh the list
        return result.data;
      } else {
        throw new Error(
          result.details || result.error || "Failed to process withdrawal"
        );
      }
    } catch (err) {
      console.error("Error processing withdrawal:", err);
      throw err;
    }
  };

  const updateWithdrawal = async (withdrawalId: string, updateData: any) => {
    try {
      const response = await fetch(`/api/e-zwich/withdrawals/${withdrawalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        await fetchWithdrawals(); // Refresh the list
        return result.data;
      } else {
        throw new Error(
          result.details || result.error || "Failed to update withdrawal"
        );
      }
    } catch (err) {
      console.error("Error updating withdrawal:", err);
      throw err;
    }
  };

  const deleteWithdrawal = async (withdrawalId: string) => {
    try {
      const response = await fetch(`/api/e-zwich/withdrawals/${withdrawalId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        await fetchWithdrawals(); // Refresh the list
        return true;
      } else {
        throw new Error(
          result.details || result.error || "Failed to delete withdrawal"
        );
      }
    } catch (err) {
      console.error("Error deleting withdrawal:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (user) {
      fetchWithdrawals();
    }
  }, [branchId, user]);

  return {
    withdrawals,
    loading,
    error,
    fetchWithdrawals,
    processWithdrawal,
    updateWithdrawal,
    deleteWithdrawal,
  };
}

export function useEZwichStatistics() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branchId = user?.branchId || "branch-1";

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/e-zwich/statistics?branchId=${branchId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await safeJsonParse(response);

      if (result.success) {
        setStatistics(result.data);
      } else {
        setError(
          result.details || result.error || "Failed to fetch statistics"
        );
      }
    } catch (err) {
      console.error("Error fetching statistics:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStatistics();
    }
  }, [branchId, user]);

  return { statistics, loading, error, fetchStatistics };
}
