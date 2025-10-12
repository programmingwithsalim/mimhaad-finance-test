"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Sample users with branch assignments
const users = [
  {
    id: "1",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    branchId: "all", // Admin can access all branches
    avatar: "/placeholder.svg",
  },
  {
    id: "2",
    name: "Accra Branch Manager",
    email: "accra@example.com",
    role: "manager",
    branchId: "branch-1", // Accra branch
    avatar: "/placeholder.svg",
  },
  {
    id: "3",
    name: "Kumasi Agent",
    email: "kumasi@example.com",
    role: "agent",
    branchId: "branch-2", // Kumasi branch
    avatar: "/placeholder.svg",
  },
  {
    id: "4",
    name: "Tamale Agent",
    email: "tamale@example.com",
    role: "agent",
    branchId: "branch-3", // Tamale branch
    avatar: "/placeholder.svg",
  },
]

export function UserSelector() {
  const [open, setOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(users[0])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={selectedUser.avatar || "/placeholder.svg"} alt={selectedUser.name} />
              <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{selectedUser.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.id}
                  onSelect={() => {
                    setSelectedUser(user)
                    setOpen(false)
                    // Here you would typically update a global user context
                    // or store to reflect the selected user
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </div>
                  <Check className={cn("ml-auto h-4 w-4", selectedUser.id === user.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
