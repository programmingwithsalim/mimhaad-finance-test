"use client"

import { useState } from "react"
import type { Commission } from "@/lib/commission-types"
import { formatCurrency } from "@/lib/utils" // Updated import
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useCommissions } from "@/hooks/use-commissions"
import { useToast } from "@/components/ui/use-toast"
import { DollarSign, MessageSquare, Paperclip, Upload } from "lucide-react"

interface CommissionDetailsProps {
  commission: Commission
}

export function CommissionDetails({ commission }: CommissionDetailsProps) {
  const { addComment, markCommissionPaid } = useCommissions()
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleAddComment = async () => {
    if (!comment.trim()) return

    setIsSubmitting(true)
    try {
      await addComment(commission.id, comment)
      setComment("")
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully.",
      })
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: "There was an error adding your comment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkPaid = async () => {
    setIsSubmitting(true)
    try {
      await markCommissionPaid(commission.id, {
        method: "bank_transfer",
        receivedAt: new Date().toISOString(),
      })
      toast({
        title: "Commission marked as paid",
        description: "The commission has been marked as paid successfully.",
      })
    } catch (error) {
      console.error("Error marking commission as paid:", error)
      toast({
        title: "Error",
        description: "There was an error marking the commission as paid. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = () => {
    switch (commission.status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Pending
          </Badge>
        )
      case "paid":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Paid
          </Badge>
        )
      default:
        return <Badge variant="outline">{commission.status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium">Commission Details</h3>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider:</span>
              <span className="font-medium">{commission.source}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Month:</span>
              <span className="font-medium">{commission.month}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{formatCurrency(commission.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference:</span>
              <span className="font-medium">{commission.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span>{getStatusBadge()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">{new Date(commission.createdAt).toLocaleDateString()}</span>
            </div>
            {commission.description && (
              <div className="pt-2">
                <span className="text-muted-foreground">Description:</span>
                <p className="mt-1">{commission.description}</p>
              </div>
            )}
          </div>
        </div>

        <div>
          {commission.status === "paid" && (
            <>
              <h3 className="text-lg font-medium">Payment Information</h3>
              <div className="mt-3 space-y-2">
                {commission.payment ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method:</span>
                      <span className="font-medium">
                        {commission.payment.method === "auto_approved" ? "Auto Approved" : commission.payment.method}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Date:</span>
                      <span className="font-medium">
                        {commission.payment.receivedAt
                          ? new Date(commission.payment.receivedAt).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    {commission.payment.method === "auto_approved" && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                        <p className="text-blue-700 dark:text-blue-300 text-sm">
                          This commission was automatically approved when created by a manager.
                        </p>
                      </div>
                    )}
                    {commission.payment.referenceNumber && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reference:</span>
                        <span className="font-medium">{commission.payment.referenceNumber}</span>
                      </div>
                    )}
                    {commission.payment.notes && (
                      <div className="pt-2">
                        <span className="text-muted-foreground">Notes:</span>
                        <p className="mt-1">{commission.payment.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                    <p className="text-blue-700 dark:text-blue-300">No payment details available.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div>
        <h3 className="text-lg font-medium">Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {commission.status === "pending" && (
            <Button onClick={handleMarkPaid} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              <DollarSign className="mr-2 h-4 w-4" />
              Mark as Paid
            </Button>
          )}
          <Button variant="outline">
            <Paperclip className="mr-2 h-4 w-4" />
            Attachments
          </Button>
        </div>
      </div>

      <Separator />

      {/* Comments */}
      <div>
        <h3 className="text-lg font-medium">Comments</h3>
        <div className="mt-3 space-y-4">
          {commission.comments && commission.comments.length > 0 ? (
            <div className="space-y-4">
              {commission.comments.map((comment, index) => (
                <div key={index} className="bg-muted/40 p-3 rounded-md">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{comment.createdBy?.name || "Unknown User"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1">{comment.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No comments yet.</p>
          )}

          <div className="mt-4 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={isSubmitting}>
                <Upload className="mr-2 h-4 w-4" />
                Attach
              </Button>
              <Button size="sm" onClick={handleAddComment} disabled={!comment.trim() || isSubmitting}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
