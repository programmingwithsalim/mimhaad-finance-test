"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface UserFilterProps {
  selectedUsers: string[]
  setSelectedUsers: (users: string[]) => void
}

export function UserFilter({ selectedUsers, setSelectedUsers }: UserFilterProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/users")
        if (!response.ok) {
          throw new Error("Failed to fetch users")
        }
        const data = await response.json()
        setUsers(data.users || [])
      } catch (error) {
        console.error("Error fetching users:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const toggleUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId))
    } else {
      setSelectedUsers([...selectedUsers, userId])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">User</label>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
              {selectedUsers.length > 0 ? `${selectedUsers.length} selected` : "Select users..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search users..." />
              <CommandList>
                <CommandEmpty>No user found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.firstName} ${user.lastName} ${user.email}`}
                      onSelect={() => toggleUser(user.id)}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", selectedUsers.includes(user.id) ? "opacity-100" : "opacity-0")}
                      />
                      {`${user.firstName} ${user.lastName}`}
                      <span className="ml-2 text-xs text-muted-foreground">{user.email}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedUsers.map((userId) => {
            const user = users.find((u) => u.id === userId)
            return (
              <Badge key={userId} variant="outline" className="flex items-center gap-1">
                {user ? `${user.firstName} ${user.lastName}` : userId}
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => toggleUser(userId)}>
                  ×
                </Button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
