import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, UserCog, Edit, Trash2, KeyRound } from "lucide-react"
import Link from "next/link"

export function UserManagementGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management Guide</CardTitle>
        <CardDescription>Learn how to manage users in the system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Viewing Users</h3>
          <p className="text-sm text-muted-foreground">
            The user list displays all users in the system. You can search for users by name, email, or ID, and filter
            them by role, branch, or status.
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">Use the search bar at the top to quickly find users</span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Editing Users</h3>
          <p className="text-sm text-muted-foreground">
            To edit a user, click the user actions menu <UserCog className="inline h-4 w-4" /> and select{" "}
            <Edit className="inline h-4 w-4" /> Edit User. You can modify their personal information, role, branch, and
            status.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Deleting Users</h3>
          <p className="text-sm text-muted-foreground">
            To delete a user, click the user actions menu <UserCog className="inline h-4 w-4" /> and select{" "}
            <Trash2 className="inline h-4 w-4" /> Delete User. A confirmation dialog will appear before deletion.
          </p>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
            <p className="text-sm font-medium">Caution</p>
            <p className="text-xs">Deleting a user is permanent and cannot be undone. Consider deactivating instead.</p>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Resetting Passwords</h3>
          <p className="text-sm text-muted-foreground">
            If a user forgets their password, click the user actions menu <UserCog className="inline h-4 w-4" /> and
            select <KeyRound className="inline h-4 w-4" /> Reset Password. You can set a temporary password that the
            user will be required to change on next login.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
          <Button asChild variant="outline">
            <Link href="/profile">View Your Profile</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/user-management">Go to User Management</Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
