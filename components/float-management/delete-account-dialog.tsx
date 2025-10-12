"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Trash2, EyeOff, Lock } from "lucide-react";

interface FloatAccount {
  id: string;
  provider?: string;
  account_type: string;
  current_balance: number | string;
  branch_name?: string;
}

interface DeleteAccountDialogProps {
  account: FloatAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (force?: boolean) => void;
}

export function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
  onSuccess,
}: DeleteAccountDialogProps) {
  const { user } = useCurrentUser();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const isAdmin = user?.role === "Admin";
  const canForceDelete = isAdmin;
  const canSoftDelete = ["Admin", "Manager", "Finance"].includes(
    user?.role || ""
  );

  const handleSoftDelete = async () => {
    if (!account) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/float-accounts/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deactivate",
          is_active: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to deactivate account");
      }

      onSuccess(false);
    } catch (error) {
      console.error("Error deactivating account:", error);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleForceDelete = async () => {
    if (!account) return;

    // Validate password
    if (!password) {
      setPasswordError("Password is required");
      return;
    }

    setPasswordError("");

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/float-accounts/${account.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle specific password-related errors
        if (response.status === 401) {
          setPasswordError(
            "Incorrect password. Please enter your correct password."
          );
          return;
        }

        if (response.status === 400 && errorData.error?.includes("password")) {
          setPasswordError(errorData.error);
          return;
        }

        throw new Error(errorData.error || "Failed to delete account");
      }

      onSuccess(true);
      // Reset form
      setPassword("");
      setShowPasswordForm(false);
    } catch (error) {
      console.error("Error deleting account:", error);
      // Don't show password errors for general errors
      if (!passwordError) {
        throw error;
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = () => {
    if (isAdmin) {
      setShowPasswordForm(true);
    } else {
      handleForceDelete();
    }
  };

  const handleCancel = () => {
    setPassword("");
    setPasswordError("");
    setShowPasswordForm(false);
    onOpenChange(false);
  };

  if (!account) return null;

  const accountLabel = `${account.account_type}${
    account.provider ? ` (${account.provider})` : ""
  }`;
  const balance = Number(account.current_balance || 0);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {isAdmin ? "Delete Float Account" : "Deactivate Float Account"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-base">
                {isAdmin
                  ? "Are you sure you want to delete this float account? This action cannot be undone."
                  : "Are you sure you want to deactivate this float account? It will be hidden but data preserved."}
              </p>

              {/* Account Details */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Account Type:</span>
                  <span className="text-sm">{accountLabel}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Branch:</span>
                  <span className="text-sm">
                    {account.branch_name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">Current Balance:</span>
                  <span
                    className={`text-sm font-medium ${
                      balance > 0 ? "text-green-600" : "text-muted-foreground"
                    }`}
                  >
                    GHS {balance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Balance Warning */}
              {balance > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">Balance Warning</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    This account has a positive balance. Consider transferring
                    funds before deletion.
                  </p>
                </div>
              )}

              {/* Password Confirmation Form */}
              {showPasswordForm && isAdmin && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-red-800">
                    <Lock className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      Password Required
                    </span>
                  </div>
                  <p className="text-sm text-red-700">
                    To permanently delete this account, please enter your
                    password.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="mt-1"
                      />
                    </div>
                    {passwordError && (
                      <p className="text-sm text-red-600">{passwordError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Explanation */}
              <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                {isAdmin ? (
                  <div className="space-y-2">
                    <p>
                      <strong>Deactivate:</strong> Account will be hidden but
                      data preserved.
                    </p>
                    <p>
                      <strong>Delete:</strong> Account, GL mappings, and GL
                      accounts will be permanently removed.
                    </p>
                  </div>
                ) : (
                  <p>
                    The account will be deactivated and hidden from the
                    interface, but all data will be preserved. Only
                    administrators can permanently delete accounts.
                  </p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel
            disabled={isDeleting}
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </AlertDialogCancel>

          {/* Soft Delete Button (Deactivate) */}
          {canSoftDelete && !showPasswordForm && (
            <Button
              variant="outline"
              onClick={handleSoftDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              Deactivate Account
            </Button>
          )}

          {/* Force Delete Button (Admin Only) */}
          {canForceDelete && !showPasswordForm && (
            <Button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2 w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Delete Permanently
            </Button>
          )}

          {/* Confirm Delete Button (when password form is shown) */}
          {showPasswordForm && isAdmin && (
            <Button
              onClick={handleForceDelete}
              disabled={isDeleting || !password}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2 w-full sm:w-auto"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Confirm Deletion
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
