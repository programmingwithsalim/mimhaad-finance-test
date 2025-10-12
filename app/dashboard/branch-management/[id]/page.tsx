"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Edit, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BranchDetails } from "@/components/branch-management/branch-details"
import { DeleteBranchDialog } from "@/components/branch-management/delete-branch-dialog"
import { BranchForm } from "@/components/branch-management/branch-form"
import { useBranches, type Branch } from "@/hooks/use-branches"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function BranchDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { getBranchById, updateBranch, deleteBranch } = useBranches()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)

  useEffect(() => {
    async function loadBranch() {
      setLoading(true)
      setError(null)
      try {
        const branchData = await getBranchById(params.id)
        setBranch(branchData)
      } catch (err) {
        console.error("Failed to fetch branch:", err)
        setError("Failed to load branch details")
      } finally {
        setLoading(false)
      }
    }

    loadBranch()
  }, [params.id, getBranchById])

  const handleUpdateBranch = async (branchData: any) => {
    if (branch) {
      const updated = await updateBranch(branch.id, branchData)
      if (updated) {
        setBranch(updated)
        setOpenEditDialog(false)
      }
    }
  }

  const handleConfirmDelete = async () => {
    if (branch) {
      const success = await deleteBranch(branch.id)
      if (success) {
        router.push("/dashboard/branch-management")
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error || !branch) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 mb-4">{error || "Branch not found"}</div>
        <Button variant="outline" onClick={() => router.push("/dashboard/branch-management")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Branch Management
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.push("/dashboard/branch-management")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-3xl font-bold tracking-tight">Branch Details</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenEditDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setOpenDeleteDialog(true)}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <BranchDetails branch={branch} />

      {/* Edit Branch Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update the branch details.</DialogDescription>
          </DialogHeader>
          <BranchForm branch={branch} onSubmit={handleUpdateBranch} onCancel={() => setOpenEditDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Branch Dialog */}
      <DeleteBranchDialog
        branch={branch}
        open={openDeleteDialog}
        onOpenChange={setOpenDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
