"use client"

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createGLEntriesTable,
  deleteGLEntriesTable,
  fetchGLEntriesTableStatus,
  updateGLEntriesTable,
} from "@/lib/api/gl-entries-table"
import { Loader2, RefreshCw, Database } from "lucide-react"
import { useCurrentUser } from "@/hooks/use-current-user"

interface GLEntriesTableData {
  id: string
  name: string
  description: string
  branchId: string
  glAccountColumn: string
  descriptionColumn: string
  amountColumn: string
  dateColumn: string
  sheetName: string
  headerRowNumber: number
  active: boolean
}

const columns: ColumnDef<GLEntriesTableData>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "branchId",
    header: "Branch ID",
  },
  {
    accessorKey: "glAccountColumn",
    header: "GL Account Column",
  },
  {
    accessorKey: "descriptionColumn",
    header: "Description Column",
  },
  {
    accessorKey: "amountColumn",
    header: "Amount Column",
  },
  {
    accessorKey: "dateColumn",
    header: "Date Column",
  },
  {
    accessorKey: "sheetName",
    header: "Sheet Name",
  },
  {
    accessorKey: "headerRowNumber",
    header: "Header Row Number",
  },
  {
    accessorKey: "active",
    header: "Active",
    cell: ({ row }) => (row.original.active ? "Yes" : "No"),
  },
]

const FixGLEntriesTable = () => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [branchId, setBranchId] = useState("")
  const [glAccountColumn, setGlAccountColumn] = useState("")
  const [descriptionColumn, setDescriptionColumn] = useState("")
  const [amountColumn, setAmountColumn] = useState("")
  const [dateColumn, setDateColumn] = useState("")
  const [sheetName, setSheetName] = useState("")
  const [headerRowNumber, setHeaderRowNumber] = useState(0)
  const [active, setActive] = useState(false)
  const [selectedTable, setSelectedTable] = useState<GLEntriesTableData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { data: status, refetch } = useQuery({
    queryKey: ["gl-entries-table-status"],
    queryFn: fetchGLEntriesTableStatus,
    onError: (error: any) => {
      console.error("Error fetching GL Entries Table status:", error)
      toast({
        title: "Error fetching GL Entries Table status",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const { user } = useCurrentUser()
  const [testingGL, setTestingGL] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const testJumiaGLPosting = async () => {
    if (!user?.id) {
      setError("User ID not available")
      return
    }

    setTestingGL(true)
    setError(null)
    setSuccess(null)
    setTestResult(null)

    try {
      const response = await fetch("/api/debug/test-jumia-gl-posting-enhanced", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          branchId: user.branchId || "default-branch",
        }),
      })
      const data = await response.json()

      setTestResult(data)
      if (data.success) {
        setSuccess(`Test GL posting successful! Transaction ID: ${data.transactionId}`)
      } else {
        setError(data.error || "Failed to test GL posting")
      }
    } catch (err) {
      setError("Error testing GL posting: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setTestingGL(false)
    }
  }

  const createMutation = useMutation(createGLEntriesTable, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl-entries-table-status"] })
      toast({
        title: "Success!",
        description: "GL Entries Table created successfully.",
      })
      refetch()
    },
    onError: (error: any) => {
      console.error("Error creating GL Entries Table:", error)
      toast({
        title: "Error!",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const updateMutation = useMutation(updateGLEntriesTable, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl-entries-table-status"] })
      toast({
        title: "Success!",
        description: "GL Entries Table updated successfully.",
      })
      refetch()
    },
    onError: (error: any) => {
      console.error("Error updating GL Entries Table:", error)
      toast({
        title: "Error!",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation(deleteGLEntriesTable, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gl-entries-table-status"] })
      toast({
        title: "Success!",
        description: "GL Entries Table deleted successfully.",
      })
      refetch()
    },
    onError: (error: any) => {
      console.error("Error deleting GL Entries Table:", error)
      toast({
        title: "Error!",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const data = status?.exists ? [status.table] : []

  const table = useReactTable({
    data: data as GLEntriesTableData[],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const renderTableStructure = () => {
    if (!status?.exists) {
      return (
        <div className="flex flex-col space-y-4">
          <p>No GL Entries Table found. Create one now.</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Create GL Entries Table</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create GL Entries Table</DialogTitle>
                <DialogDescription>Create a new GL Entries Table to get started.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="branchId" className="text-right">
                    Branch ID
                  </Label>
                  <Input
                    id="branchId"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="glAccountColumn" className="text-right">
                    GL Account Column
                  </Label>
                  <Input
                    id="glAccountColumn"
                    value={glAccountColumn}
                    onChange={(e) => setGlAccountColumn(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="descriptionColumn" className="text-right">
                    Description Column
                  </Label>
                  <Input
                    id="descriptionColumn"
                    value={descriptionColumn}
                    onChange={(e) => setDescriptionColumn(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amountColumn" className="text-right">
                    Amount Column
                  </Label>
                  <Input
                    id="amountColumn"
                    value={amountColumn}
                    onChange={(e) => setAmountColumn(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dateColumn" className="text-right">
                    Date Column
                  </Label>
                  <Input
                    id="dateColumn"
                    value={dateColumn}
                    onChange={(e) => setDateColumn(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="sheetName" className="text-right">
                    Sheet Name
                  </Label>
                  <Input
                    id="sheetName"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="headerRowNumber" className="text-right">
                    Header Row Number
                  </Label>
                  <Input
                    type="number"
                    id="headerRowNumber"
                    value={headerRowNumber}
                    onChange={(e) => setHeaderRowNumber(Number(e.target.value))}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="active" className="text-right">
                    Active
                  </Label>
                  <Checkbox id="active" checked={active} onCheckedChange={(checked) => setActive(checked || false)} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={() => {
                    createMutation.mutate({
                      name,
                      description,
                      branchId,
                      glAccountColumn,
                      descriptionColumn,
                      amountColumn,
                      dateColumn,
                      sheetName,
                      headerRowNumber,
                      active,
                    })
                  }}
                >
                  {createMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Please wait
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            onClick={testJumiaGLPosting}
            disabled={testingGL || !status?.exists}
            variant="secondary"
            className="w-full"
          >
            {testingGL ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testing GL Posting...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Test Jumia GL Posting
              </>
            )}
          </Button>
        </div>
      )
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between p-4">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
          <div className="space-x-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Edit</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Edit GL Entries Table</DialogTitle>
                  <DialogDescription>
                    Make changes to your GL Entries Table here. Click save when you're done.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      defaultValue={status.table.name}
                      onChange={(e) => setName(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="description"
                      defaultValue={status.table.description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="branchId" className="text-right">
                      Branch ID
                    </Label>
                    <Input
                      id="branchId"
                      defaultValue={status.table.branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="glAccountColumn" className="text-right">
                      GL Account Column
                    </Label>
                    <Input
                      id="glAccountColumn"
                      defaultValue={status.table.glAccountColumn}
                      onChange={(e) => setGlAccountColumn(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="descriptionColumn" className="text-right">
                      Description Column
                    </Label>
                    <Input
                      id="descriptionColumn"
                      defaultValue={status.table.descriptionColumn}
                      onChange={(e) => setDescriptionColumn(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="amountColumn" className="text-right">
                      Amount Column
                    </Label>
                    <Input
                      id="amountColumn"
                      defaultValue={status.table.amountColumn}
                      onChange={(e) => setAmountColumn(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="dateColumn" className="text-right">
                      Date Column
                    </Label>
                    <Input
                      id="dateColumn"
                      defaultValue={status.table.dateColumn}
                      onChange={(e) => setDateColumn(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sheetName" className="text-right">
                      Sheet Name
                    </Label>
                    <Input
                      id="sheetName"
                      defaultValue={status.table.sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="headerRowNumber" className="text-right">
                      Header Row Number
                    </Label>
                    <Input
                      type="number"
                      id="headerRowNumber"
                      defaultValue={status.table.headerRowNumber}
                      onChange={(e) => setHeaderRowNumber(Number(e.target.value))}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="active" className="text-right">
                      Active
                    </Label>
                    <Checkbox
                      id="active"
                      defaultChecked={status.table.active}
                      onCheckedChange={(checked) => setActive(checked || false)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="submit"
                    onClick={() => {
                      updateMutation.mutate({
                        id: status.table.id,
                        name: name || status.table.name,
                        description: description || status.table.description,
                        branchId: branchId || status.table.branchId,
                        glAccountColumn: glAccountColumn || status.table.glAccountColumn,
                        descriptionColumn: descriptionColumn || status.table.descriptionColumn,
                        amountColumn: amountColumn || status.table.amountColumn,
                        dateColumn: dateColumn || status.table.dateColumn,
                        sheetName: sheetName || status.table.sheetName,
                        headerRowNumber: headerRowNumber || status.table.headerRowNumber,
                        active: active,
                      })
                    }}
                  >
                    {updateMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Please wait
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your GL Entries Table and remove your
                    data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteMutation.mutate(status.table.id)
                    }}
                  >
                    {deleteMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Please wait
                      </>
                    ) : (
                      "Delete"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    )
  }

  const renderTestResult = () => {
    if (!testResult) return null

    return (
      <div className="space-y-4 mt-4">
        <h3 className="text-lg font-medium">Test Result</h3>
        <div className="bg-muted p-3 rounded-md overflow-x-auto">
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">GL Entries Table</h1>
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-500">{success}</div>}
      {renderTableStructure()}
      {testResult && renderTestResult()}
    </div>
  )
}

export default FixGLEntriesTable
